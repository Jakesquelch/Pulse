import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { ToDoList } from './tasks/to-do-list';
import { Journal } from './journal/journal';
import { HabitTracker } from './habits/habit-tracker';

export const routes: Routes = [
  { path: '', component: Dashboard },
  { path: 'todo', component: ToDoList },
  { path: 'journal', component: Journal },
  { path: 'habit', component: HabitTracker },
];
