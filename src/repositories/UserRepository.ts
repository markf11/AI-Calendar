import { Pool } from 'pg';
import { Database } from '@/config/database';
import { User, CreateUserRequest, UpdateUserRequest, UserAuthData } from '@/models/User';
import { WorkingHours, UserPreferences } from '@/models/types';

export class UserRepository {
  private db: Pool;

  constructor() {
    this.db = Database.getInstance().getPool();
  }

  /**
   * Create a new user
   */
  async create(userData: CreateUserRequest & { passwordHash: string }): Promise<User> {
    const defaultWorkingHours: WorkingHours = {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      lunchBreak: { start: '12:00', end: '13:00' }
    };

    const defaultPreferences: UserPreferences = {
      maxContinuousWorkTime: 120, // 2 hours
      preferredBreakDuration: 15,
      groupSimilarTasks: true,
      protectFocusTime: true,
      optimizeForEarlyCompletion: false,
      defaultMeetingBuffer: 15,
      energyPreferences: {
        highEnergyTimes: [{ start: '09:00', end: '11:00' }],
        lowEnergyTimes: [{ start: '14:00', end: '16:00' }],
        meetingPreferredTimes: [{ start: '10:00', end: '12:00' }, { start: '14:00', end: '16:00' }]
      },
      autoRescheduleEnabled: true,
      notificationSettings: {
        taskReminders: true,
        scheduleChanges: true,
        deadlineAlerts: true,
        completionCelebrations: true
      }
    };

    const query = `
      INSERT INTO users (email, name, password_hash, timezone, working_hours, preferences)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, name, timezone, working_hours, preferences, created_at, updated_at
    `;

    const values = [
      userData.email,
      userData.name,
      userData.passwordHash,
      userData.timezone,
      JSON.stringify(defaultWorkingHours),
      JSON.stringify(defaultPreferences)
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      timezone: row.timezone,
      workingHours: row.working_hours,
      preferences: row.preferences,
      connectedCalendars: [], // Will be loaded separately
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, name, timezone, working_hours, preferences, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    const result = await this.db.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      timezone: row.timezone,
      workingHours: row.working_hours,
      preferences: row.preferences,
      connectedCalendars: [], // Will be loaded separately
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, name, timezone, working_hours, preferences, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      timezone: row.timezone,
      workingHours: row.working_hours,
      preferences: row.preferences,
      connectedCalendars: [], // Will be loaded separately
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get user credentials for authentication
   */
  async getUserCredentials(email: string): Promise<{ id: string; email: string; name: string; passwordHash: string } | null> {
    const query = `
      SELECT id, email, name, password_hash
      FROM users
      WHERE email = $1
    `;

    const result = await this.db.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash
    };
  }

  /**
   * Update user information
   */
  async update(id: string, updates: UpdateUserRequest): Promise<User | null> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setParts.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.timezone !== undefined) {
      setParts.push(`timezone = $${paramIndex++}`);
      values.push(updates.timezone);
    }

    if (updates.workingHours !== undefined) {
      setParts.push(`working_hours = $${paramIndex++}`);
      values.push(JSON.stringify(updates.workingHours));
    }

    if (updates.preferences !== undefined) {
      setParts.push(`preferences = $${paramIndex++}`);
      values.push(JSON.stringify(updates.preferences));
    }

    if (setParts.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE users
      SET ${setParts.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, email, name, timezone, working_hours, preferences, created_at, updated_at
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      timezone: row.timezone,
      workingHours: row.working_hours,
      preferences: row.preferences,
      connectedCalendars: [], // Will be loaded separately
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await this.db.query(query, [passwordHash, id]);
    return result.rowCount > 0;
  }

  /**
   * Delete user account
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const query = 'SELECT 1 FROM users WHERE email = $1';
    const result = await this.db.query(query, [email]);
    return result.rows.length > 0;
  }

  /**
   * Get user auth data for token generation
   */
  async getUserAuthData(id: string): Promise<UserAuthData | null> {
    const query = `
      SELECT id, email, name
      FROM users
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name
    };
  }
}