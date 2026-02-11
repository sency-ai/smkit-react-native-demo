import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SmkitCameraView,
  configure,
  type ExerciseSummary,
  type JointData,
  type MovementFeedbackData,
  type SmkitCameraViewRef,
} from '@sency/react-native-smkit';
import CameraWindow from './components/CameraWindow';
import SkeletonOverlay from './components/SkeletonOverlay';
import StatsPanel from './components/StatsPanel';
import { Colors, Spacing, Typography } from './theme';

const API_KEY = 'YOUR_API_KEY_HERE';

const EXERCISES = [
  'Squat',
  'Pushup',
  'JumpingJacks',
  'Plank',
  'HighKnees',
] as const;

type ExerciseLabel = (typeof EXERCISES)[number];

const EXERCISE_TYPE_MAP: Record<ExerciseLabel, string> = {
  Squat: 'SquatRegular',
  Pushup: 'PushupRegular',
  JumpingJacks: 'JumpingJacks',
  Plank: 'PlankHighStatic',
  HighKnees: 'HighKnees',
};

const isStaticExercise = (exerciseName: ExerciseLabel): boolean => {
  const nativeType = EXERCISE_TYPE_MAP[exerciseName] || '';
  return nativeType.includes('Static');
};

interface AppState {
  isConfiguring: boolean;
  didConfig: boolean;
  configError: string | null;
  selectedExercise: ExerciseLabel;
  userHeight: string;
  sessionStarted: boolean;
  nativeViewReady: boolean;
  previewReady: boolean;
  isDetecting: boolean;
  isInPosition: boolean;
  repCount: number;
  feedback: string;
  formScore: number;
  elapsedTime: number;
  jointData: JointData | null;
  error: string | null;
}

