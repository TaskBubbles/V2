import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { v4 as uuidv4 } from 'uuid';
import { Task, Board, Subtask } from '../types';
import { COLOR_GROUPS, MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE, calculateFontSize } from '../constants';
import { Trash2, Calendar, AlertTriangle, X, ChevronDown, Check, ChevronUp, AlignLeft, Plus, Square, CheckSquare, ListChecks } from 'lucide-react';
import { audioService } from '../services/audioService';

interface BubbleControlsProps {
  task: Task;
  boards: Board[];
  startPos: { x: number, y: number, k: number } | null;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
  onPop: (coords?: { x: number, y: number }) => void;
}

const toDateTimeLocal = (isoString?: string) => {
    if (!isoString) return "";
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return "";
        const offsetMs = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offsetMs);
        return localDate.toISOString().slice(0, 16);
    } catch {
        return "";
    }
};

export const BubbleControls: React.FC<BubbleControlsProps> = ({ task, boards, startPos, onUpdate, onDelete, onClose, onPop }) => {
  const [isCentered, setIsCentered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPopping, setIsPopping] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showColorGrid, setShowColorGrid] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [hasText, setHasText] = useState(!!task.title);
  
  // Dimensions state to handle resize updates
  const [winDim, setWinDim] = useState({ w: window.innerWidth, h: window.innerHeight });
  const isMobile = winDim.w < 768;

  const viewportRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const colorSectionRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const currentSizeRef = useRef(task.size);
  const startDistRef = useRef(0);
  const startSizeRef = useRef(0);

  const currentBoardName = boards.find(b => b.id === task.boardId)?.name || 'Select Board';

  useEffect(() => {
    const handleResize = () => setWinDim({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { const t = setTimeout(() => setIsCentered(true), 20); return () => clearTimeout(t); }, []);

  // Update hasText when task title changes prop-side (e.g. undo/redo or initial load)
  useEffect(() => {
      setHasText(!!task.title);
  }, [task.title]);

  // Handle outside click for color grid
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (
              colorSectionRef.current && 
              !colorSectionRef.current.contains(event.target as Node)
          ) {
              setShowColorGrid(false);
          }
      };
      if (showColorGrid) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [showColorGrid]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && showDescription) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [task.description, showDescription]);

  // Focus subtask input when opened
  useEffect(() => {
    if (showSubtasks && subtaskInputRef.current) {
        setTimeout(() => subtaskInputRef.current?.focus(), 100);
    }
  }, [showSubtasks]);

  // Sync ref when task prop updates, but ONLY if not currently dragging
  useEffect(() => {
    if (!isResizing) {
        currentSizeRef.current = task.size;
    }
  }, [task.size, isResizing]);

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation(); 
    e.preventDefault();
    setIsResizing(true);
    
    const cx = window.innerWidth / 2;
    const cy = isMobile ? window.innerHeight * 0.35 : window.innerHeight / 2;
    
    startDistRef.current = Math.hypot(e.clientX - cx, e.clientY - cy);
    startSizeRef.current = currentSizeRef.current;
    
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const cx = window.innerWidth / 2;
    const cy = isMobile ? window.innerHeight * 0.35 : window.innerHeight / 2;
    
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    
    const rawSize = startSizeRef.current + (dist - startDistRef.current);
    
    const newSize = Math.max(MIN_BUBBLE_SIZE, Math.min(MAX_BUBBLE_SIZE, rawSize));
    currentSizeRef.current = newSize;

    if (rawSize !== newSize) {
         startDistRef.current = dist - (newSize - startSizeRef.current);
    }

    if (viewportRef.current) {
        const bubble = viewportRef.current.querySelector('.bubble-main') as HTMLElement;
        const ring = viewportRef.current.querySelector('.resize-ring') as HTMLElement;
        
        const diameter = newSize * 2;
        const ringDia = diameter + 60; 

        if (bubble) {
            bubble.style.width = `${diameter}px`;
            bubble.style.height = `${diameter}px`;
            
            const textEl = bubble.querySelector('.bubble-text-inner') as HTMLElement;
            if (textEl) {
                // Use placeholder text for sizing if title is empty
                const currentText = (textEl.innerText || "").trim();
                const textToMeasure = currentText || "Task Name";
                const fontSize = calculateFontSize(newSize, textToMeasure);
                textEl.style.fontSize = `${fontSize}px`;
                
                // Update placeholder size too if it exists
                const placeholderEl = bubble.querySelector('.placeholder-text') as HTMLElement;
                if (placeholderEl) {
                    placeholderEl.style.fontSize = `${fontSize}px`;
                }
            }
        }
        if (ring) {
            ring.style.width = `${ringDia}px`;
            ring.style.height = `${ringDia}px`;
        }
    }
  };

  const handleResizeEnd = (e: React.PointerEvent) => {
    if (isResizing) {
        setIsResizing(false);
        onUpdate({ ...task, size: currentSizeRef.current });
        
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch(err) {
        }
    }
  };

  // Subtask Handlers
  const handleAddSubtask = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSubtaskTitle.trim()) return;
      const newSubtask: Subtask = {
          id: uuidv4(),
          title: newSubtaskTitle.trim(),
          completed: false
      };
      onUpdate({ ...task, subtasks: [...(task.subtasks || []), newSubtask] });
      setNewSubtaskTitle('');
  };

  const toggleSubtask = (subtaskId: string) => {
      const updated = (task.subtasks || []).map(s => 
          s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );
      onUpdate({ ...task, subtasks: updated });
  };

  const deleteSubtask = (subtaskId: string) => {
      const updated = (task.subtasks || []).filter(s => s.id !== subtaskId);
      onUpdate({ ...task, subtasks: updated });
  };

  const ringPadding = 60; 
  const ringDiameter = task.size * 2 + ringPadding;
  const bubbleDiameter = task.size * 2;
  
  const safeZone = Math.min(winDim.w, winDim.h) * 0.85; 
  const fitScale = bubbleDiameter > safeZone ? safeZone / bubbleDiameter : 1;

  const initialStyle: React.CSSProperties = startPos ? {
      left: `${startPos.x}px`,
      top: `${startPos.y}px`,
      transform: `translate(-50%, -50%) scale(${startPos.k})`,
  } : { left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${fitScale})` };

  const centeredStyle: React.CSSProperties = {
      left: '50%',
      top: isMobile ? '35%' : '50%', 
      transform: `translate(-50%, -50%) scale(${fitScale})`,
  };

  // Light/Dark Adapted styles
  const controlsClass = isMobile 
    ? "fixed bottom-0 left-0 w-full px-5 pt-6 pb-8 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-[60] bg-white/30 dark:bg-slate-900/40 backdrop-blur-3xl border-t border-white/50 dark:border-white/10"
    : "absolute left-1/2 -translate-x-1/2 z-50 bottom-12 min-w-[360px] max-w-[95vw] bg-white/30 dark:bg-slate-900/30 backdrop-blur-3xl border border-white/50 dark:border-white/10 rounded-[2rem] p-5 shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]";
  
  const controlsTransition = isMobile 
    ? { transform: isCentered ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }
    : { opacity: isCentered ? 1 : 0, transform: isCentered ? 'translate(-50%, 0)' : 'translate(-50%, 20px)', transition: 'all 0.4s ease-out' };


  const renderResizeHandle = (className: string, cursor: string) => (
    <div 
        onPointerDown={handleResizeStart} 
        onPointerMove={handleResizeMove} 
        onPointerUp={handleResizeEnd}
        className={`absolute w-20 h-20 flex items-center justify-center pointer-events-auto z-[100] group ${className}`}
        style={{ cursor, touchAction: 'none' }}
    >
        <div className="w-6 h-6 bg-white rounded-full shadow-lg border-2 border-indigo-500 transition-transform group-active:scale-110 pointer-events-none" />
    </div>
  );

  // Gradient Generation
  const brightColor = d3.color(task.color)?.brighter(0.8)?.toString() || task.color;
  const bubbleGradient = `linear-gradient(135deg, ${task.color} 0%, ${brightColor} 100%)`;

  const subtasks = task.subtasks || [];
  const completedCount = subtasks.filter(s => s.completed).length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  // Placeholder Logic
  // Show placeholder if title is empty. We ignore isFocused so the placeholder persists
  // until the user actually types, which is better UX when auto-focus is off.
  const isPlaceholderVisible = !hasText;
  
  // Calculate font size using task title OR placeholder text
  const displayText = task.title || 'Task Name';
  const currentFontSize = calculateFontSize(task.size, displayText);

  // --- COMPONENT RENDER FUNCTIONS ---

  const renderContentArea = () => (
     <div className="w-full flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
        {/* Description Field */}
        {showDescription && (
            <div className="w-full relative group">
                <div className="absolute top-3 left-3 text-slate-500 dark:text-white/40 pointer-events-none">
                    <AlignLeft size={16} />
                </div>
                <textarea
                    ref={textareaRef}
                    rows={task.description ? 3 : 1}
                    placeholder="Add a description..."
                    value={task.description || ''}
                    onChange={(e) => onUpdate({ ...task, description: e.target.value })}
                    className="w-full transition-colors rounded-xl py-3 pl-10 pr-4 text-sm resize-none outline-none leading-relaxed custom-scrollbar
                        bg-white/20 dark:bg-white/5 hover:bg-white/30 dark:hover:bg-white/10 focus:bg-white/40 dark:focus:bg-white/10
                        border border-white/30 dark:border-white/5 focus:border-slate-300 dark:focus:border-white/20
                        text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/30"
                    style={{ minHeight: '46px', maxHeight: '120px' }}
                />
            </div>
        )}

        {/* Subtasks List */}
        {showSubtasks && (
            <div className="w-full bg-white/20 dark:bg-white/5 rounded-xl border border-white/30 dark:border-white/5 overflow-hidden flex flex-col">
                 {/* Progress Bar */}
                 {subtasks.length > 0 && (
                    <div className="w-full h-1 bg-slate-200 dark:bg-white/10">
                        <div 
                            className="h-full bg-green-500 dark:bg-green-400 transition-all duration-300" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                 )}

                 <div className="p-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {subtasks.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 p-2 hover:bg-white/30 dark:hover:bg-white/5 rounded-lg group">
                            <button 
                                onClick={() => toggleSubtask(sub.id)}
                                className={`shrink-0 transition-colors ${sub.completed ? 'text-green-500 dark:text-green-400' : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60'}`}
                            >
                                {sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                            <input 
                                type="text" 
                                value={sub.title}
                                onChange={(e) => {
                                    const updated = subtasks.map(s => s.id === sub.id ? { ...s, title: e.target.value } : s);
                                    onUpdate({ ...task, subtasks: updated });
                                }}
                                className={`flex-1 bg-transparent outline-none text-sm ${sub.completed ? 'text-slate-500 dark:text-white/40 line-through' : 'text-slate-900 dark:text-white/90'}`}
                            />
                            <button 
                                onClick={() => deleteSubtask(sub.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-white/20 hover:text-red-500 dark:hover:text-red-400 transition-all px-1"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    
                    {/* New Subtask Input */}
                    <form onSubmit={handleAddSubtask} className="flex items-center gap-2 p-2">
                        <Plus size={16} className="text-slate-400 dark:text-white/30 shrink-0" />
                        <input 
                            ref={subtaskInputRef}
                            type="text" 
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            placeholder="Add subtask..."
                            className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/30"
                        />
                    </form>
                 </div>
            </div>
        )}
    </div>
  );

  // 2. Board Selector
  const renderBoardSelector = () => (
    <div className={`relative group shrink-0 ${isMobile ? 'flex-1' : ''}`}>
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all border
            bg-white/20 dark:bg-white/5 hover:bg-white/40 dark:hover:bg-white/20 
            border-white/30 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20
            text-slate-900 dark:text-white group-hover:text-black dark:group-hover:text-white">
            <span className="text-xs font-medium truncate max-w-[120px]">{currentBoardName}</span>
            <ChevronDown size={14} className="text-slate-500 dark:text-white/40 group-hover:text-slate-700 dark:group-hover:text-white/90" />
        </div>
        <select 
            value={task.boardId}
            onChange={(e) => onUpdate({ ...task, boardId: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        >
            {boards.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
            ))}
        </select>
    </div>
  );

  // 3. Tools (Date, Desc, Subtasks)
  const renderToolsGroup = () => (
    <div className="flex items-center gap-2 shrink-0">
        {/* Date */}
        <button 
            type="button"
            className={`relative px-3 py-2.5 rounded-xl border transition-all flex items-center justify-center shrink-0 group outline-none overflow-hidden
                ${task.dueDate 
                    ? 'bg-blue-100 dark:bg-white/20 border-blue-200 dark:border-white/30 text-blue-800 dark:text-white' 
                    : 'bg-white/20 dark:bg-white/5 border-white/30 dark:border-white/5 text-slate-500 dark:text-white/40 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white'
                }`}
        >
            <div className="flex items-center gap-1.5 pointer-events-none relative z-0">
                <Calendar size={18} />
                {task.dueDate && !isMobile && (
                    <span className="ml-0.5 text-[10px] font-bold whitespace-nowrap">
                        {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                        {' '}
                        {new Date(task.dueDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                )}
            </div>
            
            <input 
                ref={dateInputRef}
                type="datetime-local" 
                className="absolute inset-0 opacity-0 w-full h-full z-10 cursor-pointer date-trigger"
                value={toDateTimeLocal(task.dueDate)}
                onChange={(e) => onUpdate({ ...task, dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                onClick={(e) => {
                    e.stopPropagation();
                    try {
                        if (e.currentTarget && 'showPicker' in e.currentTarget) {
                            e.currentTarget.showPicker();
                        }
                    } catch (err) {}
                }}
            />
            {/* CSS Hack for webkit calendar picker */}
            <style>{`
                .date-trigger::-webkit-calendar-picker-indicator {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    padding: 0; margin: 0; opacity: 0; cursor: pointer;
                }
            `}</style>
        </button>

        {/* Desc Toggle */}
        <button 
            onClick={() => {
                setShowDescription(!showDescription);
                if (!showDescription) {
                    setTimeout(() => textareaRef.current?.focus(), 50);
                }
            }}
            className={`relative px-3 py-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer shrink-0
                ${(showDescription || task.description)
                    ? 'bg-blue-100 dark:bg-white/20 border-blue-200 dark:border-white/30 text-blue-800 dark:text-white' 
                    : 'bg-white/20 dark:bg-white/5 border-white/30 dark:border-white/5 text-slate-500 dark:text-white/40 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white'
                }`}
        >
            <AlignLeft size={18} />
        </button>

        {/* Subtasks Toggle */}
        <button 
            onClick={() => {
                setShowSubtasks(!showSubtasks);
            }}
            className={`relative px-3 py-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer shrink-0
                ${(showSubtasks || (task.subtasks && task.subtasks.length > 0))
                    ? 'bg-blue-100 dark:bg-white/20 border-blue-200 dark:border-white/30 text-blue-800 dark:text-white' 
                    : 'bg-white/20 dark:bg-white/5 border-white/30 dark:border-white/5 text-slate-500 dark:text-white/40 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white'
                }`}
        >
            <ListChecks size={18} />
            {subtasks.length > 0 && (
                <span className="ml-1 text-[10px] font-bold">{completedCount}/{subtasks.length}</span>
            )}
        </button>
    </div>
  );

  // 4. Color Picker
  const renderColorPicker = () => (
    <div ref={colorSectionRef} className="relative group/colors z-10 shrink-0">
                            
        {/* EXPANDED CONTAINER */}
        <div 
            className={`absolute bottom-[calc(100%+8px)] ${isMobile ? 'left-0' : 'left-1/2 -translate-x-1/2'} flex flex-col gap-2 p-2 
                bg-white/30 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-2xl shadow-2xl transition-all duration-300 origin-bottom
                ${showColorGrid 
                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                    : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
                }`}
            style={{ width: isMobile ? '100%' : 'max-content' }}
        >
                {/* Top Row */}
                <div className={`flex items-center ${isMobile ? 'justify-between px-2' : 'gap-3 justify-center'}`}>
                    {COLOR_GROUPS.map((group) => (
                        <button
                            key={`${group.name}-light`}
                            onClick={() => { onUpdate({ ...task, color: group.shades[0] }); }}
                            className={`rounded-full transition-transform hover:scale-110 relative ${isMobile ? 'w-10 h-10' : 'w-7 h-7'}
                                ${task.color === group.shades[0] ? 'scale-110 ring-2 ring-white' : ''}`}
                            style={{ backgroundColor: group.shades[0] }}
                        />
                    ))}
                    {!isMobile && <div className="w-8 h-8 opacity-0" />}
                </div>
                
                {/* Middle Row */}
                <div className={`flex items-center ${isMobile ? 'justify-between px-2' : 'gap-3 justify-center'}`}>
                    {COLOR_GROUPS.map((group) => (
                        <button
                            key={`${group.name}-dark`}
                            onClick={() => { onUpdate({ ...task, color: group.shades[2] }); }}
                            className={`rounded-full transition-transform hover:scale-110 relative ${isMobile ? 'w-10 h-10' : 'w-7 h-7'}
                                ${task.color === group.shades[2] ? 'scale-110 ring-2 ring-white' : ''}`}
                            style={{ backgroundColor: group.shades[2] }}
                        />
                    ))}
                    {!isMobile && <div className="w-8 h-8 opacity-0" />}
                </div>
        </div>

        {/* BASE ROW */}
        <div className={`flex items-center ${isMobile ? 'justify-between gap-1' : 'gap-2 justify-center'}`}>
            {COLOR_GROUPS.map((group) => {
                const displayColor = group.shades[1];
                const isActive = group.shades.includes(task.color);
                
                return (
                    <button
                    key={group.name}
                    onClick={() => onUpdate({ ...task, color: displayColor })}
                    className={`rounded-full transition-all duration-300 relative flex items-center justify-center
                        ${isMobile ? 'w-10 h-10' : 'w-6 h-6'}
                        ${isActive ? 'scale-110 ring-2 ring-white/50 shadow-md' : 'hover:scale-105'}`}
                    style={{ backgroundColor: displayColor }}
                    >
                        {isActive && (
                            <div className="absolute -bottom-2 w-1 h-1 bg-slate-800 dark:bg-white rounded-full" />
                        )}
                    </button>
                );
            })}
            
            <button
                onClick={() => setShowColorGrid(!showColorGrid)}
                className={`rounded-full flex items-center justify-center transition-colors border
                bg-white/20 dark:bg-white/5 hover:bg-white/40 dark:hover:bg-white/10 border-white/30 dark:border-white/5
                text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white
                ${showColorGrid ? 'bg-white/60 dark:bg-white/20 text-slate-800 dark:text-white' : ''}
                ${isMobile ? 'w-10 h-10' : 'w-8 h-8'}
                `}
            >
                <ChevronUp size={14} className={`transition-transform duration-300 ${showColorGrid ? 'rotate-180' : ''}`} />
            </button>
        </div>
    </div>
  );

  // 5. Delete Button
  const renderDeleteButton = () => (
    <button 
        onClick={() => setShowDeleteConfirm(true)} 
        className={`flex items-center justify-center rounded-xl transition-colors shrink-0
            ${isMobile 
                ? 'w-14 h-14 bg-white/20 dark:bg-white/5 hover:bg-red-500/20 text-slate-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400' 
                : 'p-2.5 text-slate-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-white/10'}
        `}
    >
        <Trash2 size={isMobile ? 22 : 18} />
    </button>
  );

  return (
    <div className="absolute inset-0 z-40 overflow-hidden" 
        onPointerUp={handleResizeEnd} 
        onPointerLeave={handleResizeEnd}
        onPointerDown={() => audioService.resume()} 
    >
      
      {/* Background Dimmer */}
      <div className={`absolute inset-0 bg-slate-200/40 dark:bg-black/40 backdrop-blur-[4px] transition-opacity duration-300 ${isPopping ? 'opacity-0' : 'opacity-100'}`} onClick={onClose} />
      
      <div 
        ref={viewportRef} 
        className={`absolute pointer-events-none z-40 ${isResizing ? '' : 'transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)'}`}
        style={isCentered ? centeredStyle : initialStyle}
      >
          {/* Resize Ring - Hidden during pop */}
          {!showDeleteConfirm && !isPopping && (
            <div 
                className="resize-ring absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-slate-400/30 dark:border-white/40 rounded-full pointer-events-auto"
                style={{ width: ringDiameter, height: ringDiameter, touchAction: 'none' }}
            >
                {renderResizeHandle("-top-10 left-1/2 -translate-x-1/2", "ns-resize")}
                {renderResizeHandle("-bottom-10 left-1/2 -translate-x-1/2", "ns-resize")}
                {renderResizeHandle("top-1/2 -left-10 -translate-y-1/2", "ew-resize")}
                {renderResizeHandle("top-1/2 -right-10 -translate-y-1/2", "ew-resize")}
            </div>
          )}

          {/* Bubble (Text Editor) */}
          <div onClick={(e) => { e.stopPropagation(); textRef.current?.focus(); }}
               className={`bubble-main pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center cursor-text ${isResizing ? 'transition-none' : 'transition-all duration-300'}`}
               style={{ 
                   width: bubbleDiameter, 
                   height: bubbleDiameter, 
                   background: bubbleGradient,
                   boxShadow: '0 15px 30px rgba(0,0,0,0.3)',
                   ...(isPopping ? { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 0 } : {})
                }}
            >
              <div className="w-[65%] h-[65%] flex items-center justify-center relative">
                  
                  {/* VISUAL PLACEHOLDER - Overlay that disappears only when typing starts */}
                  {isPlaceholderVisible && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                           <span 
                                className="placeholder-text text-white font-bold italic opacity-50 text-center leading-[1.1]"
                                style={{ fontSize: `${currentFontSize}px` }}
                           >
                               Task Name
                           </span>
                      </div>
                  )}

                  {/* EDITABLE CONTENT */}
                  <div ref={textRef} contentEditable suppressContentEditableWarning 
                       onBlur={(e) => {
                          const text = e.currentTarget.innerText.trim();
                          setIsFocused(false);
                          // We do NOT reset to 'Task Name' string here to avoid selection issues.
                          // We just save empty string if empty, and let the overlay handle the visual.
                          onUpdate({...task, title: text});
                       }}
                       onFocus={(e) => {
                          setIsFocused(true);
                       }}
                       onInput={(e) => {
                          const text = e.currentTarget.innerText;
                          setHasText(!!text); // Update placeholder visibility based on real content
                          
                          const newSize = calculateFontSize(currentSizeRef.current, text || 'Task Name');
                          e.currentTarget.style.fontSize = `${newSize}px`;
                          
                          // Also update placeholder size in real-time just in case
                          const placeholderEl = viewportRef.current?.querySelector('.placeholder-text') as HTMLElement;
                          if (placeholderEl) placeholderEl.style.fontSize = `${newSize}px`;
                       }}
                       onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
                       className={`bubble-text-inner w-full text-center text-white font-bold outline-none pointer-events-auto drop-shadow-lg transition-opacity duration-200 z-20`}
                       style={{ 
                         fontSize: currentFontSize, 
                         overflowWrap: 'normal',
                         wordBreak: 'normal',
                         hyphens: 'none',
                         whiteSpace: 'pre-line',
                         lineHeight: 1.1,
                         minWidth: '20px' // Ensure caret is visible
                       }}>
                      {task.title}
                  </div>
              </div>
          </div>
      </div>

    {/* Bottom Controls Panel - Hidden during pop */}
    {!isPopping && (
      <div 
        ref={controlsRef}
        className={`${controlsClass} pointer-events-auto`}
        style={controlsTransition}
        onPointerDown={(e) => e.stopPropagation()} 
      >
        <div className="w-full relative">
            
            {showDeleteConfirm ? (
                 <div className="w-full max-w-md mx-auto p-4 bg-white/50 dark:bg-white/10 backdrop-blur-xl rounded-[2rem] border border-red-500/30 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex flex-col items-center text-center gap-3 mb-5">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center text-red-500">
                             <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">Delete Task?</h3>
                    </div>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-xl text-slate-800 dark:text-white font-semibold transition-colors">Cancel</button>
                        <button onClick={() => { onDelete(task.id); onClose(); }} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold shadow-lg shadow-red-500/20 transition-colors">Delete</button>
                    </div>
                </div>
            ) : (
                <div className={`flex flex-col relative gap-4`}>
                    
                    {isMobile ? (
                        // MOBILE LAYOUT
                        <>
                            {/* Row 1: Tools */}
                            <div className="flex items-center justify-between gap-2">
                                {renderBoardSelector()}
                                {renderToolsGroup()}
                            </div>

                            {/* Row 2: Content (if active) */}
                            {(showDescription || showSubtasks) && renderContentArea()}

                            {/* Row 3: Colors (Centered) */}
                            <div className="flex items-center justify-center mt-3">
                                <div className="overflow-x-visible">
                                     {renderColorPicker()}
                                </div>
                            </div>

                            {/* Row 4: Actions (Delete + Done) */}
                            <div className="flex items-center gap-3 mt-4">
                                {renderDeleteButton()}
                                <button 
                                    onClick={onClose}
                                    className="flex-1 h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm tracking-wide shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Check size={20} />
                                    <span>Done</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        // DESKTOP LAYOUT
                        <>
                            {/* Top: Content */}
                            {(showDescription || showSubtasks) && (
                                <>
                                    {renderContentArea()}
                                    <div className="w-full h-px bg-slate-200 dark:bg-white/10" />
                                </>
                            )}

                            {/* Bottom: Single Row Scrollable */}
                            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1 px-1">
                                <div className="flex items-center gap-2 shrink-0">
                                    {renderBoardSelector()}
                                    {renderToolsGroup()}
                                </div>
                                
                                <div className="shrink-0">
                                    {renderColorPicker()}
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-auto pl-4 border-l border-white/10">
                                    {renderDeleteButton()}
                                    <button 
                                        onClick={onClose}
                                        className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm tracking-wide shadow-md active:scale-95 transition-all hover:bg-slate-800 dark:hover:bg-gray-200"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                </div>
            )}
        </div>
      </div>
    )}
    </div>
  );
};