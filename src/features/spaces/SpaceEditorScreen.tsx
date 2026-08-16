import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { getDatabase } from '@/db/client';
import { getSpaceById } from '@/db/repositories/spacesRepo';
import { isValidSpaceName } from '@/domain/space/space';
import type { MoodId, Space } from '@/domain/space/types';
import { pickAndCopySpaceImage } from '@/lib/imagePicker';
import * as haptics from '@/lib/haptics';
import { useSpaceStore } from '@/store/spaceStore';
import { moodList } from '@/theme/moodPalettes';
import { useTheme } from '@/theme/ThemeProvider';

export interface SpaceEditorScreenProps {
  /** undefined = create mode */
  spaceId?: string;
}

const DEFAULT_MOOD: MoodId = 'warm';

export function SpaceEditorScreen({ spaceId }: SpaceEditorScreenProps) {
  const theme = useTheme();
  const isEditing = spaceId != null;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodId>(DEFAULT_MOOD);

  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;

    function applySpace(space: Space) {
      if (cancelled) return;
      setName(space.name);
      setImageUri(space.imageUri);
      setMood(space.paletteMood ?? DEFAULT_MOOD);
      setLoading(false);
    }

    const cached = useSpaceStore.getState().spaces.find((s) => s.id === spaceId);
    if (cached) {
      applySpace(cached);
      return;
    }

    getDatabase()
      .then((db) => getSpaceById(db, spaceId))
      .then((space) => {
        if (space) applySpace(space);
        else if (!cancelled) setLoading(false);
      })
      .catch((error: unknown) => {
        console.error('[SpaceEditorScreen] failed to load space', error);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const handleCancel = () => {
    haptics.tap();
    router.back();
  };

  const handlePickPhoto = async () => {
    haptics.tap();
    try {
      const uri = await pickAndCopySpaceImage();
      if (uri) setImageUri(uri);
    } catch (error) {
      console.error('[SpaceEditorScreen] failed to pick photo', error);
      Alert.alert('Something went wrong', 'This photo could not be added. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!isValidSpaceName(name)) {
      Alert.alert('Name required', 'Give this Focus Space a short name before saving.');
      return;
    }
    if (!imageUri) {
      Alert.alert('Photo required', 'Choose a photo for this Focus Space.');
      return;
    }

    haptics.tap();
    setSaving(true);
    try {
      if (spaceId) {
        await useSpaceStore.getState().updateCustom(spaceId, { name: name.trim(), imageUri, paletteMood: mood });
      } else {
        await useSpaceStore.getState().createCustom({ name: name.trim(), imageUri, paletteMood: mood });
      }
      router.back();
    } catch (error) {
      console.error('[SpaceEditorScreen] failed to save space', error);
      Alert.alert('Something went wrong', 'This Focus Space could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!spaceId) return;
    haptics.tap();
    Alert.alert('Delete Focus Space', `Delete "${name}"? Rituals using it will keep working, but it leaves the gallery.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void useSpaceStore
            .getState()
            .archiveCustom(spaceId)
            .then(() => router.back());
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={theme.neutral.textMuted}>
            Loading…
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
        }}
      >
        <Text variant="title">{isEditing ? 'Edit Focus Space' : 'New Focus Space'}</Text>
        <IconButton icon="x" size={18} onPress={handleCancel} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color={theme.neutral.textMuted}>
            Photo
          </Text>
          <View
            style={{
              aspectRatio: 1.4,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              backgroundColor: theme.neutral.surface,
              borderWidth: imageUri ? 0 : 1,
              borderStyle: 'dashed',
              borderColor: theme.neutral.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {imageUri && <Image source={{ uri: imageUri }} style={{ flex: 1, width: '100%' }} resizeMode="cover" />}
          </View>
          <Button
            label={imageUri ? 'Replace Photo' : 'Choose Photo'}
            variant="secondary"
            onPress={() => void handlePickPhoto()}
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" color={theme.neutral.textMuted}>
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="My Desk"
            placeholderTextColor={theme.neutral.textMuted}
            maxLength={60}
            style={{
              fontFamily: theme.fontFamily.displayMedium,
              fontSize: theme.fontSize.xl,
              color: theme.neutral.text,
              paddingVertical: theme.spacing.xs,
              borderBottomWidth: 1,
              borderBottomColor: theme.neutral.border,
            }}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color={theme.neutral.textMuted}>
            Mood
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {moodList.map((m) => (
              <Chip
                key={m.id}
                label={m.label}
                selected={m.id === mood}
                onPress={() => {
                  haptics.select();
                  setMood(m.id);
                }}
              />
            ))}
          </View>
        </View>

        {isEditing && (
          <Button label="Delete Space" variant="ghost" textColor={theme.neutral.textMuted} onPress={handleDelete} />
        )}
      </ScrollView>

      <View style={{ padding: theme.spacing.lg }}>
        <Button
          label={saving ? 'Saving…' : 'Save Focus Space'}
          onPress={() => void handleSave()}
          disabled={saving}
          style={{ alignSelf: 'stretch' }}
        />
      </View>
    </Screen>
  );
}
