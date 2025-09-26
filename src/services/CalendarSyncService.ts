import { CalendarConnection, SyncResult, CalendarSource, DateRange } from '@/models/types';
import { CalendarEvent, CreateCalendarEventRequest } from '@/models/CalendarEvent';
import { GoogleCalendarService } from './GoogleCalendarService';
import { MicrosoftGraphService } from './MicrosoftGraphService';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { CalendarConnectionRepository } from '@/repositories/CalendarConnectionRepository';
import { Pool } from 'pg';

export interface SyncStatus {
  userId: string;
  provider: CalendarSource;
  lastSyncAt: Date;
  nextSyncToken?: string;
  status: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
  eventsCount: number;
}

export interface SyncConflict {
  type: 'duplicate' | 'time_overlap' | 'external_modification';
  localEvent?: CalendarEvent;
  externalEvent?: any;
  description: string;
  resolution: 'keep_local' | 'keep_external' | 'merge' | 'manual_review';
}

export interface SyncOptions {
  fullSync?: boolean;
  dateRange?: DateRange;
  resolveConflicts?: boolean;
  dryRun?: boolean;
}

export class CalendarSyncService {
  private googleService: GoogleCalendarService;
  private microsoftService: MicrosoftGraphService;
  private eventRepository: CalendarEventRepository;
  private connectionRepository: CalendarConnectionRepository;
  private syncStatuses: Map<string, SyncStatus> = new Map();

  constructor(db: Pool) {
    this.googleService = new GoogleCalendarService();
    this.microsoftService = new MicrosoftGraphService();
    this.eventRepository = new CalendarEventRepository(db);
    this.connectionRepository = new CalendarConnectionRepository(db);
  }

  /**
   * Sync all calendars for a user
   */
  async syncUserCalendars(userId: string, options: SyncOptions = {}): Promise<SyncResult> {
    const connections = await this.connectionRepository.findByUserId(userId);
    const results: SyncResult[] = [];

    for (const connection of connections) {
      try {
        const result = await this.syncCalendar(connection, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          eventsAdded: 0,
          eventsUpdated: 0,
          eventsDeleted: 0,
          errors: [error instanceof Error ? error.message : 'Unknown sync error']
        });
      }
    }

