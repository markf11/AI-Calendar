import { CalendarSource } from './types';

export interface CalendarEvent {
  id: string;
  userId: string;
  externalId?: string; // ID from external calendar
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isFlexible: boolean; // can be moved by AI
  travelTimeBefore?: number; // minutes
  travelTimeAfter?: number; // minutes
  source: CalendarSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCalendarEventRequest {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isFlexible?: boolean;
  travelTimeBefore?: number;
  travelTimeAfter?: number;
}

export interface UpdateCalendarEventRequest {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  isFlexible?: boolean;
  travelTimeBefore?: number;
  travelTimeAfter?: number;
}

export interface CalendarEventSummary {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  source: CalendarSource;
  isFlexible: boolean;
}