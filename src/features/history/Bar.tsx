import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface BarProps {
  /** 0..1 — the bar's height relative to the tallest bar in its chart. */
  heightRatio: number;
  label: string;
  maxHeight?: number;
  color?: string;
}

/** One bar in a small custom bar chart — no charting library, just Views. */
export function Bar({ heightRatio, label, maxHeight = 72, color }: BarProps) {
  const theme = useTheme();
  const barHeight = Math.max(4, heightRatio * maxHeight);

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xxs }}>
      <View style={{ height: maxHeight, justifyContent: 'flex-end' }}>
        <View
          style={{
            width: 18,
            height: barHeight,
            borderRadius: theme.radius.sm,
            backgroundColor: color ?? theme.neutral.accent,
          }}
        />
      </View>
      <Text variant="label" color={theme.neutral.textMuted} style={{ fontSize: theme.fontSize.xs }}>
        {label}
      </Text>
    </View>
  );
}
