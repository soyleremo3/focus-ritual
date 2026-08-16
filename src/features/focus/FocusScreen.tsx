import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { MODE_DEFAULTS, type TimerMode } from '@/domain/timer/types';
import * as haptics from '@/lib/haptics';
import { useSoundStore } from '@/store/soundStore';
import { useElapsedMs, useRemainingMs, useTimerStore } from '@/store/timerStore';
import { defaultSceneId, sceneList } from '@/theme/scenePalettes';
import { useScenePalette, useTheme } from '@/theme/ThemeProvider';

import { formatClock } from './formatClock';
import { ModePicker } from './ModePicker';
import { SceneBackdrop } from './SceneBackdrop';
import { SoundMixerSheet } from './SoundMixerSheet';
import { TimerControls } from './TimerControls';
import { TimerRing } from './TimerRing';

const ACTIVE_STATUSES = new Set(['running', 'paused', 'awaiting-start']);

export function FocusScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const ringSize = width > 0 ? Math.min(300, width * 0.72) : 260;

  const [sceneId, setSceneId] = useState(defaultSceneId);
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [mixerVisible, setMixerVisible] = useState(false);

  const palette = useScenePalette(sceneId);

  const session = useTimerStore((s) => s.session);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const advancePhase = useTimerStore((s) => s.advancePhase);
  const continueFocus = useTimerStore((s) => s.continueFocus);
  const cancel = useTimerStore((s) => s.cancel);
  const elapsedMs = useElapsedMs();
  const remainingMs = useRemainingMs();

  const soundPlay = useSoundStore((s) => s.play);
  const soundPause = useSoundStore((s) => s.pause);

  const isSessionActive = session != null && ACTIVE_STATUSES.has(session.status);

  const handleStart = () => {
    haptics.tap();
    start(mode);
    soundPlay();
  };
  const handlePause = () => {
    haptics.tap();
    pause();
    soundPause();
  };
  const handleResume = () => {
    haptics.tap();
    resume();
    soundPlay();
  };
  const handleAdvancePhase = () => {
    haptics.select();
    advancePhase();
    soundPlay();
  };
  const handleContinueFocus = () => {
    haptics.select();
    continueFocus(20);
    soundPlay();
  };
  const handleCancel = () => {
    haptics.tap();
    cancel();
    soundPause();
  };
  const handleCycleScene = () => {
    haptics.select();
    const ids = sceneList.map((s) => s.id);
    const idx = ids.indexOf(sceneId);
    setSceneId(ids[(idx + 1) % ids.length] ?? defaultSceneId);
  };

  const currentPhaseMinutes = session
    ? session.phase === 'focus'
      ? session.focusMinutes
      : session.breakMinutes
    : MODE_DEFAULTS[mode].focusMinutes;
  const plannedMs = currentPhaseMinutes != null ? currentPhaseMinutes * 60_000 : null;

  const progress = session && plannedMs != null && elapsedMs != null ? Math.min(1, elapsedMs / plannedMs) : 0;

  const clockMs = session ? (remainingMs != null ? Math.max(0, remainingMs) : (elapsedMs ?? 0)) : (plannedMs ?? 0);

  const phaseLabel = !session ? 'Ready' : session.phase === 'focus' ? 'Focus' : 'Break';

  return (
    <View style={{ flex: 1 }}>
      <SceneBackdrop palette={palette} />
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
          }}
        >
          <Pressable onPress={handleCycleScene} hitSlop={12}>
            <Text variant="label" color={palette.textMuted}>
              {palette.name}
            </Text>
          </Pressable>
          <IconButton
            icon="music"
            size={18}
            onPress={() => setMixerVisible(true)}
            color={palette.text}
            backgroundColor={palette.surface}
          />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl }}>
          {!isSessionActive && (
            <ModePicker
              selected={mode}
              onSelect={setMode}
              accentColor={palette.accent}
              onAccentColor={palette.onAccent}
              mutedColor={palette.textMuted}
              borderColor={palette.surface}
            />
          )}

          <TimerRing size={ringSize} progress={progress} trackColor={palette.surface} progressColor={palette.accent}>
            <Text variant="label" color={palette.textMuted} style={{ marginBottom: theme.spacing.xs }}>
              {phaseLabel}
            </Text>
            <Text variant="hero" color={palette.text}>
              {formatClock(clockMs)}
            </Text>
          </TimerRing>
        </View>

        <View style={{ alignItems: 'center', paddingBottom: theme.spacing.xl }}>
          <TimerControls
            session={session}
            palette={palette}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onAdvancePhase={handleAdvancePhase}
            onContinueFocus={handleContinueFocus}
            onCancel={handleCancel}
          />
        </View>
      </SafeAreaView>

      <SoundMixerSheet visible={mixerVisible} onClose={() => setMixerVisible(false)} palette={palette} />
    </View>
  );
}
