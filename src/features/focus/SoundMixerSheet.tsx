import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { soundLibrary } from '@/lib/audio/soundLibrary';
import { useSoundStore } from '@/store/soundStore';
import type { ScenePalette } from '@/theme/scenePalettes';
import { useTheme } from '@/theme/ThemeProvider';

export interface SoundMixerSheetProps {
  visible: boolean;
  onClose: () => void;
  palette: ScenePalette;
}

export function SoundMixerSheet({ visible, onClose, palette }: SoundMixerSheetProps) {
  const theme = useTheme();
  const activeMix = useSoundStore((s) => s.activeMix);
  const toggleLayer = useSoundStore((s) => s.toggleLayer);
  const setLayerVolume = useSoundStore((s) => s.setLayerVolume);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={onClose} />
        <View
          style={{
            backgroundColor: palette.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="title" color={palette.text}>
              Ambient Mix
            </Text>
            <IconButton icon="x" size={18} onPress={onClose} color={palette.text} backgroundColor={palette.surface} />
          </View>

          <View style={{ gap: theme.spacing.lg }}>
            {soundLibrary.map((sound) => {
              const layer = activeMix.find((l) => l.soundId === sound.id);
              const active = layer != null;
              return (
                <View key={sound.id} style={{ gap: theme.spacing.sm }}>
                  <Pressable
                    onPress={() => toggleLayer(sound.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
                  >
                    <Feather
                      name={active ? 'volume-2' : 'volume-x'}
                      size={18}
                      color={active ? palette.accent : palette.textMuted}
                    />
                    <Text variant="body" color={active ? palette.text : palette.textMuted}>
                      {sound.label}
                    </Text>
                  </Pressable>
                  {active && layer && (
                    <VolumeBar
                      value={layer.volume}
                      onChange={(v) => setLayerVolume(sound.id, v)}
                      trackColor={palette.surface}
                      fillColor={palette.accent}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface VolumeBarProps {
  value: number;
  onChange: (value: number) => void;
  trackColor: string;
  fillColor: string;
  width?: number;
  height?: number;
}

/** Custom draggable volume control — no @react-native-community/slider dependency. */
function VolumeBar({ value, onChange, trackColor, fillColor, width = 260, height = 8 }: VolumeBarProps) {
  const progress = useSharedValue(value);

  useEffect(() => {
    progress.value = value;
  }, [value, progress]);

  const commit = (v: number) => onChange(v);

  const setFromX = (x: number) => {
    'worklet';
    const clamped = Math.min(1, Math.max(0, x / width));
    progress.value = clamped;
    runOnJS(commit)(clamped);
  };

  const gesture = Gesture.Pan()
    .onBegin((e) => setFromX(e.x))
    .onUpdate((e) => setFromX(e.x));

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: fillColor }, fillStyle]} />
      </View>
    </GestureDetector>
  );
}
