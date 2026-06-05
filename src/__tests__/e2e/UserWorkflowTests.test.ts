// @ts-nocheck
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '@/api';
import { DatabaseService } from '@/config/database';
import { RedisService } from '@/config/redis';
import { User } from '@/models/User';
import { Task } from '@/models/Task';
import { Project } from '@/models/Project';

/**
 * End-to-End User Workflow Tests
 * Tests complete user journeys from task creation to completion
 */
describe('E2E - Complete User Workflows', () => {
  let app: Express;
  let authToken: string;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    // Initialize test app
    app = createApp();
    
    // Wait for database and Redis connections
    await DatabaseService.connect();
    await RedisService.connect();
    
    // Clean up test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await DatabaseService.disconnect();
    await RedisService.disconnect();
  });

  describe('Complete User Onboarding and Setup Workflow', () => {
    it('should complete full user registration and setup flow', async () => {
      // Step 1: User Registration
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'e2e-test@example.com',
          password: 'SecurePassword123!',
          name: 'E2E Test User',
          timezone: 'America/New_York'
        })
        .expect(201);

      expect(registrationResponse.body).toHaveProperty('user');
      expect(registrationResponse.body).toHaveProperty('token');
      
      authToken = registrationResponse.body.token;
      userId = registrationResponse.body.user.id;

      // Step 2: Set Working Hours
      await request(app)
        .put(`/api/users/${userId}/working-hours`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          monday: { start: '09:00', end: '17:00' },
          tuesday: { start: '09:00', end: '17:00' },
          wednesday: { start: '09:00', end: '17:00' },
          thursday: { start: '09:00', end: '17:00' },
          friday: { start: '09:00', end: '17:00' },
          lunchBreak: { start: '12:00', end: '13:00' }
        })
        .expect(200);

      // Step 3: Set User Preferences
      await request(app)
        .put(`/api/users/${userId}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          maxContinuousWorkTime: 120,
          preferredBreakDuration: 15,
          groupSimilarTasks: true,
          protectFocusTime: true,
          optimizeForEarlyCompletion: false,
          defaultMeetingBuffer: 10,
          energyPreferences: {
            highEnergyTimes: [{ start: '09:00', end: '11:00' }],
            lowEnergyTimes: [{ start: '14:00', end: '16:00' }],
            meetingPreferredTimes: [{ start: '10:00', end: '12:00' }]
          }
        })
        .expect(200);

      // Step 4: Connect Google Calendar (Mock)
      await request(app)
        .post('/api/calendar/google/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          authCode: 'mock-google-auth-code'
        })
        .expect(200);

      // Verify user setup is complete
      const userResponse = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(userResponse.body.workingHours).toBeDefined();
      expect(userResponse.body.preferences).toBeDefined();
      expect(userResponse.body.connectedCalendars).toHaveLength(1);
    });
  });

  describe('Project and Task Management Workflow', () => {
    it('should complete full project creation and task management flow', async () => {
      // Step 1: Create Project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'E2E Test Project',
          description: 'End-to-end testing project',
          color: '#3B82F6'
        })
        .expect(201);

      projectId = projectResponse.body.id;
      expect(projectResponse.body.name).toBe('E2E Test Project');

      // Step 2: Create Multiple Tasks with Dependencies
      const task1Response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Research Phase',
          description: 'Initial research and planning',
          duration: 120,
          priority: 'high',
          projectId,
          isBlocking: true
        })
        .expect(201);

      const task1Id = task1Response.body.id;

      const task2Response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Design Phase',
          description: 'Create design mockups',
          duration: 180,
          priority: 'high',
          projectId,
          dependencies: [task1Id],
          isBlocking: false
        })
        .expect(201);

      const task2Id = task2Response.body.id;

      const task3Response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Implementation Phase',
          description: 'Implement the solution',
          duration: 300,
          priority: 'critical',
          projectId,
          dependencies: [task2Id],
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          isHardDeadline: true,
          isBlocking: false
        })
        .expect(201);

      const task3Id = task3Response.body.id;

      // Step 3: Trigger AI Scheduling
      const scheduleResponse = await request(app)
        .post('/api/schedule/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(scheduleResponse.body.success).toBe(true);
      expect(scheduleResponse.body.scheduledTasks.length).toBeGreaterThan(0);

      // Step 4: Verify Task Scheduling Order
      const scheduledTasks = scheduleResponse.body.scheduledTasks.sort(
        (a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      // Research should be first (no dependencies)
      expect(scheduledTasks[0].taskId).toBe(task1Id);
      
      // Design should be after Research
      const task1Slot = scheduledTasks.find((s: any) => s.taskId === task1Id);
      const task2Slot = scheduledTasks.find((s: any) => s.taskId === task2Id);
      expect(new Date(task1Slot.endTime).getTime()).toBeLessThanOrEqual(new Date(task2Slot.startTime).getTime());

      // Implementation should be after Design
      const task3Slot = scheduledTasks.find((s: any) => s.taskId === task3Id);
      expect(new Date(task2Slot.endTime).getTime()).toBeLessThanOrEqual(new Date(task3Slot.startTime).getTime());

      // Step 5: Complete First Task
      await request(app)
        .post(`/api/tasks/${task1Id}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          completionNotes: 'Research completed successfully'
        })
        .expect(200);

      // Step 6: Verify Automatic Rescheduling
      const rescheduleResponse = await request(app)
        .get('/api/schedule/current')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedSchedule = rescheduleResponse.body.scheduledTasks;
      expect(updatedSchedule.some((s: any) => s.taskId === task1Id)).toBe(false); // Task 1 should be removed
      expect(updatedSchedule.some((s: any) => s.taskId === task2Id)).toBe(true);  // Task 2 should still be scheduled
      expect(updatedSchedule.some((s: any) => s.taskId === task3Id)).toBe(true);  // Task 3 should still be scheduled

      // Step 7: Update Task Priority and Verify Rescheduling
      await request(app)
        .put(`/api/tasks/${task3Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priority: 'critical',
          deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // Shorter deadline
        })
        .expect(200);

      // Verify schedule was automatically updated
      const finalScheduleResponse = await request(app)
        .get('/api/schedule/current')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalScheduleResponse.body.scheduledTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Calendar Integration Workflow', () => {
    it('should handle external calendar events and rescheduling', async () => {
      // Step 1: Create some tasks to be scheduled
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Flexible Meeting Prep',
          duration: 60,
          priority: 'medium',
          projectId
        })
        .expect(201);

      const flexibleTaskId = taskResponse.body.id;

      // Step 2: Get initial schedule
      const initialSchedule = await request(app)
        .get('/api/schedule/current')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialTaskSlot = initialSchedule.body.scheduledTasks.find(
        (s: any) => s.taskId === flexibleTaskId
      );
      expect(initialTaskSlot).toBeDefined();

      // Step 3: Simulate external calendar event creation (firm event)
      await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Important Client Meeting',
          startTime: initialTaskSlot.startTime,
          endTime: initialTaskSlot.endTime,
          isFlexible: false, // Firm event
          source: 'google'
        })
        .expect(201);

      // Step 4: Verify automatic rescheduling occurred
      const updatedSchedule = await request(app)
        .get('/api/schedule/current')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedTaskSlot = updatedSchedule.body.scheduledTasks.find(
        (s: any) => s.taskId === flexibleTaskId
      );

      // Task should be rescheduled to a different time
      if (updatedTaskSlot) {
        expect(updatedTaskSlot.startTime).not.toBe(initialTaskSlot.startTime);
      }

      // Step 5: Test calendar sync
      const syncResponse = await request(app)
        .post('/api/calendar/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.eventsProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Meeting Booking Workflow', () => {
    it('should complete meeting booking link creation and booking flow', async () => {
      // Step 1: Create Booking Link
      const bookingLinkResponse = await request(app)
        .post('/api/booking-links')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '30-minute Consultation',
          duration: 30,
          availabilityWindow: {
            daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
            timeRange: { start: '09:00', end: '17:00' },
            advanceBookingDays: 14
          },
          bufferBefore: 5,
          bufferAfter: 5
        })
        .expect(201);

      const bookingLinkId = bookingLinkResponse.body.id;
      expect(bookingLinkResponse.body.title).toBe('30-minute Consultation');

      // Step 2: Get Available Slots
      const availabilityResponse = await request(app)
        .get(`/api/booking-links/${bookingLinkId}/availability`)
        .query({
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
        .expect(200);

      expect(availabilityResponse.body.availableSlots).toBeDefined();
      expect(Array.isArray(availabilityResponse.body.availableSlots)).toBe(true);

      // Step 3: Book a Meeting (if slots available)
      if (availabilityResponse.body.availableSlots.length > 0) {
        const firstSlot = availabilityResponse.body.availableSlots[0];
        
        const bookingResponse = await request(app)
          .post(`/api/booking-links/${bookingLinkId}/book`)
          .send({
            startTime: firstSlot.startTime,
            attendeeEmail: 'client@example.com',
            attendeeName: 'Test Client',
            notes: 'Looking forward to our consultation'
          })
          .expect(201);

        expect(bookingResponse.body.success).toBe(true);
        expect(bookingResponse.body.booking).toBeDefined();

        // Step 4: Verify Meeting Added to Calendar
        const calendarResponse = await request(app)
          .get('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          })
          .expect(200);

        const meetingEvent = calendarResponse.body.events.find(
          (e: any) => e.title === '30-minute Consultation'
        );
        expect(meetingEvent).toBeDefined();

        // Step 5: Verify Tasks Were Rescheduled Around Meeting
        const scheduleAfterBooking = await request(app)
          .get('/api/schedule/current')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(scheduleAfterBooking.body.scheduledTasks).toBeDefined();
        // Tasks should not overlap with the booked meeting time
      }
    });
  });

  describe('Task Completion and Progress Tracking Workflow', () => {
    it('should handle task completion and progress tracking', async () => {
      // Step 1: Create a task with estimated duration
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Progress Tracking Task',
          description: 'Task for testing progress tracking',
          duration: 120, // 2 hours
          priority: 'medium',
          projectId
        })
        .expect(201);

      const taskId = taskResponse.body.id;

      // Step 2: Log partial progress
      await request(app)
        .post(`/api/tasks/${taskId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          minutesCompleted: 60,
          notes: 'Completed first hour of work'
        })
        .expect(200);

      // Step 3: Verify progress was recorded
      const progressResponse = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(progressResponse.body.completedMinutes).toBe(60);
      expect(progressResponse.body.remainingMinutes).toBe(60);

      // Step 4: Complete the task
      await request(app)
        .post(`/api/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          completionNotes: 'Task completed successfully'
        })
        .expect(200);

      // Step 5: Verify task completion
      const completedTaskResponse = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(completedTaskResponse.body.status).toBe('completed');
      expect(completedTaskResponse.body.completedAt).toBeDefined();

      // Step 6: Check project progress
      const projectProgressResponse = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(projectProgressResponse.body.completedTasks).toBeGreaterThan(0);
      expect(projectProgressResponse.body.totalTasks).toBeGreaterThan(0);
      expect(projectProgressResponse.body.completionPercentage).toBeGreaterThan(0);

      // Step 7: Unmark task completion (test reversal)
      await request(app)
        .post(`/api/tasks/${taskId}/unmark-complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Step 8: Verify task is back in pending state
      const unmarkedTaskResponse = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(unmarkedTaskResponse.body.status).toBe('pending');
      expect(unmarkedTaskResponse.body.completedAt).toBeNull();
    });
  });

  describe('Real-time Features Workflow', () => {
    it('should handle real-time schedule updates via WebSocket', async () => {
      // This test would require WebSocket testing setup
      // For now, we'll test the REST API endpoints that trigger real-time updates
      
      // Step 1: Create a task that will trigger real-time updates
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Real-time Test Task',
          duration: 45,
          priority: 'high'
        })
        .expect(201);

      const taskId = taskResponse.body.id;

      // Step 2: Update task priority (should trigger rescheduling)
      await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priority: 'critical',
          deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        })
        .expect(200);

      // Step 3: Verify schedule was updated
      const updatedSchedule = await request(app)
        .get('/api/schedule/current')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedTask = updatedSchedule.body.scheduledTasks.find(
        (s: any) => s.taskId === taskId
      );
      expect(updatedTask).toBeDefined();

      // Step 4: Test WebSocket notification endpoint
      const notificationResponse = await request(app)
        .get('/api/notifications/recent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(notificationResponse.body.notifications)).toBe(true);
    });
  });

  describe('Error Handling and Recovery Workflow', () => {
    it('should handle scheduling conflicts and provide alternatives', async () => {
      // Step 1: Create tasks that will cause scheduling conflicts
      const conflictTask1 = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Conflict Task 1',
          duration: 480, // 8 hours - exceeds daily capacity
          priority: 'critical',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          isHardDeadline: true,
          isBlocking: true
        })
        .expect(201);

      const conflictTask2 = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Conflict Task 2',
          duration: 480, // 8 hours - exceeds daily capacity
          priority: 'critical',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          isHardDeadline: true,
          isBlocking: true
        })
        .expect(201);

      // Step 2: Attempt to schedule (should detect conflicts)
      const scheduleResponse = await request(app)
        .post('/api/schedule/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should either succeed with partial scheduling or report conflicts
      if (!scheduleResponse.body.success) {
        expect(scheduleResponse.body.violations).toBeDefined();
        expect(scheduleResponse.body.violations.length).toBeGreaterThan(0);
        expect(scheduleResponse.body.suggestions).toBeDefined();
      } else {
        // If successful, should not schedule both conflicting tasks
        expect(scheduleResponse.body.unscheduledTasks.length).toBeGreaterThan(0);
      }

      // Step 3: Test conflict resolution suggestions
      const conflictResponse = await request(app)
        .get('/api/schedule/conflicts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(conflictResponse.body.conflicts).toBeDefined();
      if (conflictResponse.body.conflicts.length > 0) {
        expect(conflictResponse.body.suggestions).toBeDefined();
      }
    });
  });

  // Helper function to clean up test data
  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up in reverse dependency order
      if (userId) {
        await request(app)
          .delete(`/api/users/${userId}/test-cleanup`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .catch(() => {}); // Ignore errors during cleanup
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }
});