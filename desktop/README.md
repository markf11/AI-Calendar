# Momentum Calendar Desktop Application

The desktop application for Momentum Calendar, built with Electron. Provides native system integration, offline capabilities, and enhanced productivity features.

## Features

### Native Integration
- **System Tray**: Quick access to calendar and tasks from the system tray
- **Global Shortcuts**: System-wide keyboard shortcuts for common actions
- **Native Notifications**: System notifications for schedule changes and reminders
- **Auto-start**: Option to start with the operating system
- **Menu Bar Integration**: Native menu bar integration on macOS

### Offline Capabilities
- **Local Data Caching**: Store schedule data locally for offline viewing
- **Sync Queue**: Queue changes made while offline for synchronization when online
- **Conflict Resolution**: Intelligent conflict resolution when merging offline/online changes
- **Background Sync**: Automatic synchronization when network connection is restored

### Desktop-Specific Features
- **Window Management**: Remember window position and size
- **Focus Mode**: Distraction-free mode for productivity
- **Quick Task Dialog**: Global shortcut to quickly add tasks
- **System Integration**: Deep integration with operating system features

## Installation

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Build the application:
```bash
npm run build
```

3. Start in development mode:
```bash
npm run dev
```

### Production Build

Build for all platforms:
```bash
npm run dist
```

Build for specific platforms:
```bash
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

## Architecture

### Main Process (`src/main.ts`)
The main Electron process that manages:
- Application lifecycle
- Window creation and management
- System tray and global shortcuts
- IPC communication with renderer process

### Services
- **NotificationManager**: Handles system notifications and alerts
- **OfflineDataManager**: Manages local data storage and sync queue
- **SystemTrayManager**: System tray integration and context menu
- **GlobalShortcutManager**: Global keyboard shortcuts
- **WindowManager**: Window state management
- **ConfigManager**: Application configuration and preferences

### Preload Script (`src/preload.ts`)
Secure bridge between main and renderer processes, exposing:
- Notification API
- Offline data operations
- Configuration management
- System integration features

## Global Shortcuts

Default keyboard shortcuts (customizable):

- `Ctrl+Shift+M` (Cmd+Shift+M on macOS): Toggle main window
- `Ctrl+Shift+N` (Cmd+Shift+N on macOS): Quick task creation
- `Ctrl+Shift+T` (Cmd+Shift+T on macOS): Show today's schedule
- `Ctrl+Shift+F` (Cmd+Shift+F on macOS): Toggle focus mode
- `Ctrl+Shift+S` (Cmd+Shift+S on macOS): Quick search

## Configuration

The application stores configuration in:
- **Windows**: `%APPDATA%/momentum-calendar-desktop/`
- **macOS**: `~/Library/Application Support/momentum-calendar-desktop/`
- **Linux**: `~/.config/momentum-calendar-desktop/`

### Configuration Options

```typescript
interface AppConfig {
  // Window settings
  windowState?: WindowState;
  minimizeToTray?: boolean;
  closeToTray?: boolean;
  startMinimized?: boolean;
  
  // Startup settings
  openAtLogin?: boolean;
  startHidden?: boolean;
  
  // Notification settings
  enableNotifications?: boolean;
  notificationSound?: boolean;
  taskReminders?: boolean;
  scheduleChangeNotifications?: boolean;
  deadlineAlerts?: boolean;
  
  // Sync settings
  offlineMode?: boolean;
  syncInterval?: number;
  autoSync?: boolean;
  
  // UI settings
  theme?: 'light' | 'dark' | 'system';
  fontSize?: 'small' | 'medium' | 'large';
  compactMode?: boolean;
  
  // Keyboard shortcuts
  globalShortcuts?: { [action: string]: string };
}
```

## Offline Data Management

### Data Storage
- Local SQLite database for offline data
- Automatic sync queue for changes made while offline
- Conflict detection and resolution

### Sync Process
1. **Online**: Changes are immediately synced to server
2. **Offline**: Changes are queued locally
3. **Reconnection**: Queued changes are synced automatically
4. **Conflicts**: User is prompted to resolve conflicts

### Conflict Resolution Strategies
- **Local**: Keep local changes
- **Remote**: Accept server changes
- **Merge**: Intelligent merge of both versions

## System Tray Integration

### Tray Icon States
- **Normal**: Default state
- **Notification**: Indicates pending notifications or alerts
- **Offline**: Shows when application is in offline mode

### Context Menu
- Current schedule status
- Quick actions (add task, view schedule)
- Application preferences
- Quit option

## Notifications

### Notification Types
- **Task Reminders**: Alerts before tasks start
- **Schedule Changes**: When AI reschedules tasks
- **Deadline Alerts**: Approaching or missed deadlines
- **Sync Status**: Offline/online status changes

### Notification Actions
- **View**: Open main window to relevant section
- **Snooze**: Delay reminder notifications
- **Complete**: Mark tasks as completed
- **Reschedule**: Open rescheduling dialog

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

### Test Structure
- **Unit Tests**: Individual service and component testing
- **Integration Tests**: Cross-service functionality
- **E2E Tests**: Full application workflow testing

## Security

### Electron Security Best Practices
- Context isolation enabled
- Node integration disabled in renderer
- Secure preload script
- Content Security Policy
- No remote module access

### Data Security
- Local data encryption at rest
- Secure API communication
- Token storage in secure keychain

## Performance

### Optimization Strategies
- Lazy loading of services
- Efficient data caching
- Background sync processing
- Memory management for long-running processes

### Resource Usage
- Minimal CPU usage when idle
- Efficient memory management
- Optimized disk I/O for sync operations

## Troubleshooting

### Common Issues

1. **Global shortcuts not working**
   - Check if shortcuts are already registered by other applications
   - Verify shortcut format in configuration

2. **Notifications not appearing**
   - Check system notification permissions
   - Verify notification settings in app configuration

3. **Sync issues**
   - Check network connectivity
   - Verify API credentials
   - Check sync queue for failed items

4. **Performance issues**
   - Check available system resources
   - Review sync interval settings
   - Clear local cache if corrupted

### Debug Mode
Enable debug mode in configuration to get detailed logging:
```typescript
{
  "debugMode": true
}
```

## Contributing

1. Follow TypeScript and ESLint configurations
2. Write tests for new features
3. Update documentation for API changes
4. Test on multiple platforms before submitting

## License

MIT License - see LICENSE file for details.