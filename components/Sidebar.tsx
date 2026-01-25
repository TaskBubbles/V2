import React, { useState, useEffect } from 'react';
import { Menu, Plus, LayoutGrid, List, Archive, LogOut, User as UserIcon, LogIn, Settings, X, Volume2, Bell, Moon, Sun, VolumeX, BellOff } from 'lucide-react';
import { Board, User } from '../types';
import { audioService } from '../services/audioService';
import { notificationService } from '../services/notificationService';

interface SidebarProps {
  boards: Board[];
  currentBoardId: string | 'ALL' | 'COMPLETED';
  onSelectBoard: (id: string | 'ALL' | 'COMPLETED') => void;
  onCreateBoard: (name: string) => void;
  user?: User | null;
  onLogout?: () => void;
  onLogin?: () => void;
  isHidden?: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

// Reusable Switch Component (Visual Only - Parent handles click)
const Switch = ({ checked, iconOn, iconOff, colorClass = "from-blue-500 to-blue-600" }: { checked: boolean, iconOn?: React.ReactNode, iconOff?: React.ReactNode, colorClass?: string }) => (
    <div
        className={`w-[4.5rem] h-10 rounded-full relative transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ring-inset shrink-0
            ${checked 
                ? `bg-gradient-to-r ${colorClass} ring-0 shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)]` 
                : 'bg-slate-300/80 dark:bg-white/5 ring-1 ring-slate-300 dark:ring-white/10 group-hover:ring-slate-400 dark:group-hover:ring-white/30'}`}
    >
        {/* Track Gloss Overlay */}
        <div className={`absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none ${checked ? 'opacity-100' : 'opacity-0'}`} />

        <div className={`absolute top-1 w-8 h-8 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.15)] flex items-center justify-center transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) z-10
            bg-white dark:bg-white
            ${checked 
                ? 'left-[calc(100%-2.25rem)] text-slate-800 transform rotate-0' 
                : 'left-1 text-slate-400 dark:text-slate-500 transform -rotate-12'}`}
        >
            <div className="relative w-full h-full flex items-center justify-center">
                 <div className={`absolute transition-all duration-300 ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50 rotate-45'}`}>
                     {iconOn}
                 </div>
                 <div className={`absolute transition-all duration-300 ${!checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50 -rotate-45'}`}>
                     {iconOff}
                 </div>
            </div>
        </div>
    </div>
);

