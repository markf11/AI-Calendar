import { AvailabilityWindow } from './types';

export interface BookingLink {
  id: string;
  userId: string;
  title: string;
  duration: number; // minutes
  availabilityWindow: AvailabilityWindow;
  bufferBefore: number; // minutes
  bufferAfter: number; // minutes
  isActive: boolean;
  customUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingLinkSummary {
  id: string;
  title: string;
  duration: number;
  isActive: boolean;
  bookingUrl: string;
  createdAt: Date;
}

export interface BookingLinkStats {
  totalBookings: number;
  thisWeekBookings: number;
  thisMonthBookings: number;
  averageBookingsPerWeek: number;
}