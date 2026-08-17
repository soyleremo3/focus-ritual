import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { getDatabase } from '@/db/client';
import { getRitualById } from '@/db/repositories/ritualsRepo';
import { getTaskById } from '@/db/repositories/tasksRepo';
import { ritualToActiveMix, ritualToSessionStart } from '@/domain/ritual/ritual';
import type { Ritual } from '@/domain/ritual/types';
import type { Task } from '@/domain/task/types';
import { MODE_DEFAULTS, type TimerMode } from '@/domain/timer/types';
import { NumberField } from '@/features/rituals/NumberField';
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
async function resolveTask(id: string): Promise<Task | null> {
  const cached = useTaskStore.getState().tasks.find((t) => t.id === id);
  if (cached) return cached;
  const db = await getDatabase();
  return getTaskById(db, id);
}

export function FocusScreen() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  // Phones held sideways have far less height than width — a ring sized off width alone
  // (the portrait case, where height is the generous dimension) would blow past the
  // available height and clip against the mode picker / controls stacked beside it.
  const isLandscape = width > height;
  const ringSize = isLandscape
    ? height > 0
      ? Math.min(260, height * 0.62)
      : 220
    : width > 0
      ? Math.min(300, width * 0.72)
      : 260;

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

  // Custom mode's whole point is a per-session duration — previously it silently always
  // used Settings' Timer Defaults with no way to change it from the Focus screen itself, so
  // "Custom" wasn't actually customizable. These start pre-filled from that same default and
  // are editable right here; re-synced whenever the persisted default changes (covers the
  // default still being the store's placeholder until hydrate() resolves it).
  const [customFocusMinutes, setCustomFocusMinutes] = useState<number | null>(defaultFocusMinutes);
  const [customBreakMinutes, setCustomBreakMinutes] = useState<number | null>(defaultBreakMinutes);
  useEffect(() => setCustomFocusMinutes(defaultFocusMinutes), [defaultFocusMinutes]);
  useEffect(() => setCustomBreakMinutes(defaultBreakMinutes), [defaultBreakMinutes]);

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
      })
      .finally(() => {
        // Reset both guards once handled: the ref (so the *next* time this effect runs
        // for this same ritual id, it doesn't immediately bail on a stale match) and the
        // param (so tapping "Start" on the same ritual again is a genuine value
        // transition undefined -> ritualId that actually re-runs the effect in the first
        // place — this tab screen never unmounts between visits, and React's effect
        // dependency check ignores an unchanged string). Clearing only one of the two
        // leaves the button dead: clear the param alone and the stale ref still bails;
        // clear the ref alone and the unchanged param never re-triggers the effect.
        startedRitualIdRef.current = null;
        router.setParams({ startRitualId: undefined });
      });

    return () => {
      cancelled = true;
    };
  }, [startRitualId, start]);

  // Started from a Today task (TaskCard's "Start" button). No ritual involved. If the
  // task pinned its own mode+duration (TaskDurationSheet), that overrides whatever's
  // currently selected on this screen; otherwise falls back to it exactly as before.
  const startedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!startTaskId || startedTaskIdRef.current === startTaskId) return;
    startedTaskIdRef.current = startTaskId;

    let cancelled = false;
    resolveTask(startTaskId)
      .then((task) => {
        if (task == null || cancelled) return;
        haptics.tap();
        start(task.mode ?? mode, { taskId: startTaskId, focusMinutes: task.focusMinutes ?? undefined });
      })
      .catch((error: unknown) => {
        console.error('[FocusScreen] failed to start from task', error);
      })
      .finally(() => {
        // Same reasoning as the ritual effect above — reset both the ref and the param.
        startedTaskIdRef.current = null;
        router.setParams({ startTaskId: undefined });
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
    resolveTask(sessionTaskId)
      .then((task) => {
        if (cancelled) return;
        setActiveTaskTitle(task?.title ?? null);
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
    // fixed at MODE_DEFAULTS. Uses this screen's own draft, not Settings' Timer Defaults
    // directly, so editing the fields below actually changes what Start uses.
    const options = mode === 'custom' ? { focusMinutes: customFocusMinutes, breakMinutes: customBreakMinutes } : undefined;
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

  // A terminal (completed/cancelled) session lingers in the store until the next start() —
  // isSessionActive (not just session != null) gates this, otherwise picking a new mode
  // after finishing/cancelling a session would keep showing the old session's duration
  // instead of the newly selected mode's, since only an explicit Start creates a fresh one.
  const currentPhaseMinutes =
    isSessionActive && session
      ? session.phase === 'focus'
        ? session.focusMinutes
        : session.breakMinutes
      : mode === 'custom'
        ? customFocusMinutes
        : MODE_DEFAULTS[mode].focusMinutes;
  const plannedMs = currentPhaseMinutes != null ? currentPhaseMinutes * 60_000 : null;

  // Same isSessionActive gating as currentPhaseMinutes above — a terminal session must not
  // keep the ring/clock/label showing its leftover progress once it's no longer active.
  const progress =
    isSessionActive && session && plannedMs != null && elapsedMs != null ? Math.min(1, elapsedMs / plannedMs) : 0;

  const clockMs =
    isSessionActive && session
      ? remainingMs != null
        ? Math.max(0, remainingMs)
        : (elapsedMs ?? 0)
      : (plannedMs ?? 0);

  const phaseLabel = !isSessionActive || !session ? 'Ready' : session.phase === 'focus' ? 'Focus' : 'Break';
  const clockText = formatClock(clockMs);
  // Scaled off the ring itself (not a fixed constant) so the longest format ("1:30:00")
  // always stays on one line inside the ring on any screen size, while still being as large
  // as that constraint allows. Calibrated against that specific string at the Fraunces
  // display weight — leaves a small margin from the ring's stroke on every side.
  const clockFontSize = Math.round(ringSize * 0.24);

  // Shared between the portrait (stacked) and landscape (side-by-side) layouts below so
  // the two branches can't drift apart from each other over time.
  const ringChildren = (
    <>
      <Text variant="label" color={palette.textMuted} style={{ marginBottom: theme.spacing.xs }}>
        {phaseLabel}
      </Text>
      <Text
        variant="hero"
        color={palette.text}
        numberOfLines={1}
        style={{ fontSize: clockFontSize, lineHeight: clockFontSize * theme.lineHeight.tight }}
      >
        {clockText}
      </Text>
    </>
  );

  const modeAndCustomFields = (
    <>
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

      {!isSessionActive && mode === 'custom' && (
        <View style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
          <NumberField
            label="Focus"
            value={customFocusMinutes}
            onChange={setCustomFocusMinutes}
            min={1}
            max={480}
            unit="min"
            textColor={palette.text}
            mutedColor={palette.textMuted}
          />
          <NumberField
            label="Break"
            value={customBreakMinutes}
            onChange={setCustomBreakMinutes}
            min={0}
            max={60}
            unit="min"
            textColor={palette.text}
            mutedColor={palette.textMuted}
          />
        </View>
      )}
    </>
  );

  const timerControlsElement = (
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
  );

  return (
    <View style={{ flex: 1 }}>
      <SceneBackdrop palette={palette} imageUri={spaceImageUri} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* iOS's number-pad keyboard (Custom mode's Focus/Break fields) has no Done/return
            key at all — the only way to dismiss it is tapping outside the field, so the
            whole screen needs to do that. Nested Pressables (mode chips, buttons, the
            fields themselves) still get their own taps via RN's responder system — this
            only fires for a tap that doesn't land on any of them. */}
        <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.sm,
            }}
          >
            <Pressable
              onPress={handleOpenSpaces}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Change Focus Space, currently ${spaceName}`}
            >
              <Text variant="caption" color={palette.textMuted}>
                {spaceName}
              </Text>
            </Pressable>
            <IconButton
              icon="music"
              size={18}
              onPress={() => setMixerVisible(true)}
              color={palette.text}
              backgroundColor={palette.surface}
              accessibilityLabel="Open ambient sound mixer"
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

          {isLandscape ? (
            // Sideways phones are short on height, not width — a side-by-side row (ring
            // centered on one side, mode/controls stacked on the other) fits the available
            // height instead of the portrait stack's ring-then-controls order, which would
            // need far more vertical space than a landscape screen has.
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.lg,
                paddingHorizontal: theme.spacing.lg,
              }}
            >
              <TimerRing size={ringSize} progress={progress} trackColor={palette.surface} progressColor={palette.accent}>
                {ringChildren}
              </TimerRing>
              <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
                {modeAndCustomFields}
                {timerControlsElement}
              </View>
            </View>
          ) : (
            <>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl }}>
                {modeAndCustomFields}
                <TimerRing size={ringSize} progress={progress} trackColor={palette.surface} progressColor={palette.accent}>
                  {ringChildren}
                </TimerRing>
              </View>

              <View style={{ alignItems: 'center', paddingBottom: theme.spacing.xl }}>{timerControlsElement}</View>
            </>
          )}
        </Pressable>
      </SafeAreaView>

      <SoundMixerSheet visible={mixerVisible} onClose={() => setMixerVisible(false)} palette={palette} />
    </View>
  );
}
