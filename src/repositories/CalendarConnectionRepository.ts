import { Pool } from 'pg';
import { CalendarConnection } from '@/models/types';
import { encrypt, decrypt } from '@/utils/encryption';

export class CalendarConnectionRepository {
  constructor(private db: Pool) {}

  /**
   * Create a new calendar connection
   */
  async create(connection: Omit<CalendarConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarConnection> {
    const query = `
      INSERT INTO calendar_connections (
        user_id, provider, account_email, access_token, refresh_token, 
        expires_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, provider, account_email, access_token, refresh_token,
                expires_at, is_active, created_at, updated_at
    `;

    const values = [
      connection.userId,
      connection.provider,
      connection.accountEmail,
      connection.accessToken, // Already encrypted by service
      connection.refreshToken, // Already encrypted by service
      connection.expiresAt,
      connection.isActive
    ];

    try {
      const result = await this.db.query(query, values);
      return this.mapRowToConnection(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create calendar connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find connection by user ID and provider
   */
  async findByUserAndProvider(userId: string, provider: 'google' | 'microsoft'): Promise<CalendarConnection | null> {
    const query = `
      SELECT id, user_id, provider, account_email, access_token, refresh_token,
             expires_at, is_active, created_at, updated_at
      FROM calendar_connections
      WHERE user_id = $1 AND provider = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    try {
      const result = await this.db.query(query, [userId, provider]);
      return result.rows.length > 0 ? this.mapRowToConnection(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Failed to find calendar connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find all active connections for a user
   */
  async findByUserId(userId: string): Promise<CalendarConnection[]> {
    const query = `
      SELECT id, user_id, provider, account_email, access_token, refresh_token,
             expires_at, is_active, created_at, updated_at
      FROM calendar_connections
      WHERE user_id = $1 AND is_active = true
      ORDER BY provider, created_at DESC
    `;

    try {
      const result = await this.db.query(query, [userId]);
      return result.rows.map(row => this.mapRowToConnection(row));
    } catch (error) {
      throw new Error(`Failed to find user calendar connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update connection tokens
   */
  async updateTokens(
    connectionId: string, 
    accessToken: string, 
    refreshToken: string, 
    expiresAt: Date
  ): Promise<CalendarConnection> {
    const query = `
      UPDATE calendar_connections
      SET access_token = $2, refresh_token = $3, expires_at = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, user_id, provider, account_email, access_token, refresh_token,
                expires_at, is_active, created_at, updated_at
    `;

    try {
      const result = await this.db.query(query, [connectionId, accessToken, refreshToken, expiresAt]);
      if (result.rows.length === 0) {
        throw new Error('Calendar connection not found');
      }
      return this.mapRowToConnection(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to update calendar connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deactivate a connection
   */
  async deactivate(connectionId: string): Promise<void> {
    const query = `
      UPDATE calendar_connections
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      const result = await this.db.query(query, [connectionId]);
      if (result.rowCount === 0) {
        throw new Error('Calendar connection not found');
      }
    } catch (error) {
      throw new Error(`Failed to deactivate calendar connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a connection permanently
   */
  async delete(connectionId: string): Promise<void> {
    const query = `DELETE FROM calendar_connections WHERE id = $1`;

    try {
      const result = await this.db.query(query, [connectionId]);
      if (result.rowCount === 0) {
        throw new Error('Calendar connection not found');
      }
    } catch (error) {
      throw new Error(`Failed to delete calendar connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find connections that need token refresh
   */
  async findExpiredConnections(): Promise<CalendarConnection[]> {
    const query = `
      SELECT id, user_id, provider, account_email, access_token, refresh_token,
             expires_at, is_active, created_at, updated_at
      FROM calendar_connections
      WHERE is_active = true AND expires_at < CURRENT_TIMESTAMP + INTERVAL '5 minutes'
      ORDER BY expires_at ASC
    `;

    try {
      const result = await this.db.query(query);
      return result.rows.map(row => this.mapRowToConnection(row));
    } catch (error) {
      throw new Error(`Failed to find expired connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map database row to CalendarConnection object
   */
  private mapRowToConnection(row: any): CalendarConnection {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      accountEmail: row.account_email,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: new Date(row.expires_at),
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}