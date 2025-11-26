import React, { useEffect, useRef } from 'react';
import { UserRow, SimulationStep, StepType } from '../types';
import { Mail, User } from 'lucide-react';

interface TableViewProps {
  data: UserRow[];
  activeStep?: SimulationStep;
  hasIndex: boolean;
}

export const TableView: React.FC<TableViewProps> = ({ data, activeStep, hasIndex }) => {
  const rowRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (activeStep && (activeStep.type === StepType.SCAN_ROW || activeStep.type === StepType.FETCH_ROW || activeStep.type === StepType.FOUND_MATCH)) {
      const el = rowRefs.current[activeStep.targetId!];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeStep]);

  return (
    <div className="space-y-2 pb-10">
      {data.map((row, index) => {
        const isActive = activeStep && (activeStep.type === StepType.SCAN_ROW || activeStep.type === StepType.FETCH_ROW || activeStep.type === StepType.FOUND_MATCH) && activeStep.targetId === index;
        const isMatch = activeStep && activeStep.type === StepType.FOUND_MATCH && activeStep.targetId === index;
        const isIndexFetch = activeStep && activeStep.type === StepType.FETCH_ROW && activeStep.targetId === index;
        
        // Base styling
        let borderColor = "border-slate-800";
        let bgColor = "bg-[#111625]/80";
        let shadow = "";
        let scale = "scale-100";
        
        if (isActive) {
           if (isMatch) {
             borderColor = "border-green-500";
             bgColor = "bg-green-500/10";
             shadow = "shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]";
             scale = "scale-[1.02]";
           } else if (isIndexFetch) {
             borderColor = "border-blue-500";
             bgColor = "bg-blue-500/10";
             shadow = "shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]";
             scale = "scale-[1.02]";
           } else {
             // Normal Scan
             borderColor = "border-blue-500/50";
             bgColor = "bg-slate-800";
             scale = "scale-[1.01]";
           }
        } else if (activeStep) {
            // Dim others when active
            bgColor = "bg-[#111625]/40 opacity-60";
        }

        return (
          <div 
            key={row.id}
            ref={el => { rowRefs.current[index] = el; }}
            className={`
                relative flex items-center justify-between p-4 rounded-xl border backdrop-blur-sm transition-all duration-300
                ${borderColor} ${bgColor} ${shadow} ${scale}
            `}
          >
             {/* Left: ID & User Info */}
            <div className="flex items-center gap-4 min-w-0">
                <div className="flex flex-col items-center justify-center w-8 pt-1">
                    <span className="text-[10px] text-slate-600 font-mono uppercase">Row</span>
                    <span className="font-mono text-xs text-slate-500">#{row.id}</span>
                </div>
                
                <div 
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white shadow-inner border border-white/10" 
                    style={{backgroundColor: row.avatar, textShadow: '0 1px 2px rgba(0,0,0,0.3)'}}
                >
                    {row.name[0]}
                </div>
                
                <div className="min-w-0">
                    <div className={`font-medium text-sm truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                        {row.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                        <Mail size={10} /> {row.email}
                    </div>
                </div>
            </div>

            {/* Middle: The Value of Interest */}
            <div className={`
                flex flex-col items-center justify-center px-4 py-1 rounded-lg border
                ${isActive ? 'bg-slate-900 border-slate-600' : 'bg-transparent border-transparent'}
            `}>
                <span className="text-[9px] uppercase font-bold text-slate-600 tracking-wider">Age</span>
                <span className={`text-lg font-mono font-bold ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {row.age}
                </span>
            </div>

            {/* Right: Status Indicator */}
            <div className="w-20 flex justify-end">
                {isActive && (
                    <div className={`
                        text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide
                        ${isMatch ? 'bg-green-500 text-black' : isIndexFetch ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}
                    `}>
                        {isMatch ? 'Match' : isIndexFetch ? 'Fetch' : 'Scan'}
                    </div>
                )}
            </div>

          </div>
        );
      })}
    </div>
  );
};