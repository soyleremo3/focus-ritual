import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import type { Space } from '@/domain/space/types';
import { resolveSpacePalette } from '@/theme/spacePalette';
import { useTheme } from '@/theme/ThemeProvider';

export interface SpaceCardProps {
  space: Space;
  selected: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  /** Only bundled-kind spaces omit this — they can't be edited. */
  onEdit?: () => void;
}

interface MiniButtonProps {
  onPress: () => void;
  label: string;
  selected?: boolean;
  children: ReactNode;
}

function MiniButton({ onPress, label, selected, children }: MiniButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected != null ? { selected } : undefined}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.38)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  );
}

export function SpaceCard({ space, selected, onPress, onToggleFavorite, onEdit }: SpaceCardProps) {
  const theme = useTheme();
  const palette = resolveSpacePalette(space);

  return (
    <Pressable
      onPress={onPress}
      // No accessibilityRole here deliberately — this card wraps its own nested
      // interactive controls (the edit/favorite MiniButtons below), and RN Web maps
      // accessibilityRole="button" to a real <button> element; a <button> wrapping other
      // <button>s is invalid HTML and broke hydration on web. The label still gets
      // exposed to assistive tech without the role forcing that element type.
      accessibilityLabel={`Use ${space.name} as Focus Space`}
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        aspectRatio: 0.82,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        backgroundColor: palette.background,
      }}
    >
      {space.kind === 'custom' && space.imageUri ? (
        <Image source={{ uri: space.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[palette.backgroundSecondary, palette.background]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={['transparent', palette.scrimBottom]}
        start={{ x: 0, y: 0.35 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {selected && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: theme.radius.lg, borderWidth: 2, borderColor: palette.accent },
          ]}
        />
      )}
      <View
        style={{
          position: 'absolute',
          top: theme.spacing.xs,
          right: theme.spacing.xs,
          flexDirection: 'row',
          // Each MiniButton's hitSlop(8) extends its tappable area well past its 28pt
          // visual box — a gap.xxs (4) here left the two hit areas overlapping by 12pt,
          // making taps in the seam land on whichever button unpredictably. md (16) is
          // the minimum gap that keeps the two 8pt hitSlops from touching at all.
          gap: theme.spacing.md,
        }}
      >
        {onEdit && (
          <MiniButton onPress={onEdit} label={`Edit ${space.name}`}>
            <Feather name="edit-2" size={13} color="#FFFFFF" />
          </MiniButton>
        )}
        <MiniButton
          onPress={onToggleFavorite}
          label={space.isFavorite ? `Remove ${space.name} from favorites` : `Add ${space.name} to favorites`}
          selected={space.isFavorite}
        >
          <Feather name="star" size={13} color={space.isFavorite ? palette.accent : '#FFFFFF'} />
        </MiniButton>
      </View>
      <View style={{ position: 'absolute', left: theme.spacing.sm, right: theme.spacing.sm, bottom: theme.spacing.sm }}>
        <Text variant="label" color={palette.text} numberOfLines={1}>
          {space.name}
        </Text>
      </View>
    </Pressable>
  );
}
