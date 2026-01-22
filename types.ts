export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Task {
  id: string;
  boardId: string;
  title: string;
  description?: string;
  subtasks?: Subtask[]; // Array of sub-items
  dueDate?: string; // ISO date string
  color: string;
  size: number; // 30 to 100 representing importance
  completed: boolean;
  
  // Physics properties (managed by D3)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null; // Fixed position X
  fy?: number | null; // Fixed position Y
}

export interface Board {
  id: string;
  name: string;
}

export interface Vector2 {
  x: number;
  y: number;
}