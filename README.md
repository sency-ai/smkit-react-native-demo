# SMKit React Native Demo

React Native demo app for the published `@sency/react-native-smkit` 1.2.4 package. It exercises the public JS API on iOS and Android: configure, camera preview, the session lifecycle, detection and position events, phone and body calibration, guidance mode, exercise summaries, recovered sessions, and exercise config overrides.

## Features

- Real-time camera preview and SMKit exercise detection
- Session state driven by `onSessionStateChange` (starting, running, stopped with a reason)
- Rep counting and form score for dynamic exercises, time in position for static holds (Plank)
- Every active feedback item, not only the first one
- Exercise summary screen built from `onDetectionStopped` (reps, perfect reps, time in position, technique score, top feedback)
- Phone and body calibration before detection on iOS and Android
- Optional guidance mode and guidance suggestions
- Results recovered after a crash or native fault, shown on the next launch
- Changing the exercise or the config overrides restarts the session so they apply
- iOS skeleton overlay through JS position events
- Android skeleton overlay through the native SMKit view path to reduce JS/UI latency
- Sample `startSession(modifications)` overrides for Squat and Pushup
- Android runtime camera permission flow

## Prerequisites

- Node.js 18+
- Yarn 3.6.4
- A Sency SDK key in the git-ignored `AuthKey.local.properties` file (see [Configure the demo](#configure-the-demo))
- iOS: macOS, Xcode, CocoaPods, iOS 17.0+ deployment target
- Android: Android Studio/SDK, JDK 17, Android min SDK 24 (Android 7.0), Android Gradle Plugin 8.6+
- Android SMKit Maven access to `https://artifacts.sency.ai/artifactory/release`

## Install

```bash
yarn install
```

The demo installs the published package directly from npm:

```sh
yarn add @sency/react-native-smkit@1.2.4
```

For iOS:

```bash
cd ios
pod install
cd ..
```

The bridge podspec is pinned to `SMKit` and `SMBase` 2.7.3. Android resolves SMKit and SMBase 1.9.9 from Sency Artifactory.

## Configure the demo

Copy the template in the project root and paste your key into the copy:

```bash
cp AuthKey.local.properties.example AuthKey.local.properties
```

```properties
SMKIT_UI_AUTH_KEY=your_sency_sdk_key_here
```

`AuthKey.local.properties` is git-ignored, so the key never shows up in `git status` or a commit. A `SMKIT_UI_AUTH_KEY` environment variable overrides the file (useful for CI). `react-native-dotenv` inlines the key at bundle time, and the app imports it as `SMKIT_UI_AUTH_KEY` from `@env`. This is the same file and variable name the Android demo (`smkit-ui-android-demo`) uses.

After creating or changing the file, restart Metro with `--reset-cache` so the new value is picked up.

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
- iOS-only options (back camera, 3D options, workout paused gesture region, video analysis) are no-ops or report an error on Android. See the SDK README.

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
  consumeRecoveredSessionSummaries,
  preloadModelsInBackground,
  type SmkitCameraViewRef,
} from '@sency/react-native-smkit';
import { Platform } from 'react-native';

await configure(API_KEY, {
  poseModelChoice: Platform.OS === 'android' ? 'AdaptiveChoice' : undefined,
});
preloadModelsInBackground();
const recovered = await consumeRecoveredSessionSummaries();

cameraRef.current?.startSession({
  SquatRegular: {
    DepthScore: { threshold: 0.75 },
  },
});
cameraRef.current?.startDetection('SquatRegular', { guidanceMode: false });
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
  onSessionStateChange={handleSessionState}
  onPreviewReady={setPreviewReady}
  onDetectionData={handleDetectionData}
  onDetectionStopped={handleDetectionStopped}
/>
```

`startSession()` on a view that is already starting or running does nothing, so the demo calls `stopSession()` and waits for the `stopped` state before starting again with new modifications.

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

- Confirm network access to `https://artifacts.sency.ai/artifactory/release`.

Camera starts but detection feels delayed:

- Keep Android `showNativeSkeletonOverlay` enabled.
- Avoid subscribing to `onPositionData` unless the screen needs per-joint data.
- Use `adb logcat | grep -E "SMKit|ReactNativeJS|RNSMKitDemoApp"` to inspect native and JS logs.

## License

See [LICENSE](LICENSE).
