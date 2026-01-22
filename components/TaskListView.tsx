import React from 'react';
import { Task } from '../types';
import { ArrowLeft, CheckSquare, Square, List, CalendarClock, CheckCircle2, Pencil } from 'lucide-react';
import { MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE } from '../constants';

interface TaskListViewProps {
  tasks: Task[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  isOpen,
  onClose,
  onUpdateTask,
  onEditTask,
}) => {
  // Sort by size (descending) -> Importance
  const sortedTasks = [...tasks].sort((a, b) => b.size - a.size);
  
  const activeTasks = sortedTasks.filter(t => !t.completed);
  const completedTasks = sortedTasks.filter(t => t.completed);

  const formatDate = (isoString?: string) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const toggleSubtask = (task: Task, subtaskId: string) => {
      const updatedSubtasks = task.subtasks?.map(s => 
          s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );
      onUpdateTask({ ...task, subtasks: updatedSubtasks });
  };

  const renderTaskItem = (task: Task) => {
    // Calculate dot size based on importance
    const minDot = 4;
    const maxDot = 24;
    const percentage = (task.size - MIN_BUBBLE_SIZE) / (MAX_BUBBLE_SIZE - MIN_BUBBLE_SIZE);
    const dotSize = minDot + (percentage * (maxDot - minDot));

    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(s => s.completed).length;
    const progress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;

    return (
        <div 
            key={task.id} 
            onClick={() => {
                onEditTask(task);
                onClose();
            }}
            className="group relative rounded-2xl transition-all duration-200 overflow-hidden cursor-pointer shadow-sm backdrop-blur-xl
                bg-white/20 dark:bg-slate-900/20 border border-white/30 dark:border-white/10 
                hover:shadow-md hover:bg-white/40 dark:hover:bg-slate-900/40"
        >
          {/* Main Task Row */}
          <div className="p-4 flex items-start gap-3">
            
            {/* Left: Checkbox Wrapper */}
            <div className="h-6 flex items-center justify-center shrink-0">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTask({ ...task, completed: !task.completed });
                    }}
                    className={`transition-all duration-300 ${
                        task.completed 
                        ? 'text-green-500 dark:text-green-400 scale-100' 
                        : 'text-slate-300 dark:text-white/20 group-hover:text-slate-500 dark:group-hover:text-white/40 hover:scale-110 active:scale-90'
                        }`}
                >
                    {task.completed ? <CheckSquare size={20} className="drop-shadow-sm" /> : <Square size={20} />}
                </button>
            </div>

            {/* Middle: Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-medium text-[15px] leading-6 transition-colors ${task.completed ? 'text-slate-400 dark:text-white/30 line-through' : 'text-slate-900 dark:text-white/90'}`}>
                        {task.title}
                    </h3>
                </div>

                {/* Meta Row: Date & Desc */}
                {(task.dueDate || task.description) && (
                    <div className="flex items-center gap-3 text-[11px] mt-0.5">
                        {task.dueDate && (
                            <div className={`flex items-center gap-1.5 ${task.completed ? 'text-slate-300 dark:text-white/20' : 'text-blue-500 dark:text-blue-300/70'}`}>
                                <CalendarClock size={11} />
                                <span>{formatDate(task.dueDate)}</span>
                            </div>
                        )}
                        
                        {task.description && (
                            <p className="text-[11px] text-slate-400 dark:text-white/30 line-clamp-1 truncate max-w-[200px]">{task.description}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Edit Icon & Importance Dot */}
            <div className="flex items-center gap-3 pl-2 shrink-0">
                {/* Edit Pencil - Always visible on mobile, hover on desktop */}
                <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 transform scale-100">
                     <Pencil size={16} className="text-slate-400 dark:text-white/40" />
                </div>

                {/* Importance Dot */}
                <div className="h-6 w-6 flex items-center justify-center">
                    <div 
                        className="rounded-full transition-all duration-300 border border-slate-50 dark:border-white/5"
                        style={{ 
                            width: `${dotSize}px`, 
                            height: `${dotSize}px`, 
                            background: task.color,
                            opacity: task.completed ? 0.3 : 0.9,
                            boxShadow: task.completed ? 'none' : `0 0 12px ${task.color}50`
                        }} 
                    />
                </div>
            </div>
          </div>
          
          {/* Subtasks List - Indented */}
          {subtasks.length > 0 && !task.completed && (
              <div className="bg-slate-50/50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 px-4 py-2 space-y-1">
                  {subtasks.map(sub => (
                      <div 
                        key={sub.id} 
                        className="flex items-start gap-3 pl-9 pr-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group/sub"
                        onClick={(e) => {
                            e.stopPropagation(); 
                            onEditTask(task);
                            onClose();
                        }}
                      >
                          {/* Subtask Checkbox Wrapper */}
                          <div className="h-5 flex items-center justify-center shrink-0">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSubtask(task, sub.id);
                                    }}
                                    className={`transition-colors ${sub.completed ? 'text-green-500/70 dark:text-green-400/70' : 'text-slate-300 dark:text-white/10 group-hover/sub:text-slate-500 dark:group-hover/sub:text-white/40'}`}
                                >
                                    {sub.completed ? <CheckSquare size={13} /> : <Square size={13} />}
                                </button>
                          </div>
                          
                          <span className={`text-[13px] leading-5 transition-colors ${sub.completed ? 'text-slate-400 dark:text-white/20 line-through' : 'text-slate-600 dark:text-white/50'}`}>
                              {sub.title}
                          </span>
                      </div>
                  ))}
              </div>
          )}

          {/* Progress Bar Line at Bottom - Ultra thin */}
          {subtasks.length > 0 && !task.completed && (
             <div className="absolute bottom-0 left-0 h-[2px] bg-slate-100 dark:bg-white/5 w-full pointer-events-none">
                 <div className="h-full bg-blue-500/40 dark:bg-blue-400/40 transition-all duration-500" style={{ width: `${progress}%` }} />
             </div>
          )}
        </div>
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-slate-200/40 dark:bg-black/40 backdrop-blur-[2px] z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] shadow-2xl z-[70] transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col
            bg-white/40 dark:bg-slate-900/30 backdrop-blur-3xl border-l border-white/60 dark:border-white/10
            ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
         {/* Decorative gradient */}
         <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

        {/* Header - Back Arrow on Left */}
        <div className="relative px-6 py-6 border-b border-slate-200 dark:border-white/10 flex items-center gap-4 bg-white/20 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full transition-colors active:scale-90 duration-200
                hover:bg-white/40 dark:hover:bg-white/10 text-slate-400 dark:text-white/50 hover:text-slate-800 dark:hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-3">
             <h2 className="text-xl font-bold text-slate-900 dark:text-white/90 tracking-tight">Tasks</h2>
             <span className="px-2 py-0.5 rounded-full text-xs font-bold border
                bg-white/20 dark:bg-white/10 text-slate-500 dark:text-white/40 border-slate-200 dark:border-white/5">
                {activeTasks.length}
             </span>
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto p-4 custom-scrollbar scroll-smooth">
          
          {/* Active Tasks */}
          <div className="space-y-2 pb-4">
             {activeTasks.length > 0 ? (
                 activeTasks.map(renderTaskItem)
             ) : (
                 <div className="h-64 flex flex-col items-center justify-center text-slate-300 dark:text-white/10 gap-3">
                    <List size={32} strokeWidth={1.5} className="opacity-80" />
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60">All Clear</p>
                 </div>
             )}
          </div>

          {/* Completed Section */}
          {completedTasks.length > 0 && (
             <div className="mt-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-center gap-4 mb-4 px-1">
                     <div className="h-px bg-slate-200 dark:bg-white/5 flex-1" />
                     <div className="flex items-center gap-2 text-slate-400 dark:text-white/20 text-[10px] font-bold uppercase tracking-widest px-2">
                        <CheckCircle2 size={11} />
                        <span>Done</span>
                     </div>
                     <div className="h-px bg-slate-200 dark:bg-white/5 flex-1" />
                 </div>
                 
                 <div className="space-y-2 opacity-60 hover:opacity-100 transition-all duration-300">
                    {completedTasks.map(renderTaskItem)}
                 </div>
             </div>
          )}

        </div>
      </div>
    </>
  );
};