// @ts-nocheck
import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication, AuthenticationResult } from '@azure/msal-node';
import { config } from '@/config/environment';
import { CalendarEvent, CreateCalendarEventRequest, UpdateCalendarEventRequest } from '@/models/CalendarEvent';
import { CalendarConnection, SyncResult } from '@/models/types';
import { encrypt, decrypt } from '@/utils/encryption';

export interface MicrosoftGraphCredentials {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
}

export interface MicrosoftGraphWebhook {
  id: string;
  resource: string;
  changeType: string;
  clientState?: string;
  notificationUrl: string;
  expirationDateTime: string;
}

/**
 * Custom authentication provider for Microsoft Graph
 */
class CustomAuthProvider implements AuthenticationProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

export class MicrosoftGraphService {
  private msalClient: ConfidentialClientApplication;

  constructor() {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.microsoft.clientId,
        clientSecret: config.microsoft.clientSecret,
        authority: `https://login.microsoftonline.com/${config.microsoft.tenantId}`
      }
    });
  }

  /**
   * Generate OAuth 2.0 authorization URL
   */
  async getAuthUrl(): Promise<string> {
    const authCodeUrlParameters = {
      scopes: [
        'https://graph.microsoft.com/Calendars.ReadWrite',
        'https://graph.microsoft.com/User.Read',
        'offline_access'
      ],
      redirectUri: config.microsoft.redirectUri,
    };

    return await this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<MicrosoftGraphCredentials> {
    try {
      const tokenRequest = {
        code,
        scopes: [
          'https://graph.microsoft.com/Calendars.ReadWrite',
          'https://graph.microsoft.com/User.Read',
          'offline_access'
        ],
        redirectUri: config.microsoft.redirectUri,
      };

      const response: AuthenticationResult = await this.msalClient.acquireTokenByCode(tokenRequest);
      
      if (!response.accessToken || !response.refreshToken) {
        throw new Error('Failed to obtain required tokens from Microsoft');
      }

      return {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiryDate: response.expiresOn?.getTime()
      };
    } catch (error) {
      throw new Error(`Failed to exchange code for tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create Microsoft Graph client with authentication
   */
  private createGraphClient(accessToken: string): Client {
    const authProvider = new CustomAuthProvider(accessToken);
    return Client.initWithMiddleware({ authProvider });
  }

  /**
   * Refresh access token if needed
   */
  private async refreshTokenIfNeeded(connection: CalendarConnection): Promise<CalendarConnection> {
    if (connection.expiresAt > new Date()) {
      return connection; // Token is still valid
    }

    try {
      const decryptedRefreshToken = decrypt(connection.refreshToken);
      
      const refreshTokenRequest = {
        refreshToken: decryptedRefreshToken,
        scopes: [
          'https://graph.microsoft.com/Calendars.ReadWrite',
          'https://graph.microsoft.com/User.Read',
          'offline_access'
        ],
      };

      const response: AuthenticationResult = await this.msalClient.acquireTokenByRefreshToken(refreshTokenRequest);
      
      if (!response.accessToken) {
        throw new Error('Failed to refresh access token');
      }

      // Return updated connection with new tokens
      return {
        ...connection,
        accessToken: encrypt(response.accessToken),
        refreshToken: response.refreshToken ? encrypt(response.refreshToken) : connection.refreshToken,
        expiresAt: new Date(response.expiresOn?.getTime() || Date.now() + 3600000), // 1 hour default
        updatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's calendar list
   */
  async getCalendarList(connection: CalendarConnection): Promise<any[]> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    const decryptedAccessToken = decrypt(updatedConnection.accessToken);
    const graphClient = this.createGraphClient(decryptedAccessToken);

    try {
      const calendars = await graphClient.api('/me/calendars').get();
      return calendars.value || [];
    } catch (error) {
      throw new Error(`Failed to fetch calendar list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync events from Microsoft Calendar
   */
  async syncEvents(
    connection: CalendarConnection, 
    calendarId: string = 'primary',
    deltaToken?: string
  ): Promise<{ events: CalendarEvent[]; nextDeltaToken?: string }> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    const decryptedAccessToken = decrypt(updatedConnection.accessToken);
    const graphClient = this.createGraphClient(decryptedAccessToken);

    try {
      let apiUrl = `/me/calendar/events`;
      if (calendarId !== 'primary') {
        apiUrl = `/me/calendars/${calendarId}/events`;
      }

      // Add query parameters
      const queryParams = new URLSearchParams({
        '$select': 'id,subject,body,start,end,createdDateTime,lastModifiedDateTime,isAllDay',
        '$orderby': 'start/dateTime',
        '$filter': `start/dateTime ge '${new Date().toISOString()}'`, // Only future events
        '$top': '1000'
      });

      if (deltaToken) {
        queryParams.set('$deltatoken', deltaToken);
      }

      const response = await graphClient.api(`${apiUrl}?${queryParams.toString()}`).get();
      const microsoftEvents = response.value || [];

      const events: CalendarEvent[] = microsoftEvents
        .filter((event: any) => event.start && event.end)
        .map((event: any) => this.convertMicrosoftEventToCalendarEvent(event, connection.userId));

      return {
        events,
        nextDeltaToken: response['@odata.deltaLink'] ? this.extractDeltaToken(response['@odata.deltaLink']) : undefined
      };
    } catch (error) {
      throw new Error(`Failed to sync events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create event in Microsoft Calendar
   */
  async createEvent(
    connection: CalendarConnection,
    eventData: CreateCalendarEventRequest,
    calendarId: string = 'primary'
  ): Promise<string> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    const decryptedAccessToken = decrypt(updatedConnection.accessToken);
    const graphClient = this.createGraphClient(decryptedAccessToken);

    try {
      const microsoftEvent = {
        subject: eventData.title,
        body: {
          contentType: 'text',
          content: eventData.description || ''
        },
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC'
        }
      };

      let apiUrl = '/me/calendar/events';
      if (calendarId !== 'primary') {
        apiUrl = `/me/calendars/${calendarId}/events`;
      }

      const response = await graphClient.api(apiUrl).post(microsoftEvent);

      if (!response.id) {
        throw new Error('Failed to create event - no ID returned');
      }

      return response.id;
    } catch (error) {
      throw new Error(`Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update event in Microsoft Calendar
   */
  async updateEvent(
    connection: CalendarConnection,
    eventId: string,
    eventData: UpdateCalendarEventRequest,
    calendarId: string = 'primary'
  ): Promise<void> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    const decryptedAccessToken = decrypt(updatedConnection.accessToken);
    const graphClient = this.createGraphClient(decryptedAccessToken);

    try {
      const updateData: any = {};

      if (eventData.title !== undefined) updateData.subject = eventData.title;
      if (eventData.description !== undefined) {
        updateData.body = {
          contentType: 'text',
          content: eventData.description
        };
      }
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

      let apiUrl = `/me/calendar/events/${eventId}`;
      if (calendarId !== 'primary') {
        apiUrl = `/me/calendars/${calendarId}/events/${eventId}`;
      }

      await graphClient.api(apiUrl).patch(updateData);
    } catch (error) {
      throw new Error(`Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete event from Microsoft Calendar
   */
  async deleteEvent(
    connection: CalendarConnection,
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<void> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    const decryptedAccessToken = decrypt(updatedConnection.accessToken);
    const graphClient = this.createGraphClient(decryptedAccessToken);

    try {
      let apiUrl = `/me/calendar/events/${eventId}`;
      if (calendarId !== 'primary') {
        apiUrl = `/me/calendars/${calendarId}/events/${eventId}`;
      }

      await graphClient.api(apiUrl).delete();
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
  ): Promise<MicrosoftGraphWebhook> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    const decryptedAccessToken = decrypt(updatedConnection.accessToken);
    const graphClient = this.createGraphClient(decryptedAccessToken);

    try {
      let resource = '/me/calendar/events';
      if (calendarId !== 'primary') {
        resource = `/me/calendars/${calendarId}/events`;
      }

      const expirationDateTime = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)); // 3 days
      
      const subscription = {
        changeType: 'created,updated,deleted',
        notificationUrl: webhookUrl,
        resource: resource,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: connection.userId // Use userId as client state for verification
      };

      const response = await graphClient.api('/subscriptions').post(subscription);

      return {
        id: response.id,
        resource: response.resource,
        changeType: response.changeType,
        clientState: response.clientState,
        notificationUrl: response.notificationUrl,
        expirationDateTime: response.expirationDateTime
      };
    } catch (error) {
      throw new Error(`Failed to subscribe to changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop webhook subscription
   */
  async stopWebhookSubscription(subscriptionId: string, connection: CalendarConnection): Promise<void> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    const decryptedAccessToken = decrypt(updatedConnection.accessToken);
    const graphClient = this.createGraphClient(decryptedAccessToken);

    try {
      await graphClient.api(`/subscriptions/${subscriptionId}`).delete();
    } catch (error) {
      throw new Error(`Failed to stop webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Microsoft Graph event to our CalendarEvent format
   */
  private convertMicrosoftEventToCalendarEvent(
    microsoftEvent: any,
    userId: string
  ): CalendarEvent {
    const startTime = new Date(microsoftEvent.start.dateTime || microsoftEvent.start.date);
    const endTime = new Date(microsoftEvent.end.dateTime || microsoftEvent.end.date);

    return {
      id: `microsoft-${microsoftEvent.id}`,
      userId,
      externalId: microsoftEvent.id,
      title: microsoftEvent.subject || 'Untitled Event',
      description: microsoftEvent.body?.content,
      startTime,
      endTime,
      isFlexible: false, // External events are firm by default
      source: 'microsoft',
      createdAt: new Date(microsoftEvent.createdDateTime || Date.now()),
      updatedAt: new Date(microsoftEvent.lastModifiedDateTime || Date.now())
    };
  }

  /**
   * Get user profile information
   */
  async getUserProfile(connection: CalendarConnection): Promise<{ email: string; name: string }> {
    const updatedConnection = await this.refreshTokenIfNeeded(connection);
    const decryptedAccessToken = decrypt(updatedConnection.accessToken);
    const graphClient = this.createGraphClient(decryptedAccessToken);

    try {
      const user = await graphClient.api('/me').select('mail,displayName,userPrincipalName').get();
      
      return {
        email: user.mail || user.userPrincipalName || '',
        name: user.displayName || ''
      };
    } catch (error) {
      throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract delta token from OData delta link
   */
  private extractDeltaToken(deltaLink: string): string | undefined {
    const url = new URL(deltaLink);
    return url.searchParams.get('$deltatoken') || undefined;
  }
}