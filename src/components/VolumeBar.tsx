import { useEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

export interface VolumeBarProps {
  value: number;
  onChange: (value: number) => void;
  trackColor: string;
  fillColor: string;
  width?: number;
  height?: number;
}

/** Custom draggable volume control — no @react-native-community/slider dependency. */
export function VolumeBar({ value, onChange, trackColor, fillColor, width = 260, height = 8 }: VolumeBarProps) {
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
