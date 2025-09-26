# Calendar Synchronization Service

## Overview

The Calendar Synchronization Service provides bi-directional synchronization between external calendar providers (Google Calendar and Microsoft 365) and the local Momentum database. It includes conflict resolution, real-time webhook handling, and comprehensive error management.

## Features

### Core Synchronization
- **Bi-directional Sync**: Synchronizes events between external calendars and local database
- **Multiple Providers**: Supports Google Calendar and Microsoft 365 Calendar
- **Incremental Sync**: Uses sync tokens/delta tokens for efficient incremental updates
- **Full Sync**: Option to perform complete synchronization when needed

### Conflict Resolution
- **Automatic Detection**: Identifies time overlaps and conflicting events
- **Resolution Strategies**: Configurable conflict resolution (keep local, keep external, manual review)
- **Flexible vs Firm Events**: Distinguishes between AI-schedulable tasks and fixed calendar events

### Real-time Updates
- **Webhook Support**: Handles real-time notifications from external calendar providers
- **Immediate Sync**: Triggers synchronization within seconds of external changes
- **Validation**: Verifies webhook authenticity and handles validation requests

### Error Handling
- **Graceful Degradation**: Continues operation even when some calendars fail to sync
- **Retry Logic**: Implements exponential backoff for transient failures
- **Comprehensive Logging**: Detailed error reporting and status tracking

## API Endpoints

### Synchronization Endpoints

#### Sync User Calendars
```http
POST /api/calendar-sync/sync
Authorization: Bearer <token>
Content-Type: application/json

Query Parameters:
- fullSync: boolean (optional) - Perform full synchronization
- resolveConflicts: boolean (optional) - Automatically resolve conflicts
- dryRun: boolean (optional) - Preview changes without applying them
```

#### Force Full Sync
```http
POST /api/calendar-sync/force-sync
Authorization: Bearer <token>
```

#### Get Sync Status
```http
GET /api/calendar-sync/status
Authorization: Bearer <token>
```

#### Detect Conflicts
```http
GET /api/calendar-sync/conflicts/{provider}
Authorization: Bearer <token>

Parameters:
- provider: "google" | "microsoft"
```

#### Push Local Changes
```http
POST /api/calendar-sync/push/{provider}
Authorization: Bearer <token>

Parameters:
- provider: "google" | "microsoft"
```

### Webhook Endpoints

#### Google Calendar Webhook
```http
POST /api/webhooks/google
Content-Type: application/json

Headers:
- x-goog-channel-id: string
- x-goog-channel-token: string (user ID)
- x-goog-resource-id: string
- x-goog-resource-uri: string
- x-goog-resource-state: "exists" | "not_exists" | "sync"
```

#### Microsoft Graph Webhook
```http
POST /api/webhooks/microsoft
Content-Type: application/json

Body:
{
  "value": [
    {
      "subscriptionId": "string",
      "clientState": "string",
      "resource": "string",
      "resourceData": {
        "@odata.type": "string",
        "@odata.id": "string",
        "id": "string"
      },
      "changeType": "created" | "updated" | "deleted"
    }
  ]
}
```

## Service Classes

### CalendarSyncService

Main service class that orchestrates calendar synchronization.

#### Key Methods

- `syncUserCalendars(userId, options)`: Sync all calendars for a user
- `syncCalendar(connection, options)`: Sync a specific calendar connection
- `detectConflicts(userId, provider)`: Detect scheduling conflicts
- `pushLocalChanges(userId, provider)`: Push local events to external calendar
- `getSyncStatus(key)`: Get current sync status

#### Configuration Options

```typescript
interface SyncOptions {
  fullSync?: boolean;        // Perform complete sync vs incremental
  dateRange?: DateRange;     // Limit sync to specific date range
  resolveConflicts?: boolean; // Automatically resolve conflicts
  dryRun?: boolean;          // Preview changes without applying
}
```

### CalendarWebhookService

Handles real-time webhook notifications from external calendar providers.

#### Key Methods

- `handleGoogleWebhook(payload)`: Process Google Calendar notifications
- `handleMicrosoftWebhook(payload)`: Process Microsoft Graph notifications
- `setupWebhookSubscriptions(userId, webhookBaseUrl)`: Setup webhook subscriptions
- `handleWebhookValidation(token)`: Handle Microsoft webhook validation

