import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { ScenePalette } from '@/theme/scenePalettes';

export interface SceneBackdropProps {
  palette: ScenePalette;
}

/**
 * Code-drawn gradient scene — no photographic wallpaper asset. Hand-tuned palettes read as
 * more premium than a stock photo would for a Phase 1 prototype, and keeps every bundled
 * scene license-free. One of the two permitted continuous animations: a slow, low-amplitude
 * ambient glow tied to the active scene.
 */
export function SceneBackdrop({ palette }: SceneBackdropProps) {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = 0;
    glow.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [palette.id, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.08 + glow.value * 0.1,
    transform: [{ scale: 1 + glow.value * 0.06 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
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
