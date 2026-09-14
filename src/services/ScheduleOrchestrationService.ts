import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import {
  ScheduleRevisionConflictError,
  ScheduleRevisionRepository,
} from '@/repositories/ScheduleRevisionRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { UserRepository } from '@/repositories/UserRepository';
import {
  ScheduleAlert,
  ScheduleExplanation,
  ScheduleRevision,
  ScheduleSnapshot,
  ScheduleSnapshotInput,
} from '@/models/Schedule';
import { Task } from '@/models/Task';
import { AvailableSlot, ScheduledSlot } from '@/models/types';
import { ConstraintCollectionService } from './ConstraintCollectionService';
import { ConstraintSatisfactionSolver, SolverResult } from './ConstraintSatisfactionSolver';
import { ScheduleRequest } from './SchedulingTypes';
import { TimeSlotGenerationService } from './TimeSlotGenerationService';
import { DeadlineRiskService } from './domain/DeadlineRiskService';
import {
  ScheduleExplanationService,
  ScheduleReasonCode,
} from './domain/ScheduleExplanationService';

const ACTIVE_TASK_STATUSES = ['pending', 'scheduled', 'in_progress', 'blocked'] as const;
const SCHEDULED_BLOCK_DURATION_TOLERANCE_MINUTES = 1e-6;

export interface ScheduleUpdatePublisher {
  publish(userId: string, snapshot: ScheduleSnapshot): void | Promise<void>;
}

export interface ScheduleReplanResult {
  snapshot: ScheduleSnapshot;
  solverResult: SolverResult;
}

export type ScheduleOrchestrationErrorCode =
  | 'INVALID_HORIZON'
  | 'USER_NOT_FOUND'
  | 'PLANNING_FAILED'
  | 'REVISION_NOT_FOUND'
  | 'NO_PREVIOUS_REVISION'
  | 'INVALID_REVISION'
  | 'STALE_REVISION';

export class ScheduleOrchestrationError extends Error {
  constructor(
    public readonly code: ScheduleOrchestrationErrorCode,
    message: string,
    public readonly solverResult?: SolverResult,
  ) {
    super(message);
    this.name = 'ScheduleOrchestrationError';
  }
}

export class ScheduleOrchestrationService {
  constructor(
    private readonly constraintCollectionService: ConstraintCollectionService,
    private readonly timeSlotGenerationService: TimeSlotGenerationService,
    private readonly constraintSatisfactionSolver: ConstraintSatisfactionSolver,
    private readonly userRepository: UserRepository,
    private readonly taskRepository: TaskRepository,
    private readonly calendarEventRepository: CalendarEventRepository,
    private readonly scheduleRevisionRepository: ScheduleRevisionRepository,
    private readonly deadlineRiskService: DeadlineRiskService,
    private readonly scheduleExplanationService: ScheduleExplanationService,
    private readonly publisher?: ScheduleUpdatePublisher,
  ) {}

  async getSchedule(
    userId: string,
    horizonStart: Date,
    horizonEnd: Date,
  ): Promise<ScheduleSnapshot> {
    this.validateHorizon(horizonStart, horizonEnd);

    const persisted = await this.scheduleRevisionRepository.findLatestCoveringHorizon(
      userId,
      horizonStart,
      horizonEnd,
    );
    if (persisted) {
      return persisted.snapshot;
    }

    const [events, scheduledTasks] = await Promise.all([
      this.calendarEventRepository.findByUserAndDateRange(userId, {
        start: horizonStart,
        end: horizonEnd,
      }),
      this.taskRepository.findScheduledByUserIdAndDateRange(
        userId,
        horizonStart,
        horizonEnd,
      ),
    ]);

    return {
      events,
      taskBlocks: scheduledTasks.flatMap((task) => task.scheduledSlots),
      alerts: [],
      explanations: [],
      revision: 0,
    };
  }

