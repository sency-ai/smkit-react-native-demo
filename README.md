# SMKit React Native Demo

A modern React Native demo app showcasing real-time pose detection, exercise tracking, and form analysis using the **@sency/react-native-smkit** library (v1.0.7).

## Features

- ✅ Real-time pose detection with skeleton visualization
- ✅ Exercise-specific form feedback and scoring
- ✅ Rep counting for dynamic exercises
- ✅ Live performance metrics (form score, elapsed time)
- ✅ Support for static/dynamic exercises
- ✅ TypeScript support
- ✅ iOS support

## Prerequisites

- Node.js ≥ 18
- macOS with Xcode for iOS development
- CocoaPods
- Valid SMKit API key from [sency.ai](https://sency.ai)

## Installation

### 1. Install dependencies
```bash
yarn install
```

### 2. iOS setup
```bash
cd ios
pod install
cd ..
```

## Quick Start

### Step 1: Configure SMKit

Call `configure()` early in your app lifecycle:

```tsx
import { configure } from '@sency/react-native-smkit';

useEffect(() => {
  configure('YOUR_API_KEY').catch(err => {
    console.error('SMKit configuration failed:', err);
  });
}, []);
```

**⚠️ Required:** `configure()` must be called before rendering `SmkitCameraView`.

### Step 2: Add the Camera View

Use the `SmkitCameraView` component to render the camera and run detection:

```tsx
import { SmkitCameraView, type SmkitCameraViewRef } from '@sency/react-native-smkit';
import { useRef } from 'react';

const MyExerciseScreen = () => {
  const cameraRef = useRef<SmkitCameraViewRef>(null);

  const handleDetectionData = (data: MovementFeedbackData) => {
    if (data.didFinishMovement) {
      // Rep completed
      setRepCount(prev => prev + 1);
    }
    console.log('Form score:', data.techniqueScore);
  };

  return (
    <SmkitCameraView
      ref={cameraRef}
      authKey="YOUR_API_KEY"
      exercise="SquatRegular"
      phonePosition="Floor"
      userHeight={175}
      onDetectionData={handleDetectionData}
      style={{ flex: 1 }}
    />
  );
};
```

### Step 3: Control Sessions

```tsx
// Start camera session
cameraRef.current?.startSession();

// Start movement detection for a specific exercise
cameraRef.current?.startDetection('SquatRegular');

// Stop detection
cameraRef.current?.stopDetection();

// Stop session
cameraRef.current?.stopSession();
```

## API Reference

### SmkitCameraView Component

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `ref` | `React.Ref<SmkitCameraViewRef>` | Yes | Ref to call imperative methods |
| `authKey` | `string` | Yes | SMKit authentication key |
| `exercise` | `string` | No | Exercise type to detect (e.g., `'SquatRegular'`) |
| `phonePosition` | `'Floor' \| 'Elevated'` | No | Phone position relative to user (default: `'Floor'`) |
| `userHeight` | `number` | No | User height in cm for form analysis |
| `autoStart` | `boolean` | No | Auto-start session on mount (default: `false`) |
| `onDetectionData` | `(data: MovementFeedbackData) => void` | No | Called when movement data is detected |
| `onPositionData` | `(data: JointData) => void` | No | Called with joint position data |
| `onDetectionStopped` | `(summary: ExerciseSummary) => void` | No | Called when detection stops with session summary |
| `onError` | `(error: string) => void` | No | Called when errors occur |
| `onPreviewReady` | `() => void` | No | Called when camera preview is ready |
| `style` | `StyleProp<ViewStyle>` | No | View styling |

#### Ref Methods (SmkitCameraViewRef)

```tsx
startSession(): void
// Starts the camera session and initializes detection

stopSession(): void
// Stops the camera session and cleans up resources

startDetection(exercise: string): void
// Begins detecting the specified exercise

stopDetection(): void
// Stops detection and returns exercise summary
```

### Data Types

#### MovementFeedbackData

Real-time feedback for each detected movement frame:

```tsx
interface MovementFeedbackData {
  didFinishMovement: boolean;     // Rep completed
  isShallowRep: boolean;          // Form issue: shallow rep
  isInPosition: boolean;          // User in correct position
  isPerfectForm: boolean;         // Perfect form detected
  techniqueScore: number;         // Technique score (0-100)
  detectionConfidence: number;    // Detection confidence (0-1)
  feedback: string[];             // User feedback messages
  currentRomValue: number;        // Current range of motion
  specialParams: Record<string, number>; // Exercise-specific params
}
```

#### ExerciseSummary

Summary data returned when detection stops:

```tsx
interface ExerciseSummary {
  sessionId: string;              // Unique session ID
  exerciseName: string;           // Exercise name
  startTime: string;              // ISO 8601 start timestamp
  endTime: string;                // ISO 8601 end timestamp
  totalTime: number;              // Duration in seconds
  techniqueScore: number;         // Average technique score (0-100)
}
```

#### JointData

Joint position data for pose tracking:

```tsx
interface JointPosition {
  x: number;        // Normalized x coordinate (0-1)
  y: number;        // Normalized y coordinate (0-1)
  confidence?: number; // Confidence level
}

interface JointData {
  [jointName: string]: JointPosition;
}
```

**Available joints:** Nose, Neck, RShoulder, RElbow, RWrist, LShoulder, LElbow, LWrist, RHip, RKnee, RAnkle, LHip, LKnee, LAnkle, REye, LEye, REar, LEar, Hip, Chest, Head, LBigToe, RBigToe, LSmallToe, RSmallToe, LHeel, RHeel.

### Supported Exercises

Map user-friendly names to native SMKit exercise types:

```tsx
const EXERCISE_TYPE_MAP: Record<string, string> = {
  'Squat': 'SquatRegular',
  'Pushup': 'PushupRegular',
  'JumpingJacks': 'JumpingJacks',
  'Plank': 'PlankHighStatic',
  'HighKnees': 'HighKnees',
};

// Pass the mapped native type to startDetection:
cameraRef.current?.startDetection(EXERCISE_TYPE_MAP['Squat']);
```

## iOS Setup

### Minimum Deployment Target

Ensure your Podfile targets iOS 16 or higher:

```ruby
platform :ios, 16.0
```

If you encounter CocoaPods errors, verify your Podfile contains:

```ruby
source 'https://bitbucket.org/sencyai/ios_sdks_release.git'
source 'https://github.com/CocoaPods/Specs.git'

use_frameworks!

post_install do |installer|
  react_native_post_install(installer, :mac_catalyst_enabled => false)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
      config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'arm64'
    end
  end
end
```

### Camera Permissions

Add camera usage description to `ios/RNSMKitDemoApp/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is needed to detect your exercise form and provide real-time feedback.</string>
```

## Running the App

### iOS

```bash
yarn ios
```

Or open the workspace in Xcode:

```bash
open ios/RNSMKitDemoApp.xcworkspace
```

### Development Server

```bash
yarn start
```

## Project Structure

```
├── App.tsx                 # Main app component with exercise flow
├── components/
│   ├── CameraWindow.tsx   # Camera frame wrapper
│   ├── SkeletonOverlay.tsx # Pose skeleton visualization
│   └── StatsPanel.tsx     # Performance metrics display
├── theme/
│   └── index.ts           # Design tokens and colors
├── ios/                   # iOS native configuration
└── package.json           # Dependencies
```

## Troubleshooting

### "SMKit not configured" error
- Call `configure(key)` at app startup before rendering `SmkitCameraView`

### Camera not showing
- Ensure camera permissions are granted in Info.plist
- Check that `onPreviewReady` callback fires
- Verify the phone is properly positioned for detection

### No detection data
- Verify correct exercise type is passed to `startDetection()`
- Check user height and phone position are correct
- Ensure user is visible and well-lit in the camera frame

### CocoaPods version conflicts
- Run `pod repo update` to update CocoaPods specs
- Try `pod install --repo-update`

## License

See LICENSE file for details.

## Support

For issues, feature requests, or documentation, visit [sency.ai](https://sency.ai).
