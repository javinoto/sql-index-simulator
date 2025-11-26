import React, { useEffect, useRef, useState, useMemo } from 'react';
import { BTreeNode, SimulationStep, StepType } from '../types';
import { ZoomIn, ZoomOut, Move, Zap } from 'lucide-react';

interface IndexViewProps {
  rootNode: BTreeNode | null;
  activeStep?: SimulationStep;
  steps: SimulationStep[];
  currentStepIndex: number;
}

export const IndexView: React.FC<IndexViewProps> = ({ rootNode, activeStep, steps, currentStepIndex }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  
  // View State for Pan & Zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.9 });
  const [initialized, setInitialized] = useState(false);

  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startTranslate = useRef({ x: 0, y: 0 });

  // Determine Visible Nodes & Edges based on simulation progress
  const visibilityState = useMemo(() => {
    // If no active simulation step, show everything (e.g., initial view after creation)
    if (!activeStep && steps.length === 0) {
        return { visibleNodes: new Set<number>(), visibleEdges: new Set<string>(), showAll: true };
    }

    const vNodes = new Set<number>();
    const vEdges = new Set<string>(); // Format: "parentId-childId"

    // Always show root if it exists
    if (rootNode) vNodes.add(rootNode.id);

    // Replay steps up to current index
    for (let i = 0; i <= currentStepIndex; i++) {
        const step = steps[i];
        if (step.type === StepType.CHECK_NODE && step.targetId) {
            vNodes.add(step.targetId);
        }
        if (step.type === StepType.TRAVERSE_EDGE && step.targetId && step.childId) {
            vEdges.add(`${step.targetId}-${step.childId}`);
            vNodes.add(step.childId); // Ensure child is visible when traversed
        }
    }

    return { visibleNodes: vNodes, visibleEdges: vEdges, showAll: false };
  }, [activeStep, steps, currentStepIndex, rootNode]);

  // Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    startTranslate.current = { x: transform.x, y: transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTransform(prev => ({ ...prev, x: startTranslate.current.x + dx, y: startTranslate.current.y + dy }));
  };

  const handleMouseUp = () => setIsDragging(false);

  const adjustZoom = (delta: number) => {
     setTransform(prev => ({ ...prev, scale: Math.max(0.1, Math.min(2, prev.scale + delta)) }));
  };

  // Helper to center a node
  const centerNode = (targetId: number | null, targetScale: number = 1) => {
    if (!containerRef.current || !contentRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

    let logicalCx = 0;
    let logicalCy = 0;

    if (targetId && nodeRefs.current[targetId]) {
      const nodeEl = nodeRefs.current[targetId]!;
      const nodeRect = nodeEl.getBoundingClientRect();
      logicalCx = (nodeRect.left + nodeRect.width / 2 - contentRect.left) / transform.scale;
      logicalCy = (nodeRect.top + nodeRect.height / 2 - contentRect.top) / transform.scale;
    } else {
        // Default: Top Center
        logicalCx = contentRef.current.offsetWidth / 2;
        logicalCy = 150; 
    }

    const newX = (containerRect.width / 2) - (logicalCx * targetScale);
    const newY = (containerRect.height / 2) - (logicalCy * targetScale);

    setTransform({ x: newX, y: newY, scale: targetScale });
  };

  // Effect: React to Steps or Initial Load
  useEffect(() => {
    if (!rootNode) return;

    if (!initialized) {
        setTimeout(() => {
            centerNode(rootNode.id, 0.9);
            setInitialized(true);
        }, 100);
        return;
    }

    if (activeStep) {
        if (activeStep.type === StepType.CHECK_NODE || activeStep.type === StepType.CHECK_ENTRY || activeStep.type === StepType.CHECK_INTERNAL_KEY) {
            centerNode(activeStep.targetId!, 1.1);
        } else if (activeStep.type === StepType.FINISHED) {
             centerNode(rootNode.id, 0.75); 
        }
    }
  }, [activeStep, rootNode, initialized]);


  if (!rootNode) return (
      <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-50">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
              <span className="text-2xl">?</span>
          </div>
          <p className="font-mono text-sm">Index Not Created</p>
      </div>
  );

  const isVisible = (nodeId: number) => visibilityState.showAll || visibilityState.visibleNodes.has(nodeId);
  const isEdgeVisible = (parentId: number, childId: number) => visibilityState.showAll || visibilityState.visibleEdges.has(`${parentId}-${childId}`);

  return (
    <div 
        ref={containerRef} 
        className={`relative w-full h-full overflow-hidden flex items-start justify-center bg-[#0B0F19] transition-cursor duration-200 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
            style={{ 
                backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                transform: `translate(${transform.x % 40}px, ${transform.y % 40}px)`
            }} 
        />

      <div 
        ref={contentRef}
        className="absolute top-0 left-0 transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] origin-top-left will-change-transform pt-20"
        style={{ transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})` }}
      >
          <TreeLevel 
            nodes={[rootNode]} 
            activeStep={activeStep} 
            nodeRefs={nodeRefs} 
            isVisible={isVisible}
            isEdgeVisible={isEdgeVisible}
            isRoot={true}
          />
      </div>

       <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
             <button onClick={(e) => { e.stopPropagation(); adjustZoom(0.1); }} className="p-3 bg-[#111625] hover:bg-slate-800 text-cyan-400 rounded-xl shadow-lg border border-slate-700/50 transition-all hover:scale-105" title="Zoom In">
                <ZoomIn size={20} />
             </button>
             <button onClick={(e) => { e.stopPropagation(); adjustZoom(-0.1); }} className="p-3 bg-[#111625] hover:bg-slate-800 text-cyan-400 rounded-xl shadow-lg border border-slate-700/50 transition-all hover:scale-105" title="Zoom Out">
                <ZoomOut size={20} />
             </button>
             <button onClick={(e) => { e.stopPropagation(); centerNode(rootNode?.id || null, 0.9); }} className="p-3 bg-[#111625] hover:bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700/50 transition-all hover:scale-105 mt-2" title="Reset View">
                <Move size={20} />
             </button>
        </div>
    </div>
  );
};

