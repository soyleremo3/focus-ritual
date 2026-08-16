import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { getDatabase } from '@/db/client';
import { getRitualById } from '@/db/repositories/ritualsRepo';
import { getTaskById } from '@/db/repositories/tasksRepo';
import { ritualToActiveMix, ritualToSessionStart } from '@/domain/ritual/ritual';
import type { Ritual } from '@/domain/ritual/types';
import { MODE_DEFAULTS, type TimerMode } from '@/domain/timer/types';
import * as haptics from '@/lib/haptics';
import { useRitualStore } from '@/store/ritualStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSoundStore } from '@/store/soundStore';
import { useSpaceStore } from '@/store/spaceStore';
import { useTaskStore } from '@/store/taskStore';
import { useElapsedMs, useRemainingMs, useTimerStore } from '@/store/timerStore';
import { defaultSceneId, scenePalettes } from '@/theme/scenePalettes';
import { resolveSpacePalette } from '@/theme/spacePalette';
import { useTheme } from '@/theme/ThemeProvider';

import { formatClock } from './formatClock';
import { ModePicker } from './ModePicker';
import { SceneBackdrop } from './SceneBackdrop';
import { SoundMixerSheet } from './SoundMixerSheet';
import { TimerControls } from './TimerControls';
import { TimerRing } from './TimerRing';

const ACTIVE_STATUSES = new Set(['running', 'paused', 'awaiting-start']);
const FALLBACK_SPACE_NAME = scenePalettes[defaultSceneId].name;

/** Cache-first (ritualStore), falling back to a direct DB read if the store hasn't loaded yet. */
async function resolveRitual(id: string): Promise<Ritual | null> {
  const cached = useRitualStore.getState().rituals.find((r) => r.id === id);
  if (cached) return cached;
  const db = await getDatabase();
  return getRitualById(db, id);
}

/** Cache-first (taskStore), falling back to a direct DB read if the store hasn't loaded yet. */
async function resolveTaskTitle(id: string): Promise<string | null> {
  const cached = useTaskStore.getState().tasks.find((t) => t.id === id);
  if (cached) return cached.title;
  const db = await getDatabase();
  const task = await getTaskById(db, id);
  return task?.title ?? null;
}

