import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { PaletteColors } from '@/theme/scenePalettes';

export interface SceneBackdropProps {
  palette: PaletteColors;
  /** A custom Focus Space's photo — when set, replaces the drawn gradient background. */
  imageUri?: string | null;
}

/**
 * Renders either a code-drawn gradient (bundled scenes — no photographic asset, and keeps
 * every bundled scene license-free) or a custom space's photo, with the same scrim
 * treatment either way. One of the two permitted continuous animations: a slow,
 * low-amplitude ambient glow, shown only over drawn gradients — a colored blob over a
 * user's own photo would read as a bug, not a premium touch.
 */
export function SceneBackdrop({ palette, imageUri }: SceneBackdropProps) {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = 0;
    glow.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [palette.background, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.08 + glow.value * 0.1,
    transform: [{ scale: 1 + glow.value * 0.06 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <>
          <LinearGradient
            colors={[palette.backgroundSecondary, palette.background]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, glowStyle]}
          >
            <View
              style={{
                width: '150%',
                aspectRatio: 1,
                borderRadius: 9999,
                backgroundColor: palette.accent,
              }}
            />
          </Animated.View>
        </>
      )}
      <LinearGradient
        colors={[palette.scrimTop, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.35 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', palette.scrimBottom]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
