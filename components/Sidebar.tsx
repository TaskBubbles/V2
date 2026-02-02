
import React, { useState, useEffect } from 'react';
import { Menu, Plus, LayoutGrid, List, Trash2, Settings, X, Volume2, Bell, Moon, Sun, VolumeX, BellOff, AlertTriangle, Download, LogOut, Cloud, Upload, Check } from 'lucide-react';
import { Board, User } from '../types';
import { audioService } from '../services/audioService';
import { notificationService } from '../services/notificationService';
import { isFirebaseInitialized } from '../services/firebaseService';
import { FAB_BASE_CLASS, GLASS_PANEL_CLASS, GLASS_MENU_ITEM, GLASS_MENU_ITEM_ACTIVE, GLASS_MENU_ITEM_INACTIVE } from '../constants';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  boards: Board[];
  currentBoardId: string | 'ALL' | 'COMPLETED';
  onSelectBoard: (id: string | 'ALL' | 'COMPLETED') => void;
  onCreateBoard: (name: string) => void;
  onDeleteBoard?: (id: string) => void;
  isHidden?: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  user?: User | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

const Switch = ({ checked, iconOn, iconOff, colorClass = "from-blue-500 to-blue-600" }: { checked: boolean, iconOn?: React.ReactNode, iconOff?: React.ReactNode, colorClass?: string }) => (
    <div className={`w-[4.5rem] h-10 rounded-full relative transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ring-inset shrink-0 ${checked ? `bg-gradient-to-r ${colorClass} ring-0 shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)]` : 'bg-slate-300/80 dark:bg-white/5 ring-1 ring-slate-300 dark:ring-white/10 group-hover:ring-slate-400 dark:group-hover:ring-white/30'}`}>
        <div className={`absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none ${checked ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute top-1 w-8 h-8 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.15)] flex items-center justify-center transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) z-10 bg-white dark:bg-white ${checked ? 'left-[calc(100%-2.25rem)] text-slate-800 transform rotate-0' : 'left-1 text-slate-400 dark:text-slate-500 transform -rotate-12'}`}>
            <div className="relative w-full h-full flex items-center justify-center">
                 <div className={`absolute transition-all duration-300 ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50 rotate-45'}`}>{iconOn}</div>
                 <div className={`absolute transition-all duration-300 ${!checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50 -rotate-45'}`}>{iconOff}</div>
            </div>
        </div>
    </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, boards, currentBoardId, onSelectBoard, onCreateBoard, onDeleteBoard, isHidden = false, theme, onToggleTheme, user, onSignIn, onSignOut }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => { try { return localStorage.getItem('soundEnabled') !== 'false'; } catch { return true; } });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => { try { return localStorage.getItem('notificationsEnabled') === 'true'; } catch { return false; } });
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  
  const [boardToDelete, setBoardToDelete] = useState<{ id: string, name: string } | null>(null);
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
      setIsCloudEnabled(isFirebaseInitialized());
  }, []);

  useEffect(() => { localStorage.setItem('soundEnabled', String(soundEnabled)); audioService.setMuted(!soundEnabled); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('notificationsEnabled', String(notificationsEnabled)); notificationService.setEnabled(notificationsEnabled); }, [notificationsEnabled]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); if (newBoardName.trim()) { onCreateBoard(newBoardName); setNewBoardName(''); setIsCreating(false); }
  };

  const handleToggleNotifications = async () => {
    const newState = !notificationsEnabled;
    
    if (newState) {
        const granted = await notificationService.requestPermission();
        if (!granted) {
            setNotificationsEnabled(false);
            if (Notification.permission === 'denied') {
                alert('Notifications are blocked. Please enable them in your browser settings.');
            }
            return;
        }
    }
    setNotificationsEnabled(newState);
  };

  const handleDeleteData = () => {
    if (window.confirm('Are you sure you want to delete all data? This cannot be undone.')) {
      try { localStorage.clear(); window.location.reload(); } catch (e) { alert('Failed to delete data.'); }
    }
  };
  
  const handleExportData = () => {
      try {
          const tasks = localStorage.getItem('tasks') || '[]';
          const boardsData = localStorage.getItem('boards') || '[]';
          const exportObj = {
              tasks: JSON.parse(tasks),
              boards: JSON.parse(boardsData),
              exportedAt: new Date().toISOString(),
              version: '1.6.1'
          };
          
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", dataStr);
          downloadAnchorNode.setAttribute("download", "task_bubbles_backup.json");
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      } catch (e) {
          alert('Failed to export data.');
      }
  };

  const handleSignOutClick = () => {
    if (window.confirm("Are you sure you want to sign out?")) {
        onSignOut?.();
    }
  };
  
  const handleDeleteBoardClick = (e: React.MouseEvent, boardId: string, boardName: string) => {
      e.stopPropagation();
      e.preventDefault(); // Prevent default behavior
      if (boards.length <= 1) {
          alert("You must have at least one board.");
          return;
      }
      setBoardToDelete({ id: boardId, name: boardName });
  };
  
  const confirmDeleteBoard = () => {
      if (boardToDelete && onDeleteBoard) {
          onDeleteBoard(boardToDelete.id);
          if (currentBoardId === boardToDelete.id) {
              onSelectBoard('ALL');
          }
          setBoardToDelete(null);
      }
  };

  return (
    <>
      <button 
        id="sidebar-toggle" 
        onClick={() => setIsOpen(true)} 
        aria-label="Open sidebar"
        aria-expanded={isOpen}
        className={`absolute top-6 left-6 ${FAB_BASE_CLASS} z-30 group ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
      >
        <Menu size={22} />
      </button>
      <div 
        className={`fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsOpen(false)} 
      />
      <div 
        aria-hidden={!isOpen}
        className={`fixed top-0 left-0 h-full w-80 shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) ${GLASS_PANEL_CLASS} border-l-0 border-y-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />
        <div className="relative p-6 flex flex-col h-full text-slate-800 dark:text-slate-200">
          <div className="mb-6 px-1 flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">Task Bubbles</h2>
          </div>

          {/* User Profile / Auth Section */}
          {isCloudEnabled && (
            user ? (
                <div className="mb-6 mx-1 p-3 rounded-2xl bg-gradient-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 border border-white/40 dark:border-white/10 shadow-sm backdrop-blur-md flex items-center gap-3 group transition-all duration-300 hover:bg-white/50 dark:hover:bg-white/10 hover:scale-[1.02]">
                  <div className="relative shrink-0">
                      {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="User" className="w-10 h-10 rounded-full object-cover border-2 border-white/50 dark:border-white/10 shadow-sm" />
                      ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold border-2 border-white/50 dark:border-white/10 shadow-sm">
                              {user.name.charAt(0).toUpperCase()}
                          </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight truncate">{user.name}</h3>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 font-medium truncate">{user.email}</p>
                  </div>
                  <button 
                      onClick={handleSignOutClick} 
                      className="p-2 rounded-xl text-slate-400 dark:text-white/30 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200 group/logout"
                      title="Sign Out"
                  >
                      <LogOut size={16} className="transition-transform duration-200 group-hover/logout:translate-x-0.5" />
                  </button>
                </div>
            ) : (
                <div className="mb-6 mx-1 p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 shadow-sm backdrop-blur-md flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                            <Cloud size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Sync Tasks</h3>
                            <p className="text-[10px] text-slate-500 dark:text-white/40">Backup to the cloud</p>
                        </div>
                    </div>
                    <button 
                        onClick={onSignIn}
                        className="w-full py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-bold rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.734 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.799 L -6.734 42.379 C -8.804 40.439 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/></g></svg>
                        Sign in with Google
                    </button>
                </div>
            )
          )}

          <nav className="space-y-1.5 flex-1 overflow-y-auto no-scrollbar">
            <button onClick={() => { onSelectBoard('ALL'); setIsOpen(false); }} className={`${GLASS_MENU_ITEM} ${currentBoardId === 'ALL' ? GLASS_MENU_ITEM_ACTIVE : GLASS_MENU_ITEM_INACTIVE}`}>
                <LayoutGrid size={18} /><span className="font-medium text-sm">All Tasks</span>
            </button>
            <div className="pt-6 pb-2 px-4"><span className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">Task Boards</span></div>
            {boards.map((board) => (
                <div key={board.id} className="group relative flex items-center">
                    <button onClick={() => { onSelectBoard(board.id); setIsOpen(false); }} className={`${GLASS_MENU_ITEM} ${currentBoardId === board.id ? GLASS_MENU_ITEM_ACTIVE : GLASS_MENU_ITEM_INACTIVE} pr-10`}>
                        <List size={18} /><span className="font-medium text-sm truncate">{board.name}</span>
                    </button>
                    {onDeleteBoard && boards.length > 1 && (
                        <button 
                            onClick={(e) => handleDeleteBoardClick(e, board.id, board.name)} 
                            className="absolute right-2 p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10"
                            title="Delete Board"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            ))}
            {isCreating ? (
                <form onSubmit={handleSubmit} className="px-1 py-2 relative">
                    <input 
                        autoFocus 
                        type="text" 
                        placeholder="Board Name" 
                        value={newBoardName} 
                        onChange={(e) => setNewBoardName(e.target.value)} 
                        onBlur={(e) => {
                            // Only close if empty and not focusing the submit button
                            if (e.relatedTarget && (e.relatedTarget as HTMLElement).getAttribute('type') === 'submit') return;
                            !newBoardName && setIsCreating(false);
                        }} 
                        className="w-full rounded-lg pl-4 pr-10 py-2.5 text-sm focus:outline-none transition-all bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:border-slate-400 dark:focus:border-white/30" 
                    />
                    <button 
                        type="submit" 
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/20 dark:bg-white/5 border border-white/30 dark:border-white/10 text-slate-700 dark:text-white hover:bg-white/40 dark:hover:bg-white/20 transition-all"
                        title="Create Board"
                    >
                        <Check size={16} strokeWidth={2.5} />
                    </button>
                </form>
            ) : (
                <button onClick={() => setIsCreating(true)} className={`${GLASS_MENU_ITEM} ${GLASS_MENU_ITEM_INACTIVE} mt-2 group`}>
                    <Plus size={18} className="group-hover:rotate-90 transition-transform" /><span className="font-medium text-sm">New Board</span>
                </button>
            )}
            <div className="my-3 border-t border-slate-200 dark:border-white/10 mx-2" />
            <button onClick={() => { onSelectBoard('COMPLETED'); setIsOpen(false); }} className={`${GLASS_MENU_ITEM} ${currentBoardId === 'COMPLETED' ? GLASS_MENU_ITEM_ACTIVE : GLASS_MENU_ITEM_INACTIVE}`}>
                <Trash2 size={18} /><span className="font-medium text-sm">Completed Tasks</span>
            </button>
            
            {deferredPrompt && (
              <div className="mt-6 px-1">
                 <button onClick={handleInstallClick} className="w-full p-3 rounded-2xl bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-3 transition-all active:scale-95 border border-indigo-400/50">
                    <div className="p-1.5 bg-white/20 rounded-lg"><Download size={18} /></div>
                    <div className="flex flex-col items-start">
                        <span className="font-bold text-sm leading-none">Install App</span>
                        <span className="text-[10px] opacity-80 leading-tight mt-1">Get the full experience</span>
                    </div>
                 </button>
              </div>
            )}
          </nav>
          <div className="pt-4 border-t border-slate-200 dark:border-white/10 mt-2 space-y-1.5">
            <button onClick={() => { setIsSettingsOpen(true); setIsOpen(false); }} className={`${GLASS_MENU_ITEM} ${GLASS_MENU_ITEM_INACTIVE}`}>
                <Settings size={18} /><span className="font-medium text-sm">Settings</span>
            </button>
          </div>
        </div>
      </div>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsSettingsOpen(false)} />
            <div className={`relative w-full max-w-sm rounded-3xl transform transition-all animate-in fade-in zoom-in-95 duration-200 ${GLASS_PANEL_CLASS}`}>
                <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-center relative"><h3 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Settings</h3><button onClick={() => setIsSettingsOpen(false)} className="absolute right-4 p-2 rounded-full transition-colors text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-white/30 dark:hover:bg-white/10"><X size={18} /></button></div>
                <div className="p-6 space-y-4">
                    <button onClick={onToggleTheme} className="w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 outline-none group bg-white/40 dark:bg-white/5 border-white/40 dark:border-white/5 hover:bg-white/60 dark:hover:bg-white/10 hover:border-white/60 dark:hover:border-white/20 active:scale-[0.98]"><div className="flex items-center gap-3 text-slate-700 dark:text-white/80"><div className="p-2 rounded-xl text-slate-500 dark:text-white/70 bg-white/50 dark:bg-white/10 group-hover:scale-110 transition-transform duration-300">{theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</div><div className="flex flex-col items-start"><span className="font-bold text-sm">Dark Mode</span><span className="text-[10px] text-slate-400 dark:text-white/40 font-medium">Adjust appearance</span></div></div><Switch checked={theme === 'dark'} iconOn={<Moon size={14} className="text-indigo-600" />} iconOff={<Sun size={14} className="text-amber-500" />} colorClass="from-indigo-500 to-violet-600" /></button>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 outline-none group bg-white/40 dark:bg-white/5 border-white/40 dark:border-white/5 hover:bg-white/60 dark:hover:bg-white/10 hover:border-white/60 dark:hover:border-white/20 active:scale-[0.98]"><div className="flex items-center gap-3 text-slate-700 dark:text-white/80"><div className="p-2 rounded-xl text-slate-500 dark:text-white/70 bg-white/50 dark:bg-white/10 group-hover:scale-110 transition-transform duration-300">{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</div><div className="flex flex-col items-start"><span className="font-bold text-sm">Sound Effects</span><span className="text-[10px] text-slate-400 dark:text-white/40 font-medium">Bubbles go pop</span></div></div><Switch checked={soundEnabled} iconOn={<Volume2 size={14} className="text-blue-600" />} iconOff={<VolumeX size={14} className="text-slate-400" />} colorClass="from-blue-400 to-blue-600" /></button>
                    <button onClick={handleToggleNotifications} className="w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 outline-none group bg-white/40 dark:bg-white/5 border-white/40 dark:border-white/5 hover:bg-white/60 dark:hover:bg-white/10 hover:border-white/60 dark:hover:border-white/20 active:scale-[0.98]"><div className="flex items-center gap-3 text-slate-700 dark:text-white/80"><div className="p-2 rounded-xl text-slate-500 dark:text-white/70 bg-white/50 dark:bg-white/10 group-hover:scale-110 transition-transform duration-300">{notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}</div><div className="flex flex-col items-start"><span className="font-bold text-sm">Notifications</span><span className="text-[10px] text-slate-400 dark:text-white/40 font-medium">Task reminders</span></div></div><Switch checked={notificationsEnabled} iconOn={<Bell size={14} className="text-emerald-600" />} iconOff={<BellOff size={14} className="text-slate-400" />} colorClass="from-emerald-400 to-emerald-600" /></button>
                    
                    <button onClick={handleExportData} className="w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 outline-none bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/30 active:scale-[0.98] text-indigo-600 dark:text-indigo-400">
                        <div className="p-2 rounded-xl bg-indigo-500/20"><Upload size={18} /></div>
                        <div className="flex flex-col items-start"><span className="font-bold text-sm">Export Data</span><span className="text-[10px] opacity-80 font-medium">Download JSON backup</span></div>
                    </button>

                    <button onClick={handleDeleteData} className="w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 outline-none bg-red-500/10 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 active:scale-[0.98] text-red-600 dark:text-red-400">
                        <div className="p-2 rounded-xl bg-red-500/20"><AlertTriangle size={18} /></div>
                        <div className="flex flex-col items-start"><span className="font-bold text-sm">Delete All Data</span><span className="text-[10px] opacity-80 font-medium">Clear local storage</span></div>
                    </button>

                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/10"><p className="text-center text-[10px] font-bold tracking-widest text-slate-400 dark:text-white/20 uppercase">Task Bubbles v1.6.1</p></div>
                </div>
            </div>
        </div>
      )}

      {/* Board Delete Confirmation Modal */}
      {boardToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setBoardToDelete(null)} />
            <div className={`relative w-full max-w-sm rounded-3xl transform transition-all animate-in fade-in zoom-in-95 duration-200 ${GLASS_PANEL_CLASS}`}>
                 <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 mb-4 rounded-full bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center text-red-500 border border-red-500/20">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Board?</h3>
                    <p className="text-sm text-slate-500 dark:text-white/60 mb-6 leading-relaxed">
                        Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-white">"{boardToDelete.name}"</span>?
                        <br/><span className="text-red-500/80 text-xs font-bold mt-1 block">All tasks in this board will be lost.</span>
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setBoardToDelete(null)}
                            className="flex-1 py-3 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-xl text-slate-800 dark:text-white font-semibold transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDeleteBoard}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold shadow-lg shadow-red-500/20 transition-colors border border-red-400/20"
                        >
                            Delete
                        </button>
                    </div>
                 </div>
            </div>
        </div>
      )}
    </>
  );
};
