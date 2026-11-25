import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PermissionsAndroid,
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
  consumeRecoveredSessionSummaries,
  preloadModelsInBackground,
  type BodyCalibrationStatusEvent,
  type ExerciseModifications,
  type ExerciseSummary,
  type GuidanceSuggestionEvent,
  type JointData,
  type MovementFeedbackData,
  type PhoneCalibrationUpdate,
  type RecoveredSessionSummary,
  type SessionState,
  type SessionStateEvent,
  type SessionStopReason,
  type SmkitCameraViewRef,
} from '@sency/react-native-smkit';
import CameraWindow from './components/CameraWindow';
import SkeletonOverlay from './components/SkeletonOverlay';
import StatsPanel from './components/StatsPanel';
import {SMKIT_UI_AUTH_KEY} from '@env';
import {Colors, Spacing, Typography} from './theme';

const API_KEY = SMKIT_UI_AUTH_KEY ?? '';
const ANDROID_POSE_MODEL_CHOICE = 'AdaptiveChoice' as const;

const EXERCISES = [
  'Squat',
  'Pushup',
  'JumpingJacks',
  'Plank',
  'HighKnees',
  'boxing',
] as const;

type ExerciseLabel = (typeof EXERCISES)[number];
type BoxingTarget = {x: number; y: number};

const BOXING_DURATION_SECONDS = 30;
const BOXING_TARGET_SIZE = 68;
const BOXING_HIT_RADIUS = BOXING_TARGET_SIZE / 2 + 18;

const EXERCISE_TYPE_MAP: Record<ExerciseLabel, string | null> = {
  Squat: 'SquatRegular',
  Pushup: 'PushupRegular',
  JumpingJacks: 'JumpingJacks',
  Plank: 'PlankHighStatic',
  HighKnees: 'HighKnees',
  boxing: null,
};

function createBoxingTarget(): BoxingTarget {
  const {width, height} = Dimensions.get('window');
  const radius = BOXING_TARGET_SIZE / 2;
  const minX = radius + Spacing.lg;
  const maxX = width - radius - Spacing.lg;
  const minY = 130;
  const maxY = Math.max(minY + 1, height - 230);

  return {
    x: minX + Math.random() * Math.max(1, maxX - minX),
    y: minY + Math.random() * Math.max(1, maxY - minY),
  };
}

function cameraPointToScreen(
  point: {x: number; y: number},
  cameraSize: {width: number; height: number} | null,
): BoxingTarget {
  const {width, height} = Dimensions.get('window');
  const cameraWidth = cameraSize?.width ?? 1080;
  const cameraHeight = cameraSize?.height ?? 1920;
  const cameraAspect = cameraWidth / cameraHeight;
  const screenAspect = width / height;

  let videoWidth = width;
  let videoHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (cameraAspect > screenAspect) {
    videoHeight = width / cameraAspect;
    offsetY = (height - videoHeight) / 2;
  } else {
    videoWidth = height * cameraAspect;
    offsetX = (width - videoWidth) / 2;
  }

  return {
    x: offsetX + (point.x / cameraWidth) * videoWidth,
    y: offsetY + (point.y / cameraHeight) * videoHeight,
  };
}

function getWristHitTarget(
  jointData: JointData,
  target: BoxingTarget,
  cameraSize: {width: number; height: number} | null,
): boolean {
  return ['LWrist', 'RWrist'].some(jointName => {
    const wrist = jointData[jointName];
    if (!wrist || wrist.confidence <= 0.3) {
      return false;
    }

    const wristPoint = cameraPointToScreen(wrist, cameraSize);
    const distance = Math.hypot(
      wristPoint.x - target.x,
      wristPoint.y - target.y,
    );
    return distance <= BOXING_HIT_RADIUS;
  });
}

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
        DepthScore: {threshold: 0.75},
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
  cameraVideoSize: {width: number; height: number} | null;
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
  boxingTarget: BoxingTarget | null;
  boxingTimeLeft: number;
  boxingActive: boolean;
  /** Native session lifecycle from `onSessionStateChange`. */
  sessionState: SessionState | 'idle';
  sessionStopReason: SessionStopReason | null;
  /** Every active feedback item from the latest detection frame. */
  feedbackItems: string[];
  /** Seconds in position for static holds such as Plank. */
  holdSeconds: number;
  /** Summary from the last `onDetectionStopped`, shown until dismissed. */
  lastSummary: ExerciseSummary | null;
  /** Results the SDK saved after a crash or native fault. */
  recoveredSummaries: RecoveredSessionSummary[];
  useGuidanceMode: boolean;
  /** Current guidance instruction while guidance mode is active. */
  guidanceText: string | null;
  guidanceSuggestion: string | null;
}

