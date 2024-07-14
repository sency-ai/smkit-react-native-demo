# smkit-react-native-demo

1. [ Installation ](#inst)
2. [ Setup ](#setup)
3. [ Configure ](#config)
4. [ Start ](#start)
5. [ Data ](#data)

<a name="inst"></a>
## 1. Installation
run `npm install @sency/react-native-smkit`

## 2. Setup <a name="setup"></a>
* [iOS](https://github.com/sency-ai/smkit-react-native-demo/blob/main/docs/ios-setup.md)

## 3. Configure<a name="config"></a>

```js
  [1] First import configure
  import { configure } from '@sency/react-native-smkit/src/index.tsx';

  [2] then call the configure function with your auth key
  async function configureSMKit() {
    try {
      const res = await configure('YOUR_AUTH_KEY');
    } catch (e) {
      console.error(e);
    }
  }
```
To reduce wait time we recommend to call `configure` on app launch.

**⚠️ react-native-smkit will not work if you don't first call configure.**

## 4. Start ##

### Start exercise detection 

First add the neccery imports
```js
import { configure, startSession, startDetection, stopDetection, stopSession, SMKitManagerDelegate } from '@sency/react-native-smkit/src/index.tsx';
```

Implment **SMKitManagerDelegate**

```js
  const smKitManagerDelegate: SMKitManagerDelegate = {
    handleDetectionData,
    handlePositionData,
    handleSessionErrors,
  };

  // This function will be called every frame with movement data.
  const handleDetectionData = (movementData: MovementFeedbackData) => {
    // Handle movement data
  };

  // This function will be called every time the SDK detects JointData.
  const handlePositionData = (position: JointData) => {
    // Handle position data
  };
  
  // This function will be called if any error occurred.
  const handleSessionErrors = (error: string) => {
    // Handle error
  };

```

Now we can start the exercise.

```js
  // [1] First you will need to start the session.
  async function startSMKitSession() {
    try {
      // startSession requirs 2 params shouldPresentCameraSession and the SMKitManagerDelegate
      const res = await startSession(true, smKitManagerDelegate);
      console.log('Session Started');
    } catch (e) {
      console.error(e);
    }
  }
  
  // [2] Then call startDetection to start the exercise detection.
  async function startSMKitDetection() {
    try {
      const res = await startDetection("EXERCISE_NAME");
      console.log('Detection Started');
    } catch (e) {
      console.error(e);
    }
  }
  
  // [3] When you are ready to stop the exercise call stopDetection.
  async function stopSMKitDetection() {
    try {
      // Stops the exercise detection and returns result json.
      const res = await stopDetection();
      console.log('Detection Stopped ' + res);
    } catch (e) {
      console.error(e);
    }
  }

  // [4] When you are ready to stop the session call stopSession.
  async function stopSMKitSession() {
    try {
          // Stops the session and returns result json.
        const res = await stopSession();
        console.log('Session Stopped');
    } catch (e) {
        console.error(e);
    }
 }
```

## 5. Available Data Types <a name="data"></a>

#### `MovementFeedbackData`
| Type                | Format                                                         | Description                                                                                                  |
|---------------------|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| didFinishMovement   | `boolean`                                                      | Will be true when the user finishes a dynamic movement.                                                      |
| isShallowRep        | `boolean`                                                      | Will be true when the user finishes a shallow dynamic movement.                                              |
| isInPosition        | `boolean`                                                      | Will be true if the user is in the correct position.                                                         |
| isPerfectForm       | `boolean`                                                      | Will be true if the user did not have any mistakes.                                                          |
| techniqueScore      | `number`                                                       | The score representing the user's technique during the exercise.                                             |
| detectionConfidence | `number`                                                       | The confidence score.                                                                                        |
| feedback            | `string[]`                                                     | Array of feedback about the user's movement.                                                                 |
| currentRomValue     | `number`                                                       | The current Range Of Motion of the user.                                                                     |
| specialParams       | `{ [key: string]: number }`                                    | A dictionary with every special parameter.                                                                   |

#### `JointPosition`
| Type                | Format                                                         | Description                                                                                                  |
|---------------------|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| x                   | `number`                                                       | The joint x position                                                                                         |
| y                   | `number`                                                       | The joint y position                                                                                         |

#### `JointData`
possible list of joints

| Name                |
|---------------------|
| Nose                |
| Neck                |
| RShoulder           |
| RElbow              |
| RWrist              |
| LShoulder           |
| LElbow              |
| LWrist              |
| RHip                |
| RKnee               |
| RAnkle              |
| LHip                |
| LKnee               |
| LAnkle              |
| REye                |
| LEye                |
| REar                |
| LEar                |
| Hip                 |
| Chest               |
| Head                |
| LBigToe             |
| RBigToe             |
| LSmallToe           |
| RSmallToe           |
| LHeel               |
| RHeel               |