export function FocusScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const ringSize = width > 0 ? Math.min(300, width * 0.72) : 260;

  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [mixerVisible, setMixerVisible] = useState(false);

  // The space a ritual-tied session forces (start-from-ritual, or cold-start recovery of
  // one) takes priority over the user's standalone gallery pick while that session lasts.
  const [ritualSpaceOverride, setRitualSpaceOverride] = useState<string | null>(null);
  const spaces = useSpaceStore((s) => s.spaces);
  const standaloneActiveSpaceId = useSpaceStore((s) => s.activeSpaceId);
  const displaySpaceId = ritualSpaceOverride ?? standaloneActiveSpaceId;
  const activeSpace = spaces.find((s) => s.id === displaySpaceId) ?? null;
  const palette = activeSpace ? resolveSpacePalette(activeSpace) : scenePalettes[defaultSceneId];
  const spaceName = activeSpace?.name ?? FALLBACK_SPACE_NAME;
  const spaceImageUri = activeSpace?.kind === 'custom' ? activeSpace.imageUri : null;

  const session = useTimerStore((s) => s.session);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const advancePhase = useTimerStore((s) => s.advancePhase);
  const continueFocus = useTimerStore((s) => s.continueFocus);
  const cancel = useTimerStore((s) => s.cancel);
  const finish = useTimerStore((s) => s.finish);
  const elapsedMs = useElapsedMs();
  const remainingMs = useRemainingMs();

  const soundPlay = useSoundStore((s) => s.play);
  const soundPause = useSoundStore((s) => s.pause);
  const applyRitualMix = useSoundStore((s) => s.applyRitualMix);

  const pauseSoundWithTimer = useSettingsStore((s) => s.settings.pauseSoundWithTimer);
  const defaultFocusMinutes = useSettingsStore((s) => s.settings.defaultFocusMinutes);
  const defaultBreakMinutes = useSettingsStore((s) => s.settings.defaultBreakMinutes);

  const isSessionActive = session != null && ACTIVE_STATUSES.has(session.status);

  // Started from a ritual (RitualCard's "Start" button navigates here with this param).
  // Only responsible for creating the session — applying the ritual's scene/sound mix is
  // handled below by the session.ritualId effect, so it also covers cold-start recovery.
  const { startRitualId, startTaskId } = useLocalSearchParams<{ startRitualId?: string; startTaskId?: string }>();
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

  // Started from a Today task (TaskCard's "Start" button). No ritual involved — starts
  // with whatever mode is currently selected on this screen, just tagged with taskId so
  // it shows up associated with the task in History later.
  const startedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!startTaskId || startedTaskIdRef.current === startTaskId) return;
    startedTaskIdRef.current = startTaskId;

    let cancelled = false;
    resolveTaskTitle(startTaskId)
      .then((title) => {
        if (title == null || cancelled) return;
        haptics.tap();
        start(mode, { taskId: startTaskId });
      })
      .catch((error: unknown) => {
        console.error('[FocusScreen] failed to start from task', error);
      });

    return () => {
      cancelled = true;
    };
  }, [startTaskId, start, mode]);

  // Reflects whichever task the *current session* is tied to — shows its title near the
  // timer while running, and (like the ritual effect below) also covers cold-start
  // recovery of a task-tied session.
  const sessionTaskId = session?.taskId ?? null;
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);
  const appliedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionTaskId) {
      appliedTaskIdRef.current = null;
      setActiveTaskTitle(null);
      return;
    }
    if (appliedTaskIdRef.current === sessionTaskId) return;
    appliedTaskIdRef.current = sessionTaskId;

    let cancelled = false;
    resolveTaskTitle(sessionTaskId)
      .then((title) => {
        if (cancelled) return;
        setActiveTaskTitle(title);
      })
      .catch((error: unknown) => {
        console.error('[FocusScreen] failed to resolve active task', error);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionTaskId]);

  // Reflects whichever ritual the *current session* is tied to — fires both right after
  // the effect above creates a session, and when a running/paused session recovers from a
  // cold start (timerStore's hydrate() sets session.ritualId directly, bypassing the
  // param-driven effect above entirely). Without this, a killed-and-relaunched app would
  // recover the correct elapsed time but silently drop back to the default space/sound
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
        if (ritual.spaceId) setRitualSpaceOverride(ritual.spaceId);
        applyRitualMix(ritualToActiveMix(ritual));
        if (sessionStatus === 'running') soundPlay();
      })
      .catch((error: unknown) => {
        console.error('[FocusScreen] failed to apply ritual scene/mix', error);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionRitualId, sessionStatus, applyRitualMix, soundPlay]);

  // A plain "Start" (no ritual) creates a new session with no ritualId — release any
  // leftover ritual space/sound override so the screen falls back to the user's own
  // standalone picks instead of lingering on a previous ritual's.
  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (sessionId && !sessionRitualId) {
      setRitualSpaceOverride(null);
      appliedRitualIdRef.current = null;
      void useSoundStore.getState().restoreStandaloneMix();
    }
  }, [sessionId, sessionRitualId]);

  const handleStart = () => {
    haptics.tap();
    // Custom is the one mode meant for a user-defined duration when started standalone
    // (no ritual) — every other mode's numbers are what define that mode, so they stay
    // fixed at MODE_DEFAULTS.
    const options = mode === 'custom' ? { focusMinutes: defaultFocusMinutes, breakMinutes: defaultBreakMinutes } : undefined;
    start(mode, options);
    soundPlay();
  };
  const handlePause = () => {
    haptics.tap();
    pause();
    if (pauseSoundWithTimer) soundPause();
  };
  const handleResume = () => {
    haptics.tap();
    resume();
    if (pauseSoundWithTimer) soundPlay();
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
  const handleFinish = () => {
    haptics.success();
    finish();
    soundPause();
  };
  const handleOpenSpaces = () => {
    haptics.tap();
    router.push('/spaces');
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
      <SceneBackdrop palette={palette} imageUri={spaceImageUri} />
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
          <Pressable onPress={handleOpenSpaces} hitSlop={12}>
            <Text variant="label" color={palette.textMuted}>
              {spaceName}
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

        {activeTaskTitle && (
          <Text
            variant="body"
            color={palette.textMuted}
            style={{ textAlign: 'center', paddingTop: theme.spacing.xs }}
            numberOfLines={1}
          >
            {activeTaskTitle}
          </Text>
        )}

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
            onFinish={handleFinish}
          />
        </View>
      </SafeAreaView>

      <SoundMixerSheet visible={mixerVisible} onClose={() => setMixerVisible(false)} palette={palette} />
    </View>
  );
}
