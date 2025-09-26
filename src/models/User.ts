import { WorkingHours, UserPreferences, CalendarConnection } from './types';

export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
  workingHours: WorkingHours;
  preferences: UserPreferences;
  connectedCalendars: CalendarConnection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  timezone: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  timezone?: string;
  workingHours?: Partial<WorkingHours>;
  preferences?: Partial<UserPreferences>;
}

export interface UserAuthData {
  id: string;
  email: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserAuthData;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}