export const Sidebar: React.FC<SidebarProps> = ({
  boards,
  currentBoardId,
  onSelectBoard,
  onCreateBoard,
  user,
  onLogout,
  onLogin,
  isHidden = false,
  theme,
  onToggleTheme
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Functional Settings State
  const [soundEnabled, setSoundEnabled] = useState(() => {
     try {
         return localStorage.getItem('soundEnabled') !== 'false';
     } catch { return true; }
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
     try {
         return localStorage.getItem('notificationsEnabled') === 'true';
     } catch { return false; }
  });

  // Effect: Persist Sound
  useEffect(() => {
      localStorage.setItem('soundEnabled', String(soundEnabled));
      audioService.setMuted(!soundEnabled);
  }, [soundEnabled]);

  // Effect: Persist & Request Notifications
  useEffect(() => {
      localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
      notificationService.setEnabled(notificationsEnabled);
  }, [notificationsEnabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBoardName.trim()) {
      onCreateBoard(newBoardName);
      setNewBoardName('');
      setIsCreating(false);
    }
  };

  return (
    <>
      <button
        id="sidebar-toggle"
        onClick={() => setIsOpen(true)}
        className={`absolute top-6 left-6 p-3 rounded-2xl transition-all shadow-lg z-30 group 
            bg-white/30 dark:bg-slate-900/20 
            hover:bg-white/50 dark:hover:bg-slate-900/40 
            text-slate-700 dark:text-white/80 
            border border-white/60 dark:border-white/10 
            backdrop-blur-xl
            ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
      >
        <Menu size={22} className="group-active:scale-95 transition-transform" />
      </button>

      {/* Backdrop */}
      <div
          className={`fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsOpen(false)}
        />

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-80 shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)
            bg-white/40 dark:bg-slate-900/30 backdrop-blur-3xl border-r border-white/60 dark:border-white/10
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Decorative noise/gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

        <div className="relative p-6 flex flex-col h-full text-slate-800 dark:text-slate-200">
          
          {/* User Profile Section */}
          <div className="mb-6 pb-6 border-b border-slate-200 dark:border-white/10">
            {user ? (
               <div className="flex items-center gap-3 p-3 rounded-2xl shadow-sm backdrop-blur-sm
                    bg-white/20 dark:bg-white/5 border border-white/30 dark:border-white/5">
                   {user.avatarUrl ? (
                       <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-white/10 shadow-sm" />
                   ) : (
                       <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-white/70">
                           <UserIcon size={20} />
                       </div>
                   )}
                   <div className="flex-1 min-w-0">
                       <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">{user.name}</h3>
                       <p className="text-[10px] text-slate-500 dark:text-white/40 truncate font-medium">{user.email}</p>
                   </div>
                   <button 
                       onClick={onLogout}
                       title="Log Out"
                       className="p-2 text-slate-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-white/40 dark:hover:bg-white/10 rounded-xl transition-all"
                   >
                       <LogOut size={18} />
                   </button>
               </div>
            ) : (
                <button 
                    onClick={onLogin}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl shadow-sm transition-all text-left group backdrop-blur-sm
                        bg-white/20 dark:bg-white/5 hover:bg-white/40 dark:hover:bg-white/10 border border-white/30 dark:border-white/5"
                >
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-white/50 group-hover:text-slate-700 dark:group-hover:text-white">
                        <LogIn size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Log In</h3>
                        <p className="text-[10px] text-slate-500 dark:text-white/40">Sync your tasks</p>
                    </div>
                </button>
            )}
          </div>

          <div className="mb-6 px-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">Task Bubbles</h2>
            <p className="text-slate-500 dark:text-white/40 text-xs mt-1 font-medium tracking-wide">Workspace</p>
          </div>

          <nav className="space-y-1.5 flex-1 overflow-y-auto no-scrollbar">
            {/* 1. All Tasks */}
            <button
              onClick={() => {
                onSelectBoard('ALL');
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                currentBoardId === 'ALL'
                  ? 'bg-white/40 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm border-white/40 dark:border-white/10 backdrop-blur-md'
                  : 'border-transparent text-slate-500 dark:text-white/60 hover:bg-white/20 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid size={18} />
              <span className="font-medium text-sm">All Tasks</span>
            </button>

            {/* 2. Boards Label */}
            <div className="pt-6 pb-2 px-4">
              <span className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">Boards</span>
            </div>

            {/* 3. Boards List */}
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => {
                  onSelectBoard(board.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                  currentBoardId === board.id
                    ? 'bg-white/40 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm border-white/40 dark:border-white/10 backdrop-blur-md'
                    : 'border-transparent text-slate-500 dark:text-white/60 hover:bg-white/20 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List size={18} />
                <span className="font-medium text-sm truncate">{board.name}</span>
              </button>
            ))}

            {/* 4. New Board Input/Button */}
            {isCreating ? (
              <form onSubmit={handleSubmit} className="px-1 py-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Board Name"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onBlur={() => !newBoardName && setIsCreating(false)}
                  className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-all
                    bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10 
                    text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20
                    focus:border-slate-400 dark:focus:border-white/30"
                />
              </form>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group mt-2 border border-transparent 
                    text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white 
                    hover:bg-white/20 dark:hover:bg-white/5 hover:border-white/30 dark:hover:border-white/10"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                <span className="font-medium text-sm">New Board</span>
              </button>
            )}

            {/* 5. Divider */}
            <div className="my-3 border-t border-slate-200 dark:border-white/10 mx-2" />

            {/* 6. Completed Tasks */}
            <button
                onClick={() => {
                  onSelectBoard('COMPLETED');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                  currentBoardId === 'COMPLETED'
                    ? 'bg-white/40 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm border-white/40 dark:border-white/10 backdrop-blur-md'
                    : 'border-transparent text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/5 hover:border-white/30 dark:hover:border-white/5'
                }`}
              >
                <Archive size={18} />
                <span className="font-medium text-sm">Completed Tasks</span>
              </button>
          </nav>
          
          {/* Footer Area with Settings */}
          <div className="pt-4 border-t border-slate-200 dark:border-white/10 mt-2 space-y-1.5">
              <button
                onClick={() => {
                   setIsSettingsOpen(true);
                   setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border border-transparent 
                    text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white 
                    hover:bg-white/20 dark:hover:bg-white/5 hover:border-white/30 dark:hover:border-white/5"
              >
                <Settings size={18} />
                <span className="font-medium text-sm">Settings</span>
              </button>
          </div>
        </div>
      </div>

      {/* Settings Modal - Glass */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm transition-opacity" 
                onClick={() => setIsSettingsOpen(false)}
            />
            <div className="relative w-full max-w-sm rounded-3xl shadow-2xl transform transition-all animate-in fade-in zoom-in-95 duration-200
                bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-white/10">
                
                <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-center relative">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Settings</h3>
                    <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="absolute right-4 p-2 rounded-full transition-colors
                            text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-white/30 dark:hover:bg-white/10"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    
                    {/* Theme Settings */}
                    <button 
                        onClick={onToggleTheme}
                        className="w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 outline-none group
                        bg-white/40 dark:bg-white/5 border-white/40 dark:border-white/5 
                        hover:bg-white/60 dark:hover:bg-white/10 hover:border-white/60 dark:hover:border-white/20 active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-3 text-slate-700 dark:text-white/80">
                            <div className="p-2 rounded-xl text-slate-500 dark:text-white/70 bg-white/50 dark:bg-white/10 group-hover:scale-110 transition-transform duration-300">
                                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-sm">Dark Mode</span>
                                <span className="text-[10px] text-slate-400 dark:text-white/40 font-medium">Adjust appearance</span>
                            </div>
                        </div>
                        <Switch 
                            checked={theme === 'dark'} 
                            iconOn={<Moon size={14} className="text-indigo-600" />}
                            iconOff={<Sun size={14} className="text-amber-500" />}
                            colorClass="from-indigo-500 to-violet-600"
                        />
                    </button>

                    {/* Sound Settings */}
                    <button 
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 outline-none group
                        bg-white/40 dark:bg-white/5 border-white/40 dark:border-white/5 
                        hover:bg-white/60 dark:hover:bg-white/10 hover:border-white/60 dark:hover:border-white/20 active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-3 text-slate-700 dark:text-white/80">
                            <div className="p-2 rounded-xl text-slate-500 dark:text-white/70 bg-white/50 dark:bg-white/10 group-hover:scale-110 transition-transform duration-300">
                                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-sm">Sound Effects</span>
                                <span className="text-[10px] text-slate-400 dark:text-white/40 font-medium">Bubbles go pop</span>
                            </div>
                        </div>
                        <Switch 
                            checked={soundEnabled} 
                            iconOn={<Volume2 size={14} className="text-blue-600" />}
                            iconOff={<VolumeX size={14} className="text-slate-400" />}
                            colorClass="from-blue-400 to-blue-600"
                        />
                    </button>

                    {/* Notification Settings */}
                    <button 
                        onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                        className="w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 outline-none group
                         bg-white/40 dark:bg-white/5 border-white/40 dark:border-white/5 
                         hover:bg-white/60 dark:hover:bg-white/10 hover:border-white/60 dark:hover:border-white/20 active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-3 text-slate-700 dark:text-white/80">
                            <div className="p-2 rounded-xl text-slate-500 dark:text-white/70 bg-white/50 dark:bg-white/10 group-hover:scale-110 transition-transform duration-300">
                                {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-sm">Notifications</span>
                                <span className="text-[10px] text-slate-400 dark:text-white/40 font-medium">Task reminders</span>
                            </div>
                        </div>
                         <Switch 
                            checked={notificationsEnabled} 
                            iconOn={<Bell size={14} className="text-emerald-600" />}
                            iconOff={<BellOff size={14} className="text-slate-400" />}
                            colorClass="from-emerald-400 to-emerald-600"
                        />
                    </button>

                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/10">
                        <p className="text-center text-[10px] font-bold tracking-widest text-slate-400 dark:text-white/20 uppercase">Task Bubbles v1.3.1</p>
                    </div>
                </div>
            </div>
        </div>
      )}
    </>
  );
};