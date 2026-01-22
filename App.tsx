import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BubbleCanvas } from './components/BubbleCanvas';
import { Sidebar } from './components/Sidebar';
import { TaskListView } from './components/TaskListView';
import { Task, Board, User } from './types';
import { COLORS } from './constants';
import { LayoutList } from 'lucide-react';
import { notificationService } from './services/notificationService';

const App: React.FC = () => {
  // --- STATE INITIALIZATION WITH PERSISTENCE ---

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
  
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
      const saved = localStorage.getItem('theme');
      return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  
  // Mock User State with Persistence
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

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => { localStorage.setItem('tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('boards', JSON.stringify(boards)); }, [boards]);
  useEffect(() => { localStorage.setItem('currentBoardId', currentBoardId); }, [currentBoardId]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => {
      if (user) localStorage.setItem('user', JSON.stringify(user));
      else localStorage.removeItem('user');
  }, [user]);

  // Handle Theme Logic
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
  }, [theme]);

  // Handle Notification Checks
  useEffect(() => {
    // Check every 30 seconds
    const interval = setInterval(() => {
        notificationService.checkAndNotify(tasks);
    }, 30000);
    
    // Initial check on load
    notificationService.checkAndNotify(tasks);

    return () => clearInterval(interval);
  }, [tasks]);

  // Initialize with dummy data ONLY if this is the first run ever
  useEffect(() => {
    const isInitialized = localStorage.getItem('app_initialized');
    if (!isInitialized && tasks.length === 0) {
      setTasks([
        { 
            id: '1', boardId: '1', title: 'Hold to Pop', 
            subtasks: [], color: COLORS[0], size: 110, completed: false 
        }, // Red - Largest
        { 
            id: '2', boardId: '1', title: 'Tap to Edit', 
            subtasks: [], color: COLORS[4], size: 95, completed: false
        }, // Blue - Large
        { 
            id: '3', boardId: '1', title: 'Pinch / Scroll\nto Zoom', 
            subtasks: [], color: COLORS[5], size: 80, completed: false
        }, // Purple - Medium
        { 
            id: '4', boardId: '1', title: '+\nAdd Tasks', 
            subtasks: [], color: COLORS[3], size: 70, completed: false
        }, // Green - Small
        { 
            id: '5', boardId: '1', title: 'Drag to\nOrganize', 
            subtasks: [], color: COLORS[1], size: 45, completed: false
        }, // Orange - Smallest
      ]);
      localStorage.setItem('app_initialized', 'true');
    }
  }, []); // Run once on mount

  // --- Filtering Logic ---
  const { displayTasks, showEyeButton } = useMemo(() => {
    let relevantTasks: Task[] = [];

    if (currentBoardId === 'COMPLETED') {
        // Archive View: Show only completed tasks from ALL boards
        relevantTasks = tasks.filter(t => t.completed);
    } else if (currentBoardId === 'ALL') {
        relevantTasks = tasks;
    } else {
        relevantTasks = tasks.filter(t => t.boardId === currentBoardId);
    }

    // Determine if we need the Eye Button
    // Logic: Only show if we are NOT in the Archive view AND there are actually completed tasks to toggle
    const hasCompletedTasksInCurrentView = relevantTasks.some(t => t.completed);
    const shouldShowEye = currentBoardId !== 'COMPLETED' && hasCompletedTasksInCurrentView;

    return { 
        displayTasks: relevantTasks,
        showEyeButton: shouldShowEye
    };
  }, [tasks, currentBoardId]);

  // --- Handlers ---

  const handleAddTask = () => {
    // Determine target board (default to first if in ALL or COMPLETED view)
    let targetBoardId = currentBoardId;
    if (currentBoardId === 'ALL' || currentBoardId === 'COMPLETED') {
        targetBoardId = boards[0]?.id || '1';
    }
    
    const newTask: Task = {
      id: uuidv4(),
      boardId: targetBoardId,
      title: 'New Task',
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

    // If the board ID changed, switch the workspace view to the new board
    // so the user can see where the task went (and keep editing context valid visually)
    if (updatedTask.boardId !== currentBoardId && currentBoardId !== 'ALL' && currentBoardId !== 'COMPLETED') {
        // Verify board exists to be safe
        const targetBoard = boards.find(b => b.id === updatedTask.boardId);
        if (targetBoard) {
            setCurrentBoardId(targetBoard.id);
        }
    }

    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
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

  // Helper for UI label
  const getCurrentBoardName = () => {
      if (currentBoardId === 'ALL') return 'All Tasks';
      if (currentBoardId === 'COMPLETED') return 'Completed Tasks';
      return boards.find(b => b.id === currentBoardId)?.name || 'Unknown Board';
  };

  const editingTask = useMemo(() => tasks.find(t => t.id === editingTaskId) || null, [tasks, editingTaskId]);
  
  return (
    <div className="w-screen h-screen relative bg-[#f1f5f9] dark:bg-[#020617] overflow-hidden select-none font-sans text-slate-900 dark:text-slate-200 transition-colors duration-500">
      
      {/* Sidebar Navigation */}
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

      {/* Main Canvas */}
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
        showEyeButton={showEyeButton}
        onToggleShowCompleted={() => setShowCompleted(!showCompleted)}
        isShowingCompleted={showCompleted}
        theme={theme}
      />

      {/* Task List Drawer */}
      <TaskListView 
        tasks={displayTasks}
        isOpen={isListViewOpen}
        onClose={() => setIsListViewOpen(false)}
        onUpdateTask={handleUpdateTask}
        onEditTask={(task) => {
            setEditingTaskId(task.id);
        }}
      />

      {/* Bottom Center Board Indicator & List Toggle */}
      <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 transition-opacity duration-300 flex items-center gap-3 ${editingTaskId ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <h1 className="pointer-events-none text-[10px] font-bold tracking-[0.25em] uppercase px-6 py-2.5 rounded-full backdrop-blur-md shadow-lg transition-colors duration-500
          bg-white/20 dark:bg-slate-900/20 
          text-slate-600 dark:text-white/60
          border border-white/40 dark:border-white/10"
        >
            {getCurrentBoardName()}
        </h1>
        
        <button
          id="list-toggle"
          onClick={() => setIsListViewOpen(true)}
          className="p-2.5 rounded-full transition-all shadow-lg group 
            bg-white/30 dark:bg-slate-900/20 
            hover:bg-white/50 dark:hover:bg-slate-900/40 
            text-slate-700 dark:text-white/80 
            border border-white/60 dark:border-white/10 
            backdrop-blur-xl
            active:scale-95 pointer-events-auto"
        >
          <LayoutList size={18} className="group-active:scale-95 transition-transform" />
        </button>
      </div>
      
    </div>
  );
};

export default App;