    // Aggregate results
    return this.aggregateSyncResults(results);
  }

  /**
   * Sync a specific calendar connection
   */
  async syncCalendar(connection: CalendarConnection, options: SyncOptions = {}): Promise<SyncResult> {
    const syncKey = `${connection.userId}-${connection.provider}`;
    
    // Update sync status
    this.updateSyncStatus(syncKey, {
      userId: connection.userId,
      provider: connection.provider as CalendarSource,
      lastSyncAt: new Date(),
      status: 'syncing',
      eventsCount: 0
    });

    try {
      let result: SyncResult;

      if (connection.provider === 'google') {
        result = await this.syncGoogleCalendar(connection, options);
      } else if (connection.provider === 'microsoft') {
        result = await this.syncMicrosoftCalendar(connection, options);
      } else {
        throw new Error(`Unsupported calendar provider: ${connection.provider}`);
      }

      // Update sync status on success
      this.updateSyncStatus(syncKey, {
        userId: connection.userId,
        provider: connection.provider as CalendarSource,
        lastSyncAt: new Date(),
        status: 'idle',
        eventsCount: result.eventsAdded + result.eventsUpdated
      });

      return result;
    } catch (error) {
      // Update sync status on error
      this.updateSyncStatus(syncKey, {
        userId: connection.userId,
        provider: connection.provider as CalendarSource,
        lastSyncAt: new Date(),
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        eventsCount: 0
      });

      throw error;
    }
  }

  /**
   * Sync Google Calendar
   */
  private async syncGoogleCalendar(connection: CalendarConnection, options: SyncOptions): Promise<SyncResult> {
    const syncStatus = this.getSyncStatus(`${connection.userId}-google`);
    const syncToken = options.fullSync ? undefined : syncStatus?.nextSyncToken;

    // Fetch events from Google Calendar
    const { events: externalEvents, nextSyncToken } = await this.googleService.syncEvents(
      connection,
      'primary',
      syncToken
    );

    // Get existing local events
    const localEvents = await this.eventRepository.findBySource(connection.userId, 'google');

    // Perform sync
    const syncResult = await this.performBidirectionalSync(
      connection.userId,
      'google',
      externalEvents,
      localEvents,
      options
    );

    // Update sync token
    if (nextSyncToken) {
      this.updateSyncStatus(`${connection.userId}-google`, {
        ...syncStatus,
        nextSyncToken
      });
    }

    return syncResult;
  }

  /**
   * Sync Microsoft Calendar
   */
  private async syncMicrosoftCalendar(connection: CalendarConnection, options: SyncOptions): Promise<SyncResult> {
    const syncStatus = this.getSyncStatus(`${connection.userId}-microsoft`);
    const deltaToken = options.fullSync ? undefined : syncStatus?.nextSyncToken;

    // Fetch events from Microsoft Calendar
    const { events: externalEvents, nextDeltaToken } = await this.microsoftService.syncEvents(
      connection,
      'primary',
      deltaToken
    );

    // Get existing local events
    const localEvents = await this.eventRepository.findBySource(connection.userId, 'microsoft');

    // Perform sync
    const syncResult = await this.performBidirectionalSync(
      connection.userId,
      'microsoft',
      externalEvents,
      localEvents,
      options
    );

    // Update delta token
    if (nextDeltaToken) {
      this.updateSyncStatus(`${connection.userId}-microsoft`, {
        ...syncStatus,
        nextSyncToken: nextDeltaToken
      });
    }

    return syncResult;
  }

  /**
   * Perform bidirectional synchronization
   */
  private async performBidirectionalSync(
    userId: string,
    source: CalendarSource,
    externalEvents: CalendarEvent[],
    localEvents: CalendarEvent[],
    options: SyncOptions
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: []
    };

    // Create maps for efficient lookup
    const externalEventMap = new Map(
      externalEvents.map(event => [event.externalId!, event])
    );
    const localEventMap = new Map(
      localEvents.map(event => [event.externalId!, event])
    );

    // Process external events (add/update local events)
    for (const externalEvent of externalEvents) {
      if (!externalEvent.externalId) continue;

      try {
        const localEvent = localEventMap.get(externalEvent.externalId);

        if (!localEvent) {
          // Add new event
          if (!options.dryRun) {
            await this.eventRepository.create(userId, {
              ...externalEvent,
              source
            });
          }
          result.eventsAdded++;
        } else if (this.shouldUpdateLocalEvent(localEvent, externalEvent)) {
          // Update existing event
          if (!options.dryRun) {
            await this.eventRepository.update(localEvent.id, {
              title: externalEvent.title,
              description: externalEvent.description,
              startTime: externalEvent.startTime,
              endTime: externalEvent.endTime
            });
          }
          result.eventsUpdated++;
        }
      } catch (error) {
        result.errors.push(`Failed to sync external event ${externalEvent.externalId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    // Process local events that don't exist externally (delete them)
    for (const localEvent of localEvents) {
      if (!localEvent.externalId) continue;

      if (!externalEventMap.has(localEvent.externalId)) {
        try {
          if (!options.dryRun) {
            await this.eventRepository.delete(localEvent.id);
          }
          result.eventsDeleted++;
        } catch (error) {
          result.errors.push(`Failed to delete local event ${localEvent.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.success = false;
        }
      }
    }

    return result;
  }

  /**
   * Check if local event should be updated based on external event
   */
  private shouldUpdateLocalEvent(localEvent: CalendarEvent, externalEvent: CalendarEvent): boolean {
    return (
      localEvent.title !== externalEvent.title ||
      localEvent.description !== externalEvent.description ||
      localEvent.startTime.getTime() !== externalEvent.startTime.getTime() ||
      localEvent.endTime.getTime() !== externalEvent.endTime.getTime() ||
      localEvent.updatedAt < externalEvent.updatedAt
    );
  }

  /**
   * Detect and resolve conflicts
   */
  async detectConflicts(userId: string, source: CalendarSource): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];
    const localEvents = await this.eventRepository.findBySource(userId, source);

    // Check for time overlaps with other events
    for (const event of localEvents) {
      const conflictingEvents = await this.eventRepository.findConflictingEvents(
        userId,
        event.startTime,
        event.endTime,
        event.id
      );

      for (const conflictingEvent of conflictingEvents) {
        // Only report conflicts between firm events (external calendar events)
        if (!event.isFlexible && !conflictingEvent.isFlexible) {
          conflicts.push({
            type: 'time_overlap',
            localEvent: event,
            externalEvent: conflictingEvent,
            description: `Time overlap between "${event.title}" and "${conflictingEvent.title}"`,
            resolution: 'manual_review'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts automatically where possible
   */
  async resolveConflicts(conflicts: SyncConflict[], options: SyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: []
    };

    for (const conflict of conflicts) {
      try {
        switch (conflict.resolution) {
          case 'keep_local':
            // Keep local event, ignore external
            break;
          case 'keep_external':
            // Update local event with external data
            if (conflict.localEvent && conflict.externalEvent && !options.dryRun) {
              await this.eventRepository.update(conflict.localEvent.id, {
                title: conflict.externalEvent.title,
                description: conflict.externalEvent.description,
                startTime: new Date(conflict.externalEvent.startTime),
                endTime: new Date(conflict.externalEvent.endTime)
              });
              result.eventsUpdated++;
            }
            break;
          case 'merge':
            // Merge event data (implementation depends on specific conflict type)
            break;
          case 'manual_review':
            // Skip automatic resolution
            result.errors.push(`Manual review required for conflict: ${conflict.description}`);
            break;
        }
      } catch (error) {
        result.errors.push(`Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Push local changes to external calendar
   */
  async pushLocalChanges(userId: string, source: CalendarSource): Promise<SyncResult> {
    const connection = await this.connectionRepository.findByUserAndProvider(
      userId, 
      source === 'google' ? 'google' : 'microsoft'
    );

    if (!connection) {
      throw new Error(`No ${source} calendar connection found for user`);
    }

    // Get local events that originated from Momentum (no externalId)
    const localEvents = await this.eventRepository.findBySource(userId, 'momentum');
    
    const result: SyncResult = {
      success: true,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: []
    };

    for (const localEvent of localEvents) {
      try {
        let externalId: string;

        if (source === 'google') {
          externalId = await this.googleService.createEvent(connection, {
            title: localEvent.title,
            description: localEvent.description,
            startTime: localEvent.startTime,
            endTime: localEvent.endTime
          });
        } else {
          externalId = await this.microsoftService.createEvent(connection, {
            title: localEvent.title,
            description: localEvent.description,
            startTime: localEvent.startTime,
            endTime: localEvent.endTime
          });
        }

        // Update local event with external ID
        await this.eventRepository.update(localEvent.id, {});
        // Note: We would need to add externalId to the update method

        result.eventsAdded++;
      } catch (error) {
        result.errors.push(`Failed to push event ${localEvent.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Get sync status for a user and provider
   */
  getSyncStatus(key: string): SyncStatus | undefined {
    return this.syncStatuses.get(key);
  }

  /**
   * Update sync status
   */
  private updateSyncStatus(key: string, status: Partial<SyncStatus>): void {
    const existing = this.syncStatuses.get(key);
    this.syncStatuses.set(key, { ...existing, ...status } as SyncStatus);
  }

  /**
   * Aggregate multiple sync results
   */
  private aggregateSyncResults(results: SyncResult[]): SyncResult {
    return results.reduce((aggregate, result) => ({
      success: aggregate.success && result.success,
      eventsAdded: aggregate.eventsAdded + result.eventsAdded,
      eventsUpdated: aggregate.eventsUpdated + result.eventsUpdated,
      eventsDeleted: aggregate.eventsDeleted + result.eventsDeleted,
      errors: [...aggregate.errors, ...result.errors]
    }), {
      success: true,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: []
    });
  }

  /**
   * Schedule periodic sync for all users
   */
  async schedulePeriodicSync(intervalMinutes: number = 15): Promise<void> {
    setInterval(async () => {
      try {
        // Get all active connections
        const connections = await this.connectionRepository.findExpiredConnections();
        
        for (const connection of connections) {
          try {
            await this.syncCalendar(connection, { resolveConflicts: true });
          } catch (error) {
            console.error(`Failed to sync calendar for user ${connection.userId}:`, error);
          }
        }
      } catch (error) {
        console.error('Failed to run periodic sync:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}