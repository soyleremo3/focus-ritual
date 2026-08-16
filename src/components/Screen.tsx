import { SafeAreaView } from 'react-native-safe-area-context';
import { type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export function Screen({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.neutral.background }, style]} {...rest}>
      {children}
    </SafeAreaView>
  );
}
