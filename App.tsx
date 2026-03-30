import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SmkitCameraView,
  configure,
  type BodyCalibrationStatusEvent,
  type ExerciseModifications,
  type ExerciseSummary,
  type JointData,
  type MovementFeedbackData,
  type PhoneCalibrationUpdate,
  type SmkitCameraViewRef,
} from '@sency/react-native-smkit';
import CameraWindow from './components/CameraWindow';
import SkeletonOverlay from './components/SkeletonOverlay';
import StatsPanel from './components/StatsPanel';
import {API_PUBLIC_KEY} from '@env';
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

function feedbackSaysPushupKneesOnFloor(data: MovementFeedbackData): boolean {
  if (data.feedbackKeys?.includes('PushupKneesOnFloor')) {
    return true;
  }
  return (data.feedback ?? []).some(
    (t: string) => /knee/i.test(t) && /floor/i.test(t),
  );
}

/**
 * Sample `startSession(modifications)` — merged into native defaults. Values 0–1 normalized
 * where applicable. Pushup: slightly less strict depth vs cpp defaults; raise `high` to loosen.
 */
function sampleModificationsForSelectedExercise(
  exercise: ExerciseLabel,
): ExerciseModifications | null {
  const native = EXERCISE_TYPE_MAP[exercise];
  if (native === 'SquatRegular') {
    return {
      SquatRegular: {
        DepthScore: { threshold: 0.75 },
      },
    };
  }
  if (native === 'PushupRegular') {
    return {
      PushupRegular: {
        PushupDepthFloor: {
          low: 0.25,
          high: 0.78,
          high_soft: 0.83,
          high_start: 0.87,
        },
      },
    };
  }
  return null;
}

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
  cameraVideoSize: { width: number; height: number } | null;
  isDetecting: boolean;
  isInPosition: boolean;
  repCount: number;
  isShallowRep: boolean;
  lastRepSummaryLabel: string | null;
  feedback: string;
  formScore: number;
  elapsedTime: number;
  jointData: JointData | null;
  error: string | null;
  useWideAngleCamera: boolean;
  calibrateBeforeDetection: boolean;
  applyExerciseModifications: boolean;
  countOnlyPerfectPushups: boolean;
  phoneCalibrationReady: boolean;
  bodyInFrameForCalibration: boolean;
}

