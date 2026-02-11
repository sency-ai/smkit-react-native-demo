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

const SKELETON_CONNECTIONS = [
  ['Nose', 'Neck'],
  ['Neck', 'RShoulder'],
  ['Neck', 'LShoulder'],
  ['RShoulder', 'RElbow'],
  ['RElbow', 'RWrist'],
  ['LShoulder', 'LElbow'],
  ['LElbow', 'LWrist'],
  ['Neck', 'Hip'],
  ['Hip', 'RHip'],
  ['Hip', 'LHip'],
  ['RShoulder', 'RHip'],
  ['LShoulder', 'LHip'],
  ['RHip', 'RKnee'],
  ['RKnee', 'RAnkle'],
  ['RAnkle', 'RHeel'],
  ['RHeel', 'RBigToe'],
  ['LHip', 'LKnee'],
  ['LKnee', 'LAnkle'],
  ['LAnkle', 'LHeel'],
  ['LHeel', 'LBigToe'],
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

  const confidenceThreshold = 0.2;

  const transformCoord = (x: number, y: number) => {
    const isNormalized = x <= 1 && y <= 1;
    const nx = isNormalized ? x : x / cameraWidth;
    const ny = isNormalized ? y : y / cameraHeight;
    const scaledX = mirrored ? (1 - nx) * width : nx * width;
    const scaledY = ny * height;
    return { x: scaledX, y: scaledY };
  };

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={width} height={height} style={styles.svg}>
        {SKELETON_CONNECTIONS.map(([joint1, joint2], index) => {
          const point1 = jointData[joint1 as keyof JointData] as
            | { x: number; y: number; confidence?: number }
            | undefined;
          const point2 = jointData[joint2 as keyof JointData] as
            | { x: number; y: number; confidence?: number }
            | undefined;

          const c1 = point1?.confidence ?? 1;
          const c2 = point2?.confidence ?? 1;

          if (point1 && point2 && c1 > confidenceThreshold && c2 > confidenceThreshold) {
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
                opacity={Math.min(c1, c2)}
              />
            );
          }
          return null;
        })}

        {Object.entries(jointData).map(([jointName, joint]) => {
          const point = joint as { x: number; y: number; confidence?: number };
          const confidence = point.confidence ?? 1;
          if (confidence > confidenceThreshold) {
            const p = transformCoord(point.x, point.y);
            return (
              <Circle
                key={`joint-${jointName}`}
                cx={p.x}
                cy={p.y}
                r={6}
                fill="#00ff88"
                opacity={confidence}
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
