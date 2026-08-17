import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { SoundMixEditor } from '@/features/sound/SoundMixEditor';
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
  const masterVolume = useSoundStore((s) => s.masterVolume);
  const masterPlaying = useSoundStore((s) => s.masterPlaying);
  const toggleLayer = useSoundStore((s) => s.toggleLayer);
  const setLayerVolume = useSoundStore((s) => s.setLayerVolume);
  const setMasterVolume = useSoundStore((s) => s.setMasterVolume);
  const play = useSoundStore((s) => s.play);
  const pause = useSoundStore((s) => s.pause);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close ambient sound mixer"
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '80%',
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconButton
                icon={masterPlaying ? 'pause' : 'play'}
                size={16}
                onPress={masterPlaying ? pause : play}
                disabled={activeMix.length === 0}
                color={palette.text}
                backgroundColor={palette.surface}
                accessibilityLabel={masterPlaying ? 'Pause ambient sound' : 'Play ambient sound'}
              />
              <IconButton
                icon="x"
                size={18}
                onPress={onClose}
                color={palette.text}
                backgroundColor={palette.surface}
                accessibilityLabel="Close ambient sound mixer"
              />
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <SoundMixEditor
              layers={activeMix}
              onToggleLayer={toggleLayer}
              onLayerVolumeChange={setLayerVolume}
              masterVolume={masterVolume}
              onMasterVolumeChange={setMasterVolume}
              textColor={palette.text}
              mutedColor={palette.textMuted}
              accentColor={palette.accent}
              onAccentColor={palette.onAccent}
              trackColor={palette.surface}
              borderColor={palette.surface}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
