import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { configure, startSession, startDetection, stopDetection, stopSession, SMKitManagerDelegate } from '@sency/react-native-smkit/src/index.tsx';

const App: React.FC = () => {
  const [didConfig, setDidConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [exercise, setExercise] = useState('');
  const [reps, setReps] = useState(0);
  const [inPosition, setInPosition] = useState(false);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const exercisesList = [
    'HighKnees',
    'Burpees',
    'PlankHighStatic',
    'SquatRegularStatic',
  ];

  const handleDetectionData = (movementData: MovementFeedbackData) => {
    setInPosition(isInPosition => movementData.isInPosition);
    if (movementData.didFinishMovement) {
      setReps(reps => reps + 1);
    }
  };

  const handlePositionData = (position: JointData) => {
    // Handle position data
  };

  const handleSessionErrors = (error: string) => {
    console.error('Session Error:', error);
    Alert.alert('Error', error);
  };

  const smKitManagerDelegate: SMKitManagerDelegate = {
    handleDetectionData,
    handlePositionData,
    handleSessionErrors,
  };

  useEffect(() => {
    configureSMKit();
  }, []);

  return (
    <View style={styles.centeredView}>
      {isLoading && <ActivityIndicator size="large" color="#ff0000" />}
      {didConfig && (
        <View>
          <Text style={styles.textStyle}>Exercise: {exercise}</Text>
          <Text style={styles.textStyle}>Rep: {reps}</Text>
          <Text style={styles.textStyle}>
            InPosition: {inPosition ? 'true' : 'false'}
          </Text>

          <Pressable style={[styles.button]} onPress={startSMKitSession}>
            <Text style={styles.textStyle}>Start Session</Text>
          </Pressable>

          <Pressable style={[styles.button]} onPress={startSMKitDetection}>
            <Text style={styles.textStyle}>Start Detection</Text>
          </Pressable>

          <Pressable style={[styles.button]} onPress={stopSMKitDetection}>
            <Text style={styles.textStyle}>Stop Detection</Text>
          </Pressable>

          <Pressable style={[styles.button]} onPress={stopSMKitSession}>
            <Text style={styles.textStyle}>Stop Session</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  async function configureSMKit() {
    try {
      setIsLoading(true);
      const res = await configure('YOUR_AUTH_KEY');
      console.log('DONE config');
      setIsLoading(false);
      setDidConfig(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function startSMKitSession() {
    try {
      const res = await startSession(true, smKitManagerDelegate);
      console.log('Session Started');
    } catch (e) {
      console.error(e);
    }
  }

  async function startSMKitDetection() {
    try {
      const exerciseName = exercisesList[exerciseIndex];
      setExercise(exerciseName);
      const res = await startDetection(exerciseName);
      console.log('Detection Started');
    } catch (e) {
      console.error(e);
    }
  }

  async function stopSMKitDetection() {
    try {
      const res = await stopDetection();
      Alert.alert('Result: ' + res);
      const newIndex = (exerciseIndex + 1) % exercisesList.length;
      setExerciseIndex(newIndex);
      setInPosition(false);
      setReps(0);
      console.log('Detection Stopped');
    } catch (e) {
      console.error(e);
    }
  }

  async function stopSMKitSession() {
    try {
      const res = await stopSession();
      Alert.alert('Result: ' + res);

      console.log('Session Stopped');
    } catch (e) {
      console.error(e);
    }
  }
};

const styles = StyleSheet.create({
  sdk: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    padding: 10,
    elevation: 2,
    borderColor: 'red',
    borderWidth: 1,
    margin: 5,
  },
  textStyle: {
    color: 'red',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
});

export default App;
