import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {CalendarScreen} from '@/screens/CalendarScreen';
import {TasksScreen} from '@/screens/TasksScreen';
import {ProjectsScreen} from '@/screens/ProjectsScreen';
import {SettingsScreen} from '@/screens/SettingsScreen';
import {useAppStore} from '@/store/useAppStore';
import {OfflineManager} from '@/services/OfflineManager';
import {NotificationManager} from '@/services/NotificationManager';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Calendar':
              iconName = 'calendar-today';
              break;
            case 'Tasks':
              iconName = 'assignment';
              break;
            case 'Projects':
              iconName = 'folder';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Calendar" 
        component={CalendarScreen}
        options={{
          tabBarLabel: 'Calendar',
        }}
      />
      <Tab.Screen 
        name="Tasks" 
        component={TasksScreen}
        options={{
          tabBarLabel: 'Tasks',
        }}
      />
      <Tab.Screen 
        name="Projects" 
        component={ProjectsScreen}
        options={{
          tabBarLabel: 'Projects',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

const App: React.FC = () => {
  const {loadOfflineData, setOffline} = useAppStore();

  useEffect(() => {
    // Initialize app services
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Load offline data
      await loadOfflineData();
      
      // Initialize offline manager
      OfflineManager.initialize();
      
      // Initialize notifications
      await NotificationManager.initialize();
      
      // Check network status
      const isConnected = await OfflineManager.checkNetworkStatus();
      setOffline(!isConnected);
      
      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  };

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Main" component={TabNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
};

export default App;