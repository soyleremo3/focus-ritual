import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Surface } from '@/components/Surface';
import { Text } from '@/components/Text';
import type { Ritual } from '@/domain/ritual/types';
import { MODE_LABELS } from '@/features/focus/ModePicker';
import * as haptics from '@/lib/haptics';
import { soundLibrary } from '@/lib/audio/soundLibrary';
import { useRitualStore } from '@/store/ritualStore';
import { scenePalettes, type SceneId } from '@/theme/scenePalettes';
import { useTheme } from '@/theme/ThemeProvider';

export interface RitualCardProps {
  ritual: Ritual;
}

export function soundLabels(soundIds: string[]): string {
  if (soundIds.length === 0) return 'No ambient sounds';
  return soundIds
    .map((id) => soundLibrary.find((s) => s.id === id)?.label ?? id)
    .join(', ');
}

export function RitualCard({ ritual }: RitualCardProps) {
  const theme = useTheme();
  const toggleFavorite = useRitualStore((s) => s.toggleFavorite);
  const duplicate = useRitualStore((s) => s.duplicate);
  const remove = useRitualStore((s) => s.remove);

  const sceneName = ritual.spaceId ? scenePalettes[ritual.spaceId as SceneId]?.name : undefined;
  const durationLabel =
    ritual.focusMinutes != null
      ? `${ritual.focusMinutes} min${ritual.cyclesTarget ? ` × ${ritual.cyclesTarget}` : ''}`
      : 'Open-ended';
  const subtitle = [MODE_LABELS[ritual.timerMode], durationLabel, sceneName].filter(Boolean).join(' · ');

  const handleEdit = () => {
    haptics.tap();
    router.push({ pathname: '/rituals/[id]', params: { id: ritual.id } });
  };

  const handleStart = () => {
    haptics.tap();
    router.push({ pathname: '/', params: { startRitualId: ritual.id } });
  };

  const handleToggleFavorite = () => {
    haptics.select();
    void toggleFavorite(ritual.id);
  };

  const handleDuplicate = () => {
    haptics.tap();
    void duplicate(ritual.id);
  };

  const handleDelete = () => {
    haptics.tap();
    Alert.alert('Delete Ritual', `Delete "${ritual.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(ritual.id) },
    ]);
  };

  return (
    <Pressable onPress={handleEdit}>
      <Surface style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="title" style={{ fontSize: theme.fontSize.lg }}>
              {ritual.name}
            </Text>
            <Text variant="body" color={theme.neutral.textMuted}>
              {subtitle}
            </Text>
            <Text variant="body" color={theme.neutral.textMuted} style={{ fontSize: theme.fontSize.sm }}>
              {soundLabels(ritual.soundLayers.map((l) => l.soundId))}
            </Text>
          </View>
          <IconButton
            icon="star"
            size={16}
            onPress={handleToggleFavorite}
            color={ritual.isFavorite ? theme.neutral.accent : theme.neutral.textMuted}
            backgroundColor="transparent"
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Button label="Start" onPress={handleStart} style={{ flex: 1 }} />
          <IconButton icon="copy" size={16} onPress={handleDuplicate} />
          <IconButton
            icon="trash-2"
            size={16}
            onPress={handleDelete}
            color={theme.neutral.textMuted}
          />
        </View>
      </Surface>
    </Pressable>
  );
}

