import { Pool } from 'pg';
import { CalendarEvent, CreateCalendarEventRequest, UpdateCalendarEventRequest } from '@/models/CalendarEvent';
import { CalendarSource, DateRange } from '@/models/types';

export class CalendarEventRepository {
  constructor(private db: Pool) {}

  /**
   * Create a new calendar event
   */
  async create(userId: string, eventData: CreateCalendarEventRequest & { 
    externalId?: string; 
    source: CalendarSource;
  }): Promise<CalendarEvent> {
    const query = `
      INSERT INTO calendar_events (
        user_id, external_id, title, description, start_time, end_time,
        is_flexible, travel_time_before, travel_time_after, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, user_id, external_id, title, description, start_time, end_time,
                is_flexible, travel_time_before, travel_time_after, source,
                created_at, updated_at
    `;

    const values = [
      userId,
      eventData.externalId || null,
      eventData.title,
      eventData.description || null,
      eventData.startTime,
      eventData.endTime,
      eventData.isFlexible ?? false,
      eventData.travelTimeBefore || null,
      eventData.travelTimeAfter || null,
      eventData.source
    ];

    try {
      const result = await this.db.query(query, values);
      return this.mapRowToEvent(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find event by ID
   */
  async findById(eventId: string): Promise<CalendarEvent | null> {
    const query = `
      SELECT id, user_id, external_id, title, description, start_time, end_time,
             is_flexible, travel_time_before, travel_time_after, source,
             created_at, updated_at
      FROM calendar_events
      WHERE id = $1
    `;

    try {
      const result = await this.db.query(query, [eventId]);
      return result.rows.length > 0 ? this.mapRowToEvent(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Failed to find calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find event by external ID and source
   */
  async findByExternalId(externalId: string, source: CalendarSource, userId: string): Promise<CalendarEvent | null> {
    const query = `
      SELECT id, user_id, external_id, title, description, start_time, end_time,
             is_flexible, travel_time_before, travel_time_after, source,
             created_at, updated_at
      FROM calendar_events
      WHERE external_id = $1 AND source = $2 AND user_id = $3
    `;

    try {
      const result = await this.db.query(query, [externalId, source, userId]);
      return result.rows.length > 0 ? this.mapRowToEvent(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Failed to find calendar event by external ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find events for a user within a date range
   */
  async findByUserAndDateRange(userId: string, dateRange: DateRange): Promise<CalendarEvent[]> {
    const query = `
      SELECT id, user_id, external_id, title, description, start_time, end_time,
             is_flexible, travel_time_before, travel_time_after, source,
             created_at, updated_at
      FROM calendar_events
      WHERE user_id = $1 
        AND start_time <= $3 
        AND end_time >= $2
      ORDER BY start_time ASC
    `;

    try {
      const result = await this.db.query(query, [userId, dateRange.start, dateRange.end]);
      return result.rows.map(row => this.mapRowToEvent(row));
    } catch (error) {
      throw new Error(`Failed to find calendar events by date range: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find all events for a user
   */
  async findByUserId(userId: string, limit?: number): Promise<CalendarEvent[]> {
    let query = `
      SELECT id, user_id, external_id, title, description, start_time, end_time,
             is_flexible, travel_time_before, travel_time_after, source,
             created_at, updated_at
      FROM calendar_events
      WHERE user_id = $1
      ORDER BY start_time ASC
    `;

    const values: any[] = [userId];

    if (limit) {
      query += ` LIMIT $2`;
      values.push(limit);
    }

    try {
      const result = await this.db.query(query, values);
      return result.rows.map(row => this.mapRowToEvent(row));
    } catch (error) {
      throw new Error(`Failed to find user calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find events by source
   */
  async findBySource(userId: string, source: CalendarSource): Promise<CalendarEvent[]> {
    const query = `
      SELECT id, user_id, external_id, title, description, start_time, end_time,
             is_flexible, travel_time_before, travel_time_after, source,
             created_at, updated_at
      FROM calendar_events
      WHERE user_id = $1 AND source = $2
      ORDER BY start_time ASC
    `;

    try {
      const result = await this.db.query(query, [userId, source]);
      return result.rows.map(row => this.mapRowToEvent(row));
    } catch (error) {
      throw new Error(`Failed to find calendar events by source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an event
   */
  async update(eventId: string, updates: UpdateCalendarEventRequest): Promise<CalendarEvent> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }
    if (updates.startTime !== undefined) {
      updateFields.push(`start_time = $${paramCount++}`);
      values.push(updates.startTime);
    }
    if (updates.endTime !== undefined) {
      updateFields.push(`end_time = $${paramCount++}`);
      values.push(updates.endTime);
    }
    if (updates.isFlexible !== undefined) {
      updateFields.push(`is_flexible = $${paramCount++}`);
      values.push(updates.isFlexible);
    }
    if (updates.travelTimeBefore !== undefined) {
      updateFields.push(`travel_time_before = $${paramCount++}`);
      values.push(updates.travelTimeBefore);
    }
    if (updates.travelTimeAfter !== undefined) {
      updateFields.push(`travel_time_after = $${paramCount++}`);
      values.push(updates.travelTimeAfter);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(eventId);

    const query = `
      UPDATE calendar_events
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, user_id, external_id, title, description, start_time, end_time,
                is_flexible, travel_time_before, travel_time_after, source,
                created_at, updated_at
    `;

    try {
      const result = await this.db.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('Calendar event not found');
      }
      return this.mapRowToEvent(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to update calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an event
   */
  async delete(eventId: string): Promise<void> {
    const query = `DELETE FROM calendar_events WHERE id = $1`;

    try {
      const result = await this.db.query(query, [eventId]);
      if (result.rowCount === 0) {
        throw new Error('Calendar event not found');
      }
    } catch (error) {
      throw new Error(`Failed to delete calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete events by external ID and source
   */
  async deleteByExternalId(externalId: string, source: CalendarSource, userId: string): Promise<void> {
    const query = `DELETE FROM calendar_events WHERE external_id = $1 AND source = $2 AND user_id = $3`;

    try {
      await this.db.query(query, [externalId, source, userId]);
    } catch (error) {
      throw new Error(`Failed to delete calendar event by external ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk create events (for sync operations)
   */
  async bulkCreate(events: (CreateCalendarEventRequest & { 
    userId: string;
    externalId?: string; 
    source: CalendarSource;
  })[]): Promise<CalendarEvent[]> {
    if (events.length === 0) return [];

    const values: any[] = [];
    const valueStrings: string[] = [];
    let paramCount = 1;

    events.forEach(event => {
      valueStrings.push(
        `($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`
      );
      values.push(
        event.userId,
        event.externalId || null,
        event.title,
        event.description || null,
        event.startTime,
        event.endTime,
        event.isFlexible ?? false,
        event.travelTimeBefore || null,
        event.travelTimeAfter || null,
        event.source
      );
    });

    const query = `
      INSERT INTO calendar_events (
        user_id, external_id, title, description, start_time, end_time,
        is_flexible, travel_time_before, travel_time_after, source
      ) VALUES ${valueStrings.join(', ')}
      RETURNING id, user_id, external_id, title, description, start_time, end_time,
                is_flexible, travel_time_before, travel_time_after, source,
                created_at, updated_at
    `;

    try {
      const result = await this.db.query(query, values);
      return result.rows.map(row => this.mapRowToEvent(row));
    } catch (error) {
      throw new Error(`Failed to bulk create calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check for conflicting events
   */
  async findConflictingEvents(
    userId: string, 
    startTime: Date, 
    endTime: Date, 
    excludeEventId?: string
  ): Promise<CalendarEvent[]> {
    let query = `
      SELECT id, user_id, external_id, title, description, start_time, end_time,
             is_flexible, travel_time_before, travel_time_after, source,
             created_at, updated_at
      FROM calendar_events
      WHERE user_id = $1 
        AND start_time < $3 
        AND end_time > $2
    `;

    const values: any[] = [userId, startTime, endTime];

    if (excludeEventId) {
      query += ` AND id != $4`;
      values.push(excludeEventId);
    }

    query += ` ORDER BY start_time ASC`;

    try {
      const result = await this.db.query(query, values);
      return result.rows.map(row => this.mapRowToEvent(row));
    } catch (error) {
      throw new Error(`Failed to find conflicting events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Alias for findByUserAndDateRange for consistency with other repositories
   */
  async findByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    return this.findByUserAndDateRange(userId, { start: startDate, end: endDate });
  }

  /**
   * Map database row to CalendarEvent object
   */
  private mapRowToEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      userId: row.user_id,
      externalId: row.external_id,
      title: row.title,
      description: row.description,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      isFlexible: row.is_flexible,
      travelTimeBefore: row.travel_time_before,
      travelTimeAfter: row.travel_time_after,
      source: row.source,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}