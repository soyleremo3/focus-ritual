import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.md,
          backgroundColor: theme.neutral.background,
        }}
      >
        <Text variant="title">This screen doesn&apos;t exist.</Text>
        <Link href="/">
          <Text variant="body" color={theme.neutral.accent}>
            Go to Focus
          </Text>
        </Link>
      </View>
    </>
  );
}
