import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export interface SurfaceProps extends ViewProps {
  backgroundColor?: string;
  borderColor?: string;
  padding?: number;
  radius?: number;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Surface({
  backgroundColor,
  borderColor,
  padding,
  radius: radiusProp,
  bordered = false,
  style,
  ...rest
}: SurfaceProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: backgroundColor ?? theme.neutral.surface,
          borderRadius: radiusProp ?? theme.radius.lg,
          padding: padding ?? theme.spacing.md,
          borderWidth: bordered ? 1 : 0,
          borderColor: borderColor ?? theme.neutral.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}
