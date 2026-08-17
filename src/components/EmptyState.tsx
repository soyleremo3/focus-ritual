import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message?: string;
  /** Renders a "Try Again" button below the message — for error states a reload can recover from. */
  onRetry?: () => void;
}

export function EmptyState({ icon = 'clock', title, message, onRetry }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.sm,
      }}
    >
      <Feather name={icon} size={28} color={theme.neutral.textMuted} />
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" color={theme.neutral.textMuted} style={{ textAlign: 'center' }}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button label="Try Again" variant="secondary" onPress={onRetry} style={{ marginTop: theme.spacing.sm }} />
      ) : null}
    </View>
  );
}
