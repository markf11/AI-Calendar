import { ProjectProgress } from './types';

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  tasks: string[]; // task IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithTasks extends Project {
  taskDetails: Array<{
    id: string;
    title: string;
    status: string;
    duration: number;
    completedMinutes: number;
  }>;
  progress: ProjectProgress;
}

export interface ProjectSummary {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  completedTasks: number;
  totalMinutes: number;
  completedMinutes: number;
}