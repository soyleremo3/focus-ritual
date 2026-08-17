import { useEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

export interface VolumeBarProps {
  value: number;
  onChange: (value: number) => void;
  trackColor: string;
  fillColor: string;
  /** Announced by screen readers, e.g. "Rain volume". */
  label: string;
  width?: number;
  height?: number;
}

const ACCESSIBILITY_STEP = 0.1;
/** Expands the tappable area well past the thin visual track without changing its drawn height. */
const TOUCH_HIT_SLOP = 16;

/** Custom draggable volume control — no @react-native-community/slider dependency. */
export function VolumeBar({ value, onChange, trackColor, fillColor, label, width = 260, height = 8 }: VolumeBarProps) {
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

  const handleAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    if (event.nativeEvent.actionName === 'increment') {
      onChange(Math.min(1, value + ACCESSIBILITY_STEP));
    } else if (event.nativeEvent.actionName === 'decrement') {
      onChange(Math.max(0, value - ACCESSIBILITY_STEP));
    }
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        hitSlop={TOUCH_HIT_SLOP}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        onAccessibilityAction={handleAccessibilityAction}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
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
