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

// Where the initial GET has got to. A three-state union rather than two
// booleans, so "loading and failed at the same time" can't be represented —
// the states are genuinely exclusive, and the type says so.
export type TaskLoadState = 'loading' | 'ready' | 'failed';

// What the client may send when changing a task — mirrors the backend's
// TaskUpdate model. Partial because PATCH sends only the changed fields;
// `id` is omitted because it travels in the URL and the server owns it.
// Derived from Task rather than hand-written so it can't drift locally.
export type TaskUpdate = Partial<Omit<Task, 'id'>>;
