import { Task } from '@/models/Task';
import { Priority } from '@/models/types';
import { User } from '@/models/User';

/**
 * Priority scoring algorithm for AI scheduling engine
 * Implements weighted priority scoring: Hard Deadlines > Critical > High > Soft Deadlines > Medium > Low
 */
export class PriorityScoringService {
  
  // Base priority scores for task priorities
  private static readonly PRIORITY_SCORES = {
    critical: 80,
    high: 60,
    medium: 30,
    low: 10
  } as const;

  // Deadline urgency multipliers
  private static readonly DEADLINE_URGENCY_MULTIPLIERS = {
    critical: 2.0,  // < 24 hours
    high: 1.5,      // < 3 days
    medium: 1.2,    // < 1 week
    low: 1.0        // > 1 week
  } as const;

  // Hard deadline bonus
  private static readonly HARD_DEADLINE_BONUS = 20;

  // Project importance multiplier
  private static readonly PROJECT_IMPORTANCE_MULTIPLIER = 1.1;

  /**
   * Calculate comprehensive priority score for a task
   */
  static calculateTaskPriorityScore(
    task: Task, 
    user: User, 
    currentTime: Date = new Date()
  ): number {
    let score = 0;

    // 1. Base priority score
    const basePriorityScore = this.getBasePriorityScore(task.priority);
    score += basePriorityScore;

    // 2. Deadline urgency calculation
    if (task.deadline) {
      const urgencyScore = this.calculateDeadlineUrgencyScore(
        task.deadline, 
        currentTime, 
        task.isHardDeadline
      );
      score += urgencyScore;
    }

    // 3. Task importance weighting based on user preferences
    const importanceWeight = this.calculateImportanceWeight(task, user);
    score *= importanceWeight;

    // 4. Hard deadline bonus (applied after other calculations)
    if (task.deadline && task.isHardDeadline) {
      score += this.HARD_DEADLINE_BONUS;
    }

    // 5. Ensure score doesn't exceed maximum
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Get base priority score for task priority level
   */
  static getBasePriorityScore(priority: Priority): number {
    return this.PRIORITY_SCORES[priority];
  }

  /**
   * Calculate deadline urgency score based on time remaining
   */
  static calculateDeadlineUrgencyScore(
    deadline: Date, 
    currentTime: Date, 
    isHardDeadline: boolean
  ): number {
    const timeUntilDeadline = deadline.getTime() - currentTime.getTime();
    const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);

    // Base urgency score based on time remaining
    let urgencyScore = 0;
    let urgencyLevel: keyof typeof this.DEADLINE_URGENCY_MULTIPLIERS;

    if (hoursUntilDeadline <= 0) {
      // Overdue - maximum urgency
      urgencyScore = 50;
      urgencyLevel = 'critical';
    } else if (hoursUntilDeadline <= 24) {
      // Less than 24 hours - critical urgency
      urgencyScore = 40;
      urgencyLevel = 'critical';
    } else if (hoursUntilDeadline <= 72) {
      // Less than 3 days - high urgency
      urgencyScore = 30;
      urgencyLevel = 'high';
    } else if (hoursUntilDeadline <= 168) {
      // Less than 1 week - medium urgency
      urgencyScore = 20;
      urgencyLevel = 'medium';
    } else {
      // More than 1 week - low urgency
      urgencyScore = 10;
      urgencyLevel = 'low';
    }

    // Apply urgency multiplier
    const multiplier = this.DEADLINE_URGENCY_MULTIPLIERS[urgencyLevel];
    urgencyScore *= multiplier;

    // Additional boost for hard deadlines
    if (isHardDeadline) {
      urgencyScore *= 1.3;
    }

    return Math.round(urgencyScore);
  }

  /**
   * Calculate importance weight based on project and user preferences
   */
  static calculateImportanceWeight(task: Task, user: User): number {
    let weight = 1.0;

    // Project-based importance (if task belongs to a project)
    if (task.projectId) {
      weight *= this.PROJECT_IMPORTANCE_MULTIPLIER;
    }

    // User preference for early completion
    if (user.preferences.optimizeForEarlyCompletion) {
      // Boost priority for tasks with deadlines
      if (task.deadline) {
        weight *= 1.15;
      }
    }

    // User preference for protecting focus time
    if (user.preferences.protectFocusTime) {
      // Boost priority for blocking tasks (they need uninterrupted time)
      if (task.isBlocking) {
        weight *= 1.1;
      }
    }

    return weight;
  }

  /**
   * Calculate relative priority scores for a list of tasks
   * Returns tasks sorted by priority score (highest first)
   */
  static calculateRelativePriorities(
    tasks: Task[], 
    user: User, 
    currentTime: Date = new Date()
  ): Array<{ task: Task; priorityScore: number; rank: number }> {
    // Calculate scores for all tasks
    const tasksWithScores = tasks.map(task => ({
      task,
      priorityScore: this.calculateTaskPriorityScore(task, user, currentTime)
    }));

    // Sort by priority score (highest first)
    tasksWithScores.sort((a, b) => b.priorityScore - a.priorityScore);

    // Add ranking
    return tasksWithScores.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }

