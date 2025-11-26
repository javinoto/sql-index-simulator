import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Play, RotateCcw, Database, Search, ArrowRight, Zap, ListFilter, HelpCircle, X, Layers, Clock, Activity, CheckCircle2 } from 'lucide-react';
import { GENERATED_DATA, QUERY_SQL, CREATE_INDEX_SQL, TARGET_AGE } from './constants';
import { SimulationMode, IndexEntry, SimulationStep, StepType, QueryStats, BTreeNode } from './types';
import { TableView } from './components/TableView';
import { IndexView } from './components/IndexView';

const App: React.FC = () => {
  // State
  const [data] = useState(GENERATED_DATA);
  const [hasIndex, setHasIndex] = useState(false);
  const [mode, setMode] = useState<SimulationMode>(SimulationMode.IDLE);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [stats, setStats] = useState<QueryStats>({ rowsScanned: 0, indexNodesVisited: 0, timeTaken: 0, resultsFound: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(500); // ms
  const [showInfo, setShowInfo] = useState(false);

  // Helper: Build B-Tree from flat sorted entries
  const buildBTree = (entries: IndexEntry[], leafSize = 5, branchingFactor = 3): BTreeNode | null => {
    if (entries.length === 0) return null;

    let nodeIdCounter = 1000;

    // 1. Create Leaf Layer
    let nodes: BTreeNode[] = [];
    for (let i = 0; i < entries.length; i += leafSize) {
      const chunk = entries.slice(i, i + leafSize);
      nodes.push({
        id: nodeIdCounter++,
        isLeaf: true,
        entries: chunk,
        children: [],
        keys: chunk.map(c => c.key),
        range: [chunk[0].key, chunk[chunk.length - 1].key]
      });
    }

    // 2. Build Internal Layers
    while (nodes.length > 1) {
      const newNodes: BTreeNode[] = [];
      for (let i = 0; i < nodes.length; i += branchingFactor) {
        const children = nodes.slice(i, i + branchingFactor);
        const min = children[0].range[0];
        const max = children[children.length - 1].range[1];
        
        // Use max key of each child (except last) as separators
        const separators = children.slice(0, -1).map(c => c.range[1]);

        const newNode: BTreeNode = {
          id: nodeIdCounter++,
          isLeaf: false,
          entries: [],
          children: children,
          keys: separators,
          range: [min, max]
        };
        
        // Link parent for visualization if needed
        children.forEach(c => c.parentId = newNode.id);
        
        newNodes.push(newNode);
      }
      nodes = newNodes;
    }

    return nodes[0];
  };

  // Derived State: The Index Structure
  const { indexTree } = useMemo(() => {
    if (!hasIndex) return { indexTree: null };
    const sorted = data
      .map((row, idx) => ({ key: row.age, rowId: row.id, originalIndex: idx }))
      .sort((a, b) => a.key - b.key);
    
    return { indexTree: buildBTree(sorted) };
  }, [data, hasIndex]);

  // Generate Simulation Steps
  const generateSteps = useCallback(() => {
    const newSteps: SimulationStep[] = [];
    
    if (!hasIndex) {
      // FULL TABLE SCAN
      data.forEach((row, idx) => {
        newSteps.push({
          type: StepType.SCAN_ROW,
          targetId: idx,
          description: `Scanning Row #${row.id} (Age: ${row.age})...`,
          isMatch: row.age === TARGET_AGE
        });
        if (row.age === TARGET_AGE) {
          newSteps.push({
            type: StepType.FOUND_MATCH,
            targetId: idx,
            description: `Match found! Age is ${TARGET_AGE}. Adding to result set.`,
          });
        }
      });
      newSteps.push({ type: StepType.FINISHED, description: "Full Table Scan Complete." });
    } else if (indexTree) {
      // B-TREE SEARCH
      let currentNode = indexTree;
      
      // Traverse down
      while (currentNode) {
        newSteps.push({
            type: StepType.CHECK_NODE,
            targetId: currentNode.id,
            description: currentNode.isLeaf 
                ? `Reached Leaf Node [${currentNode.range[0]} - ${currentNode.range[1]}]. Scanning entries...`
                : `Visiting Node [${currentNode.range[0]} - ${currentNode.range[1]}]. Evaluating path...`
        });

        if (currentNode.isLeaf) {
            // Scan Leaf Entries
            let foundInNode = false;
            for (const entry of currentNode.entries) {
                const isMatch = entry.key === TARGET_AGE;
                newSteps.push({
                    type: StepType.CHECK_ENTRY,
                    targetId: currentNode.id,
                    entryId: entry.key,
                    description: `Comparing: ${entry.key} vs ${TARGET_AGE} ${isMatch ? '(MATCH)' : ''}`,
                    isMatch
                });

                if (isMatch) {
                    foundInNode = true;
                    // Go to table
                    newSteps.push({
                        type: StepType.FETCH_ROW,
                        targetId: entry.originalIndex,
                        description: `Using Pointer -> Fetching Row #${entry.rowId} from Heap.`,
                    });
                    newSteps.push({
                        type: StepType.FOUND_MATCH,
                        targetId: entry.originalIndex,
                        description: `Row #${entry.rowId} added to results.`,
                    });
                } else if (entry.key > TARGET_AGE && foundInNode) {
                    newSteps.push({
                        type: StepType.FINISHED,
                        description: `Key ${entry.key} > ${TARGET_AGE}. Stopping search.`
                    });
                    setSteps(newSteps);
                    setMode(SimulationMode.INDEX_SEEK);
                    setCurrentStepIndex(0);
                    setIsPlaying(true);
                    setStats({ rowsScanned: 0, indexNodesVisited: 0, timeTaken: 0, resultsFound: 0 });
                    return; 
                }
            }
            break; // Finished leaf
        } else {
            // Internal Node Logic: Explicit comparison steps
            let foundPath = false;
            
            for (let i = 0; i < currentNode.keys.length; i++) {
                const key = currentNode.keys[i];
                const child = currentNode.children[i];
                
                // Compare Step
                const isLessOrEqual = TARGET_AGE <= key;
                newSteps.push({
                    type: StepType.CHECK_INTERNAL_KEY,
                    targetId: currentNode.id,
                    entryId: key, // Using entryId to highlight the key
                    compareValue: key,
                    compareResult: isLessOrEqual,
                    description: `Is ${TARGET_AGE} <= ${key}? ${isLessOrEqual ? 'Yes (Go Left)' : 'No (Check Next)'}`
                });

                if (isLessOrEqual) {
                    // Traverse Step
                    newSteps.push({
                        type: StepType.TRAVERSE_EDGE,
                        targetId: currentNode.id,
                        childId: child.id,
                        description: `Following pointer to Child Node [${child.range[0]}-${child.range[1]}]`
                    });
                    currentNode = child;
                    foundPath = true;
                    break;
                }
            }

            if (!foundPath) {
                // If larger than all keys, go to last child
                const lastChild = currentNode.children[currentNode.children.length - 1];
                const lastKey = currentNode.keys[currentNode.keys.length - 1];
                
                newSteps.push({
                    type: StepType.CHECK_INTERNAL_KEY,
                    targetId: currentNode.id,
                    compareValue: lastKey,
                    compareResult: false,
                    description: `${TARGET_AGE} > All Keys. Going to Rightmost Child.`
                });

                newSteps.push({
                    type: StepType.TRAVERSE_EDGE,
                    targetId: currentNode.id,
                    childId: lastChild.id,
                    description: `Following pointer to Child Node [${lastChild.range[0]}-${lastChild.range[1]}]`
                });
                currentNode = lastChild;
            }
        }
      }
      
      newSteps.push({ type: StepType.FINISHED, description: "Index Seek Complete." });
    }

    setSteps(newSteps);
    setMode(hasIndex ? SimulationMode.INDEX_SEEK : SimulationMode.FULL_SCAN);
    setCurrentStepIndex(0);
    setIsPlaying(true);
    setStats({ rowsScanned: 0, indexNodesVisited: 0, timeTaken: 0, resultsFound: 0 });
  }, [data, hasIndex, indexTree]);

  // Playback Loop
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isPlaying && currentStepIndex < steps.length) {
      timer = setTimeout(() => {
        const step = steps[currentStepIndex];
        setStats(prev => {
           const s = { ...prev };
           s.timeTaken += hasIndex ? 2 : 10; 
           if (step.type === StepType.SCAN_ROW || step.type === StepType.FETCH_ROW) s.rowsScanned++;
           if (step.type === StepType.CHECK_NODE) s.indexNodesVisited++;
           if (step.type === StepType.FOUND_MATCH) s.resultsFound++;
           return s;
        });

        if (currentStepIndex >= steps.length - 1) {
          setIsPlaying(false);
          setMode(SimulationMode.IDLE);
        } else {
          setCurrentStepIndex(prev => prev + 1);
        }
      }, playbackSpeed);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, steps, playbackSpeed, hasIndex]);

  // Actions
  const handleRun = () => {
    generateSteps();
  };

  const handleReset = () => {
    setIsPlaying(false);
    setMode(SimulationMode.IDLE);
    setCurrentStepIndex(-1);
    setSteps([]);
    setStats({ rowsScanned: 0, indexNodesVisited: 0, timeTaken: 0, resultsFound: 0 });
  };

  const toggleIndex = () => {
    handleReset();
    setHasIndex(!hasIndex);
  };

  // derived values for UI
  const activeStep = steps[currentStepIndex];

  return (
    <div className="flex h-screen w-screen bg-[#0B0F19] text-slate-100 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* Help Modal */}
      {showInfo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-[#161b2e] rounded-2xl border border-slate-700/50 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-[#161b2e] sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Database className="text-blue-400" size={24} />
                        </div>
                        Index Strategy Explained
                    </h2>
                    <button onClick={() => setShowInfo(false)} className="text-slate-400 hover:text-white transition-colors hover:bg-slate-800 p-2 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-8 space-y-8 text-slate-300 leading-relaxed">
                    <div className="space-y-4">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                           <Layers size={20} className="text-blue-500"/>
                           The B-Tree Structure
                        </h3>
                        <p className="text-slate-400">
                            Instead of a simple list, real databases use a <strong>B-Tree (Balanced Tree)</strong>. This allows the database to skip huge chunks of data by navigating through "branches" (Internal Nodes) to find the specific "leaf" containing the data.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                            <div className="text-yellow-400 font-bold mb-3 uppercase text-xs tracking-wider flex items-center gap-2">
                                <Search size={14}/> The Value
                            </div>
                            <p className="text-sm text-slate-400">
                                This is the sorted copy of the column you indexed (e.g., <span className="font-mono text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded text-xs">AGE</span>). The database searches this first because it's sorted and fast.
                            </p>
                        </div>
                        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50 hover:border-green-500/30 transition-colors">
                            <div className="text-green-400 font-bold mb-3 uppercase text-xs tracking-wider flex items-center gap-2">
                                <ArrowRight size={14}/> The Pointer
                            </div>
                            <p className="text-sm text-slate-400">
                                This is the <span className="font-mono text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded text-xs">ROW ID</span>. It's the "address" of the full data. Once the value is found in the index, this pointer tells the database exactly where to grab the full row.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-700/50 bg-[#111625] text-right">
                    <button onClick={() => setShowInfo(false)} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20">
                        Understood
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar - Expanded & Modernized */}
      <div className="w-[400px] flex-shrink-0 bg-[#111625] border-r border-slate-800/60 flex flex-col z-30 shadow-2xl">
        <div className="p-8 pb-4">
            <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-3 text-blue-400">
                    <div className="p-2 bg-blue-500/10 rounded-xl">
                        <Database size={24} />
                    </div>
                    <span className="font-bold tracking-tight text-white text-lg">SQL Simulator</span>
                </div>
                <button 
                    onClick={() => setShowInfo(true)} 
                    className="text-slate-500 hover:text-white transition-colors"
                >
                    <HelpCircle size={20} />
                </button>
            </div>
            <p className="text-sm text-slate-500 mt-2">
                Visualize database performance differences between Heaps and B-Tree Indexes.
            </p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6 scrollbar-hide">
            {/* Query Card */}
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 shadow-inner group transition-all hover:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Query</label>
                    <span className="bg-green-500/10 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-green-500/20">SELECT</span>
                </div>
                <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 font-mono text-sm text-slate-300 break-all shadow-sm group-hover:border-slate-700 transition-colors">
                    <span className="text-purple-400">SELECT</span> * <span className="text-purple-400">FROM</span> users <br/>
                    <span className="text-purple-400">WHERE</span> age = <span className="text-yellow-400">{TARGET_AGE}</span>;
                </div>
            </div>

            {/* Index Toggle Card */}
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-1 shadow-inner">
                <button 
                    onClick={toggleIndex}
                    disabled={mode !== SimulationMode.IDLE}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-300 flex items-center justify-between group ${hasIndex ? 'bg-[#111625] border-blue-500/50' : 'bg-[#111625] border-transparent hover:border-slate-700'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${hasIndex ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-500'}`}>
                            {hasIndex ? <Zap size={24} fill="currentColor"/> : <ListFilter size={24}/>}
                        </div>
                        <div className="text-left">
                            <div className={`font-bold text-sm ${hasIndex ? 'text-white' : 'text-slate-400'}`}>
                                {hasIndex ? 'Index Active' : 'No Index'}
                            </div>
                            <div className="text-xs text-slate-600 font-medium mt-0.5">
                                {hasIndex ? 'Strategy: B-Tree Seek' : 'Strategy: Full Scan'}
                            </div>
                        </div>
                    </div>
                    <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${hasIndex ? 'bg-blue-600' : 'bg-slate-800'}`}>
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${hasIndex ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </button>
            </div>

            {/* Stats Grid */}
            <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block px-1">Performance Metrics</label>
                 <div className="grid grid-cols-2 gap-3">
                     <BigStat 
                        label="Rows Scanned" 
                        value={stats.rowsScanned} 
                        icon={<Activity size={14}/>} 
                        active={mode !== SimulationMode.IDLE}
                     />
                     <BigStat 
                        label="Cost Estimate" 
                        value={stats.timeTaken} 
                        unit="units"
                        icon={<Clock size={14}/>} 
                        color="text-yellow-400"
                        active={mode !== SimulationMode.IDLE}
                     />
                     <BigStat 
                        label="Nodes Visited" 
                        value={stats.indexNodesVisited} 
                        icon={<Layers size={14}/>} 
                        highlight={hasIndex} 
                        active={mode !== SimulationMode.IDLE}
                     />
                     <BigStat 
                        label="Matches" 
                        value={stats.resultsFound} 
                        icon={<CheckCircle2 size={14}/>} 
                        color="text-green-400"
                        active={mode !== SimulationMode.IDLE}
                     />
                 </div>
            </div>
        </div>

        {/* Footer / Playback */}
        <div className="p-6 border-t border-slate-800/60 bg-[#111625] space-y-4">
            <div className="flex items-center justify-between">
                <button 
                    onClick={handleReset}
                    className="p-3 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                    title="Reset Simulation"
                >
                    <RotateCcw size={20} />
                </button>
                
                {(!isPlaying && currentStepIndex === -1) || (currentStepIndex >= steps.length - 1 && steps.length > 0) ? (
                     <button 
                     onClick={handleRun}
                     className="flex-1 mx-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all hover:translate-y-[-2px] active:translate-y-[0px]"
                 >
                     <Play size={18} fill="currentColor" />
                     <span>Start Execution</span>
                 </button>
                ) : (
                    <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex-1 mx-4 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${isPlaying ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/50' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/50'}`}
                >
                    {isPlaying ? <span>Pause</span> : <span className="flex items-center gap-2"><Play size={18} fill="currentColor"/> Resume</span>}
                </button>
                )}

                 <div className="w-10"></div> {/* Spacer for center alignment */}
            </div>

            <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 min-w-[40px]">Speed</span>
                <input 
                    type="range" 
                    min="50" 
                    max="1000" 
                    step="50"
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    value={1050 - playbackSpeed} // Invert so right is faster
                    onChange={(e) => setPlaybackSpeed(1050 - parseInt(e.target.value))}
                />
            </div>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="flex-1 relative flex flex-col bg-gradient-to-br from-[#0B0F19] via-[#0f1524] to-[#0B0F19]">
          
          {/* Floating Status Bar */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 pointer-events-none">
             <div className={`
                bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-2xl flex items-center gap-4 transition-all duration-500
                ${activeStep ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
             `}>
                <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center shadow-lg
                    ${activeStep?.type === StepType.FOUND_MATCH ? 'bg-green-500 text-black' : 
                      activeStep?.type === StepType.CHECK_NODE ? 'bg-yellow-500 text-black' : 
                      'bg-blue-600 text-white'}
                `}>
                    {activeStep?.type === StepType.FOUND_MATCH ? <CheckCircle2 size={24}/> :
                     activeStep?.type === StepType.CHECK_NODE ? <Zap size={24} fill="currentColor"/> :
                     <Activity size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Current Operation</div>
                    <div className="text-sm font-medium text-slate-200 truncate pr-4">
                        {activeStep?.description}
                    </div>
                </div>
             </div>
          </div>

          {/* Visualization Canvas */}
          <div className="flex-1 overflow-hidden flex pt-28 px-8 pb-8 gap-8">
                {/* Index Column */}
                <div className={`transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col ${hasIndex ? 'flex-[1.2] opacity-100 translate-x-0' : 'flex-0 w-0 opacity-0 -translate-x-20 overflow-hidden'}`}>
                    <div className="bg-[#111625] border border-slate-700/50 rounded-t-2xl p-4 flex items-center justify-between shadow-lg z-10">
                        <span className="font-bold text-sm text-yellow-400 flex items-center gap-2">
                             <Zap size={16} fill="currentColor"/> B-Tree Index
                        </span>
                        <div className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">LOG(N) Complexity</div>
                    </div>
                    {/* Index Container with Hidden Overflow for Pan/Zoom */}
                    <div className="flex-1 bg-slate-900/30 border-x border-b border-slate-800/50 rounded-b-2xl overflow-hidden p-0 relative">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/5 via-transparent to-transparent pointer-events-none z-0"></div>
                        <IndexView 
                            rootNode={indexTree} 
                            activeStep={activeStep}
                            steps={steps}
                            currentStepIndex={currentStepIndex}
                        />
                    </div>
                </div>

                {/* Table Column */}
                <div className="flex-1 flex flex-col relative min-w-[300px]">
                     {hasIndex && activeStep?.type === StepType.FETCH_ROW && (
                        <div className="absolute -left-6 top-1/2 z-50 pointer-events-none">
                             <div className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg shadow-blue-900/50 font-bold flex items-center gap-2 animate-bounce-horizontal">
                                <ArrowRight size={14}/> POINTER
                             </div>
                        </div>
                     )}
                    
                    <div className="bg-[#111625] border border-slate-700/50 rounded-t-2xl p-4 flex items-center justify-between shadow-lg z-10">
                        <span className="font-bold text-sm text-blue-300 flex items-center gap-2">
                            <Database size={16} /> Heap Table
                        </span>
                         <div className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">{data.length} Rows</div>
                    </div>
                    
                    <div className="flex-1 bg-slate-900/30 border-x border-b border-slate-800/50 rounded-b-2xl overflow-y-auto p-4 relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/5 via-transparent to-transparent pointer-events-none"></div>
                        <TableView 
                            data={data} 
                            activeStep={activeStep}
                            hasIndex={hasIndex}
                        />
                    </div>
                </div>
          </div>
      </div>
    </div>
  );
};

// Sub-components
const BigStat = ({ label, value, unit, icon, highlight, color = "text-white", active }: { label: string, value: number, unit?: string, icon?: React.ReactNode, highlight?: boolean, color?: string, active?: boolean }) => (
    <div className={`p-4 rounded-xl border transition-all duration-500 ${highlight ? 'bg-blue-500/10 border-blue-500/50' : 'bg-[#0B0F19] border-slate-800'}`}>
        <div className="flex items-center gap-2 mb-2 text-slate-500">
            {icon}
            <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
        </div>
        <div className={`text-2xl font-mono font-light tracking-tighter ${color} flex items-baseline gap-1`}>
            {value}
            {unit && <span className="text-xs text-slate-600 font-sans font-bold">{unit}</span>}
        </div>
    </div>
);

export default App;