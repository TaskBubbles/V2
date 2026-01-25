import React, { useEffect, useState } from 'react';
import { Task } from '../types';
import { ALL_COLORS, MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE } from '../constants';
import { X, Trash2, Calendar, CheckCircle } from 'lucide-react';

interface EditPanelProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export const EditPanel: React.FC<EditPanelProps> = ({
  task,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [editedTask, setEditedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (task) {
      setEditedTask({ ...task });
    }
  }, [task]);

  if (!editedTask) return null;

  const handleChange = (field: keyof Task, value: any) => {
    const updated = { ...editedTask, [field]: value };
    setEditedTask(updated);
    onUpdate(updated); // Real-time update for physics
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-slate-900/80 backdrop-blur-xl border-l border-white/10 shadow-2xl transform transition-transform duration-300 z-[60] flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-white/10">
        <h2 className="text-xl font-semibold text-white">Edit Task</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Title */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Task Name</label>
          <input
            type="text"
            value={editedTask.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-lg"
            placeholder="What needs to be done?"
          />
        </div>

        {/* Importance (Size) */}
        <div className="space-y-4">
          <div className="flex justify-between">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Importance (Size)</label>
            <span className="text-xs text-white/70">{Math.round(((editedTask.size - MIN_BUBBLE_SIZE) / (MAX_BUBBLE_SIZE - MIN_BUBBLE_SIZE)) * 100)}%</span>
          </div>
          <input
            type="range"
            min={MIN_BUBBLE_SIZE}
            max={MAX_BUBBLE_SIZE}
            value={editedTask.size}
            onChange={(e) => handleChange('size', parseInt(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Color */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Color Tag</label>
          <div className="flex flex-wrap gap-3">
            {ALL_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => handleChange('color', c)}
                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                  editedTask.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Due Date</label>
          <div className="relative">
            <input
              type="date"
              value={editedTask.dueDate ? editedTask.dueDate.split('T')[0] : ''}
              onChange={(e) => handleChange('dueDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 pl-10 text-white focus:outline-none focus:border-blue-500 transition-colors [&::-webkit-calendar-picker-indicator]:invert"
            />
            <Calendar className="absolute left-3 top-3.5 text-white/40" size={18} />
          </div>
        </div>
        
        {/* Completed Status */}
        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
           onClick={() => handleChange('completed', !editedTask.completed)}
        >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${editedTask.completed ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                {editedTask.completed && <CheckCircle size={14} className="text-white" />}
            </div>
            <span className={editedTask.completed ? 'text-white/50 line-through' : 'text-white'}>
                Mark as Completed
            </span>
        </div>

      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/10 flex justify-between">
        <button
          onClick={() => {
             onDelete(editedTask.id);
             onClose();
          }}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors px-4 py-2 hover:bg-red-500/10 rounded-lg"
        >
          <Trash2 size={18} />
          <span>Delete</span>
        </button>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-white text-slate-900 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};