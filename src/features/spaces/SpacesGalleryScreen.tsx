import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, View } from 'react-native';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import * as haptics from '@/lib/haptics';
import { useSpaceStore } from '@/store/spaceStore';
import { useTheme } from '@/theme/ThemeProvider';

import { SpaceCard } from './SpaceCard';

const NUM_COLUMNS = 2;

export function SpacesGalleryScreen() {
  const theme = useTheme();
  const spaces = useSpaceStore((s) => s.spaces);
  const activeSpaceId = useSpaceStore((s) => s.activeSpaceId);
  const refresh = useSpaceStore((s) => s.refresh);
  const selectSpace = useSpaceStore((s) => s.selectSpace);
  const toggleFavorite = useSpaceStore((s) => s.toggleFavorite);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const handleSelect = (id: string) => {
    haptics.tap();
    void selectSpace(id);
    router.back();
  };

  const handleEdit = (id: string) => {
    haptics.tap();
    router.push({ pathname: '/spaces/[id]', params: { id } });
  };

  const handleToggleFavorite = (id: string) => {
    haptics.select();
    void toggleFavorite(id);
  };

  const handleAddCustomSpace = () => {
    haptics.tap();
    router.push('/spaces/new');
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
        <Text variant="title">Focus Spaces</Text>
        <IconButton icon="x" size={18} onPress={() => router.back()} accessibilityLabel="Close Focus Spaces" />
      </View>

      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={{ gap: theme.spacing.sm }}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.xxxl }}
        renderItem={({ item }) => (
          <SpaceCard
            space={item}
            selected={item.id === activeSpaceId}
            onPress={() => handleSelect(item.id)}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
            onEdit={item.kind === 'custom' ? () => handleEdit(item.id) : undefined}
          />
        )}
        ListFooterComponent={
          <View style={{ paddingTop: theme.spacing.sm }}>
            <Button label="Add Custom Space" variant="secondary" onPress={handleAddCustomSpace} />
          </View>
        }
      />
    </Screen>
  );
}
