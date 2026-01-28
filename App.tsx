
import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BubbleCanvas } from './components/BubbleCanvas';
import { Sidebar } from './components/Sidebar';
import { TaskListView } from './components/TaskListView';
import { Task, Board, User } from './types';
import { COLORS, FAB_BASE_CLASS } from './constants';
import { LayoutList, ChevronUp } from 'lucide-react';
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
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
      const saved = localStorage.getItem('theme');
      return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });
  
  const [user, setUser] = useState<User | null>(() => {
      try {
          const saved = localStorage.getItem('user');
          if (saved) return JSON.parse(saved);
      } catch {}
      return {
          id: 'u1',
          name: 'Alex Morgan',
          email: 'alex.morgan@design.co',
          avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&h=200&auto=format&fit=crop'
      };
  });

  useEffect(() => { localStorage.setItem('tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('boards', JSON.stringify(boards)); }, [boards]);
  useEffect(() => { localStorage.setItem('currentBoardId', currentBoardId); }, [currentBoardId]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => {
      if (user) localStorage.setItem('user', JSON.stringify(user));
      else localStorage.removeItem('user');
  }, [user]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const interval = setInterval(() => {
        notificationService.checkAndNotify(tasks);
    }, 30000);
    notificationService.checkAndNotify(tasks);
    return () => clearInterval(interval);
  }, [tasks]);

  useEffect(() => {
      const close = () => setIsBoardMenuOpen(false);
      if (isBoardMenuOpen) window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
  }, [isBoardMenuOpen]);

  useEffect(() => {
    const isInitialized = localStorage.getItem('app_initialized_v2');
    if (!isInitialized && tasks.length === 0) {
      setTasks([
        { id: '1', boardId: '1', title: 'Hold to Pop', subtasks: [], color: COLORS[0], size: 110, completed: false },
        { id: '2', boardId: '1', title: 'Tap to Edit', subtasks: [], color: COLORS[4], size: 95, completed: false },
        { id: '3', boardId: '1', title: 'Pinch / Scroll\nto Zoom', subtasks: [], color: COLORS[5], size: 80, completed: false },
        { id: '4', boardId: '1', title: '+\nAdd Tasks', subtasks: [], color: COLORS[3], size: 70, completed: false },
        { id: '5', boardId: '1', title: 'Drag to\nOrganize', subtasks: [], color: COLORS[1], size: 45, completed: false },
      ]);
      localStorage.setItem('app_initialized_v2', 'true');
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

  const editingTask = useMemo(() => tasks.find(t => t.id === editingTaskId) || null, [tasks, editingTaskId]);
  
  return (
    <div className="w-screen h-screen relative bg-[#f1f5f9] dark:bg-[#020617] overflow-hidden select-none font-sans text-slate-900 dark:text-slate-200 transition-colors duration-500">
      <Sidebar 
        boards={boards}
        currentBoardId={currentBoardId}
        onSelectBoard={(id) => {
            setCurrentBoardId(id);
            setShowCompleted(false); 
        }}
        onCreateBoard={handleCreateBoard}
        user={user}
        onLogout={() => setUser(null)}
        onLogin={() => setUser({
            id: 'u1',
            name: 'Alex Morgan',
            email: 'alex.morgan@design.co',
            avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&h=200&auto=format&fit=crop'
        })}
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
                    onClick={() => setIsListViewOpen(true)}
                    className={FAB_BASE_CLASS}
                    title="List View"
                >
                    <LayoutList size={22} />
                </button>
            </div>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-500">
                 <div className="relative">
                     <div 
                        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/50 dark:border-white/10 overflow-hidden transition-all duration-300 origin-bottom
                        ${isBoardMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4 pointer-events-none'}`}
                     >
                        <div className="p-1.5 flex flex-col gap-0.5">
                            {boards.map(b => (
                                <button
                                    key={b.id}
                                    onClick={() => { setCurrentBoardId(b.id); setIsBoardMenuOpen(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors
                                    ${currentBoardId === b.id 
                                        ? 'bg-white/50 dark:bg-white/10 text-slate-900 dark:text-white' 
                                        : 'text-slate-600 dark:text-white/60 hover:bg-white/30 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    {b.name}
                                </button>
                            ))}
                            <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
                            <button
                                onClick={() => { setCurrentBoardId('ALL'); setIsBoardMenuOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors
                                ${currentBoardId === 'ALL' 
                                    ? 'bg-white/50 dark:bg-white/10 text-slate-900 dark:text-white' 
                                    : 'text-slate-600 dark:text-white/60 hover:bg-white/30 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                All Tasks
                            </button>
                            <button
                                onClick={() => { setCurrentBoardId('COMPLETED'); setIsBoardMenuOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors
                                ${currentBoardId === 'COMPLETED' 
                                    ? 'bg-white/50 dark:bg-white/10 text-slate-900 dark:text-white' 
                                    : 'text-slate-600 dark:text-white/60 hover:bg-white/30 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Completed
                            </button>
                        </div>
                     </div>

                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsBoardMenuOpen(!isBoardMenuOpen);
                        }}
                        className={`px-6 py-2.5 rounded-full backdrop-blur-xl border shadow-lg flex items-center justify-center gap-2 min-w-[140px] transition-all hover:scale-105 active:scale-95
                        ${isBoardMenuOpen 
                            ? 'bg-white/60 dark:bg-slate-800/60 border-white/60 dark:border-white/20' 
                            : 'bg-white/30 dark:bg-slate-900/40 border-white/40 dark:border-white/10 hover:bg-white/50 dark:hover:bg-slate-900/60'}`}
                     >
                        <span className="text-sm font-bold text-slate-800 dark:text-white leading-none whitespace-nowrap shadow-sm">
                            {getCurrentBoardName()}
                        </span>
                        <ChevronUp size={14} className={`text-slate-500 dark:text-white/50 transition-transform duration-300 ${isBoardMenuOpen ? 'rotate-180' : ''}`} />
                     </button>
                 </div>
            </div>
        </>
      )}
    </div>
  );
};

export default App;