export default function App() {
  const cameraRef = useRef<SmkitCameraViewRef>(null);

  const [state, setState] = useState<AppState>({
    isConfiguring: true,
    didConfig: false,
    configError: null,
    selectedExercise: 'Squat',
    userHeight: '175',
    sessionStarted: false,
    nativeViewReady: false,
    previewReady: false,
    isDetecting: false,
    isInPosition: false,
    repCount: 0,
    feedback: '',
    formScore: 0,
    elapsedTime: 0,
    jointData: null,
    error: null,
  });

  useEffect(() => {
    const autoConfig = async () => {
      try {
        if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
          setState(prev => ({
            ...prev,
            isConfiguring: false,
            configError: 'Please set your SMKit API key in App.tsx',
          }));
          return;
        }

        await configure(API_KEY);
        setState(prev => ({
          ...prev,
          isConfiguring: false,
          didConfig: true,
        }));
      } catch (e) {
        setState(prev => ({
          ...prev,
          isConfiguring: false,
          configError: `Configuration failed: ${String(e)}`,
        }));
      }
    };

    autoConfig();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (state.isDetecting) {
      interval = setInterval(() => {
        setState(prev => ({
          ...prev,
          elapsedTime: prev.elapsedTime + 1,
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.isDetecting]);

  useEffect(() => {
    if (!state.sessionStarted || !state.nativeViewReady) return;
    cameraRef.current?.startSession?.();
  }, [state.sessionStarted, state.nativeViewReady]);

  const handleDetectionData = (data: MovementFeedbackData) => {
    if (data.didFinishMovement) {
      setState(prev => ({
        ...prev,
        repCount: prev.repCount + 1,
      }));
    }

    const feedbackText = data.feedback?.[0] || '';

    setState(prev => ({
      ...prev,
      feedback: feedbackText,
      isInPosition: data.isInPosition,
      formScore: Math.round(data.techniqueScore || 0),
    }));
  };

  const handlePositionData = (data: JointData) => {
    setState(prev => ({
      ...prev,
      jointData: data,
    }));
  };

  const handleDetectionStopped = (summary: ExerciseSummary) => {
    setState(prev => ({
      ...prev,
      isDetecting: false,
    }));
    console.log('[SMKit] Detection summary:', summary);
  };

  const handlePreviewReady = () => {
    setState(prev => ({
      ...prev,
      previewReady: true,
      error: null,
    }));
  };

  const handleError = (errorMsg: string) => {
    setState(prev => ({
      ...prev,
      error: errorMsg,
    }));
  };

  const startSessionAndPreview = () => {
    setState(prev => ({
      ...prev,
      error: null,
      nativeViewReady: false,
      previewReady: false,
      sessionStarted: true,
    }));
  };

  const handleCameraLayout = () => {
    setState(prev => ({
      ...prev,
      nativeViewReady: true,
    }));
  };

  const startDetectionSession = () => {
    if (!state.sessionStarted) {
      setState(prev => ({
        ...prev,
        error: 'Session not started. Tap "Start Session" first.',
      }));
      return;
    }
    if (!state.previewReady) {
      setState(prev => ({
        ...prev,
        error: 'Camera not ready yet. Waiting for preview...',
      }));
      return;
    }
    const nativeExerciseType = EXERCISE_TYPE_MAP[state.selectedExercise];

    setState(prev => ({
      ...prev,
      error: null,
      isDetecting: true,
    }));

    cameraRef.current?.startDetection?.(nativeExerciseType);
  };

  const stopDetection = () => {
    cameraRef.current?.stopDetection?.();
    setState(prev => ({
      ...prev,
      isDetecting: false,
    }));
  };

  const resetSession = () => {
    stopDetection();
    setState(prev => ({
      ...prev,
      repCount: 0,
      feedback: '',
      formScore: 0,
      elapsedTime: 0,
      error: null,
    }));
  };

  const resetToExerciseSetup = () => {
    stopDetection();
    cameraRef.current?.stopSession?.();
    setState(prev => ({
      ...prev,
      sessionStarted: false,
      nativeViewReady: false,
      previewReady: false,
      repCount: 0,
      feedback: '',
      formScore: 0,
      elapsedTime: 0,
      error: null,
    }));
  };

  const resetToConfiguration = () => {
    stopDetection();
    cameraRef.current?.stopSession?.();
    setState(prev => ({
      ...prev,
      didConfig: false,
      sessionStarted: false,
      nativeViewReady: false,
      previewReady: false,
      isDetecting: false,
      repCount: 0,
      feedback: '',
      formScore: 0,
      elapsedTime: 0,
      error: null,
    }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  if (state.isConfiguring) {
    return (
      <SafeAreaView style={styles.setupContainer}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.setupTitle, { marginTop: Spacing.lg }]}>
            Initializing SMKit...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.configError) {
    return (
      <SafeAreaView style={styles.setupContainer}>
        <View style={styles.loadingContainer}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{state.configError}</Text>
          </View>
          <Text style={[styles.setupSubtitle, { marginTop: Spacing.lg }]}>
            Update your API key in App.tsx
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!state.didConfig) {
    return (
      <SafeAreaView style={styles.setupContainer}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.setupTitle, { marginTop: Spacing.lg }]}>
            Initializing...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!state.sessionStarted) {
    return (
      <SafeAreaView style={styles.setupContainer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.setupTitle}>SMKit Exercise Tracker</Text>
          <Text style={styles.setupSubtitle}>Select your workout</Text>

          <View style={styles.setupForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Exercise</Text>
              <View style={styles.exerciseGrid}>
                {EXERCISES.map(item => {
                  const isSelected = state.selectedExercise === item;
                  return (
                    <Pressable
                      key={item}
                      style={[
                        styles.exerciseButton,
                        isSelected && styles.exerciseButtonSelected,
                      ]}
                      onPress={() =>
                        setState(prev => ({
                          ...prev,
                          selectedExercise: item,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.exerciseButtonText,
                          isSelected && styles.exerciseButtonTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                placeholder="175"
                placeholderTextColor={Colors.textTertiary}
                value={state.userHeight}
                onChangeText={text =>
                  setState(prev => ({ ...prev, userHeight: text }))
                }
                keyboardType="numeric"
              />
              <Text style={styles.hint}>Used for more accurate form scoring.</Text>
            </View>

            {state.error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{state.error}</Text>
              </View>
            ) : null}

            <Pressable style={styles.primaryButton} onPress={startSessionAndPreview}>
              <Text style={styles.primaryButtonText}>Start Session</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={resetToConfiguration}>
              <Text style={styles.secondaryButtonText}>Back to Configuration</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <CameraWindow isLive={state.isDetecting} fullscreen>
        <SmkitCameraView
          ref={cameraRef}
          authKey={API_KEY}
          exercise={EXERCISE_TYPE_MAP[state.selectedExercise]}
          phonePosition="Floor"
          userHeight={parseFloat(state.userHeight) || 175}
          autoStart={false}
          onDetectionData={handleDetectionData}
          onPositionData={handlePositionData}
          onError={handleError}
          onPreviewReady={handlePreviewReady}
          onDetectionStopped={handleDetectionStopped}
          onLayout={handleCameraLayout}
          style={styles.cameraView}
        />

        <SkeletonOverlay
          jointData={state.jointData}
          width={Dimensions.get('window').width}
          height={Dimensions.get('window').height}
          mirrored={false}
        />

        {state.isDetecting && !isStaticExercise(state.selectedExercise) ? (
          <View style={styles.repCounterOverlay}>
            <Text style={styles.repCounterLabel}>REPS</Text>
            <Text style={styles.repCounterValue}>{state.repCount}</Text>
          </View>
        ) : null}

        {state.isDetecting ? (
          <View
            style={[
              styles.positionIndicator,
              {
                backgroundColor: state.isInPosition
                  ? '#22c55e'
                  : 'rgba(255, 0, 0, 0.6)',
              },
            ]}
          >
            <Text style={styles.positionIndicatorLabel}>
              {state.isInPosition ? 'IN POSITION' : 'OUT OF POSITION'}
            </Text>
          </View>
        ) : null}

        {!state.previewReady ? (
          <View style={styles.previewOverlay}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.previewText}>Starting camera...</Text>
          </View>
        ) : null}
      </CameraWindow>

      <SafeAreaView style={styles.overlayContainer}>
        <View style={styles.statsPanelOverlay}>
          <StatsPanel
            repCount={state.repCount}
            time={formatTime(state.elapsedTime)}
            formScore={state.formScore}
            feedback={state.feedback}
          />
        </View>

        {state.error ? (
          <View style={styles.errorBannerOverlay}>
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{state.error}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.controlsOverlay}>
          <View style={styles.controlsContainer}>
            {!state.isDetecting ? (
              <Pressable style={styles.primaryButton} onPress={startDetectionSession}>
                <Text style={styles.primaryButtonText}>Start Detection</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.primaryButtonDanger} onPress={stopDetection}>
                <Text style={styles.primaryButtonText}>Pause Detection</Text>
              </Pressable>
            )}

            <View style={styles.secondaryButtons}>
              <Pressable style={styles.secondaryButton} onPress={resetSession}>
                <Text style={styles.secondaryButtonText}>Reset Stats</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={resetToExerciseSetup}>
                <Text style={styles.secondaryButtonText}>Change Exercise</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  setupContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  setupTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  setupSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  setupForm: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surface2,
    color: Colors.textPrimary,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  exerciseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  exerciseButton: {
    backgroundColor: Colors.surface2,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.borderGlass,
  },
  exerciseButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  exerciseButtonText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  exerciseButtonTextSelected: {
    color: Colors.background,
  },
  errorBanner: {
    backgroundColor: Colors.error,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  statsPanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  errorBannerOverlay: {
    position: 'absolute',
    top: '40%',
    left: Spacing.lg,
    right: Spacing.lg,
    pointerEvents: 'auto',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'auto',
  },
  cameraView: {
    flex: 1,
  },
  controlsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: 'rgba(9, 15, 30, 0.9)',
    borderTopWidth: 1,
    borderTopColor: Colors.borderGlass,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  primaryButtonDanger: {
    backgroundColor: Colors.error,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  primaryButtonText: {
    ...Typography.body,
    color: Colors.background,
    fontWeight: '700',
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    borderRadius: 12,
  },
  secondaryButtonText: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  previewText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  repCounterOverlay: {
    position: 'absolute',
    top: 60,
    right: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    pointerEvents: 'none',
  },
  repCounterLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  repCounterValue: {
    ...Typography.h1,
    color: Colors.primary,
    fontSize: 48,
  },
  positionIndicator: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  positionIndicatorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    letterSpacing: 0.5,
  },
});
