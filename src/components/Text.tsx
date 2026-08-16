import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export type TextVariant = 'hero' | 'display' | 'title' | 'body' | 'label';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** Explicit color override — pass a scene palette's text color when used over a Focus Space backdrop. */
  color?: string;
}

export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[variantStyle(theme, variant), { color: color ?? theme.neutral.text }, style]}
      {...rest}
    />
  );
}

function variantStyle(theme: ReturnType<typeof useTheme>, variant: TextVariant): TextStyle {
  switch (variant) {
    case 'hero':
      return {
        fontFamily: theme.fontFamily.displaySemiBold,
        fontSize: theme.fontSize.hero,
        lineHeight: theme.fontSize.hero * theme.lineHeight.tight,
        letterSpacing: theme.tracking.tight,
      };
    case 'display':
      return {
        fontFamily: theme.fontFamily.displaySemiBold,
        fontSize: theme.fontSize.display,
        lineHeight: theme.fontSize.display * theme.lineHeight.tight,
        letterSpacing: theme.tracking.tight,
      };
    case 'title':
      return {
        fontFamily: theme.fontFamily.displayMedium,
        fontSize: theme.fontSize.xxl,
        lineHeight: theme.fontSize.xxl * theme.lineHeight.tight,
      };
    case 'label':
      return {
        fontFamily: theme.fontFamily.sansSemiBold,
        fontSize: theme.fontSize.xs,
        lineHeight: theme.fontSize.xs * theme.lineHeight.normal,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
      };
    case 'body':
    default:
      return {
        fontFamily: theme.fontFamily.sansRegular,
        fontSize: theme.fontSize.md,
        lineHeight: theme.fontSize.md * theme.lineHeight.normal,
      };
  }
}
