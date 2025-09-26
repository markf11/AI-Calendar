import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAppStore} from '@/store/useAppStore';

export const SettingsScreen: React.FC = () => {
  const {user, isOffline, clearOfflineData} = useAppStore();

  const settingSections = [
    {
      title: 'Account',
      items: [
        {
          icon: 'person',
          title: 'Profile',
          subtitle: user?.name || 'Not signed in',
          onPress: () => console.log('Profile pressed'),
        },
        {
          icon: 'sync',
          title: 'Calendar Connections',
          subtitle: 'Manage Google Calendar & Microsoft 365',
          onPress: () => console.log('Calendar connections pressed'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: 'notifications',
          title: 'Notifications',
          subtitle: 'Task reminders and schedule changes',
          onPress: () => console.log('Notifications pressed'),
        },
        {
          icon: 'schedule',
          title: 'Working Hours',
          subtitle: 'Set your availability and breaks',
          onPress: () => console.log('Working hours pressed'),
        },
        {
          icon: 'priority-high',
          title: 'Priority Settings',
          subtitle: 'Configure task priority handling',
          onPress: () => console.log('Priority settings pressed'),
        },
      ],
    },
    {
      title: 'Data & Privacy',
      items: [
        {
          icon: 'cloud-off',
          title: 'Offline Data',
          subtitle: 'Manage cached data for offline use',
          onPress: () => console.log('Offline data pressed'),
        },
        {
          icon: 'security',
          title: 'Privacy & Security',
          subtitle: 'Data encryption and privacy settings',
          onPress: () => console.log('Privacy pressed'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help',
          title: 'Help & FAQ',
          subtitle: 'Get help with using Momentum',
          onPress: () => console.log('Help pressed'),
        },
        {
          icon: 'feedback',
          title: 'Send Feedback',
          subtitle: 'Help us improve the app',
          onPress: () => console.log('Feedback pressed'),
        },
        {
          icon: 'info',
          title: 'About',
          subtitle: 'Version 1.0.0',
          onPress: () => console.log('About pressed'),
        },
      ],
    },
  ];

  const renderSettingItem = (item: any) => (
    <TouchableOpacity
      key={item.title}
      style={styles.settingItem}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <Icon name={item.icon} size={20} color="#6B7280" />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{item.title}</Text>
          <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
      <Icon name="chevron-right" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {isOffline && (
          <View style={styles.offlineNotice}>
            <Icon name="cloud-off" size={20} color="#F59E0B" />
            <Text style={styles.offlineText}>
              You're currently offline. Some settings may not be available.
            </Text>
          </View>
        )}

        {settingSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map(renderSettingItem)}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={clearOfflineData}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Icon name="delete" size={20} color="#EF4444" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingTitle, {color: '#EF4444'}]}>
                    Clear Offline Data
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    Remove all cached data
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  offlineText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
});