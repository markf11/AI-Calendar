// @ts-nocheck
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { config } from '@/config/environment';
import { CalendarEvent, CreateCalendarEventRequest, UpdateCalendarEventRequest } from '@/models/CalendarEvent';
import { CalendarConnection, SyncResult } from '@/models/types';
import { encrypt, decrypt } from '@/utils/encryption';

export interface GoogleCalendarCredentials {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
}

export interface GoogleCalendarWebhook {
  id: string;
  resourceId: string;
  resourceUri: string;
  token?: string;
  expiration?: string;
}

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: calendar_v3.Calendar;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate OAuth 2.0 authorization URL
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleCalendarCredentials> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain required tokens from Google');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date || undefined
      };
    } catch (error) {
      throw new Error(`Failed to exchange code for tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set credentials for the OAuth client
   */
  private setCredentials(connection: CalendarConnection): void {
    const decryptedAccessToken = decrypt(connection.accessToken);
    const decryptedRefreshToken = decrypt(connection.refreshToken);

    this.oauth2Client.setCredentials({
      access_token: decryptedAccessToken,
      refresh_token: decryptedRefreshToken,
      expiry_date: connection.expiresAt.getTime()
    });
  }

  /**
   * Refresh access token if needed
   */
  private async refreshTokenIfNeeded(connection: CalendarConnection): Promise<CalendarConnection> {
    if (connection.expiresAt > new Date()) {
      return connection; // Token is still valid
    }

    try {
      this.setCredentials(connection);
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      // Return updated connection with new tokens
      return {
        ...connection,
        accessToken: encrypt(credentials.access_token),
        expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000), // 1 hour default
        updatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's calendar list
   */
  async getCalendarList(connection: CalendarConnection): Promise<calendar_v3.Schema$CalendarListEntry[]> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    this.setCredentials(updatedConnection);

    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      throw new Error(`Failed to fetch calendar list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync events from Google Calendar
   */
  async syncEvents(
    connection: CalendarConnection, 
    calendarId: string = 'primary',
    syncToken?: string
  ): Promise<{ events: CalendarEvent[]; nextSyncToken?: string }> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    this.setCredentials(updatedConnection);

    try {
      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: new Date().toISOString(), // Only future events
        maxResults: 2500
      };

      if (syncToken) {
        params.syncToken = syncToken;
      }

      const response = await this.calendar.events.list(params);
      const googleEvents = response.data.items || [];

      const events: CalendarEvent[] = googleEvents
        .filter(event => event.start && event.end)
        .map(event => this.convertGoogleEventToCalendarEvent(event, connection.userId));

      return {
        events,
        nextSyncToken: response.data.nextSyncToken
      };
    } catch (error) {
      throw new Error(`Failed to sync events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create event in Google Calendar
   */
  async createEvent(
    connection: CalendarConnection,
    eventData: CreateCalendarEventRequest,
    calendarId: string = 'primary'
  ): Promise<string> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    this.setCredentials(updatedConnection);

    try {
      const googleEvent: calendar_v3.Schema$Event = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC'
        }
      };

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: googleEvent
      });

      if (!response.data.id) {
        throw new Error('Failed to create event - no ID returned');
      }

      return response.data.id;
    } catch (error) {
      throw new Error(`Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update event in Google Calendar
   */
  async updateEvent(
    connection: CalendarConnection,
    eventId: string,
    eventData: UpdateCalendarEventRequest,
    calendarId: string = 'primary'
  ): Promise<void> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    this.setCredentials(updatedConnection);

    try {
      const updateData: calendar_v3.Schema$Event = {};

      if (eventData.title !== undefined) updateData.summary = eventData.title;
      if (eventData.description !== undefined) updateData.description = eventData.description;
      if (eventData.startTime !== undefined) {
        updateData.start = {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC'
        };
      }
      if (eventData.endTime !== undefined) {
        updateData.end = {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC'
        };
      }

      await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: updateData
      });
    } catch (error) {
      throw new Error(`Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete event from Google Calendar
   */
  async deleteEvent(
    connection: CalendarConnection,
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<void> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    this.setCredentials(updatedConnection);

    try {
      await this.calendar.events.delete({
        calendarId,
        eventId
      });
    } catch (error) {
      throw new Error(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to calendar changes via webhook
   */
  async subscribeToChanges(
    connection: CalendarConnection,
    webhookUrl: string,
    calendarId: string = 'primary'
  ): Promise<GoogleCalendarWebhook> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    this.setCredentials(updatedConnection);

    try {
      const channelId = `momentum-${connection.userId}-${Date.now()}`;
      const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

      const response = await this.calendar.events.watch({
        calendarId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: connection.userId, // Use userId as token for verification
          expiration: expiration.toString()
        }
      });

      return {
        id: channelId,
        resourceId: response.data.resourceId || '',
        resourceUri: response.data.resourceUri || '',
        token: connection.userId,
        expiration: expiration.toString()
      };
    } catch (error) {
      throw new Error(`Failed to subscribe to changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop webhook subscription
   */
  async stopWebhookSubscription(channelId: string, resourceId: string): Promise<void> {
    try {
      await this.calendar.channels.stop({
        requestBody: {
          id: channelId,
          resourceId: resourceId
        }
      });
    } catch (error) {
      throw new Error(`Failed to stop webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Google Calendar event to our CalendarEvent format
   */
  private convertGoogleEventToCalendarEvent(
    googleEvent: calendar_v3.Schema$Event,
    userId: string
  ): CalendarEvent {
    const startTime = googleEvent.start?.dateTime 
      ? new Date(googleEvent.start.dateTime)
      : new Date(googleEvent.start?.date || '');
    
    const endTime = googleEvent.end?.dateTime
      ? new Date(googleEvent.end.dateTime)
      : new Date(googleEvent.end?.date || '');

    return {
      id: `google-${googleEvent.id}`,
      userId,
      externalId: googleEvent.id || '',
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description,
      startTime,
      endTime,
      isFlexible: false, // External events are firm by default
      source: 'google',
      createdAt: new Date(googleEvent.created || Date.now()),
      updatedAt: new Date(googleEvent.updated || Date.now())
    };
  }

  /**
   * Get user profile information
   */
  async getUserProfile(connection: CalendarConnection): Promise<{ email: string; name: string }> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    this.setCredentials(updatedConnection);

    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const response = await oauth2.userinfo.get();
      
      return {
        email: response.data.email || '',
        name: response.data.name || ''
      };
    } catch (error) {
      throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}