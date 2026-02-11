import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
  Dimensions,
} from 'react-native';
import {
  Colors,
  Spacing,
  BorderRadius,
  Shadows,
  Typography,
} from '../theme';

interface CameraWindowProps {
  children: React.ReactNode;
  isLive?: boolean;
  style?: ViewStyle;
  fullscreen?: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CAMERA_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const CAMERA_HEIGHT = (CAMERA_WIDTH / 16) * 9;

const CameraWindow: React.FC<CameraWindowProps> = ({
  children,
  isLive = true,
  style,
  fullscreen = false,
}) => {
  if (fullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <View style={[styles.fullscreenWindow, style]}>
          {children}

          {isLive && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.window, style]}>
        {children}

        {isLive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
  },
  window: {
    width: CAMERA_WIDTH,
    height: CAMERA_HEIGHT,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.borderGlass,
    backgroundColor: Colors.surface1,
    ...Shadows.lg,
  },
  fullscreenContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.background,
  },
  fullscreenWindow: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    overflow: 'hidden',
    backgroundColor: Colors.surface1,
  },
  liveIndicator: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    zIndex: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    marginRight: Spacing.sm,
  },
  liveText: {
    ...Typography.label,
    color: Colors.error,
  },
});

export { CAMERA_WIDTH, CAMERA_HEIGHT, SCREEN_WIDTH, SCREEN_HEIGHT };
export default CameraWindow;
