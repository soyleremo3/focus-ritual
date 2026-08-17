import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springConfig } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

export interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Announced by screen readers — without it, every switch on a screen reads identically as "on/off, switch". */
  label: string;
  disabled?: boolean;
}

const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_INSET = 3;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A minimal switch — the app's only boolean-setting control, used in Settings. */
export function Toggle({ value, onValueChange, label, disabled = false }: ToggleProps) {
  const theme = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, springConfig);
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [theme.neutral.border, theme.neutral.accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2) }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={[
        {
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          borderRadius: theme.radius.pill,
          padding: THUMB_INSET,
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        trackStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            backgroundColor: theme.neutral.surface,
          },
          thumbStyle,
        ]}
      />
    </AnimatedPressable>
  );
}