  async replan(request: ScheduleRequest): Promise<ScheduleReplanResult> {
    this.validateHorizon(request.horizonStart, request.horizonEnd);

    const user = await this.userRepository.findById(request.userId);
    if (!user) {
      throw new ScheduleOrchestrationError('USER_NOT_FOUND', 'User not found');
    }

    const planningTasks = await this.findPlanningTasks(request.userId);
    const tasks = planningTasks.filter((task) => task.status !== 'completed');
    const completedTaskIds = planningTasks
      .filter((task) => task.status === 'completed')
      .map((task) => task.id);
    const constraints = await this.constraintCollectionService.collectConstraints(request);
    const [generatedAvailableSlots, events] = await Promise.all([
      this.timeSlotGenerationService.generateAvailableSlots(request, 15, constraints),
      this.calendarEventRepository.findByUserAndDateRange(request.userId, {
        start: request.horizonStart,
        end: request.horizonEnd,
      }),
    ]);
    const availableSlots = this.clipAvailableSlots(
      generatedAvailableSlots,
      request.horizonStart,
      request.horizonEnd,
    );

    const solverResult = await this.constraintSatisfactionSolver.solve(
      tasks,
      user,
      constraints,
      availableSlots,
      {
        allowSoftViolations: true,
        optimizeForEarlyCompletion: user.preferences.optimizeForEarlyCompletion,
        minimizeContextSwitching: user.preferences.groupSimilarTasks,
        completedTaskIds,
        referenceTime: request.trigger.timestamp,
      },
    );

    if (!solverResult.success) {
      throw new ScheduleOrchestrationError(
        'PLANNING_FAILED',
        'Unable to produce a valid schedule',
        solverResult,
      );
    }

    if (!this.areScheduledBlocksValidForHorizon(
      solverResult.scheduledTasks,
      request.horizonStart,
      request.horizonEnd,
    )) {
      throw new ScheduleOrchestrationError(
        'PLANNING_FAILED',
        'Solver returned schedule blocks outside the requested horizon',
        solverResult,
      );
    }

    const snapshot = this.buildSnapshotInput(
      tasks,
      events,
      solverResult.scheduledTasks,
      request.horizonStart,
    );
    const saved = await this.scheduleRevisionRepository.saveAndApply(
      request.userId,
      {
        horizonStart: request.horizonStart,
        horizonEnd: request.horizonEnd,
        trigger: request.trigger.type,
        snapshot,
      },
      tasks.map((task) => task.id),
    );

    await this.publish(request.userId, saved.snapshot);
    return { snapshot: saved.snapshot, solverResult };
  }

  async undo(userId: string, currentRevision: number): Promise<ScheduleSnapshot> {
    if (!Number.isInteger(currentRevision) || currentRevision <= 0) {
      throw new ScheduleOrchestrationError('INVALID_REVISION', 'Revision must be a positive integer');
    }

    const current = await this.scheduleRevisionRepository.findByRevision(userId, currentRevision);
    if (!current) {
      throw new ScheduleOrchestrationError('REVISION_NOT_FOUND', 'Schedule revision not found');
    }

    const previous = await this.scheduleRevisionRepository.findPrevious(userId, currentRevision);
    if (!previous) {
      throw new ScheduleOrchestrationError('NO_PREVIOUS_REVISION', 'No previous schedule revision exists');
    }

    const tasks = await this.findActiveTasks(userId);
    const previousSnapshot: ScheduleSnapshotInput = {
      events: previous.snapshot.events,
      taskBlocks: previous.snapshot.taskBlocks,
      alerts: previous.snapshot.alerts,
      explanations: previous.snapshot.explanations,
    };
    let saved: ScheduleRevision;
    try {
      saved = await this.scheduleRevisionRepository.saveAndApply(
        userId,
        {
          horizonStart: previous.horizonStart,
          horizonEnd: previous.horizonEnd,
          trigger: 'undo',
          snapshot: previousSnapshot,
          restoredFromRevision: previous.revision,
        },
        tasks.map((task) => task.id),
        currentRevision,
      );
    } catch (error) {
      if (error instanceof ScheduleRevisionConflictError) {
        throw new ScheduleOrchestrationError(
          'STALE_REVISION',
          'Schedule revision changed before undo could be applied',
        );
      }

      throw error;
    }

    await this.publish(userId, saved.snapshot);
    return saved.snapshot;
  }

  private async findActiveTasks(userId: string): Promise<Task[]> {
    return this.taskRepository.findByUser(userId, {
      status: [...ACTIVE_TASK_STATUSES],
    });
  }

  private async findPlanningTasks(userId: string): Promise<Task[]> {
    return this.taskRepository.findByUserWithDependencies(userId, {
      status: [...ACTIVE_TASK_STATUSES, 'completed'],
    });
  }