// Recursive Tree Level Component
const TreeLevel: React.FC<{ 
    nodes: BTreeNode[], 
    activeStep?: SimulationStep, 
    nodeRefs: React.MutableRefObject<{[key: number]: HTMLDivElement | null}>,
    isVisible: (id: number) => boolean,
    isEdgeVisible: (pId: number, cId: number) => boolean,
    isRoot?: boolean
}> = ({ nodes, activeStep, nodeRefs, isVisible, isEdgeVisible, isRoot = false }) => {
    if (!nodes || nodes.length === 0) return null;

    return (
        <div className="flex justify-center gap-16">
            {nodes.map((node, index) => {
                const visible = isVisible(node.id);
                const parentId = node.parentId;
                
                // --- ACTIVE PATH LOGIC ---
                // Check if we are currently traversing an edge FROM this node's parent TO this node
                const isTraversingThisEdge = activeStep?.type === StepType.TRAVERSE_EDGE && activeStep.childId === node.id;
                
                // Check if we are traversing FROM this node to one of its children
                const isTraversingFromThisNode = activeStep?.type === StepType.TRAVERSE_EDGE && activeStep.targetId === node.id;
                
                // Check if this path was previously visited
                const edgeVisited = parentId ? isEdgeVisible(parentId, node.id) : false;
                
                // --- PARENT DROP LINE LOGIC ---
                // Should the line dropping down from THIS node be highlighted?
                // Yes, if we are currently traversing from this node to ANY child.
                const hasVisibleChildren = node.children.some(c => isEdgeVisible(node.id, c.id));
                const dropLineActive = isTraversingFromThisNode || hasVisibleChildren;
                
                const dropLineColor = isTraversingFromThisNode 
                    ? 'bg-white shadow-[0_0_10px_white,0_0_5px_cyan]' 
                    : (dropLineActive ? 'bg-cyan-500 shadow-[0_0_5px_#06b6d4]' : 'bg-slate-800');

                return (
                    <div key={node.id} className="flex flex-col items-center relative">
                        {/* CONNECTOR LINES (From Parent -> Bus -> This Node) */}
                        {!isRoot && parentId && (
                            <ConnectorLines 
                                index={index}
                                total={nodes.length}
                                isActive={edgeVisited}
                                isTraversing={isTraversingThisEdge}
                            />
                        )}

                        {/* NODE CONTENT */}
                        <div className={`
                            relative z-10 transition-all duration-700 ease-out 
                            ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-90 pointer-events-none'}
                        `}>
                            <BTreeNodeComponent 
                                node={node} 
                                activeStep={activeStep}
                                nodeRef={el => { nodeRefs.current[node.id] = el; }}
                                isRoot={isRoot}
                            />
                            
                            {/* DROP LINE (From This Node -> Bus) */}
                            {/* Only render if children exist */}
                            {node.children.length > 0 && (
                                <div className="absolute left-1/2 -translate-x-1/2 -bottom-10 h-10 w-0.5 z-0 overflow-visible flex flex-col justify-start">
                                     <div className={`w-full h-full transition-colors duration-300 ${dropLineColor}`}></div>
                                </div>
                            )}
                        </div>

                        {/* CHILDREN RECURSION */}
                        {node.children.length > 0 && (
                            // Add padding-top to create the gap where connectors live
                            // Gap breakdown: 
                            // - Node Bottom
                            // - 40px Drop Line (handled by absolute above)
                            // - 40px Connector Line (handled by children)
                            // Total visual gap is 80px.
                            // We use pt-20 (80px) on the wrapper.
                             <div className="pt-20">
                                <TreeLevel 
                                    nodes={node.children} 
                                    activeStep={activeStep} 
                                    nodeRefs={nodeRefs} 
                                    isVisible={isVisible}
                                    isEdgeVisible={isEdgeVisible}
                                />
                             </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// Visual Connector Lines Component (Distributed Bus Logic)
const ConnectorLines: React.FC<{ 
    index: number,
    total: number,
    isActive: boolean,
    isTraversing: boolean 
}> = ({ index, total, isActive, isTraversing }) => {
    // Height of the connector area: 40px (h-10)
    // It sits exactly above the node.
    // The "Bus" line is at the top of this area (y=0).
    
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const isOnly = total === 1;
    const isMiddle = !isFirst && !isLast;
    
    // Calculate center relative to sibling group
    // The Parent Drop Line hits the center of the group.
    // So we need to draw a line from OUR center up to the bus, and then along the bus to the group center.
    
    const baseClass = "transition-all duration-300 ease-in-out absolute";
    
    // Styles
    const traversingColor = "bg-white shadow-[0_0_10px_white,0_0_5px_cyan] z-20";
    const activeColor = "bg-cyan-500 shadow-[0_0_5px_#06b6d4] z-10";
    const inactiveColor = "bg-slate-800 z-0";
    
    const colorClass = isTraversing ? traversingColor : (isActive ? activeColor : inactiveColor);
    
    // Specific Highlight Logic for the "Arm" (Horizontal part)
    // If traversing, the electricity flows from Parent (Center) -> Node.
    // So the arm leading to this node should light up.
    // If just Active (visited), it stays lit.

    return (
        <div className="absolute -top-10 left-0 w-full h-10 pointer-events-none">
            
            {/* 1. VERTICAL STEM (From Node Up to Bus) */}
            <div className={`
                ${baseClass}
                left-1/2 -translate-x-1/2 bottom-0 w-0.5 h-full
                ${colorClass}
            `}></div>
            
            {/* 2. HORIZONTAL BUS ARM (Connecting Stem to Center) */}
            {/* If Only Child: No arm needed, just stem goes all the way up? 
                Actually, the Parent Drop ends at Y=0 (top of this box). 
                The Stem goes from Bottom to Top. They meet perfectly. 
            */}

            {/* If Multiple Children: We need arms to reach the center. */}
            
            {/* LEFT CHILDREN (Index < Middle): Arm goes RIGHT */}
            {/* Logic: If I am to the left, I need a line from my center (50%) to the Right edge (100% + gap?) 
                Wait, flexbox centers the parent above the group.
                So "Center" is the midpoint of the container.
                
                CSS Trick:
                - First Child: Arm from 50% to 100% (Right).
                - Last Child: Arm from 0% (Left) to 50%.
                - Middle Child: Arm from 0% to 100%. 
                
                Wait, this assumes the parent is exactly centered between First and Last.
                This holds true for `justify-center`.
            */}
            
            {!isOnly && (
                <>
                    {/* Right Arm (For First/Middle nodes to reach center/next sibling) */}
                    {!isLast && (
                        <div className={`
                            ${baseClass} h-0.5 top-0 right-0
                            ${isFirst ? 'left-1/2 rounded-tl-lg' : 'left-0'} 
                            ${colorClass}
                        `}></div>
                    )}

                    {/* Left Arm (For Last/Middle nodes to reach center/prev sibling) */}
                    {!isFirst && (
                        <div className={`
                            ${baseClass} h-0.5 top-0 left-0
                            ${isLast ? 'right-1/2 rounded-tr-lg' : 'right-0'}
                            ${colorClass}
                        `}></div>
                    )}
                </>
            )}
            
            {/* CORNER SMOOTHING (Optional overlays to make 90deg turns look rounder if not using border-radius) 
                We used rounded-tl-lg / rounded-tr-lg above on the bars themselves.
            */}
        </div>
    );
};

const BTreeNodeComponent: React.FC<{ 
    node: BTreeNode, 
    activeStep?: SimulationStep,
    nodeRef: (el: HTMLDivElement | null) => void,
    isRoot?: boolean
}> = ({ node, activeStep, nodeRef, isRoot }) => {
    
    const isActive = activeStep && (activeStep.type === StepType.CHECK_NODE || activeStep.type === StepType.CHECK_ENTRY || activeStep.type === StepType.CHECK_INTERNAL_KEY) && activeStep.targetId === node.id;
    
    return (
        <div 
            ref={nodeRef}
            className={`
                relative flex flex-col rounded-xl overflow-hidden transition-all duration-500 group
                ${node.isLeaf ? 'min-w-[220px]' : 'min-w-[180px]'}
                ${isActive 
                    ? 'border-2 border-yellow-400 shadow-[0_0_30px_-5px_rgba(250,204,21,0.5)] scale-105 bg-[#0f121a] z-30' 
                    : 'border-2 border-slate-700/60 bg-[#0B0F19] shadow-2xl hover:border-cyan-500/30 z-20'}
            `}
        >
            {/* Header Section */}
            <div className={`
                relative px-4 py-3 border-b flex flex-col items-center justify-center
                ${isActive ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-[#161b2e] border-slate-700/60'}
            `}>
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-lg font-bold tracking-widest font-mono uppercase ${isActive ? 'text-white' : 'text-slate-200'}`}>
                        {isRoot ? 'ROOT NODE' : (node.isLeaf ? `LEAF #${node.id}` : `NODE #${node.id}`)}
                    </span>
                </div>
                <div className={`text-[10px] font-mono ${isActive ? 'text-yellow-200/70' : 'text-slate-500'}`}>
                    Total Range: <span className="text-white font-bold">{node.range[0]} - {node.range[1]}</span>
                </div>
                
                {/* Connector Dot Top (Incoming) */}
                {!isRoot && (
                    <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 bg-[#0B0F19] ${isActive ? 'border-yellow-400' : 'border-slate-600'}`}></div>
                )}
            </div>

            {/* Content Body */}
            <div className="p-4 flex flex-col items-center gap-3 bg-[#0B0F19]">
                <div className="text-[9px] uppercase font-bold text-slate-600 tracking-[0.2em]">
                    {node.isLeaf ? 'Entries' : 'Separators'}
                </div>
                
                {node.isLeaf ? (
                    // LEAF NODE: List of Values & Pointers
                     <div className="flex flex-col w-full gap-1.5">
                        {node.entries.map((entry) => {
                            const isEntryActive = isActive && activeStep.type === StepType.CHECK_ENTRY && activeStep.entryId === entry.key;
                            const isMatch = isEntryActive && activeStep.isMatch;

                            return (
                                <div key={entry.originalIndex} className={`
                                    flex justify-between items-center px-3 py-2 rounded border text-xs font-mono transition-all duration-200
                                    ${isEntryActive 
                                        ? (isMatch ? 'bg-green-500 text-black border-green-400 font-bold' : 'bg-yellow-400 text-black border-yellow-400 font-bold') 
                                        : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:border-slate-600'}
                                `}>
                                    <span>{entry.key}</span>
                                    <span className={`text-[10px] uppercase ${isEntryActive ? 'text-black/60' : 'text-slate-600'}`}>
                                        RID:{entry.rowId}
                                    </span>
                                </div>
                            )
                        })}
                     </div>
                ) : (
                    // INTERNAL NODE: Navigation Keys
                    <div className="flex gap-3 justify-center">
                        {node.keys.map((k, i) => {
                            const isKeyCheck = activeStep?.type === StepType.CHECK_INTERNAL_KEY && activeStep.targetId === node.id && activeStep.entryId === k;
                            const result = activeStep?.compareResult;
                            
                            return (
                                <div key={i} className={`
                                    relative px-3 py-1.5 rounded-lg border-2 text-sm font-mono font-bold transition-all duration-300 shadow-lg
                                    ${isKeyCheck 
                                        ? (result ? 'bg-green-500 border-green-400 text-black scale-110 z-10' : 'bg-red-500 border-red-500 text-white scale-110 z-10') 
                                        : 'bg-[#0B0F19] border-cyan-900 text-cyan-400 hover:border-cyan-500/50 hover:shadow-cyan-500/20'}
                                `}>
                                    [ {k} ]
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Connector Dot Bottom (Outgoing) */}
            {!node.isLeaf && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-cyan-500 bg-[#0B0F19] z-20"></div>
            )}
        </div>
    );
};