## Data Models

### SyncStatus
```typescript
interface SyncStatus {
  userId: string;
  provider: CalendarSource;
  lastSyncAt: Date;
  nextSyncToken?: string;
  status: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
  eventsCount: number;
}
```

### SyncResult
```typescript
interface SyncResult {
  success: boolean;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errors: string[];
}
```

### SyncConflict
```typescript
interface SyncConflict {
  type: 'duplicate' | 'time_overlap' | 'external_modification';
  localEvent?: CalendarEvent;
  externalEvent?: any;
  description: string;
  resolution: 'keep_local' | 'keep_external' | 'merge' | 'manual_review';
}
```

## Synchronization Flow

### Initial Sync
1. User connects external calendar account
2. System performs full sync to import existing events
3. Webhook subscriptions are established for real-time updates
4. Local events are marked as firm (non-flexible) by default

### Incremental Sync
1. External calendar change triggers webhook notification
2. Webhook service validates notification and extracts user ID
3. Sync service performs incremental sync using stored sync tokens
4. Changes are applied to local database
5. AI scheduling engine is notified of calendar changes

### Conflict Resolution
1. System detects overlapping events during sync
2. Conflicts are categorized by type and severity
3. Automatic resolution applied based on configuration
4. Manual review required for complex conflicts
5. User is notified of resolution actions taken

## Error Handling

### Common Error Scenarios
- **API Rate Limiting**: Exponential backoff and retry logic
- **Token Expiration**: Automatic token refresh using refresh tokens
- **Network Failures**: Graceful degradation and retry mechanisms
- **Data Conflicts**: Configurable conflict resolution strategies
- **Webhook Failures**: Error logging and manual sync fallback

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information",
  "code": "ERROR_CODE",
  "retryable": true
}
```

## Security Considerations

### Authentication
- All API endpoints require valid JWT authentication
- Webhook endpoints validate provider-specific signatures
- User isolation ensures data privacy between accounts

### Data Protection
- Calendar tokens encrypted at rest using AES-256-GCM
- Secure transmission using HTTPS/TLS
- Minimal data retention and automatic cleanup

### Access Control
- Users can only sync their own calendar connections
- Webhook notifications verified against stored user tokens
- Rate limiting prevents abuse and DoS attacks

## Performance Optimization

### Caching Strategy
- Sync status cached in memory for quick access
- Frequently accessed calendar data cached in Redis
- Incremental sync tokens stored for efficient updates

### Batch Operations
- Bulk database operations for large sync operations
- Batched API requests to external providers
- Parallel processing of multiple calendar connections

### Monitoring
- Sync performance metrics and timing
- Error rates and failure patterns
- Webhook delivery success rates

## Testing

### Unit Tests
- Service method functionality
- Conflict detection algorithms
- Error handling scenarios
- Webhook payload validation

### Integration Tests
- End-to-end sync workflows
- External API integration (mocked)
- Database operations
- Real-time webhook processing

### Test Coverage
- Target: 90%+ code coverage
- Focus on critical sync logic
- Edge cases and error conditions
- Performance under load

## Deployment Considerations

### Environment Variables
```bash
# Google Calendar API
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri

# Microsoft Graph API
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_TENANT_ID=your_tenant_id
MICROSOFT_REDIRECT_URI=your_redirect_uri

# Webhook Configuration
WEBHOOK_BASE_URL=https://your-domain.com/api
```

### Webhook Setup
1. Configure webhook endpoints in external provider consoles
2. Ensure HTTPS endpoints are accessible from internet
3. Set up proper DNS and SSL certificates
4. Configure firewall rules for webhook traffic

### Monitoring and Alerts
- Set up monitoring for sync success rates
- Alert on high error rates or sync failures
- Monitor webhook delivery and processing times
- Track API rate limit usage and quotas

## Future Enhancements

### Planned Features
- Support for additional calendar providers (Outlook.com, iCloud)
- Advanced conflict resolution with user preferences
- Bulk operations for enterprise customers
- Enhanced analytics and reporting
- Mobile push notifications for sync events

### Performance Improvements
- Distributed sync processing for high-volume users
- Advanced caching strategies
- Optimized database queries and indexing
- Webhook delivery optimization and retry logic