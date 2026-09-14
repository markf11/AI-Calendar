import { CalendarEvent } from '@/models/CalendarEvent';
import {
  ScheduleRevision,
  ScheduleSnapshot,
  ScheduleSnapshotInput,
} from '@/models/Schedule';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { ConstraintCollection } from '@/models/Constraint';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import {
  ScheduleRevisionConflictError,
  ScheduleRevisionRepository,
} from '@/repositories/ScheduleRevisionRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { ConstraintCollectionService } from '@/services/ConstraintCollectionService';
import {
  ConstraintSatisfactionSolver,
  SolverResult,
} from '@/services/ConstraintSatisfactionSolver';
import {
  ScheduleOrchestrationError,
  ScheduleOrchestrationService,
  ScheduleUpdatePublisher,
} from '@/services/ScheduleOrchestrationService';
import { ScheduleRequest } from '@/services/SchedulingTypes';
import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';
import { DeadlineRiskService } from '@/services/domain/DeadlineRiskService';
import { ScheduleExplanationService } from '@/services/domain/ScheduleExplanationService';

const horizonStart = new Date('2026-08-26T09:00:00.000Z');
const horizonEnd = new Date('2026-08-26T17:00:00.000Z');

const user: User = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Schedule User',
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
    groupSimilarTasks: true,
    protectFocusTime: true,
    optimizeForEarlyCompletion: true,
    defaultMeetingBuffer: 15,
    energyPreferences: {
      highEnergyTimes: [],
      lowEnergyTimes: [],
      meetingPreferredTimes: [],
    },
    autoRescheduleEnabled: true,
    notificationSettings: {
      taskReminders: true,
      scheduleChanges: true,
      deadlineAlerts: true,
      completionCelebrations: true,
    },
  },
  connectedCalendars: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const hardDeadlineTask: Task = {
  id: 'task-hard',
  userId: user.id,
  title: 'Submit report',
  duration: 60,
  priority: 'critical',
  deadline: new Date('2026-08-26T16:00:00.000Z'),
  isHardDeadline: true,
  isBlocking: false,
  dependencies: [],
  dependents: [],
  status: 'pending',
  completedMinutes: 0,
  remainingMinutes: 60,
  scheduledSlots: [],
  completionHistory: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const softDeadlineTask: Task = {
  ...hardDeadlineTask,
  id: 'task-soft',
  title: 'Prepare slides',
  priority: 'high',
  deadline: new Date('2026-08-26T15:00:00.000Z'),
  isHardDeadline: false,
  status: 'blocked',
};

const completedTask: Task = {
  ...hardDeadlineTask,
  id: 'task-completed',
  title: 'Completed prerequisite',
  status: 'completed',
  completedMinutes: 60,
  remainingMinutes: 0,
};

const calendarEvent: CalendarEvent = {
  id: 'event-1',
  userId: user.id,
  title: 'Planning meeting',
  startTime: new Date('2026-08-26T10:00:00.000Z'),
  endTime: new Date('2026-08-26T10:30:00.000Z'),
  isFlexible: false,
  source: 'momentum',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const scheduledSlot = {
  id: 'block-1',
  taskId: hardDeadlineTask.id,
  startTime: new Date('2026-08-26T11:00:00.000Z'),
  endTime: new Date('2026-08-26T12:00:00.000Z'),
  duration: 60,
  isConfirmed: false,
};

const constraints: ConstraintCollection = {
  userId: user.id,
  constraints: [],
  collectedAt: horizonStart,
  validFrom: horizonStart,
  validUntil: horizonEnd,
};

const successfulSolverResult = (): SolverResult => ({
  success: true,
  scheduledTasks: [{ ...scheduledSlot }],
  unscheduledTasks: [],
  violations: [],
  optimizationScore: 100,
  solvingTimeMs: 4,
  metadata: {
    totalTasks: 2,
    schedulableTasks: 2,
    availableSlots: 1,
    constraintsChecked: 3,
    backtrackingSteps: 2,
  },
});

const failedSolverResult = (): SolverResult => ({
  ...successfulSolverResult(),
  success: false,
  scheduledTasks: [],
  unscheduledTasks: [hardDeadlineTask],
});

const request = (): ScheduleRequest => ({
  userId: user.id,
  horizonStart,
  horizonEnd,
  trigger: {
    type: 'manual_trigger',
    entityId: user.id,
    timestamp: horizonStart,
  },
});

const snapshotInput = (): ScheduleSnapshotInput => ({
  events: [calendarEvent],
  taskBlocks: [{ ...scheduledSlot }],
  alerts: [],
  explanations: [],
});

const persistedRevision = (
  revision: number,
  snapshot: ScheduleSnapshot,
  overrides: Partial<ScheduleRevision> = {},
): ScheduleRevision => ({
  id: `revision-${revision}`,
  userId: user.id,
  revision,
  horizonStart,
  horizonEnd,
  trigger: 'manual_trigger',
  snapshot,
  createdAt: horizonStart,
  ...overrides,
});

type Harness = ReturnType<typeof createHarness>;

function createHarness(options: {
  publisher?: ScheduleUpdatePublisher;
  activeTasks?: Task[];
  solverResult?: SolverResult;
  savedRevision?: ScheduleRevision;
  deadlineRiskService?: DeadlineRiskService;
  scheduleExplanationService?: ScheduleExplanationService;
} = {}) {
  const activeTasks = options.activeTasks ?? [hardDeadlineTask, softDeadlineTask];
  const solverResult = options.solverResult ?? successfulSolverResult();
  const defaultSnapshot: ScheduleSnapshot = {
    ...snapshotInput(),
    revision: 5,
  };
  const savedRevision = options.savedRevision ?? persistedRevision(5, defaultSnapshot);
  const constraintCollectionService = {
    collectConstraints: jest.fn().mockResolvedValue(constraints),
  } as unknown as ConstraintCollectionService;
  const timeSlotGenerationService = {
    generateAvailableSlots: jest.fn().mockResolvedValue([
      {
        startTime: new Date('2026-08-26T09:00:00.000Z'),
        endTime: new Date('2026-08-26T17:00:00.000Z'),
        duration: 480,
      },
    ]),
  } as unknown as TimeSlotGenerationService;
  const constraintSatisfactionSolver = {
    solve: jest.fn().mockResolvedValue(solverResult),
  } as unknown as ConstraintSatisfactionSolver;
  const userRepository = {
    findById: jest.fn().mockResolvedValue(user),
  } as unknown as UserRepository;
  const taskRepository = {
    findByUser: jest.fn().mockResolvedValue(activeTasks),
    findByUserWithDependencies: jest.fn().mockResolvedValue(activeTasks),
    findScheduledByUserIdAndDateRange: jest.fn().mockResolvedValue([]),
  } as unknown as TaskRepository;
  const calendarEventRepository = {
    findByUserAndDateRange: jest.fn().mockResolvedValue([calendarEvent]),
  } as unknown as CalendarEventRepository;
  const scheduleRevisionRepository = {
    findLatestCoveringHorizon: jest.fn().mockResolvedValue(null),
    findByRevision: jest.fn().mockResolvedValue(null),
    findPrevious: jest.fn().mockResolvedValue(null),
    saveAndApply: jest.fn().mockResolvedValue(savedRevision),
  } as unknown as ScheduleRevisionRepository;
  const deadlineRiskService = options.deadlineRiskService ?? {
    assess: jest.fn((input: { isHardDeadline: boolean; deadline?: Date }) => ({
      deadlineKind: input.isHardDeadline ? 'hard' : 'soft',
      remainingEffortMinutes: 60,
      capacityBeforeDeadlineMinutes: 30,
      mustStartBy: null,
      severity: input.isHardDeadline ? 'critical' : input.deadline ? 'high' : 'none',
      reasonCodes: input.isHardDeadline
        ? ['HARD_DEADLINE', 'INSUFFICIENT_CAPACITY']
        : ['SOFT_DEADLINE', 'INSUFFICIENT_CAPACITY'],
    })),
  } as unknown as DeadlineRiskService;
  const scheduleExplanationService = options.scheduleExplanationService ?? {
    explainPlacement: jest.fn((input: {
      taskTitle: string;
      reasonCodes: readonly string[];
    }) => ({
      action: 'placed' as const,
      reasonCodes: [...input.reasonCodes],
      explanation: `human placement for ${input.taskTitle}`,
    })),
  } as unknown as ScheduleExplanationService;
  const publisher = options.publisher;
  const service = new ScheduleOrchestrationService(
    constraintCollectionService,
    timeSlotGenerationService,
    constraintSatisfactionSolver,
    userRepository,
    taskRepository,
    calendarEventRepository,
    scheduleRevisionRepository,
    deadlineRiskService,
    scheduleExplanationService,
    publisher,
  );

  return {
    service,
    constraintCollectionService,
    timeSlotGenerationService,
    constraintSatisfactionSolver,
    userRepository,
    taskRepository,
    calendarEventRepository,
    scheduleRevisionRepository,
    deadlineRiskService,
    scheduleExplanationService,
  };
}

const expectCode = async (
  action: Promise<unknown>,
  code: string,
): Promise<ScheduleOrchestrationError> => {
  try {
    await action;
    throw new Error('Expected schedule orchestration to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(ScheduleOrchestrationError);
    expect(error).toMatchObject({ code });
    return error as ScheduleOrchestrationError;
  }
};

describe('ScheduleOrchestrationService getSchedule', () => {
  it.each([
    [new Date(Number.NaN), horizonEnd],
    [horizonStart, new Date(Number.POSITIVE_INFINITY)],
    [horizonStart, horizonStart],
  ])('rejects invalid end-exclusive horizons without reading persistence', async (start, end) => {
    const harness = createHarness();

    await expectCode(harness.service.getSchedule(user.id, start, end), 'INVALID_HORIZON');

    expect(harness.scheduleRevisionRepository.findLatestCoveringHorizon).not.toHaveBeenCalled();
    expect(harness.calendarEventRepository.findByUserAndDateRange).not.toHaveBeenCalled();
  });

  it('returns the latest persisted snapshot that covers the requested horizon', async () => {
    const cachedSnapshot: ScheduleSnapshot = {
      ...snapshotInput(),
      revision: 7,
    };
    const harness = createHarness();
    (harness.scheduleRevisionRepository.findLatestCoveringHorizon as jest.Mock)
      .mockResolvedValue(persistedRevision(7, cachedSnapshot));

    const result = await harness.service.getSchedule(user.id, horizonStart, horizonEnd);

    expect(result).toBe(cachedSnapshot);
    expect(harness.scheduleRevisionRepository.findLatestCoveringHorizon).toHaveBeenCalledWith(
      user.id,
      horizonStart,
      horizonEnd,
    );
    expect(harness.calendarEventRepository.findByUserAndDateRange).not.toHaveBeenCalled();
    expect(harness.taskRepository.findScheduledByUserIdAndDateRange).not.toHaveBeenCalled();
    expect(harness.scheduleRevisionRepository.saveAndApply).not.toHaveBeenCalled();
  });

  it('falls back to current events and flattened scheduled task slots without persisting', async () => {
    const taskWithSlots: Task = {
      ...hardDeadlineTask,
      scheduledSlots: [
        { ...scheduledSlot },
        {
          ...scheduledSlot,
          id: 'block-2',
          startTime: new Date('2026-08-26T13:00:00.000Z'),
          endTime: new Date('2026-08-26T14:00:00.000Z'),
        },
      ],
    };
    const harness = createHarness();
    (harness.taskRepository.findScheduledByUserIdAndDateRange as jest.Mock)
      .mockResolvedValue([taskWithSlots]);

    const result = await harness.service.getSchedule(user.id, horizonStart, horizonEnd);

    expect(result).toEqual({
      events: [calendarEvent],
      taskBlocks: taskWithSlots.scheduledSlots,
      alerts: [],
      explanations: [],
      revision: 0,
    });
    expect(harness.calendarEventRepository.findByUserAndDateRange).toHaveBeenCalledWith(
      user.id,
      { start: horizonStart, end: horizonEnd },
    );
    expect(harness.taskRepository.findScheduledByUserIdAndDateRange).toHaveBeenCalledWith(
      user.id,
      horizonStart,
      horizonEnd,
    );
    expect(harness.scheduleRevisionRepository.saveAndApply).not.toHaveBeenCalled();
  });
});

describe('ScheduleOrchestrationService replan', () => {
  it('returns USER_NOT_FOUND before planning or persisting', async () => {
    const harness = createHarness();
    (harness.userRepository.findById as jest.Mock).mockResolvedValue(null);

    await expectCode(harness.service.replan(request()), 'USER_NOT_FOUND');

    expect(harness.taskRepository.findByUser).not.toHaveBeenCalled();
    expect(harness.constraintSatisfactionSolver.solve).not.toHaveBeenCalled();
    expect(harness.scheduleRevisionRepository.saveAndApply).not.toHaveBeenCalled();
  });

  it('uses one collected constraint snapshot for slot generation and solving', async () => {
    const harness = createHarness();
    const scheduleRequest = request();
    const constraintSnapshot: ConstraintCollection = {
      ...constraints,
      collectedAt: new Date('2026-08-26T09:01:00.000Z'),
    };
    (harness.constraintCollectionService.collectConstraints as jest.Mock)
      .mockResolvedValue(constraintSnapshot);

    await harness.service.replan(scheduleRequest);

    expect(harness.constraintCollectionService.collectConstraints).toHaveBeenCalledTimes(1);
    expect(harness.constraintCollectionService.collectConstraints).toHaveBeenCalledWith(scheduleRequest);
    expect(harness.timeSlotGenerationService.generateAvailableSlots).toHaveBeenCalledWith(
      scheduleRequest,
      15,
      constraintSnapshot,
    );
    const slotGenerationCall = (harness.timeSlotGenerationService.generateAvailableSlots as jest.Mock)
      .mock.calls[0];
    expect(slotGenerationCall[0]).toBe(scheduleRequest);
    expect(slotGenerationCall[2]).toBe(constraintSnapshot);
    expect(harness.constraintSatisfactionSolver.solve).toHaveBeenCalledWith(
      [hardDeadlineTask, softDeadlineTask],
      user,
      constraintSnapshot,
      expect.any(Array),
      {
        allowSoftViolations: true,
        optimizeForEarlyCompletion: true,
        minimizeContextSwitching: true,
        completedTaskIds: [],
        referenceTime: scheduleRequest.trigger.timestamp,
      },
    );
    const solverCall = (harness.constraintSatisfactionSolver.solve as jest.Mock).mock.calls[0];
    expect(solverCall[2]).toBe(constraintSnapshot);
    expect(solverCall[4].referenceTime).toBe(scheduleRequest.trigger.timestamp);
  });

  it('loads completed prerequisites with planning tasks while only solving and replacing active tasks', async () => {
    const activeDependentTask: Task = {
      ...hardDeadlineTask,
      id: 'task-dependent',
      dependencies: [completedTask.id],
    };
    const harness = createHarness({
      activeTasks: [activeDependentTask, softDeadlineTask, completedTask],
    });

    await harness.service.replan(request());

    expect(harness.taskRepository.findByUserWithDependencies).toHaveBeenCalledTimes(1);
    expect(harness.taskRepository.findByUserWithDependencies).toHaveBeenCalledWith(user.id, {
      status: ['pending', 'scheduled', 'in_progress', 'blocked', 'completed'],
    });
    expect(harness.taskRepository.findByUser).not.toHaveBeenCalled();
    expect(harness.constraintSatisfactionSolver.solve).toHaveBeenCalledWith(
      [activeDependentTask, softDeadlineTask],
      user,
      constraints,
      expect.any(Array),
      {
        allowSoftViolations: true,
        optimizeForEarlyCompletion: true,
        minimizeContextSwitching: true,
        completedTaskIds: [completedTask.id],
        referenceTime: horizonStart,
      },
    );
    expect(harness.scheduleRevisionRepository.saveAndApply).toHaveBeenCalledWith(
      user.id,
      expect.any(Object),
      [activeDependentTask.id, softDeadlineTask.id],
    );
  });

  it('clips generated available slots to the exact end-exclusive request horizon before solving', async () => {
    const partialHorizonStart = new Date('2026-08-26T13:00:00.000Z');
    const partialHorizonEnd = new Date('2026-08-26T14:00:00.000Z');
    const harness = createHarness({
      solverResult: {
        ...successfulSolverResult(),
        scheduledTasks: [{
          ...scheduledSlot,
          startTime: partialHorizonStart,
          endTime: new Date('2026-08-26T13:30:00.000Z'),
          duration: 30,
        }],
      },
    });
    const generatedSlots = [
      {
        startTime: new Date('2026-08-26T12:30:00.000Z'),
        endTime: new Date('2026-08-26T13:30:00.000Z'),
        duration: 60,
        source: 'leading-overlap',
      },
      {
        startTime: new Date('2026-08-26T13:15:00.000Z'),
        endTime: new Date('2026-08-26T13:45:00.000Z'),
        duration: 5,
        source: 'inside-horizon',
      },
      {
        startTime: new Date('2026-08-26T13:30:00.000Z'),
        endTime: new Date('2026-08-26T14:30:00.000Z'),
        duration: 60,
        source: 'trailing-overlap',
      },
      {
        startTime: new Date('2026-08-26T12:00:00.000Z'),
        endTime: partialHorizonStart,
        duration: 60,
        source: 'ends-at-horizon-start',
      },
      {
        startTime: partialHorizonEnd,
        endTime: new Date('2026-08-26T15:00:00.000Z'),
        duration: 60,
        source: 'starts-at-horizon-end',
      },
    ];
    (harness.timeSlotGenerationService.generateAvailableSlots as jest.Mock)
      .mockResolvedValue(generatedSlots);

    await harness.service.replan({
      ...request(),
      horizonStart: partialHorizonStart,
      horizonEnd: partialHorizonEnd,
    });

    expect((harness.constraintSatisfactionSolver.solve as jest.Mock).mock.calls[0][3]).toEqual([
      {
        startTime: partialHorizonStart,
        endTime: new Date('2026-08-26T13:30:00.000Z'),
        duration: 30,
        source: 'leading-overlap',
      },
      {
        startTime: new Date('2026-08-26T13:15:00.000Z'),
        endTime: new Date('2026-08-26T13:45:00.000Z'),
        duration: 30,
        source: 'inside-horizon',
      },
      {
        startTime: new Date('2026-08-26T13:30:00.000Z'),
        endTime: partialHorizonEnd,
        duration: 30,
        source: 'trailing-overlap',
      },
    ]);
  });

  it.each([
    [
      'starts before the horizon',
      {
        ...scheduledSlot,
        startTime: new Date('2026-08-26T12:59:00.000Z'),
        endTime: new Date('2026-08-26T13:30:00.000Z'),
      },
    ],
    [
      'ends after the horizon',
      {
        ...scheduledSlot,
        startTime: new Date('2026-08-26T13:30:00.000Z'),
        endTime: new Date('2026-08-26T14:01:00.000Z'),
      },
    ],
    [
      'does not have a positive interval',
      {
        ...scheduledSlot,
        startTime: new Date('2026-08-26T13:30:00.000Z'),
        endTime: new Date('2026-08-26T13:30:00.000Z'),
      },
    ],
    [
      'has a non-finite timestamp',
      {
        ...scheduledSlot,
        startTime: new Date(Number.NaN),
        endTime: new Date('2026-08-26T13:30:00.000Z'),
      },
    ],
    [
      'has a non-finite duration',
      {
        ...scheduledSlot,
        startTime: new Date('2026-08-26T13:30:00.000Z'),
        endTime: new Date('2026-08-26T13:45:00.000Z'),
        duration: Number.NaN,
      },
    ],
    [
      'has a duration that does not match its timestamps',
      {
        ...scheduledSlot,
        startTime: new Date('2026-08-26T13:00:00.000Z'),
        endTime: new Date('2026-08-26T13:15:00.000Z'),
        duration: 60,
      },
    ],
  ])('returns PLANNING_FAILED without persisting or publishing when a solver block %s', async (_case, block) => {
    const partialHorizonStart = new Date('2026-08-26T13:00:00.000Z');
    const partialHorizonEnd = new Date('2026-08-26T14:00:00.000Z');
    const publisher: ScheduleUpdatePublisher = { publish: jest.fn() };
    const hostileSolverResult: SolverResult = {
      ...successfulSolverResult(),
      scheduledTasks: [block],
    };
    const harness = createHarness({ publisher, solverResult: hostileSolverResult });

    const error = await expectCode(harness.service.replan({
      ...request(),
      horizonStart: partialHorizonStart,
      horizonEnd: partialHorizonEnd,
    }), 'PLANNING_FAILED');

    expect(error.solverResult).toBe(hostileSolverResult);
    expect(harness.scheduleRevisionRepository.saveAndApply).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('returns PLANNING_FAILED with the solver result and does not write or publish', async () => {
    const publisher: ScheduleUpdatePublisher = { publish: jest.fn() };
    const failedResult = failedSolverResult();
    const harness = createHarness({ publisher, solverResult: failedResult });

    const error = await expectCode(harness.service.replan(request()), 'PLANNING_FAILED');

    expect(error.solverResult).toBe(failedResult);
    expect(harness.scheduleRevisionRepository.saveAndApply).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('uses only task-proven reason codes and persists exact explanation results', async () => {
    const softScheduledSlot = {
      ...scheduledSlot,
      id: 'block-soft',
      taskId: softDeadlineTask.id,
      startTime: new Date('2026-08-26T13:00:00.000Z'),
      endTime: new Date('2026-08-26T14:00:00.000Z'),
    };
    const scheduleExplanationService = {
      explainPlacement: jest.fn()
        .mockReturnValueOnce({
          action: 'placed' as const,
          reasonCodes: ['HARD_DEADLINE'],
          explanation: 'hard explanation returned',
        })
        .mockReturnValueOnce({
          action: 'placed' as const,
          reasonCodes: [],
          explanation: 'soft explanation returned',
        }),
    } as unknown as ScheduleExplanationService;
    const harness = createHarness({
      solverResult: {
        ...successfulSolverResult(),
        scheduledTasks: [{ ...scheduledSlot }, softScheduledSlot],
      },
      scheduleExplanationService,
    });

    await harness.service.replan(request());

    expect(harness.scheduleExplanationService.explainPlacement).toHaveBeenNthCalledWith(1, {
      taskTitle: hardDeadlineTask.title,
      scheduledStart: scheduledSlot.startTime,
      reasonCodes: ['HARD_DEADLINE'],
    });
    expect(harness.scheduleExplanationService.explainPlacement).toHaveBeenNthCalledWith(2, {
      taskTitle: softDeadlineTask.title,
      scheduledStart: softScheduledSlot.startTime,
      reasonCodes: [],
    });
    expect((harness.scheduleRevisionRepository.saveAndApply as jest.Mock).mock.calls[0][1]
      .snapshot.explanations).toEqual([
      {
        taskId: hardDeadlineTask.id,
        blockId: scheduledSlot.id,
        reason: 'hard explanation returned',
        details: 'HARD_DEADLINE',
      },
      {
        taskId: softDeadlineTask.id,
        blockId: softScheduledSlot.id,
        reason: 'soft explanation returned',
        details: '',
      },
    ]);
  });

  it('assesses each deadline against only that task\'s committed blocks', async () => {
    const harness = createHarness({
      solverResult: successfulSolverResult(),
      deadlineRiskService: new DeadlineRiskService(),
    });

    await harness.service.replan(request());

    expect((harness.scheduleRevisionRepository.saveAndApply as jest.Mock).mock.calls[0][1]
      .snapshot.alerts).toEqual([
      {
        type: 'deadline',
        message: `${softDeadlineTask.title} is at high deadline risk`,
        severity: 'warning',
        taskId: softDeadlineTask.id,
      },
    ]);
  });

  it('persists and publishes the committed snapshot with exact slots, mapped alerts, and explanations', async () => {
    const persistedSnapshot: ScheduleSnapshot = {
      events: [calendarEvent],
      taskBlocks: [{ ...scheduledSlot }],
      alerts: [
        {
          type: 'deadline',
          message: 'persisted deadline alert',
          severity: 'error',
          taskId: hardDeadlineTask.id,
        },
      ],
      explanations: [
        {
          taskId: hardDeadlineTask.id,
          blockId: scheduledSlot.id,
          reason: 'persisted explanation',
          details: 'HARD_DEADLINE, CONFLICT_AVOIDANCE, EARLIEST_AVAILABLE',
        },
      ],
      revision: 11,
    };
    const publisher: ScheduleUpdatePublisher = { publish: jest.fn() };
    const solverResult = successfulSolverResult();
    const harness = createHarness({
      publisher,
      solverResult,
      savedRevision: persistedRevision(11, persistedSnapshot),
    });

    const result = await harness.service.replan(request());

    expect(result).toEqual({ snapshot: persistedSnapshot, solverResult });
    expect(harness.deadlineRiskService.assess).toHaveBeenCalledTimes(2);
    expect(harness.scheduleExplanationService.explainPlacement).toHaveBeenCalledWith({
      taskTitle: hardDeadlineTask.title,
      scheduledStart: scheduledSlot.startTime,
      reasonCodes: ['HARD_DEADLINE'],
    });
    expect(harness.scheduleRevisionRepository.saveAndApply).toHaveBeenCalledTimes(1);
    expect(harness.scheduleRevisionRepository.saveAndApply).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        horizonStart,
        horizonEnd,
        trigger: 'manual_trigger',
        snapshot: expect.objectContaining({
          events: [calendarEvent],
          taskBlocks: [{ ...scheduledSlot }],
          alerts: [
            expect.objectContaining({
              taskId: hardDeadlineTask.id,
              severity: 'error',
            }),
            expect.objectContaining({
              taskId: softDeadlineTask.id,
              severity: 'warning',
            }),
          ],
          explanations: [
            {
              taskId: hardDeadlineTask.id,
              blockId: scheduledSlot.id,
              reason: `human placement for ${hardDeadlineTask.title}`,
              details: 'HARD_DEADLINE',
            },
          ],
        }),
      }),
      [hardDeadlineTask.id, softDeadlineTask.id],
    );
    expect(publisher.publish).toHaveBeenCalledWith(user.id, persistedSnapshot);
  });

  it('returns the committed snapshot when publication fails after persistence', async () => {
    const persistedSnapshot: ScheduleSnapshot = {
      ...snapshotInput(),
      revision: 9,
    };
    const publisher: ScheduleUpdatePublisher = {
      publish: jest.fn().mockRejectedValue(new Error('socket unavailable')),
    };
    const harness = createHarness({
      publisher,
      savedRevision: persistedRevision(9, persistedSnapshot),
    });

    await expect(harness.service.replan(request())).resolves.toEqual({
      snapshot: persistedSnapshot,
      solverResult: expect.any(Object),
    });
    expect(harness.scheduleRevisionRepository.saveAndApply).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith(user.id, persistedSnapshot);
  });
});

describe('ScheduleOrchestrationService undo', () => {
  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid current revision %p without reading persistence',
    async (currentRevision) => {
      const harness = createHarness();

      await expectCode(harness.service.undo(user.id, currentRevision), 'INVALID_REVISION');

      expect(harness.scheduleRevisionRepository.findByRevision).not.toHaveBeenCalled();
      expect(harness.scheduleRevisionRepository.saveAndApply).not.toHaveBeenCalled();
    },
  );

  it('returns REVISION_NOT_FOUND when the current revision is absent for the user', async () => {
    const harness = createHarness();

    await expectCode(harness.service.undo(user.id, 3), 'REVISION_NOT_FOUND');

    expect(harness.scheduleRevisionRepository.findByRevision).toHaveBeenCalledWith(user.id, 3);
    expect(harness.scheduleRevisionRepository.findPrevious).not.toHaveBeenCalled();
    expect(harness.scheduleRevisionRepository.saveAndApply).not.toHaveBeenCalled();
  });

  it('returns NO_PREVIOUS_REVISION when the current revision has no predecessor', async () => {
    const harness = createHarness();
    (harness.scheduleRevisionRepository.findByRevision as jest.Mock)
      .mockResolvedValue(persistedRevision(1, { ...snapshotInput(), revision: 1 }));

    await expectCode(harness.service.undo(user.id, 1), 'NO_PREVIOUS_REVISION');

    expect(harness.scheduleRevisionRepository.findPrevious).toHaveBeenCalledWith(user.id, 1);
    expect(harness.taskRepository.findByUser).not.toHaveBeenCalled();
    expect(harness.scheduleRevisionRepository.saveAndApply).not.toHaveBeenCalled();
  });

  it('restores the previous snapshot atomically as a new undo revision and publishes the new snapshot', async () => {
    const previousSnapshot: ScheduleSnapshot = {
      ...snapshotInput(),
      alerts: [
        {
          type: 'deadline',
          message: 'previous alert',
          severity: 'warning',
          taskId: hardDeadlineTask.id,
        },
      ],
      explanations: [
        {
          taskId: hardDeadlineTask.id,
          blockId: scheduledSlot.id,
          reason: 'previous explanation',
          details: 'EARLIEST_AVAILABLE',
        },
      ],
      revision: 2,
    };
    const newSnapshot: ScheduleSnapshot = {
      ...previousSnapshot,
      revision: 4,
    };
    const publisher: ScheduleUpdatePublisher = { publish: jest.fn() };
    const harness = createHarness({
      publisher,
      savedRevision: persistedRevision(4, newSnapshot, { trigger: 'undo', restoredFromRevision: 2 }),
    });
    (harness.scheduleRevisionRepository.findByRevision as jest.Mock)
      .mockResolvedValue(persistedRevision(3, { ...snapshotInput(), revision: 3 }));
    (harness.scheduleRevisionRepository.findPrevious as jest.Mock)
      .mockResolvedValue(persistedRevision(2, previousSnapshot));

    const result = await harness.service.undo(user.id, 3);

    expect(result).toBe(newSnapshot);
    expect(harness.taskRepository.findByUser).toHaveBeenCalledWith(user.id, {
      status: ['pending', 'scheduled', 'in_progress', 'blocked'],
    });
    expect(harness.taskRepository.findByUserWithDependencies).not.toHaveBeenCalled();
    expect(harness.scheduleRevisionRepository.saveAndApply).toHaveBeenCalledTimes(1);
    expect(harness.scheduleRevisionRepository.saveAndApply).toHaveBeenCalledWith(
      user.id,
      {
        horizonStart,
        horizonEnd,
        trigger: 'undo',
        snapshot: {
          events: previousSnapshot.events,
          taskBlocks: previousSnapshot.taskBlocks,
          alerts: previousSnapshot.alerts,
          explanations: previousSnapshot.explanations,
        },
        restoredFromRevision: 2,
      },
      [hardDeadlineTask.id, softDeadlineTask.id],
      3,
    );
    expect(publisher.publish).toHaveBeenCalledWith(user.id, newSnapshot);
  });

  it('returns STALE_REVISION without publishing when an interleaved replan advances the current revision', async () => {
    const publisher: ScheduleUpdatePublisher = { publish: jest.fn() };
    const harness = createHarness({ publisher });
    (harness.scheduleRevisionRepository.findByRevision as jest.Mock)
      .mockResolvedValue(persistedRevision(3, { ...snapshotInput(), revision: 3 }));
    (harness.scheduleRevisionRepository.findPrevious as jest.Mock)
      .mockResolvedValue(persistedRevision(2, { ...snapshotInput(), revision: 2 }));
    (harness.scheduleRevisionRepository.saveAndApply as jest.Mock)
      .mockRejectedValue(new ScheduleRevisionConflictError());

    await expectCode(harness.service.undo(user.id, 3), 'STALE_REVISION');

    expect(harness.scheduleRevisionRepository.saveAndApply).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ trigger: 'undo', restoredFromRevision: 2 }),
      [hardDeadlineTask.id, softDeadlineTask.id],
      3,
    );
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('propagates non-conflict undo persistence failures without publishing', async () => {
    const publisher: ScheduleUpdatePublisher = { publish: jest.fn() };
    const persistenceError = new Error('storage unavailable');
    const harness = createHarness({ publisher });
    (harness.scheduleRevisionRepository.findByRevision as jest.Mock)
      .mockResolvedValue(persistedRevision(3, { ...snapshotInput(), revision: 3 }));
    (harness.scheduleRevisionRepository.findPrevious as jest.Mock)
      .mockResolvedValue(persistedRevision(2, { ...snapshotInput(), revision: 2 }));
    (harness.scheduleRevisionRepository.saveAndApply as jest.Mock)
      .mockRejectedValue(persistenceError);

    await expect(harness.service.undo(user.id, 3)).rejects.toBe(persistenceError);

    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
