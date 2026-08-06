export type TaskGroup = 'fun' | 'personal' | 'work';

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  group?: TaskGroup; // optional grouping
}
