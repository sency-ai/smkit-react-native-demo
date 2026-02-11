import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
} from '../theme';

interface StatsCardProps {
  label: string;
  value: string | number;
  color?: string;
  style?: ViewStyle;
}

interface StatsPanelProps {
  repCount: number;
  time: string;
  formScore: number;
  feedback?: string;
  style?: ViewStyle;
}

const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  color = Colors.primary,
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const StatsPanel: React.FC<StatsPanelProps> = ({
  repCount,
  time,
  formScore,
  feedback,
  style,
}) => {
  const getFormColor = (score: number) => {
    if (score >= 80) return Colors.primary;
    if (score >= 60) return Colors.warning;
    return Colors.error;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.cardsRow}>
        <StatsCard label="REPS" value={repCount} color={Colors.primary} style={styles.card} />
        <StatsCard label="TIME" value={time} color={Colors.secondary} style={styles.card} />
        <StatsCard label="FORM" value={`${formScore}%`} color={getFormColor(formScore)} style={styles.card} />
      </View>

      {feedback ? (
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGlass,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  value: {
    ...Typography.h1,
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  feedbackContainer: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.glassBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  feedbackText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

export default StatsPanel;
