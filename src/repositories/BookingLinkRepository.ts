import { Pool } from 'pg';
import { BookingLink } from '@/models/BookingLink';
import { BookingLinkConfig } from '@/models/types';

export class BookingLinkRepository {
  constructor(private db: Pool) {}

  /**
   * Create a new booking link
   */
  async create(bookingLink: Omit<BookingLink, 'createdAt' | 'updatedAt'>): Promise<BookingLink> {
    const query = `
      INSERT INTO booking_links (
        id, user_id, title, duration, availability_window, 
        buffer_before, buffer_after, is_active, custom_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *, created_at, updated_at
    `;

    const values = [
      bookingLink.id,
      bookingLink.userId,
      bookingLink.title,
      bookingLink.duration,
      JSON.stringify(bookingLink.availabilityWindow),
      bookingLink.bufferBefore,
      bookingLink.bufferAfter,
      bookingLink.isActive,
      bookingLink.customUrl
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToBookingLink(result.rows[0]);
  }

  /**
   * Find booking link by ID
   */
  async findById(id: string): Promise<BookingLink | null> {
    const query = `
      SELECT * FROM booking_links 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToBookingLink(result.rows[0]);
  }

  /**
   * Find booking link by custom URL
   */
  async findByCustomUrl(customUrl: string): Promise<BookingLink | null> {
    const query = `
      SELECT * FROM booking_links 
      WHERE custom_url = $1
    `;

    const result = await this.db.query(query, [customUrl]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToBookingLink(result.rows[0]);
  }

  /**
   * Find all booking links for a user
   */
  async findByUserId(userId: string): Promise<BookingLink[]> {
    const query = `
      SELECT * FROM booking_links 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapRowToBookingLink(row));
  }

  /**
   * Find active booking links for a user
   */
  async findActiveByUserId(userId: string): Promise<BookingLink[]> {
    const query = `
      SELECT * FROM booking_links 
      WHERE user_id = $1 AND is_active = true 
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapRowToBookingLink(row));
  }

  /**
   * Update a booking link
   */
  async update(id: string, updates: Partial<BookingLinkConfig & { isActive?: boolean }>): Promise<BookingLink> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }

    if (updates.duration !== undefined) {
      setClauses.push(`duration = $${paramIndex++}`);
      values.push(updates.duration);
    }

    if (updates.availabilityWindow !== undefined) {
      setClauses.push(`availability_window = $${paramIndex++}`);
      values.push(JSON.stringify(updates.availabilityWindow));
    }

    if (updates.bufferBefore !== undefined) {
      setClauses.push(`buffer_before = $${paramIndex++}`);
      values.push(updates.bufferBefore);
    }

    if (updates.bufferAfter !== undefined) {
      setClauses.push(`buffer_after = $${paramIndex++}`);
      values.push(updates.bufferAfter);
    }

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (updates.customUrl !== undefined) {
      setClauses.push(`custom_url = $${paramIndex++}`);
      values.push(updates.customUrl);
    }

    if (setClauses.length === 0) {
      throw new Error('No updates provided');
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE booking_links 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *, created_at, updated_at
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Booking link not found');
    }

    return this.mapRowToBookingLink(result.rows[0]);
  }

  /**
   * Delete a booking link
   */
  async delete(id: string): Promise<void> {
    const query = `DELETE FROM booking_links WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    
    if (result.rowCount === 0) {
      throw new Error('Booking link not found');
    }
  }

  /**
   * Check if a custom URL exists (excluding a specific booking link ID)
   */
  async isCustomUrlTaken(customUrl: string, excludeId?: string): Promise<boolean> {
    let query = `SELECT id FROM booking_links WHERE custom_url = $1`;
    const values: any[] = [customUrl];

    if (excludeId) {
      query += ` AND id != $2`;
      values.push(excludeId);
    }

    const result = await this.db.query(query, values);
    return result.rows.length > 0;
  }

  /**
   * Get booking link statistics
   */
  async getStats(userId: string, linkId?: string): Promise<{
    totalLinks: number;
    activeLinks: number;
    inactiveLinks: number;
  }> {
    let query = `
      SELECT 
        COUNT(*) as total_links,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_links,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_links
      FROM booking_links 
      WHERE user_id = $1
    `;

    const values = [userId];

    if (linkId) {
      query += ` AND id = $2`;
      values.push(linkId);
    }

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return {
      totalLinks: parseInt(row.total_links),
      activeLinks: parseInt(row.active_links),
      inactiveLinks: parseInt(row.inactive_links)
    };
  }

  /**
   * Map database row to BookingLink object
   */
  private mapRowToBookingLink(row: any): BookingLink {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      duration: row.duration,
      availabilityWindow: row.availability_window,
      bufferBefore: row.buffer_before,
      bufferAfter: row.buffer_after,
      isActive: row.is_active,
      customUrl: row.custom_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}