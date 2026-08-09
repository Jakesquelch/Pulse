export type TaskGroup = 'fun' | 'personal' | 'work';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  group?: TaskGroup; // optional grouping
}

// What the client is allowed to send when creating a task — mirrors the
// backend's TaskCreate model. The server owns everything Omit removes.
export type TaskCreate = Omit<Task, 'id' | 'completed'>;
