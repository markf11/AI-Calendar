import { Pool } from 'pg';

export interface BookingRecord {
  id: string;
  bookingLinkId: string;
  attendeeName: string;
  attendeeEmail: string;
  startTime: Date;
  endTime: Date;
  notes?: string;
  confirmationCode: string;
  calendarEventId?: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export class BookingRecordRepository {
  constructor(private db: Pool) {}

  /**
   * Create a new booking record
   */
  async create(bookingRecord: Omit<BookingRecord, 'createdAt' | 'updatedAt'>): Promise<BookingRecord> {
    const query = `
      INSERT INTO booking_records (
        id, booking_link_id, attendee_name, attendee_email, start_time, end_time,
        notes, confirmation_code, calendar_event_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *, created_at, updated_at
    `;

    const values = [
      bookingRecord.id,
      bookingRecord.bookingLinkId,
      bookingRecord.attendeeName,
      bookingRecord.attendeeEmail,
      bookingRecord.startTime,
      bookingRecord.endTime,
      bookingRecord.notes || null,
      bookingRecord.confirmationCode,
      bookingRecord.calendarEventId || null,
      bookingRecord.status
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToBookingRecord(result.rows[0]);
  }

  /**
   * Find booking record by confirmation code
   */
  async findByConfirmationCode(confirmationCode: string): Promise<BookingRecord | null> {
    const query = `
      SELECT * FROM booking_records 
      WHERE confirmation_code = $1
    `;

    const result = await this.db.query(query, [confirmationCode]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToBookingRecord(result.rows[0]);
  }

  /**
   * Find booking records by booking link ID
   */
  async findByBookingLinkId(
    linkId: string,
    filters?: {
      status?: BookingRecord['status'][];
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<BookingRecord[]> {
    let query = `
      SELECT * FROM booking_records 
      WHERE booking_link_id = $1
    `;

    const values: any[] = [linkId];
    let paramIndex = 2;

    if (filters?.status && filters.status.length > 0) {
      query += ` AND status = ANY($${paramIndex++})`;
      values.push(filters.status);
    }

    if (filters?.dateRange) {
      query += ` AND start_time >= $${paramIndex++} AND end_time <= $${paramIndex++}`;
      values.push(filters.dateRange.start, filters.dateRange.end);
    }

    query += ` ORDER BY start_time DESC`;

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToBookingRecord(row));
  }

  /**
   * Find booking record by ID
   */
  async findById(id: string): Promise<BookingRecord | null> {
    const query = `
      SELECT * FROM booking_records 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToBookingRecord(result.rows[0]);
  }

  /**
   * Update booking record status
   */
  async updateStatus(id: string, status: BookingRecord['status']): Promise<BookingRecord> {
    const query = `
      UPDATE booking_records 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *, created_at, updated_at
    `;

    const result = await this.db.query(query, [status, id]);
    
    if (result.rows.length === 0) {
      throw new Error('Booking record not found');
    }

    return this.mapRowToBookingRecord(result.rows[0]);
  }

  /**
   * Update booking record
   */
  async update(
    id: string,
    updates: Partial<Pick<BookingRecord, 'attendeeName' | 'attendeeEmail' | 'startTime' | 'endTime' | 'notes' | 'status'>>
  ): Promise<BookingRecord> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.attendeeName !== undefined) {
      setClauses.push(`attendee_name = $${paramIndex++}`);
      values.push(updates.attendeeName);
    }

    if (updates.attendeeEmail !== undefined) {
      setClauses.push(`attendee_email = $${paramIndex++}`);
      values.push(updates.attendeeEmail);
    }

    if (updates.startTime !== undefined) {
      setClauses.push(`start_time = $${paramIndex++}`);
      values.push(updates.startTime);
    }

    if (updates.endTime !== undefined) {
      setClauses.push(`end_time = $${paramIndex++}`);
      values.push(updates.endTime);
    }

    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (setClauses.length === 0) {
      throw new Error('No updates provided');
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE booking_records 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *, created_at, updated_at
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Booking record not found');
    }

    return this.mapRowToBookingRecord(result.rows[0]);
  }

  /**
   * Delete booking record
   */
  async delete(id: string): Promise<void> {
    const query = `DELETE FROM booking_records WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    
    if (result.rowCount === 0) {
      throw new Error('Booking record not found');
    }
  }

  /**
   * Find upcoming bookings that need reminders
   */
  async findUpcomingBookings(hoursAhead: number): Promise<BookingRecord[]> {
    const query = `
      SELECT * FROM booking_records 
      WHERE status = 'confirmed'
        AND start_time > NOW()
        AND start_time <= NOW() + INTERVAL '${hoursAhead} hours'
      ORDER BY start_time ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapRowToBookingRecord(row));
  }

  /**
   * Get booking statistics for a user
   */
  async getStatistics(
    userId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    completedBookings: number;
    upcomingBookings: number;
    averageBookingsPerDay: number;
    popularTimeSlots: Array<{ hour: number; count: number }>;
    bookingsByLink: Array<{ linkId: string; linkTitle: string; count: number }>;
  }> {
    let dateFilter = '';
    const values: any[] = [userId];
    
    if (dateRange) {
      dateFilter = 'AND br.created_at >= $2 AND br.created_at <= $3';
      values.push(dateRange.start, dateRange.end);
    }

    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN br.status = 'confirmed' THEN 1 END) as confirmed_bookings,
        COUNT(CASE WHEN br.status = 'cancelled' THEN 1 END) as cancelled_bookings,
        COUNT(CASE WHEN br.status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN br.status = 'confirmed' AND br.start_time > NOW() THEN 1 END) as upcoming_bookings
      FROM booking_records br
      JOIN booking_links bl ON br.booking_link_id = bl.id
      WHERE bl.user_id = $1 ${dateFilter}
    `;

    const statsResult = await this.db.query(statsQuery, values);
    const stats = statsResult.rows[0];

    // Calculate average bookings per day
    let averageBookingsPerDay = 0;
    if (dateRange) {
      const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
      averageBookingsPerDay = daysDiff > 0 ? parseInt(stats.total_bookings) / daysDiff : 0;
    }

    // Get popular time slots
    const timeSlotsQuery = `
      SELECT 
        EXTRACT(HOUR FROM br.start_time) as hour,
        COUNT(*) as count
      FROM booking_records br
      JOIN booking_links bl ON br.booking_link_id = bl.id
      WHERE bl.user_id = $1 ${dateFilter}
        AND br.status IN ('confirmed', 'completed')
      GROUP BY EXTRACT(HOUR FROM br.start_time)
      ORDER BY count DESC
      LIMIT 10
    `;

    const timeSlotsResult = await this.db.query(timeSlotsQuery, values);
    const popularTimeSlots = timeSlotsResult.rows.map(row => ({
      hour: parseInt(row.hour),
      count: parseInt(row.count)
    }));

    // Get bookings by link
    const linkStatsQuery = `
      SELECT 
        bl.id as link_id,
        bl.title as link_title,
        COUNT(br.id) as count
      FROM booking_links bl
      LEFT JOIN booking_records br ON bl.id = br.booking_link_id ${dateFilter.replace('br.created_at', 'br.start_time')}
      WHERE bl.user_id = $1
      GROUP BY bl.id, bl.title
      ORDER BY count DESC
    `;

    const linkStatsResult = await this.db.query(linkStatsQuery, values);
    const bookingsByLink = linkStatsResult.rows.map(row => ({
      linkId: row.link_id,
      linkTitle: row.link_title,
      count: parseInt(row.count)
    }));

    return {
      totalBookings: parseInt(stats.total_bookings) || 0,
      confirmedBookings: parseInt(stats.confirmed_bookings) || 0,
      cancelledBookings: parseInt(stats.cancelled_bookings) || 0,
      completedBookings: parseInt(stats.completed_bookings) || 0,
      upcomingBookings: parseInt(stats.upcoming_bookings) || 0,
      averageBookingsPerDay,
      popularTimeSlots,
      bookingsByLink
    };
  }

  /**
   * Find bookings for a specific date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<BookingRecord[]> {
    let query = `
      SELECT br.* FROM booking_records br
    `;

    const values: any[] = [startDate, endDate];
    let paramIndex = 3;

    if (userId) {
      query += `
        JOIN booking_links bl ON br.booking_link_id = bl.id
        WHERE bl.user_id = $${paramIndex++}
          AND br.start_time >= $1 
          AND br.end_time <= $2
      `;
      values.push(userId);
    } else {
      query += `
        WHERE br.start_time >= $1 
          AND br.end_time <= $2
      `;
    }

    query += ` ORDER BY br.start_time ASC`;

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToBookingRecord(row));
  }

  /**
   * Check for conflicting bookings
   */
  async findConflictingBookings(
    bookingLinkId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<BookingRecord[]> {
    let query = `
      SELECT * FROM booking_records 
      WHERE booking_link_id = $1 
        AND status = 'confirmed'
        AND start_time < $3 
        AND end_time > $2
    `;

    const values: any[] = [bookingLinkId, startTime, endTime];

    if (excludeBookingId) {
      query += ` AND id != $4`;
      values.push(excludeBookingId);
    }

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToBookingRecord(row));
  }

  /**
   * Map database row to BookingRecord object
   */
  private mapRowToBookingRecord(row: any): BookingRecord {
    return {
      id: row.id,
      bookingLinkId: row.booking_link_id,
      attendeeName: row.attendee_name,
      attendeeEmail: row.attendee_email,
      startTime: row.start_time,
      endTime: row.end_time,
      notes: row.notes,
      confirmationCode: row.confirmation_code,
      calendarEventId: row.calendar_event_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}