function topFeedback(summary: ExerciseSummary, count = 3): string[] {
  return Object.entries(summary.feedbacks ?? {})
    .filter(([, occurrences]) => occurrences > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([name, occurrences]) => `${name} ×${occurrences}`);
}

function describeStop(event: SessionStateEvent): string | null {
  switch (event.reason) {
    case 'fault':
      return `The SMKit session stopped after a native fault${
        event.faultCode ? ` (${event.faultCode})` : ''
      }. Tap Restart Session to try again.`;
    case 'startFailed':
      return 'The SMKit session failed to start. Tap Restart Session to try again.';
    case 'reconfigure':
      return 'SMKit was reconfigured, so the session stopped. Tap Restart Session.';
    default:
      return null;
  }
}

export default function App() {
  const cameraRef = useRef<SmkitCameraViewRef>(null);
  const repCountAnim = useRef(new Animated.Value(1)).current;
  const previewCalibrationsStartedRef = useRef(false);
  const directDetectionStartedRef = useRef(false);
  const calibrationCompleteRef = useRef(false);
  const boxingLastHitAtRef = useRef(0);
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
    boxingTarget: null,
    boxingTimeLeft: BOXING_DURATION_SECONDS,
    boxingActive: false,
    sessionState: 'idle',
    sessionStopReason: null,
    feedbackItems: [],
    holdSeconds: 0,
    lastSummary: null,
    recoveredSummaries: [],
    useGuidanceMode: false,
    guidanceText: null,
    guidanceSuggestion: null,
  });

  useEffect(() => {
    const autoConfig = async () => {
      try {
        if (!API_KEY.trim()) {
          setState(prev => ({
            ...prev,
            isConfiguring: false,
            configError:
              'Set SMKIT_UI_AUTH_KEY in AuthKey.local.properties (copy AuthKey.local.properties.example).',
          }));
          return;
        }

        await configure(
          API_KEY,
          Platform.OS === 'android'
            ? {poseModelChoice: ANDROID_POSE_MODEL_CHOICE}
            : undefined,
        );
        preloadModelsInBackground();
        // Results the SDK saved when a previous session was cut off by a crash or fault.
        const recoveredSummaries =
          await consumeRecoveredSessionSummaries().catch(
            () => [] as RecoveredSessionSummary[],
          );
        setState(prev => ({
          ...prev,
          isConfiguring: false,
          didConfig: true,
          recoveredSummaries,
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
          holdSeconds:
            prev.isInPosition && isStaticExercise(prev.selectedExercise)
              ? prev.holdSeconds + 1
              : prev.holdSeconds,
          boxingTimeLeft:
            prev.boxingActive && prev.selectedExercise === 'boxing'
              ? Math.max(0, prev.boxingTimeLeft - 1)
              : prev.boxingTimeLeft,
        }));
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [state.isDetecting]);

  useEffect(() => {
    if (
      state.selectedExercise !== 'boxing' ||
      !state.boxingActive ||
      state.boxingTimeLeft > 0
    ) {
      return;
    }

    setState(prev => ({
      ...prev,
      isDetecting: false,
      boxingActive: false,
      boxingTarget: null,
      feedback: `Boxing complete: ${prev.repCount} hits`,
    }));
  }, [state.boxingActive, state.boxingTimeLeft, state.selectedExercise]);

  useEffect(() => {
    if (!state.boxingActive || state.selectedExercise !== 'boxing') {
      return;
    }

    const interval = setInterval(() => {
      setState(prev => {
        if (!prev.boxingActive || prev.selectedExercise !== 'boxing') {
          return prev;
        }
        return {
          ...prev,
          boxingTarget: createBoxingTarget(),
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [state.boxingActive, state.selectedExercise]);

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

  const ensureAndroidCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permission = PermissionsAndroid.PERMISSIONS.CAMERA;
    const hasPermission = await PermissionsAndroid.check(permission);
    if (hasPermission) {
      return true;
    }

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const startSessionAndPreview = async () => {
    const hasCameraPermission = await ensureAndroidCameraPermission();
    if (!hasCameraPermission) {
      setState(prev => ({
        ...prev,
        error: 'Camera permission is required to start an SMKit session.',
      }));
      return;
    }

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
      sessionState: 'idle',
      sessionStopReason: null,
      lastSummary: null,
      holdSeconds: 0,
      guidanceText: null,
      guidanceSuggestion: null,
    }));
  };

  /** Starts the native session with the modifications chosen on the setup screen. */
  const startNativeSession = () => {
    const mods = state.applyExerciseModifications
      ? sampleModificationsForSelectedExercise(state.selectedExercise)
      : null;
    cameraRef.current?.startSession?.(mods);
  };

  /** After a fault or failed start, start a fresh session on the same camera view. */
  const restartSession = () => {
    previewCalibrationsStartedRef.current = false;
    directDetectionStartedRef.current = false;
    calibrationCompleteRef.current = false;
    setState(prev => ({
      ...prev,
      error: null,
      previewReady: false,
      isDetecting: false,
      sessionStopReason: null,
      phoneCalibrationReady: false,
      bodyInFrameForCalibration: false,
    }));
    startNativeSession();
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
    if (state.selectedExercise === 'boxing') {
      boxingLastHitAtRef.current = 0;
      setState(prev => ({
        ...prev,
        error: null,
        feedback: '',
        formScore: 0,
        elapsedTime: 0,
        repCount: 0,
        isDetecting: true,
        boxingActive: true,
        boxingTimeLeft: BOXING_DURATION_SECONDS,
        boxingTarget: createBoxingTarget(),
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      error: null,
      isDetecting: true,
      boxingActive: false,
      boxingTarget: null,
      lastSummary: null,
      guidanceText: null,
      guidanceSuggestion: null,
    }));
    const nativeExerciseType = EXERCISE_TYPE_MAP[state.selectedExercise];
    if (nativeExerciseType) {
      cameraRef.current?.startDetection?.(nativeExerciseType, {
        guidanceMode: state.useGuidanceMode,
        // Without guidance mode, let the SDK suggest it when the user struggles.
        guidanceSuggestionEnabled: !state.useGuidanceMode,
      });
    }
  };

  // Start the native session once per camera mount. The exercise and modifications can
  // only change on the setup screen, which unmounts the camera view (that stops the
  // session), so a running session never needs a second startSession() here.
  useEffect(() => {
    if (!state.sessionStarted || !state.nativeViewReady) {
      return;
    }
    startNativeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per mount
  }, [state.sessionStarted, state.nativeViewReady]);

  useEffect(() => {
    if (!state.sessionStarted || !state.previewReady) {
      return;
    }
    if (state.calibrateBeforeDetection) {
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
    if (
      state.selectedExercise === 'boxing' ||
      directDetectionStartedRef.current ||
      state.isDetecting
    ) {
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
    if (!state.calibrateBeforeDetection) {
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

    const feedbackItems = (data.feedback ?? []).filter(Boolean);
    const guidanceText = data.isGuidanceModeActive
      ? data.coachInstruction || data.guidanceStep || null
      : null;

    setState(prev => {
      const next: AppState = {
        ...prev,
        feedback: feedbackItems.join(' · '),
        feedbackItems,
        guidanceText,
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
    setState(prev => {
      const next: AppState = {
        ...prev,
        jointData: data,
      };

      if (
        prev.boxingActive &&
        prev.selectedExercise === 'boxing' &&
        prev.boxingTarget &&
        getWristHitTarget(data, prev.boxingTarget, prev.cameraVideoSize)
      ) {
        const now = Date.now();
        if (now - boxingLastHitAtRef.current > 350) {
          boxingLastHitAtRef.current = now;
          next.repCount = prev.repCount + 1;
          next.boxingTarget = createBoxingTarget();
          next.feedback = 'Target hit';
        }
      }

      return next;
    });
  };

  const handleDetectionStopped = (summary: ExerciseSummary) => {
    setState(prev => ({
      ...prev,
      isDetecting: false,
      lastSummary: summary,
    }));
  };

  const handleSessionStateChange = (event: SessionStateEvent) => {
    setState(prev => {
      const next: AppState = {
        ...prev,
        sessionState: event.state,
        sessionStopReason: event.reason ?? null,
      };
      if (event.state === 'stopped') {
        // The camera is gone; nothing is detecting any more, whatever stopped it.
        next.isDetecting = false;
        next.boxingActive = false;
        next.boxingTarget = null;
        next.previewReady = false;
        const message = describeStop(event);
        if (message) {
          next.error = message;
        }
      }
      return next;
    });
  };

  const handleGuidanceSuggestion = (event: GuidanceSuggestionEvent) => {
    setState(prev => ({
      ...prev,
      guidanceSuggestion: `Guidance mode is available for ${event.exerciseName}. Turn it on in setup for step-by-step coaching.`,
    }));
  };

  const handlePreviewReady = (videoSize?: {width: number; height: number}) => {
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
      setState(prev => ({...prev, phoneCalibrationReady: true}));
    }
  };

  const handleBodyCalibrationStatus = (ev: BodyCalibrationStatusEvent) => {
    if (ev.status === 'didEnterFrame') {
      setState(prev => ({...prev, bodyInFrameForCalibration: true}));
    }
    if (ev.status === 'didLeaveFrame') {
      setState(prev => ({...prev, bodyInFrameForCalibration: false}));
    }
  };

  const stopDetection = () => {
    cameraRef.current?.stopDetection?.();
    setState(prev => ({
      ...prev,
      isDetecting: false,
      boxingActive: false,
      boxingTarget: null,
    }));
  };

  const resetSession = () => {
    stopDetection();
    setState(prev => ({
      ...prev,
      holdSeconds: 0,
      feedbackItems: [],
      lastSummary: null,
      repCount: 0,
      isShallowRep: false,
      lastRepSummaryLabel: null,
      feedback: '',
      formScore: 0,
      elapsedTime: 0,
      error: null,
      boxingActive: false,
      boxingTarget: null,
      boxingTimeLeft: BOXING_DURATION_SECONDS,
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
      sessionState: 'idle',
      sessionStopReason: null,
      holdSeconds: 0,
      feedbackItems: [],
      lastSummary: null,
      guidanceText: null,
      guidanceSuggestion: null,
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
      boxingActive: false,
      boxingTarget: null,
      boxingTimeLeft: BOXING_DURATION_SECONDS,
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
      sessionState: 'idle',
      sessionStopReason: null,
      holdSeconds: 0,
      feedbackItems: [],
      lastSummary: null,
      guidanceText: null,
      guidanceSuggestion: null,
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
      boxingActive: false,
      boxingTarget: null,
      boxingTimeLeft: BOXING_DURATION_SECONDS,
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
          <Text style={[styles.setupTitle, {marginTop: Spacing.lg}]}>
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
          <Text style={[styles.setupSubtitle, {marginTop: Spacing.lg}]}>
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
          <Text style={[styles.setupTitle, {marginTop: Spacing.lg}]}>
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
            {state.recoveredSummaries.length > 0 ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Recovered results</Text>
                <Text style={styles.hint}>
                  SMKit saved these after a previous session was cut off.
                </Text>
                {state.recoveredSummaries.map(item => {
                  const exercises = Array.isArray(item.sessionResult?.exercises)
                    ? (item.sessionResult?.exercises as unknown[]).length
                    : 0;
                  return (
                    <Text
                      key={`${item.recoveredAt}-${item.faultCode}`}
                      style={styles.summaryLine}>
                      {new Date(item.recoveredAt).toLocaleString()} ·{' '}
                      {exercises} exercise{exercises === 1 ? '' : 's'} ·{' '}
                      {item.recoveredAfterRelaunch
                        ? 'after relaunch'
                        : item.faultCode}
                    </Text>
                  );
                })}
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    setState(prev => ({...prev, recoveredSummaries: []}))
                  }>
                  <Text style={styles.secondaryButtonText}>Dismiss</Text>
                </Pressable>
              </View>
            ) : null}

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
                      }>
                      <Text
                        style={[
                          styles.exerciseButtonText,
                          isSelected && styles.exerciseButtonTextSelected,
                        ]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {Platform.OS === 'ios' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Camera</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>
                    Wide angle (supported devices)
                  </Text>
                  <Switch
                    value={state.useWideAngleCamera}
                    onValueChange={v =>
                      setState(prev => ({...prev, useWideAngleCamera: v}))
                    }
                  />
                </View>
              </View>
            ) : null}

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
                      setState(prev => ({...prev, countOnlyPerfectPushups: v}))
                    }
                  />
                </View>
                <Text style={styles.hint}>
                  Uses isShallowRep and PushupKneesOnFloor (feedback_keys) on
                  rep completion.
                </Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Calibration</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Phone + body calibration before detection
                </Text>
                <Switch
                  value={state.calibrateBeforeDetection}
                  onValueChange={v =>
                    setState(prev => ({...prev, calibrateBeforeDetection: v}))
                  }
                />
              </View>
            </View>

            {state.selectedExercise !== 'boxing' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Guidance</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>
                    Guidance mode (step-by-step coaching)
                  </Text>
                  <Switch
                    value={state.useGuidanceMode}
                    onValueChange={v =>
                      setState(prev => ({...prev, useGuidanceMode: v}))
                    }
                  />
                </View>
                <Text style={styles.hint}>
                  When off, SMKit may suggest guidance if the exercise is hard
                  to get into.
                </Text>
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
                    setState(prev => ({...prev, applyExerciseModifications: v}))
                  }
                />
              </View>
              <Text style={styles.hint}>
                Loosen pushup depth: raise normalized high in App.tsx sample
                (keep high_start under ~0.88).
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
                  setState(prev => ({...prev, userHeight: text}))
                }
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Used for more accurate form scoring.
              </Text>
            </View>

            {state.error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{state.error}</Text>
              </View>
            ) : null}

            <Pressable
              style={styles.primaryButton}
              onPress={startSessionAndPreview}>
              <Text style={styles.primaryButtonText}>Start Session</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={resetToConfiguration}>
              <Text style={styles.secondaryButtonText}>
                Back to Configuration
              </Text>
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
          enablePhoneMovementCountPrevention={true}
          positionDataFps={15}
          detectionDataFps={8}
          showNativeSkeletonOverlay={Platform.OS === 'android'}
          autoStart={false}
          onDetectionData={handleDetectionData}
          onPositionData={
            Platform.OS === 'android' && state.selectedExercise !== 'boxing'
              ? undefined
              : handlePositionData
          }
          onError={handleError}
          onPreviewReady={handlePreviewReady}
          onDetectionStopped={handleDetectionStopped}
          onSessionStateChange={handleSessionStateChange}
          onGuidanceSuggestion={handleGuidanceSuggestion}
          onPhoneCalibrationUpdate={handlePhoneCalibrationUpdate}
          onBodyCalibrationStatus={handleBodyCalibrationStatus}
          onLayout={handleCameraLayout}
          style={styles.cameraView}
        />

        {Platform.OS !== 'android' ? (
          <SkeletonOverlay
            jointData={state.jointData}
            width={Dimensions.get('window').width}
            height={Dimensions.get('window').height}
            cameraWidth={state.cameraVideoSize?.width ?? 1080}
            cameraHeight={state.cameraVideoSize?.height ?? 1920}
            mirrored={false}
          />
        ) : null}

        {state.boxingActive && state.boxingTarget ? (
          <View
            style={[
              styles.boxingTarget,
              {
                left: state.boxingTarget.x - BOXING_TARGET_SIZE / 2,
                top: state.boxingTarget.y - BOXING_TARGET_SIZE / 2,
              },
            ]}
          />
        ) : null}

        {state.isDetecting &&
        (!isStaticExercise(state.selectedExercise) ||
          state.selectedExercise === 'boxing') ? (
          <View style={styles.repCounterOverlay}>
            <Animated.View style={{transform: [{scale: repCountAnim}]}}>
              <Text style={styles.repCounterLabel}>
                {state.selectedExercise === 'boxing' ? 'HITS' : 'REPS'}
              </Text>
              <Text style={styles.repCounterValue}>{state.repCount}</Text>
              {state.selectedExercise === 'boxing' ? (
                <Text style={styles.repCounterPerfectHint}>
                  {state.boxingTimeLeft}s left
                </Text>
              ) : null}
              {state.selectedExercise === 'Pushup' &&
              state.countOnlyPerfectPushups ? (
                <Text style={styles.repCounterPerfectHint}>perfect only</Text>
              ) : null}
            </Animated.View>
          </View>
        ) : null}

        {state.isDetecting && isStaticExercise(state.selectedExercise) ? (
          <View style={styles.repCounterOverlay}>
            <Text style={styles.repCounterLabel}>HOLD</Text>
            <Text style={styles.repCounterValue}>
              {formatTime(state.holdSeconds)}
            </Text>
            <Text style={styles.repCounterPerfectHint}>time in position</Text>
          </View>
        ) : null}

        {state.isDetecting &&
        (state.guidanceText || state.guidanceSuggestion) ? (
          <View style={styles.guidanceBanner}>
            <Text style={styles.guidanceBannerText}>
              {state.guidanceText ?? state.guidanceSuggestion}
            </Text>
          </View>
        ) : null}

        {state.isDetecting &&
        state.selectedExercise !== 'boxing' &&
        !isStaticExercise(state.selectedExercise) ? (
          <View
            style={[
              styles.depthBanner,
              {
                backgroundColor: state.isShallowRep
                  ? 'rgba(234, 179, 8, 0.92)'
                  : 'rgba(22, 163, 74, 0.88)',
              },
            ]}>
            <Text style={styles.depthBannerTitle}>Rep depth</Text>
            <Text style={styles.depthBannerLine}>
              {state.isShallowRep
                ? 'Shallow (this rep)'
                : 'Full depth (this rep)'}
            </Text>
            {state.lastRepSummaryLabel != null ? (
              <Text style={styles.depthBannerLast}>
                {state.lastRepSummaryLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        {state.boxingActive ? (
          <View style={styles.boxingHud}>
            <Text style={styles.boxingHudLabel}>Boxing</Text>
            <Text style={styles.boxingHudValue}>
              {state.boxingTimeLeft}s · {state.repCount} hits
            </Text>
          </View>
        ) : null}

        {state.isDetecting && state.selectedExercise !== 'boxing' ? (
          <View
            style={[
              styles.positionIndicator,
              {
                backgroundColor: state.isInPosition
                  ? '#22c55e'
                  : 'rgba(255, 0, 0, 0.6)',
              },
            ]}>
            <Text style={styles.positionIndicatorLabel}>
              {state.isInPosition ? 'IN POSITION' : 'OUT OF POSITION'}
            </Text>
          </View>
        ) : null}

        {state.calibrateBeforeDetection &&
        state.previewReady &&
        !state.isDetecting ? (
          <View style={styles.calibrationOverlay}>
            <Text style={styles.calibrationTitle}>Calibration</Text>
            <Text style={styles.calibrationLine}>
              Phone angle: {state.phoneCalibrationReady ? 'OK' : 'Adjust tilt'}
            </Text>
            <Text style={styles.calibrationLine}>
              Body in frame:{' '}
              {state.bodyInFrameForCalibration ? 'OK' : 'Step in view'}
            </Text>
          </View>
        ) : null}

        {!state.previewReady && state.sessionState !== 'stopped' ? (
          <View style={styles.previewOverlay}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.previewText}>
              {state.sessionState === 'running'
                ? 'Waiting for camera...'
                : 'Starting session...'}
            </Text>
          </View>
        ) : null}

        {state.sessionState === 'stopped' ? (
          <View style={styles.previewOverlay}>
            <Text style={styles.previewText}>Session stopped</Text>
            <Pressable style={styles.primaryButton} onPress={restartSession}>
              <Text style={styles.primaryButtonText}>Restart Session</Text>
            </Pressable>
          </View>
        ) : null}

        {state.lastSummary && !state.isDetecting ? (
          <View style={styles.summaryOverlay}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {state.lastSummary.exerciseName || state.selectedExercise}{' '}
                summary
              </Text>
              {state.lastSummary.repsPerformed != null ? (
                <Text style={styles.summaryLine}>
                  Reps: {state.lastSummary.repsPerformed}
                  {state.lastSummary.repsPerformedPerfect != null
                    ? ` (${state.lastSummary.repsPerformedPerfect} perfect)`
                    : ''}
                </Text>
              ) : null}
              {state.lastSummary.timeInPosition != null ? (
                <Text style={styles.summaryLine}>
                  Time in position:{' '}
                  {Math.round(state.lastSummary.timeInPosition)}s
                  {state.lastSummary.timeInPositionPerfect != null
                    ? ` (${Math.round(
                        state.lastSummary.timeInPositionPerfect,
                      )}s perfect)`
                    : ''}
                </Text>
              ) : null}
              <Text style={styles.summaryLine}>
                Technique score:{' '}
                {Math.round(state.lastSummary.techniqueScore ?? 0)}
              </Text>
              <Text style={styles.summaryLine}>
                Duration:{' '}
                {formatTime(Math.round(state.lastSummary.totalTime ?? 0))}
              </Text>
              {topFeedback(state.lastSummary).length > 0 ? (
                <Text style={styles.summaryLine}>
                  Top feedback: {topFeedback(state.lastSummary).join(', ')}
                </Text>
              ) : null}
              <Pressable
                style={styles.secondaryButton}
                onPress={() =>
                  setState(prev => ({...prev, lastSummary: null}))
                }>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </CameraWindow>

      <SafeAreaView style={styles.overlayContainer}>
        <View style={styles.statsPanelOverlay}>
          <StatsPanel
            repCount={
              isStaticExercise(state.selectedExercise)
                ? state.holdSeconds
                : state.repCount
            }
            countLabel={
              state.selectedExercise === 'boxing'
                ? 'HITS'
                : isStaticExercise(state.selectedExercise)
                ? 'HOLD (S)'
                : 'REPS'
            }
            time={
              state.selectedExercise === 'boxing'
                ? formatTime(state.boxingTimeLeft)
                : formatTime(state.elapsedTime)
            }
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
              <Pressable
                style={styles.primaryButtonDanger}
                onPress={stopDetection}>
                <Text style={styles.primaryButtonText}>Stop Detection</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.primaryButton,
                  state.sessionState !== 'running' && styles.buttonDisabled,
                ]}
                disabled={state.sessionState !== 'running'}
                onPress={startDetectionSession}>
                <Text style={styles.primaryButtonText}>
                  {state.selectedExercise === 'boxing'
                    ? 'Start Boxing'
                    : 'Start Detection'}
                </Text>
              </Pressable>
            )}

            <View style={styles.secondaryButtons}>
              <Pressable style={styles.secondaryButton} onPress={resetSession}>
                <Text style={styles.secondaryButtonText}>Reset Stats</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={resetToExerciseSetup}>
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
  boxingTarget: {
    position: 'absolute',
    width: BOXING_TARGET_SIZE,
    height: BOXING_TARGET_SIZE,
    borderRadius: BOXING_TARGET_SIZE / 2,
    backgroundColor: '#f97316',
    borderWidth: 4,
    borderColor: '#fed7aa',
    shadowColor: '#fb923c',
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 0},
    elevation: 12,
    pointerEvents: 'none',
  },
  boxingHud: {
    position: 'absolute',
    top: 120,
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    pointerEvents: 'none',
  },
  boxingHudLabel: {
    ...Typography.label,
    color: '#fed7aa',
    marginBottom: 4,
  },
  boxingHudValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
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
  buttonDisabled: {
    opacity: 0.4,
  },
  guidanceBanner: {
    position: 'absolute',
    top: '18%',
    left: 24,
    right: 24,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 211, 238, 0.9)',
    pointerEvents: 'none',
  },
  guidanceBannerText: {
    color: '#0b1220',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  summaryTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryLine: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginBottom: 6,
  },
});
