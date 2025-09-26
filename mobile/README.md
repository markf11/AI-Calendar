# Momentum Mobile App

A React Native mobile application for the Momentum AI-powered calendar and task management system.

## Features

### 📱 Touch-Optimized Calendar Interface
- **Daily Schedule View**: Focus on daily schedule with touch-optimized interface
- **Swipe Navigation**: Navigate between dates with intuitive swipe gestures
- **Visual Differentiation**: Clear distinction between firm events and flexible AI-scheduled tasks
- **Real-time Updates**: Live synchronization with backend scheduling changes

### 🎯 Task Management
- **Swipe Gestures**: Swipe right to complete tasks, left to edit
- **Quick Task Creation**: Fast task addition with voice-to-text support
- **Priority Visualization**: Color-coded priority system with visual indicators
- **Progress Tracking**: Visual progress bars and completion history

### 🎤 Voice Input
- **Voice-to-Text**: Create tasks using voice commands
- **Smart Recognition**: Intelligent parsing of task details from speech
- **Hands-free Operation**: Perfect for on-the-go task management

### 📴 Offline Capabilities
- **Essential Data Caching**: Critical schedule information available offline
- **Sync Queue**: Changes made offline are queued and synced when connected
- **Conflict Resolution**: Intelligent merging of offline and online changes

### 🔔 Push Notifications
- **Task Reminders**: Configurable reminders before scheduled tasks
- **Schedule Changes**: Notifications when AI reschedules your tasks
- **Deadline Alerts**: Critical alerts for approaching deadlines
- **Completion Celebrations**: Positive reinforcement for task completion

### 📍 Location Features
- **Travel Time Calculation**: Automatic travel time estimation between locations
- **Location-based Reminders**: Context-aware notifications based on your location
- **Smart Scheduling**: AI considers location when scheduling tasks

## Technical Architecture

### Technology Stack
- **React Native 0.72+**: Cross-platform mobile development
- **TypeScript**: Type-safe development
- **Zustand**: Lightweight state management with persistence
- **React Navigation**: Native navigation patterns
- **React Native Reanimated**: Smooth animations and gestures

### Key Dependencies
- `@react-navigation/native`: Navigation framework
- `react-native-gesture-handler`: Touch gesture handling
- `@react-native-voice/voice`: Voice recognition
- `react-native-push-notification`: Local and push notifications
- `@react-native-async-storage/async-storage`: Persistent storage
- `react-native-geolocation-service`: Location services
- `zustand`: State management

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── Calendar/       # Calendar-specific components
│   └── Tasks/          # Task management components
├── screens/            # Main application screens
├── services/           # Business logic and external integrations
├── store/              # State management
├── types/              # TypeScript type definitions
└── __tests__/          # Test files
```

## Getting Started

### Prerequisites
- Node.js 18+
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)

### Installation

1. **Install dependencies**:
   ```bash
   cd mobile
   npm install
   ```

2. **iOS Setup** (macOS only):
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Android Setup**:
   - Ensure Android SDK is installed
   - Create a virtual device in Android Studio

### Development

1. **Start Metro bundler**:
   ```bash
   npm start
   ```

2. **Run on Android**:
   ```bash
   npm run android
   ```

3. **Run on iOS**:
   ```bash
   npm run ios
   ```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check
```

## Key Components

### DailyCalendarView
Touch-optimized calendar view focused on daily schedule display with:
- Time grid layout optimized for mobile screens
- Visual differentiation between events and tasks
- Touch handlers for task and event interaction
- Smooth scrolling and responsive design

### TaskCard
Swipe-enabled task cards with:
- Swipe right to complete tasks
- Swipe left to edit tasks
- Visual progress indicators
- Priority and deadline visualization

### QuickTaskInput
Voice-enabled task creation with:
- Expandable input form
- Voice-to-text integration
- Smart defaults and validation
- Smooth animations

### CalendarScreen
Main screen combining:
- Calendar header with date navigation
- Daily calendar view
- Gesture handling for quick actions
- Offline state management

## Mobile-Specific Features

