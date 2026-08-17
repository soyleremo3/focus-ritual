import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { getDatabase } from '@/db/client';
import { getRitualById, type RitualDraft } from '@/db/repositories/ritualsRepo';
import { isValidRitualName } from '@/domain/ritual/ritual';
import type { Ritual, RitualSoundLayer } from '@/domain/ritual/types';
import { MODE_DEFAULTS, type TimerMode } from '@/domain/timer/types';
import { ModePicker } from '@/features/focus/ModePicker';
import { SoundMixEditor } from '@/features/sound/SoundMixEditor';
import * as haptics from '@/lib/haptics';
import { useRitualStore } from '@/store/ritualStore';
import { useSpaceStore } from '@/store/spaceStore';
import { defaultSceneId } from '@/theme/scenePalettes';
import { useTheme } from '@/theme/ThemeProvider';

import { NumberField } from './NumberField';

export interface RitualEditorScreenProps {
  /** undefined = create mode */
  ritualId?: string;
}

const DEFAULT_MODE: TimerMode = 'pomodoro';

function showsCycles(mode: TimerMode): boolean {
  return mode === 'pomodoro' || mode === 'custom';
}

function showsDurations(mode: TimerMode): boolean {
  return mode !== 'stopwatch';
}

export function RitualEditorScreen({ ritualId }: RitualEditorScreenProps) {
  const theme = useTheme();
  const isEditing = ritualId != null;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [mode, setMode] = useState<TimerMode>(DEFAULT_MODE);
  const [focusMinutes, setFocusMinutes] = useState<number | null>(MODE_DEFAULTS[DEFAULT_MODE].focusMinutes);
  const [breakMinutes, setBreakMinutes] = useState<number | null>(MODE_DEFAULTS[DEFAULT_MODE].breakMinutes);
  const [cyclesTarget, setCyclesTarget] = useState<number | null>(MODE_DEFAULTS[DEFAULT_MODE].cyclesTarget);
  const [spaceId, setSpaceId] = useState<string>(defaultSceneId);
  const [soundLayers, setSoundLayers] = useState<RitualSoundLayer[]>([]);
  const spaces = useSpaceStore((s) => s.spaces);

  useEffect(() => {
    if (!ritualId) return;
    let cancelled = false;

    function applyRitual(ritual: Ritual) {
      if (cancelled) return;
      setName(ritual.name);
      setMode(ritual.timerMode);
      setFocusMinutes(ritual.focusMinutes);
      setBreakMinutes(ritual.breakMinutes);
      setCyclesTarget(ritual.cyclesTarget);
      setSpaceId(ritual.spaceId ?? defaultSceneId);
      setSoundLayers(ritual.soundLayers);
      setLoading(false);
    }

    const cached = useRitualStore.getState().rituals.find((r) => r.id === ritualId);
    if (cached) {
      applyRitual(cached);
      return;
    }

    getDatabase()
      .then((db) => getRitualById(db, ritualId))
      .then((ritual) => {
        if (ritual) applyRitual(ritual);
        else if (!cancelled) setLoading(false);
      })
      .catch((error: unknown) => {
        console.error('[RitualEditorScreen] failed to load ritual', error);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ritualId]);

  const handleSelectMode = (nextMode: TimerMode) => {
    if (nextMode === mode) return;
    haptics.select();
    setMode(nextMode);
    const defaults = MODE_DEFAULTS[nextMode];
    setFocusMinutes(defaults.focusMinutes);
    setBreakMinutes(defaults.breakMinutes);
    setCyclesTarget(defaults.cyclesTarget);
  };

  const toggleSoundLayer = (soundId: string) => {
    haptics.select();
    setSoundLayers((prev) => {
      const exists = prev.some((l) => l.soundId === soundId);
      if (exists) {
        return prev.filter((l) => l.soundId !== soundId).map((l, position) => ({ ...l, position }));
      }
      return [...prev, { soundId, volume: 0.7, position: prev.length }];
    });
  };

  const setSoundLayerVolume = (soundId: string, volume: number) => {
    setSoundLayers((prev) => prev.map((l) => (l.soundId === soundId ? { ...l, volume } : l)));
  };

  const handleCancel = () => {
    haptics.tap();
    router.back();
  };

  const handleSave = async () => {
    if (!isValidRitualName(name)) {
      Alert.alert('Name required', 'Give this ritual a short name before saving.');
      return;
    }

    haptics.tap();
    setSaving(true);

    const draft: RitualDraft = {
      name: name.trim(),
      timerMode: mode,
      focusMinutes: showsDurations(mode) ? focusMinutes : null,
      breakMinutes: showsDurations(mode) ? breakMinutes : null,
      cyclesTarget: showsCycles(mode) ? cyclesTarget : null,
      spaceId,
      soundLayers,
    };

    try {
      if (ritualId) {
        await useRitualStore.getState().update(ritualId, draft);
      } else {
        await useRitualStore.getState().create(draft);
      }
      router.back();
    } catch (error) {
      console.error('[RitualEditorScreen] failed to save ritual', error);
      Alert.alert('Something went wrong', 'This ritual could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
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
        <Text variant="title">{isEditing ? 'Edit Ritual' : 'New Ritual'}</Text>
        <IconButton icon="x" size={18} onPress={handleCancel} accessibilityLabel="Close without saving" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" color={theme.neutral.textMuted}>
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Morning Pages"
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
          <Text variant="label" color={theme.neutral.textMuted} style={{ paddingHorizontal: theme.spacing.xs }}>
            Timer Mode
          </Text>
          <ModePicker
            selected={mode}
            onSelect={handleSelectMode}
            accentColor={theme.neutral.accent}
            onAccentColor={theme.neutral.onAccent}
            mutedColor={theme.neutral.textMuted}
            borderColor={theme.neutral.border}
          />
        </View>

        {showsDurations(mode) && (
          <View style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
            <NumberField label="Focus" value={focusMinutes} onChange={setFocusMinutes} min={1} max={240} unit="min" />
            <NumberField label="Break" value={breakMinutes} onChange={setBreakMinutes} min={0} max={60} unit="min" />
            {showsCycles(mode) && (
              <NumberField
                label="Cycles"
                value={cyclesTarget}
                onChange={setCyclesTarget}
                min={1}
                max={12}
                unit="×"
                placeholder="∞"
              />
            )}
          </View>
        )}

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color={theme.neutral.textMuted}>
            Focus Space
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {spaces.map((space) => (
              <Chip
                key={space.id}
                label={space.name}
                uppercase={false}
                selected={space.id === spaceId}
                onPress={() => {
                  haptics.select();
                  setSpaceId(space.id);
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="label" color={theme.neutral.textMuted}>
            Ambient Sounds
          </Text>
          <SoundMixEditor
            layers={soundLayers}
            onToggleLayer={toggleSoundLayer}
            onLayerVolumeChange={setSoundLayerVolume}
            textColor={theme.neutral.text}
            mutedColor={theme.neutral.textMuted}
            accentColor={theme.neutral.accent}
            onAccentColor={theme.neutral.onAccent}
            trackColor={theme.neutral.border}
            borderColor={theme.neutral.border}
          />
        </View>
      </ScrollView>

      <View style={{ padding: theme.spacing.lg }}>
        <Button label={saving ? 'Saving…' : 'Save Ritual'} onPress={handleSave} disabled={saving} style={{ alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );
}