  private clipAvailableSlots(
    availableSlots: AvailableSlot[],
    horizonStart: Date,
    horizonEnd: Date,
  ): AvailableSlot[] {
    const horizonStartTime = horizonStart.getTime();
    const horizonEndTime = horizonEnd.getTime();

    return availableSlots.flatMap((slot) => {
      const slotStartTime = slot.startTime.getTime();
      const slotEndTime = slot.endTime.getTime();
      if (!Number.isFinite(slotStartTime) || !Number.isFinite(slotEndTime)) {
        return [];
      }

      const startTime = new Date(Math.max(slotStartTime, horizonStartTime));
      const endTime = new Date(Math.min(slotEndTime, horizonEndTime));
      const duration = (endTime.getTime() - startTime.getTime()) / 60_000;
      if (duration <= 0) {
        return [];
      }

      return [{ ...slot, startTime, endTime, duration }];
    });
  }

  private areScheduledBlocksValidForHorizon(
    blocks: ScheduledSlot[],
    horizonStart: Date,
    horizonEnd: Date,
  ): boolean {
    const horizonStartTime = horizonStart.getTime();
    const horizonEndTime = horizonEnd.getTime();

    return blocks.every((block) => {
      const blockStartTime = block.startTime.getTime();
      const blockEndTime = block.endTime.getTime();
      const expectedDuration = (blockEndTime - blockStartTime) / 60_000;

      return Number.isFinite(blockStartTime)
        && Number.isFinite(blockEndTime)
        && Number.isFinite(block.duration)
        && block.duration > 0
        && blockEndTime > blockStartTime
        && Math.abs(block.duration - expectedDuration) <= SCHEDULED_BLOCK_DURATION_TOLERANCE_MINUTES
        && blockStartTime >= horizonStartTime
        && blockEndTime <= horizonEndTime;
    });
  }

  private buildSnapshotInput(
    tasks: Task[],
    events: ScheduleSnapshotInput['events'],
    blocks: ScheduledSlot[],
    now: Date,
  ): ScheduleSnapshotInput {
    return {
      events,
      taskBlocks: blocks.map((block) => ({ ...block })),
      alerts: this.buildDeadlineAlerts(tasks, blocks, now),
      explanations: this.buildExplanations(tasks, blocks),
    };
  }

  private buildDeadlineAlerts(
    tasks: Task[],
    blocks: ScheduledSlot[],
    now: Date,
  ): ScheduleAlert[] {
    return tasks.flatMap((task): ScheduleAlert[] => {
      const assessment = this.deadlineRiskService.assess({
        deadline: task.deadline,
        isHardDeadline: task.isHardDeadline,
        estimatedMinutes: task.duration,
        completedMinutes: task.completedMinutes,
        remainingMinutes: task.remainingMinutes,
        now,
        capacityWindows: blocks
          .filter((block) => block.taskId === task.id)
          .map((block) => ({
            start: block.startTime,
            end: block.endTime,
          })),
      });

      if (assessment.severity !== 'high' && assessment.severity !== 'critical') {
        return [];
      }

      return [{
        type: 'deadline',
        message: `${task.title} is at ${assessment.severity} deadline risk`,
        severity: assessment.severity === 'critical' ? 'error' : 'warning',
        taskId: task.id,
      }];
    });
  }

  private buildExplanations(tasks: Task[], blocks: ScheduledSlot[]): ScheduleExplanation[] {
    const tasksById = new Map(tasks.map((task) => [task.id, task]));

    return blocks.flatMap((block): ScheduleExplanation[] => {
      const task = tasksById.get(block.taskId);
      if (!task) {
        return [];
      }

      const reasonCodes: ScheduleReasonCode[] = task.isHardDeadline ? ['HARD_DEADLINE'] : [];

      const explanation = this.scheduleExplanationService.explainPlacement({
        taskTitle: task.title,
        scheduledStart: block.startTime,
        reasonCodes,
      });

      return [{
        taskId: task.id,
        blockId: block.id,
        reason: explanation.explanation,
        details: explanation.reasonCodes.join(', '),
      }];
    });
  }

  private validateHorizon(horizonStart: Date, horizonEnd: Date): void {
    const start = horizonStart.getTime();
    const end = horizonEnd.getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new ScheduleOrchestrationError(
        'INVALID_HORIZON',
        'Schedule horizon must contain finite dates with end after start',
      );
    }
  }

  private async publish(userId: string, snapshot: ScheduleSnapshot): Promise<void> {
    if (!this.publisher) {
      return;
    }

    try {
      await this.publisher.publish(userId, snapshot);
    } catch {
      // The schedule is already committed; real-time delivery is best effort.
    }
  }
}
