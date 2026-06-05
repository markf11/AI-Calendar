// @ts-nocheck
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { ScheduledSlot, AvailableSlot } from '@/models/types';
import { ConstraintCollection, SchedulingConstraint, ConstraintViolation } from '@/models/Constraint';
import { PriorityScoringService } from './PriorityScoringService';
import { TimeSlotGenerationService } from './TimeSlotGenerationService';
import { monitoringService } from './MonitoringService';
import { analyticsService } from './AnalyticsService';

/**
 * Constraint Satisfaction Problem (CSP) solver for optimal task placement
 * Implements backtracking algorithm with dependency-aware scheduling and optimization
 */
export class ConstraintSatisfactionSolver {
  
  constructor(
    private priorityScoringService: typeof PriorityScoringService,
    private timeSlotGenerationService: TimeSlotGenerationService
  ) {}

  /**
   * Solve the constraint satisfaction problem for task scheduling
   */
  async solve(
    tasks: Task[],
    user: User,
    constraints: ConstraintCollection,
    availableSlots: AvailableSlot[],
    options: SolverOptions = {}
  ): Promise<SolverResult> {
    const tracker = monitoringService.trackPerformance('constraint_satisfaction_solve', user.id, {
      taskCount: tasks.length,
      availableSlots: availableSlots.length
    });
    
    const startTime = Date.now();
    
    try {
      // Prepare tasks for scheduling
      const schedulableTasks = this.prepareTasksForScheduling(tasks, user);
    
    // Initialize solution state
    const solution: SchedulingSolution = {
      assignments: new Map(),
      unassignedTasks: [...schedulableTasks],
      usedSlots: [],
      violations: [],
      score: 0
    };

    // Attempt to find optimal solution using backtracking
    const result = await this.backtrackSearch(
      solution,
      availableSlots,
      constraints,
      user,
      options
    );

      const endTime = Date.now();
      const solvingTime = endTime - startTime;
      const duration = tracker.end();

      // Track scheduling analytics
      analyticsService.trackSchedulingOperation(
        user.id,
        'reschedule',
        tasks.length,
        solvingTime,
        result.success,
        result.violations?.length || 0
      );

      return {
        success: result.success,
        scheduledTasks: result.success ? Array.from(result.solution!.assignments.values()) : [],
        unscheduledTasks: result.success ? [] : schedulableTasks,
        violations: result.violations || [],
        optimizationScore: result.success ? result.solution!.score : 0,
        solvingTimeMs: solvingTime,
        metadata: {
          totalTasks: tasks.length,
          schedulableTasks: schedulableTasks.length,
          availableSlots: availableSlots.length,
          constraintsChecked: result.constraintsChecked || 0,
          backtrackingSteps: result.backtrackingSteps || 0
        }
      };
    } catch (error) {
      tracker.end();
      monitoringService.trackError(error as Error, 'constraint_satisfaction_solve', 'high', user.id, {
        taskCount: tasks.length,
        availableSlots: availableSlots.length
      });
      throw error;
    }
  }

  /**
   * Prepare tasks for scheduling by sorting and filtering
   */
  private prepareTasksForScheduling(tasks: Task[], user: User): TaskWithPriority[] {
    // Filter out completed tasks and tasks that can't be scheduled
    const schedulableTasks = tasks.filter(task => 
      task.status !== 'completed' && 
      (task.remainingMinutes || task.duration) > 0
    );

    // Calculate priority scores and sort by priority
    const tasksWithPriority = this.priorityScoringService.calculateRelativePriorities(
      schedulableTasks,
      user
    ).map(item => ({
      ...item.task,
      priorityScore: item.priorityScore,
      rank: item.rank
    }));

    // Sort by dependency order first, then by priority
    return this.sortTasksByDependencyAndPriority(tasksWithPriority);
  }

  /**
   * Sort tasks considering dependencies and priority
   */
  private sortTasksByDependencyAndPriority(tasks: TaskWithPriority[]): TaskWithPriority[] {
    const sorted: TaskWithPriority[] = [];
    const remaining = [...tasks];
    const inProgress = new Set<string>();

    // Topological sort with priority ordering
    while (remaining.length > 0) {
      let progress = false;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const task = remaining[i];
        
        // Check if all dependencies are satisfied
        const dependenciesSatisfied = task.dependencies.every(depId => 
          sorted.some(scheduledTask => scheduledTask.id === depId) ||
          !remaining.some(remainingTask => remainingTask.id === depId)
        );

        if (dependenciesSatisfied && !inProgress.has(task.id)) {
          // Find the best position to insert based on priority
          const insertIndex = this.findInsertionIndex(sorted, task);
          sorted.splice(insertIndex, 0, task);
          remaining.splice(i, 1);
          progress = true;
        }
      }

      // Break infinite loop if no progress (circular dependencies)
      if (!progress) {
        // Add remaining tasks anyway, but mark as having dependency issues
        sorted.push(...remaining);
        break;
      }
    }

