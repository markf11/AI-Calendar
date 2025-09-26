import { ConstraintCollectionService } from '@/services/ConstraintCollectionService';
import { UserRepository } from '@/repositories/UserRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { User } from '@/models/User';
import { Task } from '@/models/Task';
import { CalendarEvent } from '@/models/CalendarEvent';
import { 
  WorkingHoursConstraint, 
  LunchBreakConstraint, 
  FirmEventConstraint,
  DeadlineConstraint,
  TaskPriorityConstraint,
  BufferTimeConstraint,
  TravelTimeConstraint,
  EnergyPreferenceConstraint,
  DependencyConstraint,
  MaxContinuousWorkConstraint
} from '@/models/Constraint';

// Mock repositories
jest.mock('@/repositories/UserRepository');
jest.mock('@/repositories/TaskRepository');
jest.mock('@/repositories/CalendarEventRepository');

describe('ConstraintCollectionService', () => {
  let service: ConstraintCollectionService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockTaskRepository: jest.Mocked<TaskRepository>;
  let mockCalendarEventRepository: jest.Mocked<CalendarEventRepository>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    timezone: 'America/New_York',
    workingHours: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      lunchBreak: { start: '12:00', end: '13:00' }
    },
    preferences: {
      maxContinuousWorkTime: 120, // 2 hours
      preferredBreakDuration: 15,
      groupSimilarTasks: true,
      protectFocusTime: true,
      optimizeForEarlyCompletion: false,
      defaultMeetingBuffer: 10, // 10 minutes
      energyPreferences: {
        highEnergyTimes: [{ start: '09:00', end: '11:00' }],
        lowEnergyTimes: [{ start: '14:00', end: '16:00' }],
        meetingPreferredTimes: [{ start: '10:00', end: '12:00' }]
      },
      autoRescheduleEnabled: true,
      notificationSettings: {
        taskReminders: true,
        scheduleChanges: true,
        deadlineAlerts: true,
        completionCelebrations: true
      }
    },
    connectedCalendars: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockTask: Task = {
    id: 'task-1',
    userId: 'user-1',
    title: 'Test Task',
    duration: 60,
    priority: 'high',
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    isHardDeadline: true,
    isBlocking: false,
    dependencies: ['task-2'],
    dependents: [],
    status: 'pending',
    completedMinutes: 0,
    remainingMinutes: 60,
    scheduledSlots: [],
    completionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockCalendarEvent: CalendarEvent = {
    id: 'event-1',
    userId: 'user-1',
    externalId: 'ext-1',
    title: 'Important Meeting',
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
    isFlexible: false,
    travelTimeBefore: 15,
    travelTimeAfter: 10,
    source: 'google',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
    mockTaskRepository = new TaskRepository({} as any) as jest.Mocked<TaskRepository>;
    mockCalendarEventRepository = new CalendarEventRepository({} as any) as jest.Mocked<CalendarEventRepository>;

    service = new ConstraintCollectionService(
      mockUserRepository,
      mockTaskRepository,
      mockCalendarEventRepository
    );

    // Setup default mocks
    mockUserRepository.findById.mockResolvedValue(mockUser);
    mockTaskRepository.findByUserId.mockResolvedValue([mockTask]);
    mockCalendarEventRepository.findByUserAndDateRange.mockResolvedValue([mockCalendarEvent]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectConstraints', () => {
    it('should collect all constraint types for a user', async () => {
      const validFrom = new Date();
      const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const result = await service.collectConstraints('user-1', validFrom, validUntil);

      expect(result.userId).toBe('user-1');
      expect(result.constraints).toBeDefined();
      expect(result.constraints.length).toBeGreaterThan(0);
      expect(result.collectedAt).toBeInstanceOf(Date);
      expect(result.validFrom).toBe(validFrom);
      expect(result.validUntil).toBe(validUntil);

      // Verify all constraint types are present
      const constraintTypes = result.constraints.map(c => c.type);
      expect(constraintTypes).toContain('working_hours');
      expect(constraintTypes).toContain('lunch_break');
      expect(constraintTypes).toContain('firm_event');
      expect(constraintTypes).toContain('deadline');
      expect(constraintTypes).toContain('task_priority');
      expect(constraintTypes).toContain('buffer_time');
      expect(constraintTypes).toContain('travel_time');
      expect(constraintTypes).toContain('energy_preference');
      expect(constraintTypes).toContain('dependency');
      expect(constraintTypes).toContain('max_continuous_work');
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.collectConstraints('invalid-user', new Date(), new Date())
      ).rejects.toThrow('User not found: invalid-user');
    });
  });

  describe('working hours constraints', () => {
    it('should create working hours constraints for each working day', async () => {
      const validFrom = new Date('2024-01-01'); // Monday
      const validUntil = new Date('2024-01-07'); // Sunday

      const result = await service.collectConstraints('user-1', validFrom, validUntil);
      
      const workingHoursConstraints = result.constraints.filter(
        c => c.type === 'working_hours'
      ) as WorkingHoursConstraint[];

      expect(workingHoursConstraints.length).toBe(5); // Monday to Friday
      
      const mondayConstraint = workingHoursConstraints.find(c => c.dayOfWeek === 1);
      expect(mondayConstraint).toBeDefined();
      expect(mondayConstraint!.timeRange).toEqual({ start: '09:00', end: '17:00' });
      expect(mondayConstraint!.priority).toBe(100);
      expect(mondayConstraint!.timezone).toBe('America/New_York');
    });

    it('should not create constraints for non-working days', async () => {
      const userWithoutWeekends = {
        ...mockUser,
        workingHours: {
          ...mockUser.workingHours,
          saturday: undefined,
          sunday: undefined
        }
      };
      mockUserRepository.findById.mockResolvedValue(userWithoutWeekends);

      const validFrom = new Date('2024-01-06'); // Saturday
      const validUntil = new Date('2024-01-07'); // Sunday

      const result = await service.collectConstraints('user-1', validFrom, validUntil);
      
      const workingHoursConstraints = result.constraints.filter(
        c => c.type === 'working_hours'
      );

      expect(workingHoursConstraints.length).toBe(0);
    });
  });

  describe('lunch break constraints', () => {
    it('should create lunch break constraint when defined', async () => {
      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const lunchConstraints = result.constraints.filter(
        c => c.type === 'lunch_break'
      ) as LunchBreakConstraint[];

      expect(lunchConstraints.length).toBe(1);
      expect(lunchConstraints[0].timeRange).toEqual({ start: '12:00', end: '13:00' });
      expect(lunchConstraints[0].priority).toBe(90);
    });

    it('should not create lunch break constraint when not defined', async () => {
      const userWithoutLunch = {
        ...mockUser,
        workingHours: {
          ...mockUser.workingHours,
          lunchBreak: undefined
        }
      };
      mockUserRepository.findById.mockResolvedValue(userWithoutLunch);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const lunchConstraints = result.constraints.filter(c => c.type === 'lunch_break');
      expect(lunchConstraints.length).toBe(0);
    });
  });

  describe('firm event constraints', () => {
    it('should create constraints for non-flexible calendar events', async () => {
      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const firmEventConstraints = result.constraints.filter(
        c => c.type === 'firm_event'
      ) as FirmEventConstraint[];

      expect(firmEventConstraints.length).toBe(1);
      expect(firmEventConstraints[0].eventId).toBe('event-1');
      expect(firmEventConstraints[0].startTime).toEqual(mockCalendarEvent.startTime);
      expect(firmEventConstraints[0].endTime).toEqual(mockCalendarEvent.endTime);
      expect(firmEventConstraints[0].priority).toBe(95);
      expect(firmEventConstraints[0].travelTimeBefore).toBe(15);
      expect(firmEventConstraints[0].travelTimeAfter).toBe(10);
    });

    it('should not create constraints for flexible events', async () => {
      const flexibleEvent = { ...mockCalendarEvent, isFlexible: true };
      mockCalendarEventRepository.findByUserAndDateRange.mockResolvedValue([flexibleEvent]);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const firmEventConstraints = result.constraints.filter(c => c.type === 'firm_event');
      expect(firmEventConstraints.length).toBe(0);
    });
  });

  describe('deadline constraints', () => {
    it('should create deadline constraints for tasks with deadlines', async () => {
      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const deadlineConstraints = result.constraints.filter(
        c => c.type === 'deadline'
      ) as DeadlineConstraint[];

      expect(deadlineConstraints.length).toBe(1);
      expect(deadlineConstraints[0].taskId).toBe('task-1');
      expect(deadlineConstraints[0].deadline).toEqual(mockTask.deadline);
      expect(deadlineConstraints[0].isHard).toBe(true);
      expect(deadlineConstraints[0].priority).toBe(100); // Hard deadline
      expect(deadlineConstraints[0].urgencyScore).toBeGreaterThan(0);
    });

    it('should calculate different urgency scores based on time remaining', async () => {
      const urgentTask = {
        ...mockTask,
        id: 'urgent-task',
        deadline: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours from now
      };
      const distantTask = {
        ...mockTask,
        id: 'distant-task',
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days from now
      };

      mockTaskRepository.findByUserId.mockResolvedValue([urgentTask, distantTask]);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const deadlineConstraints = result.constraints.filter(
        c => c.type === 'deadline'
      ) as DeadlineConstraint[];

      expect(deadlineConstraints.length).toBe(2);
      
      const urgentConstraint = deadlineConstraints.find(c => c.taskId === 'urgent-task');
      const distantConstraint = deadlineConstraints.find(c => c.taskId === 'distant-task');
      
      expect(urgentConstraint!.urgencyScore).toBeGreaterThan(distantConstraint!.urgencyScore);
    });

    it('should not create constraints for completed tasks', async () => {
      const completedTask = { ...mockTask, status: 'completed' as const };
      mockTaskRepository.findByUserId.mockResolvedValue([completedTask]);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const deadlineConstraints = result.constraints.filter(c => c.type === 'deadline');
      expect(deadlineConstraints.length).toBe(0);
    });
  });

  describe('task priority constraints', () => {
    it('should create priority constraints for all non-completed tasks', async () => {
      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const priorityConstraints = result.constraints.filter(
        c => c.type === 'task_priority'
      ) as TaskPriorityConstraint[];

      expect(priorityConstraints.length).toBe(1);
      expect(priorityConstraints[0].taskId).toBe('task-1');
      expect(priorityConstraints[0].taskPriority).toBe('high');
      expect(priorityConstraints[0].priorityScore).toBe(60); // High priority score
      expect(priorityConstraints[0].priority).toBe(60);
    });

    it('should assign correct priority scores', async () => {
      const tasks = [
        { ...mockTask, id: 'critical-task', priority: 'critical' as const },
        { ...mockTask, id: 'high-task', priority: 'high' as const },
        { ...mockTask, id: 'medium-task', priority: 'medium' as const },
        { ...mockTask, id: 'low-task', priority: 'low' as const }
      ];
      mockTaskRepository.findByUserId.mockResolvedValue(tasks);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const priorityConstraints = result.constraints.filter(
        c => c.type === 'task_priority'
      ) as TaskPriorityConstraint[];

      expect(priorityConstraints.length).toBe(4);
      
      const criticalConstraint = priorityConstraints.find(c => c.taskId === 'critical-task');
      const highConstraint = priorityConstraints.find(c => c.taskId === 'high-task');
      const mediumConstraint = priorityConstraints.find(c => c.taskId === 'medium-task');
      const lowConstraint = priorityConstraints.find(c => c.taskId === 'low-task');

      expect(criticalConstraint!.priorityScore).toBe(80);
      expect(highConstraint!.priorityScore).toBe(60);
      expect(mediumConstraint!.priorityScore).toBe(30);
      expect(lowConstraint!.priorityScore).toBe(10);
    });
  });

  describe('buffer time constraints', () => {
    it('should create buffer constraints around meetings', async () => {
      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const bufferConstraints = result.constraints.filter(
        c => c.type === 'buffer_time'
      ) as BufferTimeConstraint[];

      expect(bufferConstraints.length).toBe(2); // Before and after meeting
      
      const beforeBuffer = bufferConstraints.find(c => c.beforeEventId === 'event-1');
      const afterBuffer = bufferConstraints.find(c => c.afterEventId === 'event-1');

      expect(beforeBuffer).toBeDefined();
      expect(beforeBuffer!.duration).toBe(10); // Default meeting buffer
      expect(beforeBuffer!.priority).toBe(60);

      expect(afterBuffer).toBeDefined();
      expect(afterBuffer!.duration).toBe(10);
      expect(afterBuffer!.priority).toBe(60);
    });

    it('should not create buffer constraints when buffer is 0', async () => {
      const userWithoutBuffer = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          defaultMeetingBuffer: 0
        }
      };
      mockUserRepository.findById.mockResolvedValue(userWithoutBuffer);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const bufferConstraints = result.constraints.filter(c => c.type === 'buffer_time');
      expect(bufferConstraints.length).toBe(0);
    });
  });

  describe('travel time constraints', () => {
    it('should create travel time constraints for events with travel time', async () => {
      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const travelConstraints = result.constraints.filter(
        c => c.type === 'travel_time'
      ) as TravelTimeConstraint[];

      expect(travelConstraints.length).toBe(2); // Before and after event
      
      const beforeTravel = travelConstraints.find(c => c.toEventId === 'event-1');
      const afterTravel = travelConstraints.find(c => c.fromEventId === 'event-1');

      expect(beforeTravel).toBeDefined();
      expect(beforeTravel!.duration).toBe(15);
      expect(beforeTravel!.priority).toBe(85);

      expect(afterTravel).toBeDefined();
      expect(afterTravel!.duration).toBe(10);
      expect(afterTravel!.priority).toBe(85);
    });

    it('should not create travel constraints for events without travel time', async () => {
      const eventWithoutTravel = {
        ...mockCalendarEvent,
        travelTimeBefore: undefined,
        travelTimeAfter: undefined
      };
      mockCalendarEventRepository.findByUserAndDateRange.mockResolvedValue([eventWithoutTravel]);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const travelConstraints = result.constraints.filter(c => c.type === 'travel_time');
      expect(travelConstraints.length).toBe(0);
    });
  });

  describe('energy preference constraints', () => {
    it('should create energy constraints based on task priority', async () => {
      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const energyConstraints = result.constraints.filter(
        c => c.type === 'energy_preference'
      ) as EnergyPreferenceConstraint[];

      expect(energyConstraints.length).toBe(1);
      expect(energyConstraints[0].taskId).toBe('task-1');
      expect(energyConstraints[0].taskPriority).toBe('high');
      expect(energyConstraints[0].energyLevel).toBe('high');
      expect(energyConstraints[0].preferredTimeRanges).toEqual([{ start: '09:00', end: '11:00' }]);
      expect(energyConstraints[0].priority).toBe(40);
    });

    it('should map low priority tasks to low energy times', async () => {
      const lowPriorityTask = { ...mockTask, priority: 'low' as const };
      mockTaskRepository.findByUserId.mockResolvedValue([lowPriorityTask]);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const energyConstraints = result.constraints.filter(
        c => c.type === 'energy_preference'
      ) as EnergyPreferenceConstraint[];

      expect(energyConstraints[0].energyLevel).toBe('low');
      expect(energyConstraints[0].preferredTimeRanges).toEqual([{ start: '14:00', end: '16:00' }]);
    });
  });

  describe('dependency constraints', () => {
    it('should create dependency constraints for tasks with dependencies', async () => {
      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const dependencyConstraints = result.constraints.filter(
        c => c.type === 'dependency'
      ) as DependencyConstraint[];

      expect(dependencyConstraints.length).toBe(1);
      expect(dependencyConstraints[0].dependentTaskId).toBe('task-1');
      expect(dependencyConstraints[0].prerequisiteTaskId).toBe('task-2');
      expect(dependencyConstraints[0].mustCompleteFirst).toBe(true);
      expect(dependencyConstraints[0].priority).toBe(90);
    });

    it('should not create constraints for tasks without dependencies', async () => {
      const taskWithoutDeps = { ...mockTask, dependencies: [] };
      mockTaskRepository.findByUserId.mockResolvedValue([taskWithoutDeps]);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const dependencyConstraints = result.constraints.filter(c => c.type === 'dependency');
      expect(dependencyConstraints.length).toBe(0);
    });
  });

  describe('max continuous work constraints', () => {
    it('should create max work time constraint when configured', async () => {
      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const maxWorkConstraints = result.constraints.filter(
        c => c.type === 'max_continuous_work'
      ) as MaxContinuousWorkConstraint[];

      expect(maxWorkConstraints.length).toBe(1);
      expect(maxWorkConstraints[0].maxDuration).toBe(120); // 2 hours
      expect(maxWorkConstraints[0].breakDuration).toBe(15);
      expect(maxWorkConstraints[0].priority).toBe(50);
    });

    it('should not create constraint when max work time is 0', async () => {
      const userWithoutMaxWork = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          maxContinuousWorkTime: 0
        }
      };
      mockUserRepository.findById.mockResolvedValue(userWithoutMaxWork);

      const result = await service.collectConstraints('user-1', new Date(), new Date());
      
      const maxWorkConstraints = result.constraints.filter(c => c.type === 'max_continuous_work');
      expect(maxWorkConstraints.length).toBe(0);
    });
  });
});