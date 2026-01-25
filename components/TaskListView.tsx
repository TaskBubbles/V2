import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Task } from '../types';
import { ArrowLeft, CheckSquare, Square, List, CalendarClock, CheckCircle2, Pencil, GripVertical } from 'lucide-react';
import { MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE } from '../constants';

interface TaskListViewProps {
  tasks: Task[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
  onBatchUpdateTasks?: (tasks: Task[]) => void;
  onEditTask: (task: Task) => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  isOpen,
  onClose,
  onUpdateTask,
  onBatchUpdateTasks,
  onEditTask,
}) => {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  
  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [isDropping, setIsDropping] = useState(false); // New Phase
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragItemDim, setDragItemDim] = useState({ width: 0, height: 0 });
  const [dropTargetPos, setDropTargetPos] = useState<{x: number, y: number} | null>(null);
  
  // Refs for logic without re-renders
  const listRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const justDroppedIdRef = useRef<string | null>(null);
  
  // Source of truth during drag to decouple from render cycle
  const itemsRef = useRef<Task[]>([]); 

  const dragRef = useRef<{
      active: boolean;
      id: string | null;
      lastPointerY: number;
  }>({ active: false, id: null, lastPointerY: 0 });

  const autoScrollFrame = useRef<number>(0);

  // Sync props to local state
  // IMPORTANT: Removed 'isDragging' and 'isDropping' from dependency array 
  // to prevent revert-to-old-props during drag/drop operations.
  useEffect(() => {
    if (!isDragging && !isDropping) {
        const sorted = [...tasks].sort((a, b) => b.size - a.size);
        setActiveTasks(sorted.filter(t => !t.completed));
        setCompletedTasks(sorted.filter(t => t.completed));
    }
  }, [tasks, isOpen]); 

  // --- FLIP ANIMATION ---
  const snapshot = () => {
      if (listRef.current) {
          const rects = new Map<string, DOMRect>();
          Array.from(listRef.current.children).forEach((child) => {
              const el = child as HTMLElement;
              const id = el.dataset.taskId;
              if (id) {
                  rects.set(id, el.getBoundingClientRect());
              }
          });
          prevRects.current = rects;
      }
  };

  useLayoutEffect(() => {
    if (!listRef.current) return;
    
    const children = Array.from(listRef.current.children) as HTMLElement[];
    
    children.forEach(child => {
        const id = child.dataset.taskId;
        if (!id) return;
        
        // Don't animate the invisible placeholder of the item currently being dragged
        if (id === draggedTaskId) return;

        // Don't animate the item that was just dropped (it should appear instantly in its final spot)
        if (id === justDroppedIdRef.current) return;

        const prevRect = prevRects.current.get(id);
        if (!prevRect) return;

        const newRect = child.getBoundingClientRect();
        const dy = prevRect.top - newRect.top;

        if (dy !== 0) {
            // Invert
            child.style.transform = `translateY(${dy}px)`;
            child.style.transition = 'none';
            
            // Force Reflow
            void child.offsetHeight;

            // Play
            requestAnimationFrame(() => {
                child.style.transform = '';
                child.style.transition = 'transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)';
            });
        }
    });

    // Clear the drop ref after the effect runs
    if (justDroppedIdRef.current) {
        justDroppedIdRef.current = null;
    }

  }, [activeTasks, draggedTaskId]);

  // --- AUTO SCROLL LOGIC ---
  const performAutoScroll = useCallback(() => {
    if (!dragRef.current.active || !scrollContainerRef.current) return;
    
    const { lastPointerY } = dragRef.current;
    const container = scrollContainerRef.current;
    const { top, bottom, height } = container.getBoundingClientRect();
    
    // Active zones (top 20% and bottom 20%)
    const zoneSize = Math.max(80, height * 0.2);
    const topZone = top + zoneSize;
    const bottomZone = bottom - zoneSize;

    let speed = 0;

    if (lastPointerY < topZone) {
        // Scroll Up
        const intensity = Math.max(0, (topZone - lastPointerY) / zoneSize);
        speed = -1 * (4 + intensity * 16); 
    } else if (lastPointerY > bottomZone) {
        // Scroll Down
        const intensity = Math.max(0, (lastPointerY - bottomZone) / zoneSize);
        speed = 4 + intensity * 16;
    }

    if (speed !== 0) {
        container.scrollTop += speed;
    }

    autoScrollFrame.current = requestAnimationFrame(performAutoScroll);
  }, []);

  // --- POINTER EVENT HANDLERS ---

  const handlePointerDown = (e: React.PointerEvent, task: Task) => {
      e.preventDefault(); 
      e.stopPropagation();
      
      const row = (e.currentTarget as HTMLElement).closest('.task-row') as HTMLElement;
      if (!row) return;

      const rect = row.getBoundingClientRect();
      
      // Initialize itemsRef with current state
      itemsRef.current = [...activeTasks];

      setDraggedTaskId(task.id);
      setDragItemDim({ width: rect.width, height: rect.height });
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setPointerPos({ x: e.clientX, y: e.clientY });
      setIsDragging(true);
      setIsDropping(false); // Reset dropping state

      dragRef.current = {
          active: true,
          id: task.id,
          lastPointerY: e.clientY
      };

      snapshot();

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      
      // Start Auto Scroll
      autoScrollFrame.current = requestAnimationFrame(performAutoScroll);
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
      if (!dragRef.current.active) return;
      
      setPointerPos({ x: e.clientX, y: e.clientY });
      dragRef.current.lastPointerY = e.clientY;

      if (listRef.current) {
          const draggedId = dragRef.current.id;
          if (!draggedId) return;

          const children = Array.from(listRef.current.children) as HTMLElement[];
          // Filter valid targets (excluding the dragged item's placeholder)
          const validTargets = children.filter(c => c.dataset.taskId !== draggedId);

          let insertIndex = validTargets.length;
          
          for (let i = 0; i < validTargets.length; i++) {
              const rect = validTargets[i].getBoundingClientRect();
              const threshold = rect.top + rect.height / 2;
              
              if (e.clientY < threshold) {
                  insertIndex = i;
                  break;
              }
          }

          const currentList = itemsRef.current;
          const filteredList = currentList.filter(t => t.id !== draggedId);
          const draggedItem = currentList.find(t => t.id === draggedId);
          
          if (!draggedItem) return;

          const newList = [
              ...filteredList.slice(0, insertIndex),
              draggedItem,
              ...filteredList.slice(insertIndex)
          ];

          const hasChanged = newList.some((t, i) => t.id !== currentList[i]?.id);

          if (hasChanged) {
              const rects = new Map<string, DOMRect>();
              children.forEach(c => {
                 const id = c.dataset.taskId;
                 if(id) rects.set(id, c.getBoundingClientRect());
              });
              prevRects.current = rects;

              itemsRef.current = newList;
              setActiveTasks(newList);
          }
      }
  }, []);

  // Extracted finalize function for reuse
  const finalizeDrop = useCallback(() => {
    // CRITICAL FIX: Snapshot current state before applying final updates
    // This ensures prevRects has the "dragged" positions, not stale "pre-drag" positions.
    if (listRef.current) {
          const rects = new Map<string, DOMRect>();
          Array.from(listRef.current.children).forEach((child) => {
              const el = child as HTMLElement;
              const id = el.dataset.taskId;
              if (id) {
                  rects.set(id, el.getBoundingClientRect());
              }
          });
          prevRects.current = rects;
    }

    let finalTasks = itemsRef.current;

    if (onBatchUpdateTasks) {
          const count = finalTasks.length;
          const updated = finalTasks.map((t, i) => {
              let newSize;
              if (count === 1) newSize = MAX_BUBBLE_SIZE;
              else {
                  const pct = i / (count - 1);
                  newSize = Math.round(MAX_BUBBLE_SIZE - (pct * (MAX_BUBBLE_SIZE - MIN_BUBBLE_SIZE)));
              }
              return { ...t, size: newSize };
          });
          
          finalTasks = updated;
          onBatchUpdateTasks(updated);
    }

    setActiveTasks(finalTasks);
    justDroppedIdRef.current = dragRef.current.id;

    // Reset everything
    setIsDragging(false);
    setIsDropping(false);
    setDraggedTaskId(null);
    setDropTargetPos(null);
    dragRef.current.active = false;
  }, [onBatchUpdateTasks]);

  const onPointerUp = useCallback(() => {
      if (!dragRef.current.active) return;

      cancelAnimationFrame(autoScrollFrame.current);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      // --- PHASE 1: Calculate Drop Target ---
      const draggedId = dragRef.current.id;
      const itemEl = listRef.current?.querySelector(`[data-task-id="${draggedId}"]`) as HTMLElement;

      if (itemEl) {
          const rect = itemEl.getBoundingClientRect();
          setDropTargetPos({ x: rect.left, y: rect.top });
          setIsDropping(true); // Triggers the "Fly Home" animation
          
          // Wait for transition (matches CSS duration)
          setTimeout(() => {
              finalizeDrop();
          }, 250);
      } else {
          // Fallback if element missing
          finalizeDrop();
      }
  }, [finalizeDrop]);

  // --- RENDER HELPERS ---

  const renderTaskContent = (task: Task) => {
    const minDot = 4;
    const maxDot = 24;
    const percentage = (task.size - MIN_BUBBLE_SIZE) / (MAX_BUBBLE_SIZE - MIN_BUBBLE_SIZE);
    const dotSize = Math.max(minDot, Math.min(maxDot, minDot + (percentage * (maxDot - minDot))));

    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(s => s.completed).length;
    const progress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;

    return (
        <div className={`relative flex items-center gap-3 p-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm transition-all
            ${task.completed ? 'opacity-60' : ''}`}>
            
            {!task.completed && (
                <div 
                    className="drag-handle -ml-2 p-2 cursor-grab active:cursor-grabbing text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 touch-none"
                    onPointerDown={(e) => handlePointerDown(e, task)}
                >
                    <GripVertical size={18} />
                </div>
            )}

            <div className="h-6 flex items-center justify-center shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={() => onUpdateTask({ ...task, completed: !task.completed })}
                    className={`transition-all duration-300 ${
                        task.completed 
                        ? 'text-green-500 dark:text-green-400 scale-100' 
                        : 'text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/40 hover:scale-110 active:scale-90'
                        }`}
                >
                    {task.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-0.5 select-none">
                <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-medium text-[15px] leading-6 truncate ${task.completed ? 'text-slate-400 dark:text-white/30 line-through' : 'text-slate-900 dark:text-white/90'}`}>
                        {task.title || "Untitled Task"}
                    </h3>
                </div>
                {(task.dueDate || task.description) && (
                    <div className="flex items-center gap-3 text-[11px] mt-0.5">
                        {task.dueDate && (
                            <div className={`flex items-center gap-1.5 ${task.completed ? 'text-slate-300 dark:text-white/20' : 'text-blue-500 dark:text-blue-300/70'}`}>
                                <CalendarClock size={11} />
                                <span>{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                        )}
                        {task.description && (
                            <p className="text-slate-400 dark:text-white/30 truncate max-w-[150px]">{task.description}</p>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 pl-2 shrink-0">
                 {!isDragging && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                         <Pencil size={14} className="text-slate-400" />
                    </div>
                 )}
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

            {subtasks.length > 0 && !task.completed && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-slate-100 dark:bg-white/5 w-full">
                    <div className="h-full bg-blue-500/40 dark:bg-blue-400/40" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>
    );
  };

  const draggedTask = activeTasks.find(t => t.id === draggedTaskId);

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
         <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

        <div className="relative px-6 py-6 border-b border-slate-200 dark:border-white/10 flex items-center gap-4 bg-white/20 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full transition-colors active:scale-90 duration-200 hover:bg-white/40 dark:hover:bg-white/10 text-slate-400 dark:text-white/50 hover:text-slate-800 dark:hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex-1">
             <h2 className="text-xl font-bold text-slate-900 dark:text-white/90 tracking-tight">Prioritize Tasks</h2>
             <p className="text-[10px] text-slate-500 dark:text-white/40 font-medium">Drag handle to reorder</p>
          </div>
          
          <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-white/20 dark:bg-white/10 text-slate-500 dark:text-white/40 border-slate-200 dark:border-white/5">
                {activeTasks.length}
          </span>
        </div>

        <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto p-4 custom-scrollbar scroll-smooth">
          
          <div ref={listRef} className="space-y-2 pb-24 min-h-[50px]">
             {activeTasks.length > 0 ? (
                 activeTasks.map((task) => (
                    <div 
                        key={task.id} 
                        data-task-id={task.id}
                        className={`task-row group cursor-pointer transition-transform duration-200
                             ${task.id === draggedTaskId ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:scale-[1.01]'}`}
                        onClick={() => {
                            if(!isDragging) {
                                onEditTask(task);
                                onClose();
                            }
                        }}
                    >
                        {renderTaskContent(task)}
                    </div>
                 ))
             ) : (
                 <div className="h-64 flex flex-col items-center justify-center text-slate-300 dark:text-white/10 gap-3">
                    <List size={32} strokeWidth={1.5} className="opacity-80" />
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60">All Clear</p>
                 </div>
             )}
          </div>

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
                    {completedTasks.map((task) => (
                        <div key={task.id} className="cursor-pointer" onClick={() => { onEditTask(task); onClose(); }}>
                            {renderTaskContent(task)}
                        </div>
                    ))}
                 </div>
             </div>
          )}
        </div>
      </div>

      {isDragging && draggedTask && createPortal(
          <div 
              className="fixed z-[100] pointer-events-none touch-none"
              style={{
                  top: 0,
                  left: 0,
                  width: dragItemDim.width,
                  height: dragItemDim.height,
                  // If Dropping: Move to target, Scale 1, No Rotate. If Dragging: Follow Mouse, Scale 1.05, Rotate 1deg
                  transition: isDropping ? 'transform 0.25s cubic-bezier(0.2, 1, 0.3, 1)' : 'none',
                  transform: isDropping && dropTargetPos 
                    ? `translate(${dropTargetPos.x}px, ${dropTargetPos.y}px) scale(1) rotate(0deg)`
                    : `translate(${pointerPos.x - dragOffset.x}px, ${pointerPos.y - dragOffset.y}px) scale(1.05) rotate(1deg)`,
              }}
          >
              <div className="shadow-2xl shadow-black/20 rounded-2xl overflow-hidden ring-1 ring-white/20 dark:ring-white/10">
                  {renderTaskContent(draggedTask)}
              </div>
          </div>,
          document.body
      )}
    </>
  );
};