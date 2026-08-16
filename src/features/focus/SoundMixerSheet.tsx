import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { VolumeBar } from '@/components/VolumeBar';
import { soundLibrary } from '@/lib/audio/soundLibrary';
import { useSoundStore } from '@/store/soundStore';
import type { PaletteColors } from '@/theme/scenePalettes';
import { useTheme } from '@/theme/ThemeProvider';

export interface SoundMixerSheetProps {
  visible: boolean;
  onClose: () => void;
  palette: PaletteColors;
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
