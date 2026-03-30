import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import type { JointData } from '@sency/react-native-smkit';

interface SkeletonOverlayProps {
  jointData: JointData | null;
  width: number;
  height: number;
  cameraWidth?: number;
  cameraHeight?: number;
  mirrored?: boolean;
}

// Define skeleton connections (bones) - using actual SMKit Joint enum names
const SKELETON_CONNECTIONS = [
  // Head to neck
  ['Nose', 'Neck'],
  ['Neck', 'RShoulder'],
  ['Neck', 'LShoulder'],
  
  // Right arm
  ['RShoulder', 'RElbow'],
  ['RElbow', 'RWrist'],
  
  // Left arm
  ['LShoulder', 'LElbow'],
  ['LElbow', 'LWrist'],
  
  // Torso (using Hip as center)
  ['Neck', 'Hip'],
  ['Hip', 'RHip'],
  ['Hip', 'LHip'],
  ['RShoulder', 'RHip'],
  ['LShoulder', 'LHip'],
  
  // Right leg
  ['RHip', 'RKnee'],
  ['RKnee', 'RAnkle'],
  ['RAnkle', 'RHeel'],
  ['RHeel', 'RBigToe'],
  
  // Left leg
  ['LHip', 'LKnee'],
  ['LKnee', 'LAnkle'],
  ['LAnkle', 'LHeel'],
  ['LHeel', 'LBigToe'],
  
  // Face (optional)
  ['Nose', 'REye'],
  ['Nose', 'LEye'],
  ['REye', 'REar'],
  ['LEye', 'LEar'],
];

const SkeletonOverlay: React.FC<SkeletonOverlayProps> = ({
  jointData,
  width,
  height,
  cameraWidth = 1080,
  cameraHeight = 1920,
  mirrored = false,
}) => {
  if (!jointData) return null;

  const confidenceThreshold = 0.3;

  // Calculate the actual rendered video frame size with AspectFit
  const cameraAspect = cameraWidth / cameraHeight;
  const screenAspect = width / height;

  let videoWidth, videoHeight, offsetX, offsetY;

  if (cameraAspect > screenAspect) {
    videoWidth = width;
    videoHeight = width / cameraAspect;
    offsetX = 0;
    offsetY = (height - videoHeight) / 2;
  } else {
    videoHeight = height;
    videoWidth = height * cameraAspect;
    offsetX = (width - videoWidth) / 2;
    offsetY = 0;
  }

  // Transform coordinates from camera space to screen space
  const transformCoord = (x: number, y: number) => {
    const scaledX = mirrored
      ? offsetX + ((cameraWidth - x) / cameraWidth) * videoWidth
      : offsetX + (x / cameraWidth) * videoWidth;
    const scaledY = offsetY + (y / cameraHeight) * videoHeight;
    return { x: scaledX, y: scaledY };
  };

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={width} height={height} style={styles.svg}>
        {/* Draw bones (lines between joints) */}
        {SKELETON_CONNECTIONS.map(([joint1, joint2], index) => {
          const point1 = jointData[joint1];
          const point2 = jointData[joint2];

          if (
            point1 &&
            point2 &&
            point1.confidence > confidenceThreshold &&
            point2.confidence > confidenceThreshold
          ) {
            const p1 = transformCoord(point1.x, point1.y);
            const p2 = transformCoord(point2.x, point2.y);
            return (
              <Line
                key={`line-${index}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#00ff88"
                strokeWidth={3}
                opacity={Math.min(point1.confidence, point2.confidence)}
              />
            );
          }
          return null;
        })}

        {/* Draw joints (circles) */}
        {Object.entries(jointData).map(([jointName, joint]) => {
          if (joint.confidence > confidenceThreshold) {
            const p = transformCoord(joint.x, joint.y);
            return (
              <Circle
                key={`joint-${jointName}`}
                cx={p.x}
                cy={p.y}
                r={6}
                fill="#00ff88"
                opacity={joint.confidence}
              />
            );
          }
          return null;
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  svg: {
    position: 'absolute',
  },
});

export default SkeletonOverlay;
