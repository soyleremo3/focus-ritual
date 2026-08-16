import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { getDatabase } from '@/db/client';
import { getRitualById } from '@/db/repositories/ritualsRepo';
import { ritualToActiveMix, ritualToSessionStart } from '@/domain/ritual/ritual';
import type { Ritual } from '@/domain/ritual/types';
import { MODE_DEFAULTS, type TimerMode } from '@/domain/timer/types';
import * as haptics from '@/lib/haptics';
import { useRitualStore } from '@/store/ritualStore';
import { useSoundStore } from '@/store/soundStore';
import { useElapsedMs, useRemainingMs, useTimerStore } from '@/store/timerStore';
import { defaultSceneId, sceneList, type SceneId } from '@/theme/scenePalettes';
import { useScenePalette, useTheme } from '@/theme/ThemeProvider';

import { formatClock } from './formatClock';
import { ModePicker } from './ModePicker';
import { SceneBackdrop } from './SceneBackdrop';
import { SoundMixerSheet } from './SoundMixerSheet';
import { TimerControls } from './TimerControls';
import { TimerRing } from './TimerRing';

const ACTIVE_STATUSES = new Set(['running', 'paused', 'awaiting-start']);

/** Cache-first (ritualStore), falling back to a direct DB read if the store hasn't loaded yet. */
async function resolveRitual(id: string): Promise<Ritual | null> {
  const cached = useRitualStore.getState().rituals.find((r) => r.id === id);
  if (cached) return cached;
  const db = await getDatabase();
  return getRitualById(db, id);
}

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
  const soundSetMix = useSoundStore((s) => s.setMix);

  const isSessionActive = session != null && ACTIVE_STATUSES.has(session.status);

  // Started from a ritual (RitualCard's "Start" button navigates here with this param).
  // Only responsible for creating the session — applying the ritual's scene/sound mix is
  // handled below by the session.ritualId effect, so it also covers cold-start recovery.
  const { startRitualId } = useLocalSearchParams<{ startRitualId?: string }>();
  const startedRitualIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!startRitualId || startedRitualIdRef.current === startRitualId) return;
    startedRitualIdRef.current = startRitualId;

    let cancelled = false;
    resolveRitual(startRitualId)
      .then((ritual) => {
        if (!ritual || cancelled) return;
        haptics.tap();
        const sessionStart = ritualToSessionStart(ritual);
        start(sessionStart.mode, sessionStart);
        void useRitualStore.getState().markUsed(ritual.id);
      })
      .catch((error: unknown) => {
        console.error('[FocusScreen] failed to start from ritual', error);
      });

    return () => {
      cancelled = true;
    };
  }, [startRitualId, start]);

  // Reflects whichever ritual the *current session* is tied to — fires both right after
  // the effect above creates a session, and when a running/paused session recovers from a
  // cold start (timerStore's hydrate() sets session.ritualId directly, bypassing the
  // param-driven effect above entirely). Without this, a killed-and-relaunched app would
  // recover the correct elapsed time but silently drop back to the default scene/sound
  // mix instead of the ritual's.
  const sessionRitualId = session?.ritualId ?? null;
  const sessionStatus = session?.status ?? null;
  const appliedRitualIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionRitualId || appliedRitualIdRef.current === sessionRitualId) return;
    appliedRitualIdRef.current = sessionRitualId;

    let cancelled = false;
    resolveRitual(sessionRitualId)
      .then((ritual) => {
        if (!ritual || cancelled) return;
        if (ritual.spaceId) setSceneId(ritual.spaceId as SceneId);
        soundSetMix(ritualToActiveMix(ritual));
        if (sessionStatus === 'running') soundPlay();
      })
      .catch((error: unknown) => {
        console.error('[FocusScreen] failed to apply ritual scene/mix', error);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionRitualId, sessionStatus, soundSetMix, soundPlay]);

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
