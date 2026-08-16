import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springConfig } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  /** Explicit overrides — pass scene-palette colors when used over a Focus Space backdrop. */
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  variant = 'primary',
  backgroundColor,
  textColor,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const resolvedBg =
    backgroundColor ??
    (variant === 'primary' ? theme.neutral.accent : variant === 'secondary' ? theme.neutral.surface : 'transparent');
  const resolvedText = textColor ?? (variant === 'primary' ? theme.neutral.onAccent : theme.neutral.text);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.96, springConfig);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springConfig);
      }}
      style={[
        {
          backgroundColor: resolvedBg,
          borderRadius: theme.radius.pill,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: theme.neutral.border,
        },
        animatedStyle,
        style,
      ]}
      {...rest}
    >
      <Text
        color={resolvedText}
        style={{ fontFamily: theme.fontFamily.sansSemiBold, fontSize: theme.fontSize.sm, letterSpacing: 0.4 }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
