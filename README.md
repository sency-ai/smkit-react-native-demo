# SMKit React Native Demo

React Native demo app for `@sency/react-native-smkit` 1.2.1. It exercises the public JS API on iOS and Android: configure, camera preview, start/stop session, detection events, position events, stop summaries, and exercise config overrides.

## Features

- Real-time camera preview and SMKit exercise detection
- Rep counting, form score, feedback, and stop summaries
- iOS skeleton overlay through JS position events
- Android skeleton overlay through the native SMKit view path to reduce JS/UI latency
- Sample `startSession(modifications)` overrides for Squat and Pushup
- Android runtime camera permission flow

## Prerequisites

- Node.js 18+
- Yarn 3.6.4
- Valid SMKit API key in `.env` as `API_PUBLIC_KEY=...`
- iOS: macOS, Xcode, CocoaPods, iOS 17.0+ deployment target
- Android: Android Studio/SDK, JDK 17, Android min SDK 26, Android Gradle Plugin 8.6+
- Android SMKit Maven access through one of:
  - local sibling `../smkit_android/repo`
  - local Maven cache
  - `https://artifacts.sency.ai/artifactory/release`

## Install

```bash
yarn install
```

For iOS:

```bash
cd ios
pod install
cd ..
```

## Run

Start Metro:

```bash
yarn start --reset-cache
```

Run Android:

```bash
yarn android
```

Or build/install from Gradle:

```bash
cd android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Run iOS:

```bash
yarn ios
```

## Android Notes

- Camera permission is requested before mounting `SmkitCameraView`.
- Android config passes `poseModelChoice: 'AdaptiveChoice'` so this demo follows the SDK adaptive model selection path.
- The camera view uses `showNativeSkeletonOverlay` on Android. JS `onPositionData` is disabled for normal exercises to avoid SVG render lag and is enabled only for the boxing mini-game.
- `positionDataFps` is capped at 15 and `detectionDataFps` at 8 for smoother JS updates.
- Android props that are iOS-only in SDK 1.7.1 remain no-op/unsupported: wide-angle camera, camera type, 3D options, workout paused gesture region, and `recordExercise=false`.

## iOS Notes

The Podfile must include the Sency CocoaPods source and iOS 17.0+ target. See `docs/ios-setup.md` for the full Podfile notes.

`Info.plist` must include:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is needed to detect your exercise form and provide real-time feedback.</string>
```

## Basic API Shape

```tsx
import {
  SmkitCameraView,
  configure,
  preloadModelsInBackground,
  type SmkitCameraViewRef,
} from '@sency/react-native-smkit';
import { Platform } from 'react-native';

await configure(API_KEY, {
  useBundledModelsOnColdStart: true,
  poseModelChoice: Platform.OS === 'android' ? 'AdaptiveChoice' : undefined,
});
preloadModelsInBackground();

cameraRef.current?.startSession({
  SquatRegular: {
    DepthScore: { threshold: 0.75 },
  },
});
cameraRef.current?.startDetection('SquatRegular');
```

```tsx
<SmkitCameraView
  ref={cameraRef}
  authKey={API_KEY}
  phonePosition="Floor"
  userHeight={175}
  showNativeSkeletonOverlay={Platform.OS === 'android'}
  positionDataFps={15}
  detectionDataFps={8}
  onPreviewReady={setPreviewReady}
  onDetectionData={handleDetectionData}
  onDetectionStopped={handleDetectionStopped}
/>
```

## Troubleshooting

Metro says the script cannot load:

```bash
adb reverse tcp:8081 tcp:8081
yarn start --reset-cache
```

Port 8081 is already in use:

```bash
lsof -i :8081
kill <pid>
```

Android cannot resolve SMKit artifacts:

- Confirm `android/build.gradle` can see `../smkit_android/repo`, or
- Configure access to `https://artifacts.sency.ai/artifactory/release`.

Camera starts but detection feels delayed:

- Keep Android `showNativeSkeletonOverlay` enabled.
- Avoid subscribing to `onPositionData` unless the screen needs per-joint data.
- Use `adb logcat | grep -E "SMKit|ReactNativeJS|RNSMKitDemoApp"` to inspect native and JS logs.