  /**
   * Get priority hierarchy order for scheduling
   * Returns the order in which different priority types should be considered
   */
  static getPriorityHierarchy(): Array<{
    type: 'hard_deadline' | 'critical' | 'high' | 'soft_deadline' | 'medium' | 'low';
    minScore: number;
    description: string;
  }> {
    return [
      {
        type: 'hard_deadline',
        minScore: 90,
        description: 'Hard deadlines - must be completed by deadline'
      },
      {
        type: 'critical',
        minScore: 80,
        description: 'Critical priority tasks'
      },
      {
        type: 'high',
        minScore: 60,
        description: 'High priority tasks'
      },
      {
        type: 'soft_deadline',
        minScore: 50,
        description: 'Soft deadlines - preferred to be completed by deadline'
      },
      {
        type: 'medium',
        minScore: 30,
        description: 'Medium priority tasks'
      },
      {
        type: 'low',
        minScore: 0,
        description: 'Low priority tasks'
      }
    ];
  }

  /**
   * Categorize task based on its calculated priority score
   */
  static categorizePriority(priorityScore: number): {
    category: 'hard_deadline' | 'critical' | 'high' | 'soft_deadline' | 'medium' | 'low';
    description: string;
  } {
    const hierarchy = this.getPriorityHierarchy();
    
    for (const level of hierarchy) {
      if (priorityScore >= level.minScore) {
        return {
          category: level.type,
          description: level.description
        };
      }
    }

    return {
      category: 'low',
      description: 'Low priority tasks'
    };
  }

  /**
   * Calculate priority adjustment for context switching
   * Tasks of similar type/project get a small boost when grouped together
   */
  static calculateContextSwitchingAdjustment(
    currentTask: Task,
    previousTask: Task | null,
    user: User
  ): number {
    if (!previousTask || !user.preferences.groupSimilarTasks) {
      return 0;
    }

    let adjustment = 0;

    // Same project bonus
    if (currentTask.projectId && currentTask.projectId === previousTask.projectId) {
      adjustment += 2;
    }

    // Same priority level bonus
    if (currentTask.priority === previousTask.priority) {
      adjustment += 1;
    }

    // Same blocking type bonus (both blocking or both non-blocking)
    if (currentTask.isBlocking === previousTask.isBlocking) {
      adjustment += 1;
    }

    return adjustment;
  }

  /**
   * Calculate energy-based priority adjustment
   * Adjusts priority based on user's energy preferences and current time
   */
  static calculateEnergyBasedAdjustment(
    task: Task,
    user: User,
    scheduledTime: Date
  ): number {
    const timeString = scheduledTime.toTimeString().substring(0, 5); // HH:MM format
    const energyPrefs = user.preferences.energyPreferences;
    
    let adjustment = 0;

    // Check if task priority matches energy level preferences
    const isHighEnergyTask = task.priority === 'critical' || task.priority === 'high';
    const isLowEnergyTask = task.priority === 'low';

    // High energy tasks during high energy times
    if (isHighEnergyTask) {
      const isHighEnergyTime = energyPrefs.highEnergyTimes.some(range => 
        timeString >= range.start && timeString <= range.end
      );
      if (isHighEnergyTime) {
        adjustment += 3;
      }
    }

    // Low energy tasks during low energy times
    if (isLowEnergyTask) {
      const isLowEnergyTime = energyPrefs.lowEnergyTimes.some(range => 
        timeString >= range.start && timeString <= range.end
      );
      if (isLowEnergyTime) {
        adjustment += 2;
      }
    }

    return adjustment;
  }

  /**
   * Get debug information for priority calculation
   */
  static getDebugInfo(
    task: Task, 
    user: User, 
    currentTime: Date = new Date()
  ): {
    taskId: string;
    taskTitle: string;
    basePriorityScore: number;
    urgencyScore: number;
    importanceWeight: number;
    hardDeadlineBonus: number;
    finalScore: number;
    category: string;
  } {
    const basePriorityScore = this.getBasePriorityScore(task.priority);
    const urgencyScore = task.deadline ? 
      this.calculateDeadlineUrgencyScore(task.deadline, currentTime, task.isHardDeadline) : 0;
    const importanceWeight = this.calculateImportanceWeight(task, user);
    const hardDeadlineBonus = (task.deadline && task.isHardDeadline) ? this.HARD_DEADLINE_BONUS : 0;
    const finalScore = this.calculateTaskPriorityScore(task, user, currentTime);
    const category = this.categorizePriority(finalScore);

    return {
      taskId: task.id,
      taskTitle: task.title,
      basePriorityScore,
      urgencyScore,
      importanceWeight,
      hardDeadlineBonus,
      finalScore,
      category: category.category
    };
  }
}