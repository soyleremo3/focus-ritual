import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import * as haptics from '@/lib/haptics';
import { useRitualStore } from '@/store/ritualStore';
import { useTheme } from '@/theme/ThemeProvider';

import { RitualCard } from './RitualCard';

export function RitualsListScreen() {
  const theme = useTheme();
  const rituals = useRitualStore((s) => s.rituals);
  const loaded = useRitualStore((s) => s.loaded);
  const refresh = useRitualStore((s) => s.refresh);

  // Refetch every time this tab regains focus, so returning from the editor (create,
  // edit, duplicate) or a favorite/delete action taken elsewhere shows up immediately.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const handleCreate = () => {
    haptics.tap();
    router.push('/rituals/new');
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <Text variant="title">Rituals</Text>
        <Button label="New" onPress={handleCreate} />
      </View>

      {loaded && rituals.length === 0 ? (
        <EmptyState
          icon="repeat"
          title="No rituals yet"
          message="Combine a timer mode, Focus Space, and sound mix into a ritual you can start with one tap."
        />
      ) : (
        <FlatList
          data={rituals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RitualCard ritual={item} />}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
        />
      )}
    </Screen>
  );
}