    return sorted;
  }

  /**
   * Find optimal insertion index for a task based on priority
   */
  private findInsertionIndex(sorted: TaskWithPriority[], task: TaskWithPriority): number {
    for (let i = 0; i < sorted.length; i++) {
      if (task.priorityScore > sorted[i].priorityScore) {
        return i;
      }
    }
    return sorted.length;
  }

  /**
   * Backtracking search algorithm for constraint satisfaction
   */
  private async backtrackSearch(
    solution: SchedulingSolution,
    availableSlots: AvailableSlot[],
    constraints: ConstraintCollection,
    user: User,
    options: SolverOptions,
    depth: number = 0
  ): Promise<BacktrackResult> {
    const maxDepth = options.maxDepth || 1000;
    const timeLimit = options.timeLimitMs || 30000; // 30 seconds default
    const startTime = Date.now();

    // Check time limit
    if (Date.now() - startTime > timeLimit) {
      return {
        success: false,
        violations: [{ 
          constraintId: 'time_limit',
          constraintType: 'deadline',
          severity: 'error',
          message: 'Solver time limit exceeded',
          affectedTaskIds: []
        }],
        backtrackingSteps: depth
      };
    }

    // Check depth limit
    if (depth > maxDepth) {
      return {
        success: false,
        violations: [{ 
          constraintId: 'depth_limit',
          constraintType: 'deadline',
          severity: 'error',
          message: 'Maximum search depth exceeded',
          affectedTaskIds: []
        }],
        backtrackingSteps: depth
      };
    }

    // Base case: all tasks assigned
    if (solution.unassignedTasks.length === 0) {
      solution.score = this.calculateSolutionScore(solution, user);
      return {
        success: true,
        solution: { ...solution },
        backtrackingSteps: depth
      };
    }

    // Select next task to assign
    const task = this.selectNextTask(solution.unassignedTasks, user);
    if (!task) {
      return {
        success: false,
        violations: [{ 
          constraintId: 'no_task',
          constraintType: 'dependency',
          severity: 'error',
          message: 'No schedulable task found',
          affectedTaskIds: []
        }],
        backtrackingSteps: depth
      };
    }

    // Generate possible slots for this task
    const taskSlots = await this.timeSlotGenerationService.generateTaskSlots(
      task,
      user,
      availableSlots,
      constraints
    );

    // Try each possible assignment
    for (const slot of taskSlots) {
      // Check if this assignment is valid
      const assignment = this.createTaskAssignment(task, slot);
      const violations = this.validateAssignment(assignment, solution, constraints, user);

      if (violations.length === 0 || this.isAcceptableViolation(violations, options)) {
        // Make assignment
        const newSolution = this.makeAssignment(solution, task, assignment);
        const newAvailableSlots = this.updateAvailableSlots(availableSlots, assignment);

        // Recursive call
        const result = await this.backtrackSearch(
          newSolution,
          newAvailableSlots,
          constraints,
          user,
          options,
          depth + 1
        );

        if (result.success) {
          return result;
        }

        // Backtrack (assignment is automatically undone by creating new solution)
      }
    }

    // No valid assignment found for this task
    return {
      success: false,
      violations: [{ 
        constraintId: 'no_assignment',
        constraintType: 'deadline',
        severity: 'error',
        message: `No valid time slot found for task: ${task.title}`,
        affectedTaskIds: [task.id]
      }],
      backtrackingSteps: depth
    };
  }

  /**
   * Select the next task to schedule using heuristics
   */
  private selectNextTask(unassignedTasks: TaskWithPriority[], user: User): TaskWithPriority | null {
    if (unassignedTasks.length === 0) return null;

    // Use Most Constraining Variable (MCV) heuristic
    // Select task with highest priority and most constraints
    let bestTask = unassignedTasks[0];
    let bestScore = this.calculateTaskConstraintScore(bestTask, user);

    for (let i = 1; i < unassignedTasks.length; i++) {
      const task = unassignedTasks[i];
      const score = this.calculateTaskConstraintScore(task, user);
      
      if (score > bestScore) {
        bestTask = task;
        bestScore = score;
      }
    }

    return bestTask;
  }

  /**
   * Calculate constraint score for task selection heuristic
   */
  private calculateTaskConstraintScore(task: TaskWithPriority, user: User): number {
    let score = task.priorityScore;

    // Boost score for tasks with deadlines
    if (task.deadline) {
      const timeUntilDeadline = task.deadline.getTime() - Date.now();
      const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
      
      if (hoursUntilDeadline < 24) {
        score += 50; // Very urgent
      } else if (hoursUntilDeadline < 72) {
        score += 30; // Urgent
      } else if (hoursUntilDeadline < 168) {
        score += 15; // Somewhat urgent
      }
    }

    // Boost score for blocking tasks (harder to schedule)
    if (task.isBlocking) {
      score += 20;
    }

    // Boost score for tasks with dependencies (schedule prerequisites first)
    if (task.dependents.length > 0) {
      score += task.dependents.length * 5;
    }

    return score;
  }

  /**
   * Create a task assignment for a given slot
   */
  private createTaskAssignment(task: TaskWithPriority, slot: AvailableSlot): TaskAssignment {
    const duration = Math.min(
      task.remainingMinutes || task.duration,
      slot.duration
    );

    return {
      taskId: task.id,
      task,
      scheduledSlot: {
        id: EncryptionService.generateUUID(),
        taskId: task.id,
        startTime: slot.startTime,
        endTime: new Date(slot.startTime.getTime() + duration * 60000),
        duration,
        isConfirmed: false
      }
    };
  }

  /**
   * Validate a task assignment against all constraints
   */
  private validateAssignment(
    assignment: TaskAssignment,
    solution: SchedulingSolution,
    constraints: ConstraintCollection,
    user: User
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Check for time conflicts with existing assignments
    for (const existingAssignment of solution.assignments.values()) {
      if (this.hasTimeConflict(assignment.scheduledSlot, existingAssignment.scheduledSlot)) {
        violations.push({
          constraintId: 'time_conflict',
          constraintType: 'firm_event',
          severity: 'error',
          message: `Time conflict between tasks: ${assignment.task.title} and ${existingAssignment.task.title}`,
          affectedTaskIds: [assignment.taskId, existingAssignment.taskId]
        });
      }
    }

    // Check dependency constraints
    const dependencyViolations = this.checkDependencyConstraints(assignment, solution);
    violations.push(...dependencyViolations);

    // Check working hours constraints
    const workingHoursViolations = this.checkWorkingHoursConstraints(assignment, constraints);
    violations.push(...workingHoursViolations);

    // Check firm event constraints
    const firmEventViolations = this.checkFirmEventConstraints(assignment, constraints);
    violations.push(...firmEventViolations);

    // Check deadline constraints
    const deadlineViolations = this.checkDeadlineConstraints(assignment, constraints);
    violations.push(...deadlineViolations);

    return violations;
  }

  /**
   * Check for time conflicts between two scheduled slots
   */
  private hasTimeConflict(slot1: ScheduledSlot, slot2: ScheduledSlot): boolean {
    return slot1.startTime < slot2.endTime && slot2.startTime < slot1.endTime;
  }

  /**
   * Check dependency constraints
   */
  private checkDependencyConstraints(
    assignment: TaskAssignment,
    solution: SchedulingSolution
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const task = assignment.task;

    // Check if all dependencies are scheduled before this task
    for (const dependencyId of task.dependencies) {
      const dependencyAssignment = solution.assignments.get(dependencyId);
      
      if (!dependencyAssignment) {
        violations.push({
          constraintId: `dependency_${dependencyId}`,
          constraintType: 'dependency',
          severity: 'error',
          message: `Dependency task ${dependencyId} must be scheduled before ${task.title}`,
          affectedTaskIds: [task.id, dependencyId]
        });
      } else if (dependencyAssignment.scheduledSlot.endTime >= assignment.scheduledSlot.startTime) {
        violations.push({
          constraintId: `dependency_order_${dependencyId}`,
          constraintType: 'dependency',
          severity: 'error',
          message: `Dependency task ${dependencyId} must complete before ${task.title} starts`,
          affectedTaskIds: [task.id, dependencyId]
        });
      }
    }

    return violations;
  }

  /**
   * Check working hours constraints
   */
  private checkWorkingHoursConstraints(
    assignment: TaskAssignment,
    constraints: ConstraintCollection
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const slot = assignment.scheduledSlot;
    const dayOfWeek = slot.startTime.getDay();

    const workingHoursConstraints = constraints.constraints.filter(
      c => c.type === 'working_hours' && (c as any).dayOfWeek === dayOfWeek
    );

    if (workingHoursConstraints.length === 0) {
      violations.push({
        constraintId: 'no_working_hours',
        constraintType: 'working_hours',
        severity: 'error',
        message: `No working hours defined for ${this.getDayName(dayOfWeek)}`,
        affectedTaskIds: [assignment.taskId]
      });
      return violations;
    }

    const workingHours = (workingHoursConstraints[0] as any).timeRange;
    const dayStart = this.createDateTime(slot.startTime, workingHours.start);
    const dayEnd = this.createDateTime(slot.startTime, workingHours.end);

    if (slot.startTime < dayStart || slot.endTime > dayEnd) {
      violations.push({
        constraintId: 'outside_working_hours',
        constraintType: 'working_hours',
        severity: 'error',
        message: `Task ${assignment.task.title} scheduled outside working hours`,
        affectedTaskIds: [assignment.taskId]
      });
    }

    return violations;
  }

  /**
   * Check firm event constraints
   */
  private checkFirmEventConstraints(
    assignment: TaskAssignment,
    constraints: ConstraintCollection
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const slot = assignment.scheduledSlot;

    const firmEventConstraints = constraints.constraints.filter(
      c => c.type === 'firm_event'
    );

    for (const constraint of firmEventConstraints) {
      const eventConstraint = constraint as any;
      
      if (this.hasTimeOverlap(
        slot.startTime,
        slot.endTime,
        eventConstraint.startTime,
        eventConstraint.endTime
      )) {
        violations.push({
          constraintId: constraint.id,
          constraintType: 'firm_event',
          severity: 'error',
          message: `Task ${assignment.task.title} conflicts with firm event`,
          affectedTaskIds: [assignment.taskId]
        });
      }
    }

    return violations;
  }

  /**
   * Check deadline constraints
   */
  private checkDeadlineConstraints(
    assignment: TaskAssignment,
    constraints: ConstraintCollection
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const task = assignment.task;

    if (task.deadline && assignment.scheduledSlot.endTime > task.deadline) {
      const severity = task.isHardDeadline ? 'error' : 'warning';
      violations.push({
        constraintId: `deadline_${task.id}`,
        constraintType: 'deadline',
        severity,
        message: `Task ${task.title} scheduled after ${task.isHardDeadline ? 'hard' : 'soft'} deadline`,
        affectedTaskIds: [task.id]
      });
    }

    return violations;
  }

  /**
   * Check if violations are acceptable based on solver options
   */
  private isAcceptableViolation(violations: ConstraintViolation[], options: SolverOptions): boolean {
    if (!options.allowSoftViolations) {
      return false;
    }

    // Only allow warning-level violations if soft violations are enabled
    return violations.every(v => v.severity === 'warning' || v.severity === 'info');
  }

  /**
   * Make an assignment in the solution
   */
  private makeAssignment(
    solution: SchedulingSolution,
    task: TaskWithPriority,
    assignment: TaskAssignment
  ): SchedulingSolution {
    const newSolution: SchedulingSolution = {
      assignments: new Map(solution.assignments),
      unassignedTasks: solution.unassignedTasks.filter(t => t.id !== task.id),
      usedSlots: [...solution.usedSlots, assignment.scheduledSlot],
      violations: [...solution.violations],
      score: solution.score
    };

    newSolution.assignments.set(task.id, assignment);
    return newSolution;
  }

  /**
   * Update available slots after making an assignment
   */
  private updateAvailableSlots(
    availableSlots: AvailableSlot[],
    assignment: TaskAssignment
  ): AvailableSlot[] {
    const updatedSlots: AvailableSlot[] = [];
    const assignedSlot = assignment.scheduledSlot;

    for (const slot of availableSlots) {
      if (this.hasTimeOverlap(
        slot.startTime,
        slot.endTime,
        assignedSlot.startTime,
        assignedSlot.endTime
      )) {
        // Split the slot around the assigned time
        const beforeSlots = this.createSlotBefore(slot, assignedSlot);
        const afterSlots = this.createSlotAfter(slot, assignedSlot);
        
        updatedSlots.push(...beforeSlots, ...afterSlots);
      } else {
        updatedSlots.push(slot);
      }
    }

    return updatedSlots;
  }

  /**
   * Create slot before assigned time
   */
  private createSlotBefore(originalSlot: AvailableSlot, assignedSlot: ScheduledSlot): AvailableSlot[] {
    if (originalSlot.startTime >= assignedSlot.startTime) {
      return [];
    }

    const endTime = new Date(Math.min(originalSlot.endTime.getTime(), assignedSlot.startTime.getTime()));
    const duration = Math.floor((endTime.getTime() - originalSlot.startTime.getTime()) / (1000 * 60));

    if (duration >= 15) { // Minimum slot duration
      return [{
        startTime: originalSlot.startTime,
        endTime,
        duration
      }];
    }

    return [];
  }

  /**
   * Create slot after assigned time
   */
  private createSlotAfter(originalSlot: AvailableSlot, assignedSlot: ScheduledSlot): AvailableSlot[] {
    if (originalSlot.endTime <= assignedSlot.endTime) {
      return [];
    }

    const startTime = new Date(Math.max(originalSlot.startTime.getTime(), assignedSlot.endTime.getTime()));
    const duration = Math.floor((originalSlot.endTime.getTime() - startTime.getTime()) / (1000 * 60));

    if (duration >= 15) { // Minimum slot duration
      return [{
        startTime,
        endTime: originalSlot.endTime,
        duration
      }];
    }

    return [];
  }

  /**
   * Calculate solution quality score
   */
  private calculateSolutionScore(solution: SchedulingSolution, user: User): number {
    let score = 0;

    // Base score for number of tasks scheduled
    score += solution.assignments.size * 10;

    // Bonus for high priority tasks scheduled early
    for (const assignment of solution.assignments.values()) {
      const task = assignment.task;
      const priorityBonus = task.priorityScore / 10;
      score += priorityBonus;

      // Early scheduling bonus for high priority tasks
      if (task.priorityScore > 60) {
        const hoursFromNow = (assignment.scheduledSlot.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursFromNow < 24) {
          score += 20;
        }
      }

      // Deadline adherence bonus
      if (task.deadline && assignment.scheduledSlot.endTime <= task.deadline) {
        score += task.isHardDeadline ? 30 : 15;
      }
    }

    // Context switching penalty
    if (user.preferences.groupSimilarTasks) {
      score += this.calculateContextSwitchingBonus(solution);
    }

    // Penalty for violations
    for (const violation of solution.violations) {
      switch (violation.severity) {
        case 'error':
          score -= 50;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 1;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Calculate context switching bonus/penalty
   */
  private calculateContextSwitchingBonus(solution: SchedulingSolution): number {
    const assignments = Array.from(solution.assignments.values())
      .sort((a, b) => a.scheduledSlot.startTime.getTime() - b.scheduledSlot.startTime.getTime());

    let bonus = 0;
    for (let i = 1; i < assignments.length; i++) {
      const current = assignments[i].task;
      const previous = assignments[i - 1].task;

      // Same project bonus
      if (current.projectId && current.projectId === previous.projectId) {
        bonus += 5;
      }

      // Same priority bonus
      if (current.priority === previous.priority) {
        bonus += 2;
      }

      // Same blocking type bonus
      if (current.isBlocking === previous.isBlocking) {
        bonus += 1;
      }
    }

    return bonus;
  }

  /**
   * Helper methods
   */
  private hasTimeOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1;
  }

  private createDateTime(date: Date, timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }
}

// Supporting interfaces
interface TaskWithPriority extends Task {
  priorityScore: number;
  rank: number;
}

interface TaskAssignment {
  taskId: string;
  task: TaskWithPriority;
  scheduledSlot: ScheduledSlot;
}

interface SchedulingSolution {
  assignments: Map<string, TaskAssignment>;
  unassignedTasks: TaskWithPriority[];
  usedSlots: ScheduledSlot[];
  violations: ConstraintViolation[];
  score: number;
}

interface BacktrackResult {
  success: boolean;
  solution?: SchedulingSolution;
  violations?: ConstraintViolation[];
  constraintsChecked?: number;
  backtrackingSteps: number;
}

export interface SolverOptions {
  maxDepth?: number;
  timeLimitMs?: number;
  allowSoftViolations?: boolean;
  optimizeForEarlyCompletion?: boolean;
  minimizeContextSwitching?: boolean;
}

export interface SolverResult {
  success: boolean;
  scheduledTasks: ScheduledSlot[];
  unscheduledTasks: Task[];
  violations: ConstraintViolation[];
  optimizationScore: number;
  solvingTimeMs: number;
  metadata: {
    totalTasks: number;
    schedulableTasks: number;
    availableSlots: number;
    constraintsChecked: number;
    backtrackingSteps: number;
  };
}