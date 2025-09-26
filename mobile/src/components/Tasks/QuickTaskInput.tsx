import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Voice from '@react-native-voice/voice';
import {useAppStore} from '@/store/useAppStore';
import {Task} from '@/types';

interface QuickTaskInputProps {
  onTaskCreate: (task: Partial<Task>) => void;
  onClose?: () => void;
  placeholder?: string;
}

export const QuickTaskInput: React.FC<QuickTaskInputProps> = ({
  onTaskCreate,
  onClose,
  placeholder = "What do you need to do?",
}) => {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [duration, setDuration] = useState('30');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  
  const {
    isListening,
    voiceText,
    setVoiceListening,
    setVoiceText,
    clearVoiceText,
  } = useAppStore();

  const inputRef = useRef<TextInput>(null);
  const expandAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  useEffect(() => {
    if (voiceText) {
      setText(voiceText);
      clearVoiceText();
    }
  }, [voiceText, clearVoiceText]);

  const onSpeechStart = () => {
    setVoiceListening(true);
  };

  const onSpeechEnd = () => {
    setVoiceListening(false);
  };

  const onSpeechResults = (event: any) => {
    const result = event.value?.[0];
    if (result) {
      setVoiceText(result);
    }
  };

  const onSpeechError = (event: any) => {
    setVoiceListening(false);
    Alert.alert('Voice Error', 'Failed to recognize speech. Please try again.');
  };

  const startVoiceRecognition = async () => {
    try {
      await Voice.start('en-US');
    } catch (error) {
      Alert.alert('Voice Error', 'Voice recognition is not available on this device.');
    }
  };

  const stopVoiceRecognition = async () => {
    try {
      await Voice.stop();
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  const handleVoicePress = () => {
    if (isListening) {
      stopVoiceRecognition();
    } else {
      startVoiceRecognition();
    }
  };

  const handleExpand = () => {
    setIsExpanded(true);
    Animated.timing(expandAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleCollapse = () => {
    Animated.timing(expandAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsExpanded(false);
    });
  };

  const handleSubmit = () => {
    if (!text.trim()) {
      Alert.alert('Error', 'Please enter a task title.');
      return;
    }

    const durationMinutes = parseInt(duration, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      Alert.alert('Error', 'Please enter a valid duration.');
      return;
    }

    const newTask: Partial<Task> = {
      title: text.trim(),
      duration: durationMinutes,
      priority,
      status: 'pending',
      isBlocking: false,
      isHardDeadline: false,
      dependencies: [],
      dependents: [],
      completedMinutes: 0,
      remainingMinutes: durationMinutes,
      scheduledSlots: [],
      completionHistory: [],
    };

    onTaskCreate(newTask);
    setText('');
    setDuration('30');
    setPriority('medium');
    handleCollapse();
    onClose?.();
  };

  const handleCancel = () => {
    setText('');
    setDuration('30');
    setPriority('medium');
    handleCollapse();
    onClose?.();
  };

  const getPriorityColor = (p: string): string => {
    switch (p) {
      case 'critical':
        return '#DC2626';
      case 'high':
        return '#EA580C';
      case 'medium':
        return '#D97706';
      case 'low':
        return '#65A30D';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          onFocus={handleExpand}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        
        <TouchableOpacity
          style={[
            styles.voiceButton,
            isListening && styles.voiceButtonActive,
          ]}
          onPress={handleVoicePress}
          activeOpacity={0.7}
        >
          <Icon
            name={isListening ? "mic" : "mic-none"}
            size={20}
            color={isListening ? "#FFFFFF" : "#6B7280"}
          />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.expandedOptions,
          {
            maxHeight: expandAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 200],
            }),
            opacity: expandAnimation,
          },
        ]}
      >
        {isExpanded && (
          <>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Duration (minutes):</Text>
              <TextInput
                style={styles.durationInput}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Priority:</Text>
              <View style={styles.priorityButtons}>
                {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityButton,
                      priority === p && {backgroundColor: getPriorityColor(p)},
                    ]}
                    onPress={() => setPriority(p)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.priorityButtonText,
                        priority === p && styles.priorityButtonTextActive,
                      ]}
                    >
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleSubmit}
                activeOpacity={0.7}
              >
                <Text style={styles.createButtonText}>Create Task</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>

      {isListening && (
        <View style={styles.listeningIndicator}>
          <View style={styles.listeningDot} />
          <Text style={styles.listeningText}>Listening...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 0,
    minHeight: 40,
    maxHeight: 100,
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  voiceButtonActive: {
    backgroundColor: '#EF4444',
  },
  expandedOptions: {
    overflow: 'hidden',
  },
  optionRow: {
    marginTop: 16,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  durationInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#111827',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  priorityButtonTextActive: {
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  listeningText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
});