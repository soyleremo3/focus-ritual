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

function MiniButton({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
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
          gap: theme.spacing.xxs,
        }}
      >
        {onEdit && (
          <MiniButton onPress={onEdit}>
            <Feather name="edit-2" size={13} color="#FFFFFF" />
          </MiniButton>
        )}
        <MiniButton onPress={onToggleFavorite}>
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
