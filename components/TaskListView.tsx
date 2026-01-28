
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
  
  const [isDragging, setIsDragging] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragItemDim, setDragItemDim] = useState({ width: 0, height: 0 });
  const [dropTargetPos, setDropTargetPos] = useState<{x: number, y: number} | null>(null);
  
  const listRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const justDroppedIdRef = useRef<string | null>(null);
  const itemsRef = useRef<Task[]>([]); 
  const dragRef = useRef<{ 
    active: boolean; 
    id: string | null; 
    lastPointerY: number; 
    startPointerPos: { x: number, y: number } | null;
    hasMoved: boolean;
  }>({ 
    active: false, 
    id: null, 
    lastPointerY: 0, 
    startPointerPos: null,
    hasMoved: false 
  });
  const autoScrollFrame = useRef<number>(0);

  useEffect(() => {
    if (!isDragging && !isDropping) {
        const sorted = [...tasks].sort((a, b) => b.size - a.size);
        setActiveTasks(sorted.filter(t => !t.completed));
        setCompletedTasks(sorted.filter(t => t.completed));
    }
  }, [tasks, isOpen, isDragging, isDropping]); 

  const snapshot = () => {
      if (listRef.current) {
          const rects = new Map<string, DOMRect>();
          Array.from(listRef.current.children).forEach((node) => {
              const child = node as HTMLElement;
              const id = child.dataset.taskId;
              if (id) rects.set(id, child.getBoundingClientRect());
          });
          prevRects.current = rects;
      }
  };

  useLayoutEffect(() => {
    if (!listRef.current) return;
    const children = Array.from(listRef.current.children) as HTMLElement[];
    children.forEach(child => {
        const id = child.dataset.taskId;
        if (!id || id === draggedTaskId || id === justDroppedIdRef.current) return;
        const prevRect = prevRects.current.get(id);
        if (!prevRect) return;
        const newRect = child.getBoundingClientRect();
        const dy = prevRect.top - newRect.top;
        if (dy !== 0) {
            child.style.transform = `translateY(${dy}px)`;
            child.style.transition = 'none';
            void child.offsetHeight;
            requestAnimationFrame(() => {
                child.style.transform = '';
                child.style.transition = 'transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)';
            });
        }
    });
    if (justDroppedIdRef.current) justDroppedIdRef.current = null;
  }, [activeTasks, draggedTaskId]);

  const performAutoScroll = useCallback(() => {
    if (!dragRef.current.active || !scrollContainerRef.current || !dragRef.current.hasMoved) return;
    const { lastPointerY } = dragRef.current;
    const container = scrollContainerRef.current;
    const { top, bottom, height } = container.getBoundingClientRect();
    const zoneSize = Math.max(80, height * 0.2);
    let speed = 0;
    if (lastPointerY < top + zoneSize) speed = -1 * (4 + (top + zoneSize - lastPointerY) / zoneSize * 16);
    else if (lastPointerY > bottom - zoneSize) speed = 4 + (lastPointerY - (bottom - zoneSize)) / zoneSize * 16;
    if (speed !== 0) container.scrollTop += speed;
    autoScrollFrame.current = requestAnimationFrame(performAutoScroll);
  }, []);

  const handlePointerDown = (e: React.PointerEvent, task: Task) => {
      if (task.completed) return;
      const target = e.target as HTMLElement;
      const isButton = target.closest('button');
      if (isButton) return;

      // On touch devices, only allow dragging via the grip handle to prevent scroll interference
      if (e.pointerType === 'touch') {
          const isHandle = target.closest('.drag-handle');
          if (!isHandle) return;
      }

      const row = e.currentTarget as HTMLElement;
      row.setPointerCapture(e.pointerId); // Crucial: prevents browser from hijacking event stream (scrolling)
      
      const rect = row.getBoundingClientRect();
      
      dragRef.current = { 
          active: true, 
          id: task.id, 
          lastPointerY: e.clientY,
          startPointerPos: { x: e.clientX, y: e.clientY },
          hasMoved: false
      };
      
      setIsDragging(false); // Reset on every down
      itemsRef.current = [...activeTasks];
      setDraggedTaskId(task.id);
      setDragItemDim({ width: rect.width, height: rect.height });
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setPointerPos({ x: e.clientX, y: e.clientY });

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
      if (!dragRef.current.active) return;
      
      const start = dragRef.current.startPointerPos;
      if (start && !dragRef.current.hasMoved) {
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.hypot(dx, dy) > 8) {
              dragRef.current.hasMoved = true;
              setIsDragging(true);
              snapshot();
              autoScrollFrame.current = requestAnimationFrame(performAutoScroll);
          }
      }

      if (dragRef.current.hasMoved) {
          e.preventDefault(); // Prevent default touch actions while dragging
          setPointerPos({ x: e.clientX, y: e.clientY });
          dragRef.current.lastPointerY = e.clientY;
          if (listRef.current) {
              const draggedId = dragRef.current.id;
              const children = Array.from(listRef.current.children) as HTMLElement[];
              const validTargets = children.filter(c => c.dataset.taskId !== draggedId);
              let insertIndex = validTargets.length;
              for (let i = 0; i < validTargets.length; i++) {
                  const target = validTargets[i];
                  const rect = target.getBoundingClientRect();
                  if (e.clientY < rect.top + rect.height / 2) {
                      insertIndex = i; break;
                  }
              }
              const currentList = itemsRef.current;
              const newList = [...currentList.filter(t => t.id !== draggedId)];
              const draggedItem = currentList.find(t => t.id === draggedId);
              if (draggedItem) {
                newList.splice(insertIndex, 0, draggedItem);
                if (newList.some((t, i) => t.id !== currentList[i]?.id)) {
                    const rects = new Map<string, DOMRect>();
                    children.forEach(c => { if(c.dataset.taskId) rects.set(c.dataset.taskId, c.getBoundingClientRect()); });
                    prevRects.current = rects;
                    itemsRef.current = newList; 
                    setActiveTasks(newList);
                }
              }
          }
      }
  }, [performAutoScroll]);

  const finalizeDrop = useCallback(() => {
    if (listRef.current) {
          const rects = new Map<string, DOMRect>();
          Array.from(listRef.current.children).forEach((child) => {
              const element = child as HTMLElement;
              const id = element.dataset.taskId;
              if (id) rects.set(id, element.getBoundingClientRect());
          });
          prevRects.current = rects;
    }
    let finalTasks = itemsRef.current;
    if (onBatchUpdateTasks) {
          const count = finalTasks.length;
          finalTasks = finalTasks.map((t, i) => ({ ...t, size: count === 1 ? MAX_BUBBLE_SIZE : Math.round(MAX_BUBBLE_SIZE - (i / (count - 1) * (MAX_BUBBLE_SIZE - MIN_BUBBLE_SIZE))) }));
          onBatchUpdateTasks(finalTasks);
    }
    setActiveTasks(finalTasks);
    justDroppedIdRef.current = dragRef.current.id;
    setIsDragging(false); setIsDropping(false); setDraggedTaskId(null); setDropTargetPos(null); dragRef.current.active = false;
  }, [onBatchUpdateTasks]);

  const onPointerUp = useCallback(() => {
      const moved = dragRef.current.hasMoved;
      const draggedId = dragRef.current.id;
      
      cancelAnimationFrame(autoScrollFrame.current);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      
      if (!dragRef.current.active) return;
      
      if (moved) {
          const itemEl = listRef.current?.querySelector(`[data-task-id="${draggedId}"]`) as HTMLElement;
          if (itemEl) {
              const rect = itemEl.getBoundingClientRect();
              setDropTargetPos({ x: rect.left, y: rect.top });
              setIsDropping(true);
              setTimeout(finalizeDrop, 250);
          } else {
              finalizeDrop();
          }
      } else {
          // Tap handling
          setIsDragging(false);
          setDraggedTaskId(null);
          dragRef.current.active = false;
      }
  }, [finalizeDrop, onPointerMove]);

  const renderTaskContent = (task: Task) => {
    const dotSize = Math.max(4, Math.min(24, 4 + (task.size - MIN_BUBBLE_SIZE) / (MAX_BUBBLE_SIZE - MIN_BUBBLE_SIZE) * 20));
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(s => s.completed).length;
    const progress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;
    return (
        <div className={`relative flex items-center gap-4 p-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm transition-all ${task.completed ? 'opacity-60' : ''}`}>
            <div className="h-6 flex items-center justify-center shrink-0">
                <button onClick={(e) => { e.stopPropagation(); onUpdateTask({ ...task, completed: !task.completed }); }} className={`transition-all duration-300 ${task.completed ? 'text-green-500 scale-100' : 'text-slate-300 hover:text-slate-500 hover:scale-110 active:scale-90'}`}>
                    {task.completed ? <CheckSquare size={22} /> : <Square size={22} />}
                </button>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5 select-none">
                <h3 className={`font-semibold text-[15px] font-medium leading-6 truncate ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white/90'}`}>{task.title || "Untitled Task"}</h3>
                {subtasks.length > 0 && !task.completed && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500/50 dark:bg-blue-400/50" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-white/30 uppercase">{completedSubtasks}/{subtasks.length}</span>
                  </div>
                )}
            </div>
            <div className="flex items-center gap-3 pl-2 shrink-0">
                <div className="rounded-full border border-slate-50 dark:border-white/5" style={{ width: `${dotSize}px`, height: `${dotSize}px`, background: task.color, opacity: task.completed ? 0.3 : 0.9, boxShadow: task.completed ? 'none' : `0 0 12px ${task.color}50` }} />
                {!task.completed && (
                  <div className="drag-handle text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing p-2 -mr-2 touch-none">
                    <GripVertical size={20} />
                  </div>
                )}
            </div>
        </div>
    );
  };

  const draggedTask = activeTasks.find(t => t.id === draggedTaskId);

  return (
    <>
      <div className={`fixed inset-0 bg-slate-200/40 dark:bg-black/40 backdrop-blur-[2px] z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[420px] shadow-2xl z-[70] transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col bg-white/40 dark:bg-slate-900/30 backdrop-blur-3xl border-l border-white/60 dark:border-white/10 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="relative px-6 py-6 border-b border-slate-200 dark:border-white/10 flex items-center gap-4 bg-white/20 dark:bg-white/[0.02]">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full transition-colors active:scale-90 text-slate-400 hover:text-slate-800"><ArrowLeft size={20} /></button>
          <div className="flex-1">
             <h2 className="text-xl font-bold text-slate-900 dark:text-white/90">Prioritize Tasks</h2>
             <p className="text-[10px] text-slate-500 dark:text-white/40 font-medium">Drag the handle to reorder</p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-white/20 text-slate-500">{activeTasks.length}</span>
        </div>
        <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div ref={listRef} className="space-y-2 pb-24 min-h-[50px]">
             {activeTasks.map((task) => (
                <div 
                    key={task.id} 
                    data-task-id={task.id} 
                    onPointerDown={(e) => handlePointerDown(e, task)} 
                    className={`task-row group cursor-grab active:cursor-grabbing transition-transform ${task.id === draggedTaskId && isDragging ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:scale-[1.01]'}`} 
                    onClick={() => { 
                        if(!isDragging) { 
                            onEditTask(task); 
                            onClose(); 
                        } 
                    }}
                >
                    {renderTaskContent(task)}
                </div>
             ))}
             {activeTasks.length === 0 && <div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-60"><List size={32} strokeWidth={1.5} /><p className="text-xs font-bold tracking-widest mt-3">All Clear</p></div>}
          </div>
          {completedTasks.length > 0 && <div className="mt-6 mb-8"><div className="flex items-center gap-4 mb-4"><div className="h-px bg-slate-200 flex-1" /><span className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Done</span><div className="h-px bg-slate-200 flex-1" /></div><div className="space-y-2 opacity-60 hover:opacity-100 transition-all">{completedTasks.map((task) => <div key={task.id} className="cursor-pointer" onClick={() => { onEditTask(task); onClose(); }}>{renderTaskContent(task)}</div>)}</div></div>}
        </div>
      </div>
      {isDragging && draggedTask && createPortal(<div className="fixed z-[100] pointer-events-none" style={{ top: 0, left: 0, width: dragItemDim.width, height: dragItemDim.height, transition: isDropping ? 'transform 0.25s' : 'none', transform: isDropping && dropTargetPos ? `translate(${dropTargetPos.x}px, ${dropTargetPos.y}px)` : `translate(${pointerPos.x - dragOffset.x}px, ${pointerPos.y - dragOffset.y}px) scale(1.05) rotate(1deg)` }}><div className="shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">{renderTaskContent(draggedTask)}</div></div>, document.body)}
    </>
  );
};
