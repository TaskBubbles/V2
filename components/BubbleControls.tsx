
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { v4 as uuidv4 } from 'uuid';
import { Task, Board, Subtask } from '../types';
import { COLOR_GROUPS, MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE, calculateFontSize, GLASS_PANEL_CLASS, TOOLTIP_BASE_CLASS, GLASS_BTN_INACTIVE, GLASS_BTN_ACTIVE, GLASS_BTN_DANGER, GLASS_MENU_ITEM, GLASS_MENU_ITEM_ACTIVE, GLASS_MENU_ITEM_INACTIVE } from '../constants';
import { Trash2, Calendar, AlertTriangle, X, ChevronDown, Check, ChevronUp, AlignLeft, Plus, Square, CheckSquare, ListChecks, Palette } from 'lucide-react';
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
    } catch { return ""; }
};

// New Glass Primary Button Style for 'Done'
const GLASS_BTN_PRIMARY_GLASS = "relative border flex items-center justify-center shrink-0 group outline-none overflow-hidden transition-all duration-200 active:scale-95 bg-white/60 dark:bg-slate-700/60 border-white/50 dark:border-white/10 text-slate-900 dark:text-white shadow-lg hover:bg-white/80 dark:hover:bg-slate-600/80 backdrop-blur-xl font-bold tracking-wide";