export default function App() {
  const cameraRef = useRef<SmkitCameraViewRef>(null);
  const repCountAnim = useRef(new Animated.Value(1)).current;
  const previewCalibrationsStartedRef = useRef(false);
  const directDetectionStartedRef = useRef(false);
  const calibrationCompleteRef = useRef(false);
const [state, setState] = useState<AppState>({
    isConfiguring: true,
    didConfig: false,
    configError: null,
    selectedExercise: 'Squat',
    userHeight: '175',
    sessionStarted: false,
    nativeViewReady: false,
    previewReady: false,
    cameraVideoSize: null,
    isDetecting: false,
    isInPosition: false,
    repCount: 0,
    isShallowRep: false,
    lastRepSummaryLabel: null,
    feedback: '',
    formScore: 0,
    elapsedTime: 0,
    jointData: null,
    error: null,
    useWideAngleCamera: false,
    calibrateBeforeDetection: true,
    applyExerciseModifications: false,
    countOnlyPerfectPushups: false,
    phoneCalibrationReady: false,
    bodyInFrameForCalibration: false,
  });

  useEffect(() => {
    const autoConfig = async () => {
      try {
        if (!API_KEY.trim()) {
          setState(prev => ({
            ...prev,
            isConfiguring: false,
            configError:
              'Set API_PUBLIC_KEY in a root `.env` file (see `.env.example`).',
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
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [state.isDetecting]);

  const triggerRepAnimation = () => {
    repCountAnim.setValue(1);
    Animated.sequence([
      Animated.timing(repCountAnim, {
        toValue: 1.15,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(repCountAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startSessionAndPreview = () => {
    previewCalibrationsStartedRef.current = false;
    directDetectionStartedRef.current = false;
    calibrationCompleteRef.current = false;
    setState(prev => ({
      ...prev,
      error: null,
      nativeViewReady: false,
      previewReady: false,
      cameraVideoSize: null,
      sessionStarted: true,
      phoneCalibrationReady: false,
      bodyInFrameForCalibration: false,
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
    setState(prev => ({
      ...prev,
      error: null,
      isDetecting: true,
    }));
    const nativeExerciseType = EXERCISE_TYPE_MAP[state.selectedExercise];
    cameraRef.current?.startDetection?.(nativeExerciseType);
  };

  useEffect(() => {
    if (!state.sessionStarted || !state.nativeViewReady) {
      return;
    }
    const mods = state.applyExerciseModifications
      ? sampleModificationsForSelectedExercise(state.selectedExercise)
      : null;
    try {
      cameraRef.current?.startSession?.(mods);
    } catch (e) {
      setState(prev => ({
        ...prev,
        error: `Failed to start session: ${String(e)}`,
      }));
    }
  }, [
    state.sessionStarted,
    state.nativeViewReady,
    state.applyExerciseModifications,
    state.selectedExercise,
  ]);

  useEffect(() => {
    if (!state.sessionStarted || !state.previewReady) {
      return;
    }
    const calibrateNative =
      Platform.OS === 'ios' && state.calibrateBeforeDetection;
    if (calibrateNative) {
      if (previewCalibrationsStartedRef.current) {
        return;
      }
      previewCalibrationsStartedRef.current = true;
      calibrationCompleteRef.current = false;
      setState(prev => ({
        ...prev,
        phoneCalibrationReady: false,
        bodyInFrameForCalibration: false,
      }));
      cameraRef.current?.startPhoneCalibration?.({
        yzAngleRange: [70, 90],
        xyAngleRange: [-5, 5],
      });
      cameraRef.current?.startBodyCalibration?.();
      return;
    }
    if (directDetectionStartedRef.current || state.isDetecting) {
      return;
    }
    directDetectionStartedRef.current = true;
    startDetectionSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once when preview ready without calibration
  }, [
    state.sessionStarted,
    state.previewReady,
    state.calibrateBeforeDetection,
    state.isDetecting,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !state.calibrateBeforeDetection) {
      return;
    }
    if (!state.sessionStarted || !state.previewReady) {
      return;
    }
    if (!state.phoneCalibrationReady || !state.bodyInFrameForCalibration) {
      return;
    }
    if (calibrationCompleteRef.current || state.isDetecting) {
      return;
    }
    calibrationCompleteRef.current = true;
    cameraRef.current?.stopPhoneCalibration?.();
    cameraRef.current?.stopBodyCalibration?.();
    startDetectionSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.calibrateBeforeDetection,
    state.sessionStarted,
    state.previewReady,
    state.phoneCalibrationReady,
    state.bodyInFrameForCalibration,
    state.isDetecting,
  ]);

  const handleDetectionData = (data: MovementFeedbackData) => {
    if (data.didFinishMovement) {
      triggerRepAnimation();
    }

    const feedbackText = data.feedback?.[0] || '';

    setState(prev => {
      const next: AppState = {
        ...prev,
        feedback: feedbackText,
        isInPosition: data.isInPosition,
        isShallowRep: data.isShallowRep,
        formScore: Math.round(data.techniqueScore || 0),
      };

      if (data.didFinishMovement) {
        const isPushup = prev.selectedExercise === 'Pushup';
        const perfectOnly = prev.countOnlyPerfectPushups && isPushup;
        const kneesOnFloor = feedbackSaysPushupKneesOnFloor(data);
        const shallow = !!data.isShallowRep;

        if (perfectOnly) {
          if (!shallow && !kneesOnFloor) {
            next.repCount = prev.repCount + 1;
            next.lastRepSummaryLabel = 'Last rep: counted (perfect)';
          } else if (shallow && kneesOnFloor) {
            next.lastRepSummaryLabel =
              'Last rep: skipped (shallow + knees on floor)';
          } else if (shallow) {
            next.lastRepSummaryLabel = 'Last rep: skipped (shallow)';
          } else {
            next.lastRepSummaryLabel = 'Last rep: skipped (knees on floor)';
          }
        } else {
          next.repCount = prev.repCount + 1;
          next.lastRepSummaryLabel = shallow
            ? 'Last rep: shallow'
            : 'Last rep: full depth';
        }
      }

      return next;
    });
  };

  const handlePositionData = (data: JointData) => {
    setState(prev => ({
      ...prev,
      jointData: data,
    }));
  };

  const handleDetectionStopped = (_summary: ExerciseSummary) => {
    setState(prev => ({
      ...prev,
      isDetecting: false,
    }));
  };

  const handlePreviewReady = (videoSize?: { width: number; height: number }) => {
    setState(prev => ({
      ...prev,
      previewReady: true,
      cameraVideoSize: videoSize ?? prev.cameraVideoSize,
      error: null,
    }));
  };

  const handleError = (errorMsg: string) => {
    setState(prev => ({
      ...prev,
      error: errorMsg,
    }));
  };

  const handlePhoneCalibrationUpdate = (e: PhoneCalibrationUpdate) => {
    if (e.isReady) {
      setState(prev => ({ ...prev, phoneCalibrationReady: true }));
    }
  };

  const handleBodyCalibrationStatus = (ev: BodyCalibrationStatusEvent) => {
    if (ev.status === 'didEnterFrame') {
      setState(prev => ({ ...prev, bodyInFrameForCalibration: true }));
    }
    if (ev.status === 'didLeaveFrame') {
      setState(prev => ({ ...prev, bodyInFrameForCalibration: false }));
    }
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
      isShallowRep: false,
      lastRepSummaryLabel: null,
      feedback: '',
      formScore: 0,
      elapsedTime: 0,
      error: null,
    }));
  };

  const resetToExerciseSetup = () => {
    previewCalibrationsStartedRef.current = false;
    directDetectionStartedRef.current = false;
    calibrationCompleteRef.current = false;
    stopDetection();
    cameraRef.current?.stopSession?.();
    setState(prev => ({
      ...prev,
      sessionStarted: false,
      nativeViewReady: false,
      previewReady: false,
      cameraVideoSize: null,
      repCount: 0,
      isShallowRep: false,
      lastRepSummaryLabel: null,
      feedback: '',
      formScore: 0,
      elapsedTime: 0,
      error: null,
    }));
  };

  const resetToConfiguration = () => {
    previewCalibrationsStartedRef.current = false;
    directDetectionStartedRef.current = false;
    calibrationCompleteRef.current = false;
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
      isShallowRep: false,
      lastRepSummaryLabel: null,
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
              <Text style={styles.label}>Camera</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Wide angle (supported devices)</Text>
                <Switch
                  value={state.useWideAngleCamera}
                  onValueChange={v =>
                    setState(prev => ({ ...prev, useWideAngleCamera: v }))
                  }
                />
              </View>
            </View>

            {state.selectedExercise === 'Pushup' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pushup rep counting</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>
                    Count only perfect reps (full depth, knees off floor)
                  </Text>
                  <Switch
                    value={state.countOnlyPerfectPushups}
                    onValueChange={v =>
                      setState(prev => ({ ...prev, countOnlyPerfectPushups: v }))
                    }
                  />
                </View>
                <Text style={styles.hint}>
                  Uses isShallowRep and PushupKneesOnFloor (feedback_keys) on rep completion.
                </Text>
              </View>
            ) : null}

            {Platform.OS === 'ios' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Calibration</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>
                    Phone + body calibration before detection
                  </Text>
                  <Switch
                    value={state.calibrateBeforeDetection}
                    onValueChange={v =>
                      setState(prev => ({ ...prev, calibrateBeforeDetection: v }))
                    }
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Exercise config override</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Apply sample modification (Squat: DepthScore; Pushup: depth)
                </Text>
                <Switch
                  value={state.applyExerciseModifications}
                  onValueChange={v =>
                    setState(prev => ({ ...prev, applyExerciseModifications: v }))
                  }
                />
              </View>
              <Text style={styles.hint}>
                Loosen pushup depth: raise normalized high in App.tsx sample (keep high_start
                under ~0.88).
              </Text>
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
          exercise={state.selectedExercise}
          phonePosition="Floor"
          userHeight={parseFloat(state.userHeight) || 175}
          useWideAngleCamera={state.useWideAngleCamera}
          autoStart={false}
          onDetectionData={handleDetectionData}
          onPositionData={handlePositionData}
          onError={handleError}
          onPreviewReady={handlePreviewReady}
          onDetectionStopped={handleDetectionStopped}
          onPhoneCalibrationUpdate={handlePhoneCalibrationUpdate}
          onBodyCalibrationStatus={handleBodyCalibrationStatus}
          onLayout={handleCameraLayout}
          style={styles.cameraView}
        />

        <SkeletonOverlay
          jointData={state.jointData}
          width={Dimensions.get('window').width}
          height={Dimensions.get('window').height}
          cameraWidth={state.cameraVideoSize?.width ?? 1080}
          cameraHeight={state.cameraVideoSize?.height ?? 1920}
          mirrored={false}
        />

        {state.isDetecting && !isStaticExercise(state.selectedExercise) ? (
          <View style={styles.repCounterOverlay}>
            <Animated.View style={{ transform: [{ scale: repCountAnim }] }}>
              <Text style={styles.repCounterLabel}>REPS</Text>
              <Text style={styles.repCounterValue}>{state.repCount}</Text>
              {state.selectedExercise === 'Pushup' &&
              state.countOnlyPerfectPushups ? (
                <Text style={styles.repCounterPerfectHint}>perfect only</Text>
              ) : null}
            </Animated.View>
          </View>
        ) : null}

        {state.isDetecting ? (
          <View
            style={[
              styles.depthBanner,
              {
                backgroundColor: state.isShallowRep
                  ? 'rgba(234, 179, 8, 0.92)'
                  : 'rgba(22, 163, 74, 0.88)',
              },
            ]}
          >
            <Text style={styles.depthBannerTitle}>Rep depth</Text>
            <Text style={styles.depthBannerLine}>
              {state.isShallowRep ? 'Shallow (this rep)' : 'Full depth (this rep)'}
            </Text>
            {state.lastRepSummaryLabel != null ? (
              <Text style={styles.depthBannerLast}>{state.lastRepSummaryLabel}</Text>
            ) : null}
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

        {Platform.OS === 'ios' &&
        state.calibrateBeforeDetection &&
        state.previewReady &&
        !state.isDetecting ? (
          <View style={styles.calibrationOverlay}>
            <Text style={styles.calibrationTitle}>Calibration</Text>
            <Text style={styles.calibrationLine}>
              Phone angle: {state.phoneCalibrationReady ? 'OK' : 'Adjust tilt'}
            </Text>
            <Text style={styles.calibrationLine}>
              Body in frame: {state.bodyInFrameForCalibration ? 'OK' : 'Step in view'}
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
            {state.isDetecting ? (
              <Pressable style={styles.primaryButtonDanger} onPress={stopDetection}>
                <Text style={styles.primaryButtonText}>Pause Detection</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.primaryButton} onPress={startDetectionSession}>
                <Text style={styles.primaryButtonText}>Start Detection</Text>
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  switchLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
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
    fontWeight: '700',
  },
  repCounterPerfectHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  depthBanner: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    pointerEvents: 'none',
  },
  depthBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.55)',
    marginBottom: 4,
  },
  depthBannerLine: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  depthBannerLast: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 6,
    opacity: 0.9,
  },
  calibrationOverlay: {
    position: 'absolute',
    top: '28%',
    left: 24,
    right: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    pointerEvents: 'none',
  },
  calibrationTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  calibrationLine: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 4,
  },
  positionIndicator: {
    position: 'absolute',
    bottom: 140,
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
