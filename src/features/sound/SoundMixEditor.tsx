import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Text } from '@/components/Text';
import { VolumeBar } from '@/components/VolumeBar';
import { SOUND_CATEGORY_LABELS, soundLibrary, type SoundCategory } from '@/lib/audio/soundLibrary';
import { useTheme } from '@/theme/ThemeProvider';

export interface SoundMixEditorLayer {
  soundId: string;
  volume: number;
}

export interface SoundMixEditorProps {
  layers: SoundMixEditorLayer[];
  onToggleLayer: (soundId: string) => void;
  onLayerVolumeChange: (soundId: string, volume: number) => void;
  /** Omit both to hide the master volume row (e.g. editing a ritual's saved mix draft). */
  masterVolume?: number;
  onMasterVolumeChange?: (volume: number) => void;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  onAccentColor: string;
  trackColor: string;
  borderColor: string;
}

const CATEGORIES = Array.from(new Set(soundLibrary.map((s) => s.category))) as SoundCategory[];

/**
 * Shared category-filterable, searchable ambient sound mix editor — used both by the live
 * mixer sheet on the Focus screen (bound to soundStore) and the ritual editor's local,
 * non-live sound-mix draft. Filtering never hides an already-active layer's volume bar;
 * it only affects which inactive sounds are offered.
 */
export function SoundMixEditor({
  layers,
  onToggleLayer,
  onLayerVolumeChange,
  masterVolume,
  onMasterVolumeChange,
  textColor,
  mutedColor,
  accentColor,
  onAccentColor,
  trackColor,
  borderColor,
}: SoundMixEditorProps) {
  const theme = useTheme();
  const [category, setCategory] = useState<SoundCategory | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return soundLibrary.filter((sound) => {
      // An active layer always stays visible, even outside the current filter — otherwise
      // switching category/search could hide the only control for turning it back off.
      if (layers.some((l) => l.soundId === sound.id)) return true;
      if (category && sound.category !== category) return false;
      if (q && !sound.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, query, layers]);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {masterVolume != null && onMasterVolumeChange && (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Feather name="sliders" size={16} color={accentColor} />
            <Text variant="body" color={textColor}>
              Master Volume
            </Text>
          </View>
          <VolumeBar
            value={masterVolume}
            onChange={onMasterVolumeChange}
            trackColor={trackColor}
            fillColor={accentColor}
            label="Master volume"
          />
        </View>
      )}

      <View style={{ gap: theme.spacing.sm }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search sounds"
          placeholderTextColor={mutedColor}
          style={{
            fontFamily: theme.fontFamily.sansRegular,
            fontSize: theme.fontSize.sm,
            color: textColor,
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            borderRadius: theme.radius.sm,
            borderWidth: 1,
            borderColor,
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip
            label="All"
            selected={category == null}
            onPress={() => setCategory(null)}
            color={accentColor}
            onColor={onAccentColor}
            mutedColor={mutedColor}
            borderColor={borderColor}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={SOUND_CATEGORY_LABELS[c]}
              selected={category === c}
              onPress={() => setCategory(c)}
              color={accentColor}
              onColor={onAccentColor}
              mutedColor={mutedColor}
              borderColor={borderColor}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {filtered.length === 0 ? (
          <Text variant="body" color={mutedColor}>
            No sounds match “{query}”.
          </Text>
        ) : (
          filtered.map((sound) => {
            const layer = layers.find((l) => l.soundId === sound.id);
            const active = layer != null;
            return (
              <View key={sound.id} style={{ gap: theme.spacing.sm }}>
                <Pressable
                  onPress={() => onToggleLayer(sound.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${sound.label} ${active ? 'on' : 'off'}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
                >
                  <Feather name={active ? 'volume-2' : 'volume-x'} size={18} color={active ? accentColor : mutedColor} />
                  <Text variant="body" color={active ? textColor : mutedColor}>
                    {sound.label}
                  </Text>
                </Pressable>
                {active && layer && (
                  <VolumeBar
                    value={layer.volume}
                    onChange={(v) => onLayerVolumeChange(sound.id, v)}
                    trackColor={trackColor}
                    fillColor={accentColor}
                    label={`${sound.label} volume`}
                  />
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
