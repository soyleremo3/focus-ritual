import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springConfig } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export interface ChipProps extends Omit<PressableProps, 'style'> {
  label: string;
  selected?: boolean;
  /** Explicit overrides — pass scene-palette colors when used over a Focus Space backdrop. */
  color?: string;
  onColor?: string;
  mutedColor?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Chip({
  label,
  selected = false,
  color,
  onColor,
  mutedColor,
  borderColor,
  style,
  ...rest
}: ChipProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const accent = color ?? theme.neutral.accent;
  const onAccent = onColor ?? theme.neutral.onAccent;
  const muted = mutedColor ?? theme.neutral.textMuted;
  const resolvedBorder = borderColor ?? theme.neutral.border;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPressIn={() => {
        scale.value = withSpring(0.95, springConfig);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springConfig);
      }}
      style={[
        {
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.pill,
          backgroundColor: selected ? accent : 'transparent',
          borderWidth: 1,
          borderColor: selected ? accent : resolvedBorder,
        },
        animatedStyle,
        style,
      ]}
      {...rest}
    >
      <Text variant="label" color={selected ? onAccent : muted} style={{ letterSpacing: 0.6 }}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}