export const BubbleControls: React.FC<BubbleControlsProps> = ({ task, boards, startPos, onUpdate, onDelete, onClose, onPop }) => {
  const [isCentered, setIsCentered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPopping, setIsPopping] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showColorGrid, setShowColorGrid] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [interactionReady, setInteractionReady] = useState(false);
  const [hasText, setHasText] = useState(!!task.title);
  const [winDim, setWinDim] = useState({ w: window.innerWidth, h: window.innerHeight });
  const isMobile = winDim.w < 768;
  const maxHeightRef = useRef(window.innerHeight);

  // Board Dropdown State
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [dragHoveredBoardId, setDragHoveredBoardId] = useState<string | null>(null);
  const boardMenuRef = useRef<HTMLDivElement>(null);
  const boardButtonRef = useRef<HTMLButtonElement>(null);
  const menuWasOpenOnDown = useRef(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const isDraggingBoardRef = useRef(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
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
    const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setWinDim({ w, h });
        if (h > maxHeightRef.current) maxHeightRef.current = h;
        if (isEditing && isMobile && h > maxHeightRef.current * 0.85) {
            if (textRef.current) textRef.current.blur();
            setIsEditing(false);
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isEditing, isMobile]);

  useEffect(() => { 
      const t = setTimeout(() => setIsCentered(true), 20); 
      const t2 = setTimeout(() => setInteractionReady(true), 300);
      return () => { clearTimeout(t); clearTimeout(t2); }; 
  }, []);

  useEffect(() => { setHasText(!!task.title); }, [task.title]);

  useEffect(() => { 
      if (isEditing && textRef.current) setTimeout(() => { if(textRef.current) textRef.current.focus(); }, 50);
  }, [isEditing]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (colorSectionRef.current && !colorSectionRef.current.contains(event.target as Node)) {
             // Optional close logic
          }
      };
      if (showColorGrid) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorGrid]);

  useEffect(() => {
    if (textareaRef.current && showDescription) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [task.description, showDescription]);

  useEffect(() => {
    if (showSubtasks && subtaskInputRef.current) setTimeout(() => subtaskInputRef.current?.focus(), 100);
  }, [showSubtasks]);

  useEffect(() => { if (!isResizing) currentSizeRef.current = task.size; }, [task.size, isResizing]);

  // Board Dropdown Click Outside
  useEffect(() => {
    const handleOutsideClick = (e: PointerEvent) => {
        if (!isBoardMenuOpen) return;
        const target = e.target as Node;
        if (!boardMenuRef.current?.contains(target) && !boardButtonRef.current?.contains(target)) {
            setIsBoardMenuOpen(false);
        }
    };
    if (isBoardMenuOpen) document.addEventListener('pointerdown', handleOutsideClick, true);
    return () => document.removeEventListener('pointerdown', handleOutsideClick, true);
  }, [isBoardMenuOpen]);

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault(); setIsResizing(true); setIsEditing(false);
    const cx = window.innerWidth / 2;
    const cy = isMobile ? window.innerHeight * 0.35 : window.innerHeight / 2;
    startDistRef.current = Math.hypot(e.clientX - cx, e.clientY - cy);
    startSizeRef.current = currentSizeRef.current;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    e.stopPropagation(); e.preventDefault();
    const cx = window.innerWidth / 2;
    const cy = isMobile ? window.innerHeight * 0.35 : window.innerHeight / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    const rawSize = startSizeRef.current + (dist - startDistRef.current);
    const newSize = Math.max(MIN_BUBBLE_SIZE, Math.min(MAX_BUBBLE_SIZE, rawSize));
    currentSizeRef.current = newSize;
    if (rawSize !== newSize) startDistRef.current = dist - (newSize - startSizeRef.current);
    const bubble = bubbleRef.current;
    const ring = ringRef.current;
    const diameter = newSize * 2;
    const ringDia = diameter + 60; 
    if (bubble) {
        bubble.style.width = `${diameter}px`; bubble.style.height = `${diameter}px`;
        const textEl = bubble.querySelector('.bubble-text-inner') as HTMLElement;
        if (textEl) {
            const currentText = (textEl.innerText || "").trim();
            const fontSize = calculateFontSize(newSize, currentText || "Task Name");
            textEl.style.fontSize = `${fontSize}px`;
            const placeholderEl = bubble.querySelector('.placeholder-text') as HTMLElement;
            if (placeholderEl) placeholderEl.style.fontSize = `${fontSize}px`;
        }
    }
    if (ring) { ring.style.width = `${ringDia}px`; ring.style.height = `${ringDia}px`; }
  };

  const handleResizeEnd = (e: React.PointerEvent) => {
    if (isResizing) {
        setIsResizing(false); onUpdate({ ...task, size: currentSizeRef.current });
        try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch(err) {}
    }
  };

  const handleBoardPointerDown = (e: React.PointerEvent) => {
    menuWasOpenOnDown.current = isBoardMenuOpen;
    setIsBoardMenuOpen(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingBoardRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleBoardPointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (!isDraggingBoardRef.current && Math.hypot(dx, dy) > 10) isDraggingBoardRef.current = true;
    if (isDraggingBoardRef.current) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const boardEl = elements.find(el => (el as HTMLElement).dataset.boardId) as HTMLElement | undefined;
        if (boardEl) setDragHoveredBoardId(boardEl.dataset.boardId || null);
        else setDragHoveredBoardId(null);
    }
  };

  const handleBoardPointerUp = (e: React.PointerEvent) => {
    if (isDraggingBoardRef.current && dragHoveredBoardId) {
        onUpdate({ ...task, boardId: dragHoveredBoardId });
        setIsBoardMenuOpen(false);
    }
    dragStartRef.current = null;
    isDraggingBoardRef.current = false;
    setDragHoveredBoardId(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const handleBoardClick = (e: React.MouseEvent) => {
    if (isDraggingBoardRef.current) return;
    if (menuWasOpenOnDown.current) setIsBoardMenuOpen(false);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
      e.preventDefault(); if (!newSubtaskTitle.trim()) return;
      const newSubtask: Subtask = { id: uuidv4(), title: newSubtaskTitle.trim(), completed: false };
      onUpdate({ ...task, subtasks: [...(task.subtasks || []), newSubtask] });
      setNewSubtaskTitle('');
  };

  const toggleSubtask = (id: string) => {
      onUpdate({ ...task, subtasks: (task.subtasks || []).map(s => s.id === id ? { ...s, completed: !s.completed } : s) });
  };

  const deleteSubtask = (id: string) => {
      onUpdate({ ...task, subtasks: (task.subtasks || []).filter(s => s.id !== id) });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
        if (!isMobile && !e.shiftKey) {
            e.preventDefault(); e.currentTarget.blur();
        }
    }
  };

  const ringDiameter = task.size * 2 + 60;
  const bubbleDiameter = task.size * 2;
  const safeZone = Math.min(winDim.w, winDim.h) * 0.85; 
  const fitScale = bubbleDiameter > safeZone ? safeZone / bubbleDiameter : 1;

  const initialStyle: React.CSSProperties = startPos ? { left: `${startPos.x}px`, top: `${startPos.y}px`, transform: `translate(-50%, -50%) scale(${startPos.k})` } : { left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${fitScale})` };
  const centeredStyle: React.CSSProperties = { left: '50%', top: isMobile ? (isEditing ? '40%' : '35%') : '50%', transform: `translate(-50%, -50%) scale(${fitScale})` };

  const controlsClass = isMobile 
    ? `fixed bottom-0 left-0 w-full px-5 pt-6 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.5rem))] rounded-t-[2.5rem] z-[60] max-h-[85vh] flex flex-col no-scrollbar ${GLASS_PANEL_CLASS}`
    : `absolute left-1/2 -translate-x-1/2 z-50 bottom-12 min-w-[360px] max-w-[95vw] rounded-[2rem] p-5 ${GLASS_PANEL_CLASS}`;
  
  const controlsTransition = isMobile 
    ? { transform: isCentered && !isEditing ? 'translateY(0)' : 'translateY(150%)', transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }
    : { opacity: isCentered ? 1 : 0, transform: isCentered ? 'translate(-50%, 0)' : 'translate(-50%, 20px)', transition: 'all 0.4s ease-out' };

  const renderResizeHandle = (className: string, cursor: string) => (
    <div onPointerDown={handleResizeStart} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} className={`absolute w-20 h-20 flex items-center justify-center pointer-events-auto z-[100] group ${className}`} style={{ cursor, touchAction: 'none' }}>
        <div className="w-6 h-6 bg-white rounded-full shadow-lg border-2 border-indigo-500 transition-transform group-active:scale-110 pointer-events-none" />
    </div>
  );

  const bubbleGradient = `linear-gradient(135deg, ${task.color} 0%, ${d3.color(task.color)?.brighter(0.8)?.toString() || task.color} 100%)`;
  const subtasks = task.subtasks || [];
  const progress = subtasks.length > 0 ? (subtasks.filter(s => s.completed).length / subtasks.length) * 100 : 0;
  const isPlaceholderVisible = !hasText;
  const currentFontSize = calculateFontSize(task.size, task.title || 'Task Name');

  const renderContentArea = () => (
     <div className="w-full flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
        {showDescription && (
            <div className="w-full relative group">
                <div className="absolute top-3 left-3 text-slate-500 dark:text-white/40 pointer-events-none"><AlignLeft size={16} /></div>
                <textarea ref={textareaRef} rows={task.description ? 3 : 1} placeholder="Add a description..." value={task.description || ''} onChange={(e) => onUpdate({ ...task, description: e.target.value })} className="w-full transition-colors rounded-xl py-3 pl-10 pr-4 text-sm resize-none outline-none leading-relaxed custom-scrollbar bg-white/20 dark:bg-white/5 hover:bg-white/30 dark:hover:bg-white/10 focus:bg-white/40 dark:focus:bg-white/10 border border-white/30 dark:border-white/5 focus:border-slate-300 dark:focus:border-white/20 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/30" style={{ minHeight: '46px', maxHeight: '120px' }} />
            </div>
        )}
        {showSubtasks && (
            <div className="w-full bg-white/20 dark:bg-white/5 rounded-xl border border-white/30 dark:border-white/5 overflow-hidden flex flex-col">
                 {subtasks.length > 0 && <div className="w-full h-1 bg-slate-200 dark:bg-white/10"><div className="h-full bg-green-500 dark:bg-green-400 transition-all duration-300" style={{ width: `${progress}%` }} /></div>}
                 <div className="p-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {subtasks.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 p-2 hover:bg-white/30 dark:hover:bg-white/5 rounded-lg group">
                            <button onClick={() => toggleSubtask(sub.id)} className={`shrink-0 transition-colors ${sub.completed ? 'text-green-500 dark:text-green-400' : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60'}`}>{sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}</button>
                            <input type="text" value={sub.title} onChange={(e) => onUpdate({ ...task, subtasks: subtasks.map(s => s.id === sub.id ? { ...s, title: e.target.value } : s) })} className={`flex-1 bg-transparent outline-none text-sm ${sub.completed ? 'text-slate-500 dark:text-white/40 line-through' : 'text-slate-900 dark:text-white/90'}`} />
                            <button onClick={() => deleteSubtask(sub.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-white/20 hover:text-red-500 dark:hover:text-red-400 transition-all px-1"><X size={14} /></button>
                        </div>
                    ))}
                    <form onSubmit={handleAddSubtask} className="flex items-center gap-2 p-2">
                        <Plus size={16} className="text-slate-400 dark:text-white/30 shrink-0" /><input ref={subtaskInputRef} type="text" value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} placeholder="Add subtask..." className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/30" />
                    </form>
                 </div>
            </div>
        )}
    </div>
  );

  const renderBoardSelector = () => (
    <div className={`relative group shrink-0 z-20 ${isMobile ? 'flex-1' : 'w-full'}`}>
        <div 
           ref={boardMenuRef}
           role="menu"
           aria-label="Select board"
           className={`absolute bottom-full left-0 mb-3 w-48 rounded-2xl overflow-hidden transition-all duration-300 origin-bottom z-50 ${GLASS_PANEL_CLASS}
           ${isBoardMenuOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-90 translate-y-4 pointer-events-none'}`}
        >
            <div className="p-1.5 flex flex-col gap-0.5">
                {boards.map(b => (
                    <button key={b.id} data-board-id={b.id} role="menuitem" onClick={(e) => { e.stopPropagation(); onUpdate({ ...task, boardId: b.id }); setIsBoardMenuOpen(false); }} className={`${GLASS_MENU_ITEM} ${(task.boardId === b.id || dragHoveredBoardId === b.id) ? GLASS_MENU_ITEM_ACTIVE : GLASS_MENU_ITEM_INACTIVE}`}>
                        {b.name}
                    </button>
                ))}
            </div>
        </div>

        <button 
           ref={boardButtonRef}
           onPointerDown={handleBoardPointerDown}
           onPointerMove={handleBoardPointerMove}
           onPointerUp={handleBoardPointerUp}
           onClick={handleBoardClick}
           aria-haspopup="menu"
           aria-expanded={isBoardMenuOpen}
           className={`w-full px-5 py-2.5 ${GLASS_BTN_INACTIVE} !justify-between gap-2 cursor-pointer group-hover:text-black dark:group-hover:text-white`}
        >
            <span className="text-sm font-bold truncate max-w-[120px] text-left flex-1">{currentBoardName}</span>
            <ChevronDown size={14} className={`text-slate-500 dark:text-white/40 transition-transform duration-300 ${isBoardMenuOpen ? 'rotate-180' : ''}`} />
        </button>
    </div>
  );

  const renderToolsGroup = () => (
    <div className="flex items-center gap-2 shrink-0">
        <button type="button" className={`px-3 py-2.5 ${task.dueDate ? GLASS_BTN_ACTIVE : GLASS_BTN_INACTIVE}`}>
            <div className="flex items-center gap-1.5 pointer-events-none relative z-0"><Calendar size={18} />{task.dueDate && !isMobile && (<span className="ml-0.5 text-[10px] font-bold whitespace-nowrap">{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })} {new Date(task.dueDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>)}</div>
            <input ref={dateInputRef} type="datetime-local" className="absolute inset-0 opacity-0 w-full h-full z-10 cursor-pointer date-trigger" value={toDateTimeLocal(task.dueDate)} onChange={(e) => onUpdate({ ...task, dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })} onClick={(e) => { e.stopPropagation(); try { if (e.currentTarget && 'showPicker' in e.currentTarget) e.currentTarget.showPicker(); } catch (err) {} }} />
            <style>{`.date-trigger::-webkit-calendar-picker-indicator { position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 0; margin: 0; opacity: 0; cursor: pointer; }`}</style>
        </button>
        <button onClick={() => { setShowDescription(!showDescription); if (!showDescription) setTimeout(() => textareaRef.current?.focus(), 50); }} className={`px-3 py-2.5 ${(showDescription || task.description) ? GLASS_BTN_ACTIVE : GLASS_BTN_INACTIVE}`}><AlignLeft size={18} /></button>
        <button onClick={() => setShowSubtasks(!showSubtasks)} className={`px-3 py-2.5 ${(showSubtasks || (task.subtasks && task.subtasks.length > 0)) ? GLASS_BTN_ACTIVE : GLASS_BTN_INACTIVE}`}><ListChecks size={18} />{subtasks.length > 0 && <span className="ml-1 text-[10px] font-bold">{subtasks.filter(s => s.completed).length}/{subtasks.length}</span>}</button>
    </div>
  );

  const renderColorPicker = () => (
    <div ref={colorSectionRef} className={`relative group/colors z-10 shrink-0 ${isMobile ? 'w-full' : ''}`}>
        <div className={`${showColorGrid ? 'flex opacity-100 pointer-events-auto scale-100' : 'hidden opacity-0 pointer-events-none scale-95'} ${isMobile ? 'static flex-col gap-3 w-full mb-4 animate-in slide-in-from-bottom-2 fade-in' : 'absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 flex-col gap-2 p-2 bg-white/30 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-2xl shadow-2xl origin-bottom transition-all duration-300'}`} style={{ width: isMobile ? '100%' : 'max-content' }}>
                <div className={`flex items-center ${isMobile ? 'justify-between px-2' : 'gap-3 justify-center'}`}>
                    {COLOR_GROUPS.map((group, idx) => {
                        if (idx === COLOR_GROUPS.length - 1) {
                            return (
                                <label key="custom-color" className={`rounded-full transition-transform hover:scale-110 relative flex items-center justify-center cursor-pointer overflow-hidden bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 ${isMobile ? 'w-10 h-10' : 'w-7 h-7'}`}>
                                    <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => onUpdate({ ...task, color: e.target.value })} />
                                    <Palette size={isMobile ? 18 : 14} className="text-white drop-shadow-md" />
                                </label>
                            );
                        }
                        return (
                            <button key={`${group.name}-light`} onClick={() => onUpdate({ ...task, color: group.shades[0] })} className={`rounded-full transition-transform hover:scale-110 relative ${isMobile ? 'w-10 h-10' : 'w-7 h-7'} ${task.color === group.shades[0] ? 'scale-110 ring-2 ring-white' : ''}`} style={{ backgroundColor: group.shades[0] }} />
                        );
                    })}
                </div>
                <div className={`flex items-center ${isMobile ? 'justify-between px-2' : 'gap-3 justify-center'}`}>{COLOR_GROUPS.map((group) => (<button key={`${group.name}-dark`} onClick={() => onUpdate({ ...task, color: group.shades[2] })} className={`rounded-full transition-transform hover:scale-110 relative ${isMobile ? 'w-10 h-10' : 'w-7 h-7'} ${task.color === group.shades[2] ? 'scale-110 ring-2 ring-white' : ''}`} style={{ backgroundColor: group.shades[2] }} />))}{!isMobile && <div className="w-8 h-8 opacity-0" />}</div>
        </div>
        <div className={`flex items-center ${isMobile ? 'justify-between px-2' : 'gap-2 justify-center'}`}>{COLOR_GROUPS.map((group) => (<button key={group.name} onClick={() => onUpdate({ ...task, color: group.shades[1] })} className={`rounded-full transition-all duration-300 relative flex items-center justify-center ${isMobile ? 'w-10 h-10' : 'w-6 h-6'} ${group.shades.includes(task.color) ? 'scale-110 ring-2 ring-white/50 shadow-md' : 'hover:scale-105'}`} style={{ backgroundColor: group.shades[1] }}>{group.shades.includes(task.color) && <div className="absolute -bottom-2 w-1 h-1 bg-slate-800 dark:bg-white rounded-full" />}</button>))}<button onClick={() => setShowColorGrid(!showColorGrid)} className={`${GLASS_BTN_INACTIVE} ${showColorGrid ? GLASS_BTN_ACTIVE : ''} ${isMobile ? 'w-10 h-10 rounded-full' : 'w-8 h-8 rounded-full'}`}><ChevronUp size={14} className={`transition-transform duration-300 ${showColorGrid ? 'rotate-180' : ''}`} /></button></div>
    </div>
  );

  const renderDeleteButton = () => (
    <button onClick={() => setShowDeleteConfirm(true)} className={`${GLASS_BTN_DANGER} ${isMobile ? 'w-14 h-14' : 'p-2.5'}`}><Trash2 size={isMobile ? 22 : 18} /></button>
  );

  return (
    <div className="absolute inset-0 z-40 overflow-hidden" onPointerUp={handleResizeEnd} onPointerLeave={handleResizeEnd} onPointerDown={() => audioService.resume()}>
      <div className={`absolute inset-0 bg-slate-200/40 dark:bg-black/40 backdrop-blur-[4px] transition-opacity duration-300 ${isPopping ? 'opacity-0' : 'opacity-100'}`} onClick={onClose} />
      <div ref={viewportRef} className={`absolute pointer-events-none z-40 ${isResizing ? '' : 'transition-all duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)'}`} style={isCentered ? centeredStyle : initialStyle}>
          {!showDeleteConfirm && !isPopping && (
            <div ref={ringRef} className="resize-ring absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-slate-400/30 dark:border-white/40 rounded-full pointer-events-auto" style={{ width: ringDiameter, height: ringDiameter, touchAction: 'none' }}>
                {renderResizeHandle("-top-10 left-1/2 -translate-x-1/2", "ns-resize")}{renderResizeHandle("-bottom-10 left-1/2 -translate-x-1/2", "ns-resize")}{renderResizeHandle("top-1/2 -left-10 -translate-y-1/2", "ew-resize")}{renderResizeHandle("top-1/2 -right-10 -translate-y-1/2", "ew-resize")}
            </div>
          )}
          {!isEditing && !isResizing && !isPopping && !showDeleteConfirm && (
             <div className="absolute left-1/2 -translate-x-1/2 top-1/2 pointer-events-none z-30 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ transform: `translate(-50%, calc(-50% - ${task.size}px - 32px))` }}>
                <div className={TOOLTIP_BASE_CLASS}>Tap to edit</div><div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white/90 dark:border-t-slate-800/90 absolute left-1/2 -translate-x-1/2 -bottom-[6px]" />
             </div>
          )}
          <div ref={bubbleRef} onClick={(e) => { e.stopPropagation(); if (interactionReady) { setIsEditing(true); setTimeout(() => textRef.current?.focus(), 0); } }} className={`bubble-main pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center cursor-text ${isResizing ? 'transition-none' : 'transition-all duration-300'}`} style={{ width: bubbleDiameter, height: bubbleDiameter, background: bubbleGradient, boxShadow: '0 15px 30px rgba(0,0,0,0.3)', ...(isPopping ? { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 0 } : {}) }}>
              <div className="w-[65%] h-[65%] flex items-center justify-center relative">
                  {isPlaceholderVisible && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><span className="placeholder-text text-white font-bold italic opacity-50 text-center leading-[1.1]" style={{ fontSize: `${currentFontSize}px` }}>Task Name</span></div>}
                  <div 
                    ref={textRef} 
                    contentEditable={isEditing} 
                    suppressContentEditableWarning 
                    onBlur={(e) => { setIsEditing(false); onUpdate({...task, title: e.currentTarget.innerText.trim()}); }} 
                    onInput={(e) => { setHasText(!!e.currentTarget.innerText); const newSize = calculateFontSize(currentSizeRef.current, e.currentTarget.innerText || 'Task Name'); e.currentTarget.style.fontSize = `${newSize}px`; const placeholderEl = viewportRef.current?.querySelector('.placeholder-text') as HTMLElement; if (placeholderEl) placeholderEl.style.fontSize = `${newSize}px`; }} 
                    onKeyDown={handleKeyDown} 
                    className={`bubble-text-inner w-full text-center text-white font-bold outline-none pointer-events-auto drop-shadow-lg transition-opacity duration-200 z-20`} 
                    style={{ fontSize: currentFontSize, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.1, minWidth: '20px' }}
                  >
                    {task.title}
                  </div>
              </div>
          </div>
      </div>
    {!isPopping && (
      <div ref={controlsRef} className={`${controlsClass} pointer-events-auto`} style={controlsTransition} onPointerDown={(e) => e.stopPropagation()} >
        <div className="w-full h-full relative flex flex-col">
            {showDeleteConfirm ? (
                 <div className="w-full max-w-md mx-auto p-4 bg-white/50 dark:bg-white/10 backdrop-blur-xl rounded-[2rem] border border-red-500/30 shadow-2xl animate-in fade-in zoom-in-95 duration-200"><div className="flex flex-col items-center text-center gap-3 mb-5"><div className="w-12 h-12 rounded-full bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center text-red-500"><AlertTriangle size={24} /></div><h3 className="text-slate-900 dark:text-white font-bold text-lg">Delete Task?</h3></div><div className="flex gap-3 w-full"><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-xl text-slate-800 dark:text-white font-semibold transition-colors">Cancel</button><button onClick={() => { onDelete(task.id); onClose(); }} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold shadow-lg shadow-red-500/20 transition-colors">Delete</button></div></div>
            ) : (
                <>
                {isMobile ? (
                    <>
                        <div className="flex items-center justify-between gap-2 shrink-0 mb-4 z-20 relative">
                            {renderBoardSelector()}
                            {renderToolsGroup()}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-5 px-5 min-h-0">
                            {(showDescription || showSubtasks) && (
                                <div className="mb-3">
                                    {renderContentArea()}
                                </div>
                            )}
                            <div className="flex items-center justify-center mb-4">
                                <div className="overflow-x-visible w-full">{renderColorPicker()}</div>
                            </div>
                            <div className="flex items-center gap-3 pb-1">
                                {renderDeleteButton()}
                                <button onClick={onClose} className={`flex-1 h-14 rounded-2xl ${GLASS_BTN_PRIMARY_GLASS} flex items-center justify-center gap-2`}><Check size={20} /><span>Done</span></button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-[140px] max-w-[200px] z-20 relative">
                                {renderBoardSelector()}
                            </div>
                            {renderToolsGroup()}
                        </div>
                        
                        {(showDescription || showSubtasks) && (
                            <>
                                <div className="w-full h-px bg-slate-200 dark:bg-white/10" />
                                {renderContentArea()}
                            </>
                        )}

                        <div className="w-full h-px bg-slate-200 dark:bg-white/10" />

                        <div className="flex items-center justify-between gap-4">
                            <div className="relative z-10">
                                    {renderColorPicker()}
                            </div>
                            <div className="flex items-center gap-3">
                                {renderDeleteButton()}
                                <button onClick={onClose} className={`h-10 px-5 rounded-xl ${GLASS_BTN_PRIMARY_GLASS} flex items-center justify-center gap-2`}>
                                    <Check size={18} /><span>Done</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                </>
            )}
        </div>
      </div>
    )}
    {isMobile && isEditing && (
        <button 
           className="fixed bottom-6 right-6 z-[70] bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white backdrop-blur-xl w-14 h-14 rounded-full shadow-2xl border border-white/40 dark:border-white/10 flex items-center justify-center animate-in fade-in zoom-in duration-300 pointer-events-auto active:scale-90 transition-all hover:bg-white/80 dark:hover:bg-slate-700/60"
           onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); textRef.current?.blur(); }}
           aria-label="Close keyboard"
        >
           <ChevronDown size={32} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};
