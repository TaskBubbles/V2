

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BubbleCanvas } from './components/BubbleCanvas';
import { Sidebar } from './components/Sidebar';
import { TaskListView } from './components/TaskListView';
import { Task, Board, User } from './types';
import { COLORS, FAB_BASE_CLASS, GLASS_PANEL_CLASS, GLASS_MENU_ITEM, GLASS_MENU_ITEM_ACTIVE, GLASS_MENU_ITEM_INACTIVE, GLASS_BTN_INACTIVE } from './constants';
import { LayoutList } from 'lucide-react';
import { notificationService } from './services/notificationService';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('tasks');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [boards, setBoards] = useState<Board[]>(() => {
    try {
      const saved = localStorage.getItem('boards');
      return saved ? JSON.parse(saved) : [
        { id: '1', name: 'Main To-Do' },
        { id: '2', name: 'Ideas' }
      ];
    } catch {
      return [{ id: '1', name: 'Main To-Do' }, { id: '2', name: 'Ideas' }];
    }
  });

  const [currentBoardId, setCurrentBoardId] = useState<string | 'ALL' | 'COMPLETED'>(() => {
     return localStorage.getItem('currentBoardId') || '1';
  });

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isListViewOpen, setIsListViewOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [dragHoveredBoardId, setDragHoveredBoardId] = useState<string | null>(null);
  
  const boardMenuRef = useRef<HTMLDivElement>(null);
  const boardButtonRef = useRef<HTMLButtonElement>(null);
  const menuWasOpenOnDown = useRef(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
      const saved = localStorage.getItem('theme');
      return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });
  
  useEffect(() => { localStorage.setItem('tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('boards', JSON.stringify(boards)); }, [boards]);
  useEffect(() => { localStorage.setItem('currentBoardId', currentBoardId); }, [currentBoardId]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
  }, [theme]);

  // Handle Notifications (Background/Foreground Bubble Opening)
  useEffect(() => {
    const handleHighlightTask = (taskId: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        // 1. Switch Board if needed
        if (task.boardId !== currentBoardId && currentBoardId !== 'ALL' && currentBoardId !== 'COMPLETED') {
             const boardExists = boards.some(b => b.id === task.boardId);
             if (boardExists) setCurrentBoardId(task.boardId);
             else setCurrentBoardId('ALL');
        }
        
        // 2. Ensure task is visible if completed
        if (task.completed) {
             if (currentBoardId !== 'COMPLETED') {
                 setShowCompleted(true);
             }
        }

        // 3. Close overlays
        setIsSidebarOpen(false);
        setIsListViewOpen(false);

        // 4. Open Bubble
        setEditingTaskId(taskId);
      }
    };

    // A. Check URL Params (New Window / Page Load)
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get('highlight');
    if (highlightId) {
        handleHighlightTask(highlightId);
        window.history.replaceState({}, '', window.location.pathname);
    }

    // B. Check SW Messages (Focus Existing Window)
    const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'HIGHLIGHT_TASK' && event.data.taskId) {
            handleHighlightTask(event.data.taskId);
        }
    };

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
        }
    };
  }, [tasks, boards, currentBoardId]);

  useEffect(() => {
    const interval = setInterval(() => {
        notificationService.checkAndNotify(tasks);
    }, 30000);
    notificationService.checkAndNotify(tasks);
    return () => clearInterval(interval);
  }, [tasks]);

  useEffect(() => {
      const handleOutsideClick = (e: PointerEvent) => {
          if (!isBoardMenuOpen) return;
          
          const target = e.target as Node;
          const isMenuClick = boardMenuRef.current?.contains(target);
          const isButtonClick = boardButtonRef.current?.contains(target);
          
          if (!isMenuClick && !isButtonClick) {
              setIsBoardMenuOpen(false);
          }
      };

      if (isBoardMenuOpen) {
          document.addEventListener('pointerdown', handleOutsideClick, true);
      }
      return () => {
          document.removeEventListener('pointerdown', handleOutsideClick, true);
      };
  }, [isBoardMenuOpen]);

  useEffect(() => {
    const isInitialized = localStorage.getItem('app_initialized_v3');
    if (!isInitialized && tasks.length === 0) {
      setTasks([
        { id: '1', boardId: '1', title: 'Hold to Pop', subtasks: [], color: COLORS[0], size: 110, completed: false },
        { id: '2', boardId: '1', title: 'Tap to Edit', subtasks: [], color: COLORS[4], size: 95, completed: false },
        { id: '3', boardId: '1', title: 'Pinch / Scroll\nto Zoom', subtasks: [], color: COLORS[5], size: 80, completed: false },
        { id: '4', boardId: '1', title: '+\nAdd Tasks', subtasks: [], color: COLORS[3], size: 70, completed: false },
        { id: '5', boardId: '1', title: 'Drag to\nOrganize', subtasks: [], color: COLORS[1], size: 45, completed: false },
      ]);
      localStorage.setItem('app_initialized_v3', 'true');
    }
  }, []);

  const displayTasks = useMemo(() => {
    if (currentBoardId === 'COMPLETED') return tasks.filter(t => t.completed);
    if (currentBoardId === 'ALL') return tasks;
    return tasks.filter(t => t.boardId === currentBoardId);
  }, [tasks, currentBoardId]);

  const handleAddTask = () => {
    let targetBoardId = currentBoardId;
    if (currentBoardId === 'ALL' || currentBoardId === 'COMPLETED') targetBoardId = boards[0]?.id || '1';
    const newTask: Task = {
      id: uuidv4(),
      boardId: targetBoardId,
      title: '', 
      subtasks: [],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 60,
      completed: false,
      x: window.innerWidth / 2, 
      y: window.innerHeight / 2
    };
    setTasks(prev => [...prev, newTask]);
    setEditingTaskId(newTask.id); 
  };

  const handleUpdateTask = (updatedTask: Task) => {
    if (!updatedTask) { 
        setEditingTaskId(null);
        return;
    }
    if (updatedTask.boardId !== currentBoardId && currentBoardId !== 'ALL' && currentBoardId !== 'COMPLETED') {
        const targetBoard = boards.find(b => b.id === updatedTask.boardId);
        if (targetBoard) setCurrentBoardId(targetBoard.id);
    }
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleBatchUpdateTasks = (updatedTasks: Task[]) => {
      setTasks(prev => {
          const updateMap = new Map(updatedTasks.map(t => [t.id, t]));
          return prev.map(t => updateMap.has(t.id) ? updateMap.get(t.id)! : t);
      });
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (editingTaskId === taskId) setEditingTaskId(null);
  };

  const handleToggleComplete = (task: Task) => {
    handleUpdateTask({ ...task, completed: !task.completed });
  };

  const handleCreateBoard = (name: string) => {
    const newBoard = { id: uuidv4(), name };
    setBoards(prev => [...prev, newBoard]);
    setCurrentBoardId(newBoard.id);
  };

  const getCurrentBoardName = () => {
      if (currentBoardId === 'ALL') return 'All Tasks';
      if (currentBoardId === 'COMPLETED') return 'Completed Tasks';
      return boards.find(b => b.id === currentBoardId)?.name || 'Unknown Board';
  };

  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const isDraggingBoardRef = useRef(false);

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
    
    if (!isDraggingBoardRef.current && Math.hypot(dx, dy) > 10) {
        isDraggingBoardRef.current = true;
    }

    if (isDraggingBoardRef.current) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const boardEl = elements.find(el => (el as HTMLElement).dataset.boardId) as HTMLElement | undefined;
        if (boardEl) {
            setDragHoveredBoardId(boardEl.dataset.boardId || null);
        } else {
            setDragHoveredBoardId(null);
        }
    }
  };

  const handleBoardPointerUp = (e: React.PointerEvent) => {
    if (isDraggingBoardRef.current) {
      if (dragHoveredBoardId) {
        setCurrentBoardId(dragHoveredBoardId as any);
        setIsBoardMenuOpen(false);
      }
    }
    
    dragStartRef.current = null;
    isDraggingBoardRef.current = false;
    setDragHoveredBoardId(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const handleBoardClick = (e: React.MouseEvent) => {
    if (isDraggingBoardRef.current) return;
    if (menuWasOpenOnDown.current) {
      setIsBoardMenuOpen(false);
    }
  };

  const editingTask = useMemo(() => tasks.find(t => t.id === editingTaskId) || null, [tasks, editingTaskId]);
  
  return (
    <div className="w-screen h-[100dvh] relative bg-[#f1f5f9] dark:bg-[#020617] overflow-hidden select-none font-sans text-slate-900 dark:text-slate-200 transition-colors duration-500">
      <Sidebar 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        boards={boards}
        currentBoardId={currentBoardId}
        onSelectBoard={(id) => {
            setCurrentBoardId(id);
            setShowCompleted(false); 
        }}
        onCreateBoard={handleCreateBoard}
        isHidden={!!editingTaskId}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      <BubbleCanvas 
        tasks={displayTasks}
        activeTask={editingTask}
        boards={boards}
        onEditTask={(task) => {
             if (task) setEditingTaskId(task.id);
             else setEditingTaskId(null);
             if (task) handleUpdateTask(task);
        }}
        onAddTask={handleAddTask}
        onToggleComplete={handleToggleComplete}
        onDeleteTask={handleDeleteTask}
        selectedTaskId={editingTaskId}
        showCompleted={currentBoardId === 'COMPLETED' || showCompleted}
        onToggleShowCompleted={() => setShowCompleted(!showCompleted)}
        isShowingCompleted={showCompleted}
        theme={theme}
        hideTrash={currentBoardId === 'COMPLETED'}
      />

      <TaskListView 
        tasks={displayTasks}
        isOpen={isListViewOpen}
        onClose={() => setIsListViewOpen(false)}
        onUpdateTask={handleUpdateTask}
        onBatchUpdateTasks={handleBatchUpdateTasks}
        onEditTask={(task) => {
            setEditingTaskId(task.id);
        }}
      />

      {!editingTaskId && (
        <>
            <div className="absolute top-6 right-6 z-40 animate-in slide-in-from-top-10 fade-in duration-500">
                <button 
                    onClick={() => {
                        setIsListViewOpen(true);
                        setIsSidebarOpen(false); 
                    }}
                    className={FAB_BASE_CLASS}
                    title="List View"
                    aria-label="Open list view"
                >
                    <LayoutList size={22} />
                </button>
            </div>

            <div className="absolute bottom-[max(3rem,calc(env(safe-area-inset-bottom)+2rem))] left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-500">
                 <div className="relative">
                     <div 
                        ref={boardMenuRef}
                        role="menu"
                        aria-label="Select board"
                        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 rounded-2xl overflow-hidden transition-all duration-300 origin-bottom pointer-events-none ${GLASS_PANEL_CLASS}
                        ${isBoardMenuOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-90 translate-y-4'}`}
                     >
                        <div className="p-1.5 flex flex-col gap-0.5">
                            {boards.map(b => (
                                <button
                                    key={b.id}
                                    data-board-id={b.id}
                                    role="menuitem"
                                    onClick={(e) => { 
                                        e.stopPropagation();
                                        setCurrentBoardId(b.id); 
                                        setIsBoardMenuOpen(false); 
                                    }}
                                    className={`${GLASS_MENU_ITEM} justify-center ${(currentBoardId === b.id || dragHoveredBoardId === b.id) ? GLASS_MENU_ITEM_ACTIVE : GLASS_MENU_ITEM_INACTIVE}`}
                                >
                                    {b.name}
                                </button>
                            ))}
                            <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
                            <button
                                data-board-id="ALL"
                                role="menuitem"
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    setCurrentBoardId('ALL'); 
                                    setIsBoardMenuOpen(false); 
                                    setShowCompleted(false);
                                }}
                                className={`${GLASS_MENU_ITEM} justify-center ${(currentBoardId === 'ALL' || dragHoveredBoardId === 'ALL') ? GLASS_MENU_ITEM_ACTIVE : GLASS_MENU_ITEM_INACTIVE}`}
                            >
                                All Tasks
                            </button>
                            <button
                                data-board-id="COMPLETED"
                                role="menuitem"
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    setCurrentBoardId('COMPLETED'); 
                                    setIsBoardMenuOpen(false); 
                                }}
                                className={`${GLASS_MENU_ITEM} justify-center ${(currentBoardId === 'COMPLETED' || dragHoveredBoardId === 'COMPLETED') ? GLASS_MENU_ITEM_ACTIVE : GLASS_MENU_ITEM_INACTIVE}`}
                            >
                                Completed
                            </button>
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
                        className={`px-6 py-2.5 rounded-full backdrop-blur-xl border shadow-lg flex items-center justify-center gap-2 min-w-[140px] transition-all hover:scale-105 active:scale-95 touch-none
                        ${isBoardMenuOpen 
                            ? 'bg-white/60 dark:bg-slate-800/60 border-white/60 dark:border-white/20' 
                            : 'bg-white/30 dark:bg-slate-900/40 border-white/40 dark:border-white/10 hover:bg-white/50 dark:hover:bg-slate-900/60'}`}
                     >
                        <span className="text-sm font-bold text-slate-800 dark:text-white leading-none whitespace-nowrap shadow-sm">
                            {getCurrentBoardName()}
                        </span>
                     </button>
                 </div>
            </div>
        </>
      )}
    </div>
  );
};

export default App;