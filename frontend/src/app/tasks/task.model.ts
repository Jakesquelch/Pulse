export type TaskGroup = 'fun' | 'personal' | 'work';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  group?: TaskGroup; // optional grouping
}
