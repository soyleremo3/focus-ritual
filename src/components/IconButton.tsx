import { Feather } from '@expo/vector-icons';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springConfig } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: keyof typeof Feather.glyphMap;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function IconButton({ icon, size = 22, color, backgroundColor, style, disabled, ...rest }: IconButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const resolvedColor = color ?? theme.neutral.text;
  const resolvedBg = backgroundColor ?? theme.neutral.surface;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.9, springConfig);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springConfig);
      }}
      style={[
        {
          width: size * 2,
          height: size * 2,
          borderRadius: theme.radius.pill,
          backgroundColor: resolvedBg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        animatedStyle,
        style,
      ]}
      {...rest}
    >
      <Feather name={icon} size={size} color={resolvedColor} />
    </AnimatedPressable>
  );
}
