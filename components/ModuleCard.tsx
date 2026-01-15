
import React, { useState } from 'react';
import { Module } from '../types';

interface ModuleCardProps {
  module: Module;
  index: number;
  onToggleCompletion?: (moduleId: string) => void;
}

const ModuleCard: React.FC<ModuleCardProps> = ({ module, index, onToggleCompletion }) => {
  const [isOpen, setIsOpen] = useState(index === 0);

  return (
    <div className={`bg-white dark:bg-slate-900 border rounded-xl shadow-sm overflow-hidden transition-all duration-300 ${
      module.isCompleted 
        ? 'border-green-200 dark:border-green-900 bg-green-50/20 dark:bg-green-900/10' 
        : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
    }`}>
      <div className="flex items-stretch">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex-grow flex items-center justify-between p-5 text-left transition-colors"
        >
          <div className="flex items-center gap-4">
            <span className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-colors ${
              module.isCompleted 
                ? 'bg-green-500 dark:bg-green-600 text-white' 
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
            }`}>
              {module.isCompleted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              ) : (
                index + 1
              )}
            </span>
            <div>
              <h3 className={`font-semibold transition-colors ${module.isCompleted ? 'text-green-900 dark:text-green-300' : 'text-slate-900 dark:text-slate-100'}`}>
                {module.title}
                {module.isCompleted && <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-md">Covered</span>}
              </h3>
              <div className="flex gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {module.duration}
                </span>
                <span className={`px-2 py-0.5 rounded-full ${
                  module.level === 'Beginner' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                  module.level === 'Intermediate' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                  {module.level}
                </span>
              </div>
            </div>
          </div>
          <svg 
            className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {onToggleCompletion && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompletion(module.id);
            }}
            title={module.isCompleted ? "Mark as uncompleted" : "Mark as covered"}
            className={`px-6 border-l transition-all flex flex-col items-center justify-center gap-1 hover:brightness-95 ${
              module.isCompleted 
                ? 'bg-green-500 dark:bg-green-600 border-green-600 dark:border-green-700 text-white' 
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-tighter">
              {module.isCompleted ? 'Done' : 'Cover'}
            </span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="p-5 pt-0 border-t border-slate-50 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Key Topics</h4>
              <ul className="space-y-3">
                {module.topics.map((topic, i) => (
                  <li key={i} className="group">
                    <p className={`font-medium text-sm transition-colors ${module.isCompleted ? 'text-green-800 dark:text-green-300' : 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>{topic.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">{topic.description}</p>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Learning Outcomes</h4>
                <ul className="space-y-2">
                  {module.learningOutcomes.map((outcome, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${module.isCompleted ? 'text-green-500 dark:text-green-400' : 'text-blue-400 dark:text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`rounded-lg p-4 border transition-colors ${
                module.isCompleted 
                  ? 'bg-green-100/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' 
                  : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
              }`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${
                  module.isCompleted ? 'text-green-800 dark:text-green-400' : 'text-blue-800 dark:text-blue-400'
                }`}>Standard Alignment</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <svg className={`w-4 h-4 mt-0.5 ${module.isCompleted ? 'text-green-600 dark:text-green-500' : 'text-blue-600 dark:text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <div>
                      <p className={`text-[10px] font-bold uppercase ${module.isCompleted ? 'text-green-500' : 'text-blue-400'}`}>Industry</p>
                      <p className={`text-xs ${module.isCompleted ? 'text-green-800 dark:text-slate-300' : 'text-slate-700 dark:text-slate-300'}`}>{module.industryAlignment}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className={`w-4 h-4 mt-0.5 ${module.isCompleted ? 'text-green-600 dark:text-green-500' : 'text-indigo-600 dark:text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                    <div>
                      <p className={`text-[10px] font-bold uppercase ${module.isCompleted ? 'text-green-500' : 'text-indigo-400'}`}>Academic</p>
                      <p className={`text-xs ${module.isCompleted ? 'text-green-800 dark:text-slate-300' : 'text-slate-700 dark:text-slate-300'}`}>{module.academicAlignment}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleCard;