### Gesture Support
- **Swipe Navigation**: Navigate between dates
- **Swipe Actions**: Complete or edit tasks
- **Pull to Refresh**: Sync latest data
- **Pinch to Zoom**: Adjust calendar view (future feature)

### Voice Integration
- **Task Creation**: "Add task review code for 30 minutes high priority"
- **Voice Commands**: Natural language processing for task attributes
- **Hands-free Operation**: Perfect for driving or walking

### Offline Experience
- **Essential Data**: Schedule for next 7 days cached locally
- **Graceful Degradation**: Limited functionality when offline
- **Smart Sync**: Efficient synchronization when connection restored

### Push Notifications
- **Smart Timing**: Notifications respect user's schedule and preferences
- **Actionable**: Complete tasks directly from notifications
- **Contextual**: Location and time-aware notifications

## Performance Optimizations

### Memory Management
- **Lazy Loading**: Components loaded on demand
- **Image Optimization**: Efficient image caching and resizing
- **Memory Cleanup**: Proper cleanup of listeners and timers

### Battery Optimization
- **Background Sync**: Efficient background synchronization
- **Location Services**: Smart location tracking to preserve battery
- **Push Notifications**: Server-side scheduling to reduce local processing

### Network Efficiency
- **Delta Sync**: Only sync changed data
- **Compression**: Efficient data compression for mobile networks
- **Caching**: Intelligent caching strategies

## Accessibility

### Screen Reader Support
- **ARIA Labels**: Comprehensive labeling for screen readers
- **Semantic Structure**: Proper heading hierarchy and navigation
- **Voice Over**: Full iOS VoiceOver support
- **TalkBack**: Complete Android TalkBack integration

### Motor Accessibility
- **Large Touch Targets**: Minimum 44pt touch targets
- **Gesture Alternatives**: Alternative input methods for all gestures
- **Voice Control**: Full voice control support

### Visual Accessibility
- **High Contrast**: Support for high contrast themes
- **Font Scaling**: Responsive to system font size settings
- **Color Blind Friendly**: Accessible color palette

## Security

### Data Protection
- **Local Encryption**: Sensitive data encrypted at rest
- **Secure Storage**: Keychain/Keystore integration
- **Network Security**: Certificate pinning and secure transmission

### Privacy
- **Minimal Permissions**: Only request necessary permissions
- **Data Minimization**: Store only essential data locally
- **User Control**: Clear privacy controls and data management

## Deployment

### Android
```bash
# Generate signed APK
cd android
./gradlew assembleRelease
```

### iOS
```bash
# Archive for App Store
npx react-native run-ios --configuration Release
```

## Contributing

1. Follow the existing code style and patterns
2. Write tests for new features
3. Update documentation for API changes
4. Test on both iOS and Android platforms
5. Ensure accessibility compliance

## Troubleshooting

### Common Issues

**Metro bundler issues**:
```bash
npx react-native start --reset-cache
```

**Android build issues**:
```bash
cd android && ./gradlew clean && cd ..
```

**iOS build issues**:
```bash
cd ios && rm -rf Pods && pod install && cd ..
```

**Voice recognition not working**:
- Check microphone permissions
- Ensure device has speech recognition capability
- Test on physical device (simulator may not support voice)

### Performance Issues
- Use Flipper for debugging performance bottlenecks
- Monitor memory usage with React Native performance tools
- Profile with Xcode Instruments (iOS) or Android Studio Profiler

## Future Enhancements

### Planned Features
- **Widget Support**: Home screen widgets for quick schedule view
- **Apple Watch/Wear OS**: Companion apps for wearable devices
- **Siri/Google Assistant**: Voice assistant integration
- **AR Features**: Augmented reality for location-based tasks
- **Machine Learning**: On-device ML for better task predictions

### Technical Improvements
- **Code Push**: Over-the-air updates for faster deployment
- **Crash Analytics**: Advanced crash reporting and analytics
- **A/B Testing**: Feature flag system for gradual rollouts
- **Performance Monitoring**: Real-time performance tracking