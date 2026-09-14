import { ConstraintCollection, DeadlineConstraint, WorkingHoursConstraint } from '@/models/Constraint';
import { Task } from '@/models/Task';
import { AvailableSlot } from '@/models/types';
import { User } from '@/models/User';
import { ConstraintCollectionService } from '@/services/ConstraintCollectionService';
import { ConstraintSatisfactionSolver } from '@/services/ConstraintSatisfactionSolver';
import { PriorityScoringService } from '@/services/PriorityScoringService';
import { ScheduleRequest } from '@/services/SchedulingTypes';
import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';

const referenceTime = new Date(2026, 0, 5, 8, 0, 0);
const deadline = new Date(2026, 0, 7, 8, 0, 0);

const user: User = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Deterministic User',
  timezone: 'UTC',
  workingHours: {
    monday: { start: '09:00', end: '17:00' },
    tuesday: { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday: { start: '09:00', end: '17:00' },
    friday: { start: '09:00', end: '17:00' },
  },
  preferences: {
    maxContinuousWorkTime: 120,
    preferredBreakDuration: 15,
    groupSimilarTasks: false,
    protectFocusTime: false,
    optimizeForEarlyCompletion: false,
    defaultMeetingBuffer: 0,
    energyPreferences: {
      highEnergyTimes: [],
      lowEnergyTimes: [],
      meetingPreferredTimes: [],
    },
    autoRescheduleEnabled: false,
    notificationSettings: {
      taskReminders: false,
      scheduleChanges: false,
      deadlineAlerts: false,
      completionCelebrations: false,
    },
  },
  connectedCalendars: [],
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(2026, 0, 1),
};

function createTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    userId: user.id,
    title: id,
    duration: 60,
    priority: 'high',
    isHardDeadline: false,
    isBlocking: false,
    dependencies: [],
    dependents: [],
    status: 'pending',
    completedMinutes: 0,
    remainingMinutes: 60,
    scheduledSlots: [],
    completionHistory: [],
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...overrides,
  };
}

function createRequest(): ScheduleRequest {
  return {
    userId: user.id,
    horizonStart: new Date(referenceTime),
    horizonEnd: new Date(2026, 0, 12, 17, 0, 0),
    trigger: {
      type: 'manual_trigger',
      entityId: user.id,
      timestamp: new Date(referenceTime),
    },
  };
}

function createConstraints(): ConstraintCollection {
  const workingHours = (dayOfWeek: number): WorkingHoursConstraint => ({
    id: `working-hours-${dayOfWeek}`,
    type: 'working_hours',
    priority: 100,
    description: 'Working hours',
    dayOfWeek,
    timeRange: { start: '09:00', end: '17:00' },
    timezone: 'UTC',
  });

  return {
    userId: user.id,
    constraints: [workingHours(1), workingHours(2)],
    collectedAt: new Date(referenceTime),
    validFrom: new Date(referenceTime),
    validUntil: new Date(2026, 0, 12, 17, 0, 0),
  };
}

function createSolver() {
  const priorityScoringService = {
    calculateRelativePriorities: jest.fn((tasks: Task[]) => tasks.map((task, index) => ({
      task,
      priorityScore: task.id === 'plain-task' ? 80 : 70,
      rank: index + 1,
    }))),
  } as unknown as typeof PriorityScoringService;
  const timeSlotGenerationService = {
    generateTaskSlots: jest.fn((task: Task) => Promise.resolve([
      task.id === 'plain-task'
        ? {
          startTime: new Date(2026, 0, 6, 10, 0, 0),
          endTime: new Date(2026, 0, 6, 11, 0, 0),
          duration: 60,
        }
        : {
          startTime: new Date(2026, 0, 5, 10, 0, 0),
          endTime: new Date(2026, 0, 5, 11, 0, 0),
          duration: 60,
        },
    ])),
  } as unknown as TimeSlotGenerationService;

  return {
    solver: new ConstraintSatisfactionSolver(priorityScoringService, timeSlotGenerationService),
    timeSlotGenerationService,
  };
}

async function solveAtSystemTime(systemTime: Date, options: { referenceTime?: Date } = {}) {
  jest.setSystemTime(systemTime);
  const { solver } = createSolver();
  const tasks = [
    createTask('plain-task'),
    createTask('deadline-task', { deadline: new Date(deadline) }),
  ];
  const availableSlots: AvailableSlot[] = [{
    startTime: new Date(2026, 0, 5, 9, 0, 0),
    endTime: new Date(2026, 0, 6, 17, 0, 0),
    duration: 1920,
  }];

  return solver.solve(tasks, user, createConstraints(), availableSlots, options as any);
}

describe('deterministic scheduling reference time', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('collects deadline urgency and collectedAt from the trigger timestamp under different system clocks', async () => {
    jest.useFakeTimers();
    const request = createRequest();
    const task = createTask('deadline-task', { deadline: new Date(deadline) });
    const service = new ConstraintCollectionService(
      { findById: jest.fn().mockResolvedValue(user) } as any,
      { findByUser: jest.fn().mockResolvedValue([task]) } as any,
      { findByUserAndDateRange: jest.fn().mockResolvedValue([]) } as any,
    );

    jest.setSystemTime(new Date(2025, 11, 1, 8, 0, 0));
    const first = await service.collectConstraints(request);
    jest.setSystemTime(new Date(2026, 0, 10, 8, 0, 0));
    const second = await service.collectConstraints(request);

    const firstDeadline = first.constraints.find((constraint) => constraint.type === 'deadline') as DeadlineConstraint;
    const secondDeadline = second.constraints.find((constraint) => constraint.type === 'deadline') as DeadlineConstraint;
    expect(firstDeadline.urgencyScore).toBe(80);
    expect(secondDeadline.urgencyScore).toBe(80);
    expect(first.collectedAt).toEqual(request.trigger.timestamp);
    expect(second.collectedAt).toEqual(request.trigger.timestamp);
    expect(first.collectedAt).not.toBe(request.trigger.timestamp);
    expect(second.collectedAt).not.toBe(request.trigger.timestamp);
  });

  it('uses an explicit reference time for task ordering and early-placement score under different system clocks', async () => {
    jest.useFakeTimers();

    const first = await solveAtSystemTime(new Date(2025, 11, 1, 8, 0, 0), {
      referenceTime: new Date(referenceTime),
    });
    const second = await solveAtSystemTime(new Date(2026, 0, 10, 8, 0, 0), {
      referenceTime: new Date(referenceTime),
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.scheduledTasks.map((slot) => slot.taskId)).toEqual(['deadline-task', 'plain-task']);
    expect(second.scheduledTasks.map((slot) => slot.taskId)).toEqual(['deadline-task', 'plain-task']);
    expect(first.optimizationScore).toBe(70);
    expect(second.optimizationScore).toBe(70);
  });

  it('uses constraints.validFrom as the deterministic solver reference when no option is supplied', async () => {
    jest.useFakeTimers();

    const first = await solveAtSystemTime(new Date(2025, 11, 1, 8, 0, 0));
    const second = await solveAtSystemTime(new Date(2026, 0, 10, 8, 0, 0));

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.scheduledTasks.map((slot) => slot.taskId)).toEqual(['deadline-task', 'plain-task']);
    expect(second.scheduledTasks.map((slot) => slot.taskId)).toEqual(['deadline-task', 'plain-task']);
    expect(first.optimizationScore).toBe(70);
    expect(second.optimizationScore).toBe(70);
  });
});
