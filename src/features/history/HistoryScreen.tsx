import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Surface } from '@/components/Surface';
import { Text } from '@/components/Text';
import { getDatabase } from '@/db/client';
import { getRitualById } from '@/db/repositories/ritualsRepo';
import { listTerminalSessions } from '@/db/repositories/sessionsRepo';
import { getTaskById } from '@/db/repositories/tasksRepo';
import {
  TIME_OF_DAY_LABELS,
  WEEKDAY_SHORT_LABELS,
  bestFocusSegment,
  favoriteRitualId,
  filterSessionsInRange,
  formatFocusDuration,
  groupByRitual,
  groupByTask,
  last7DaysBuckets,
  startOfDay,
  startOfMonth,
  startOfWeek,
  summarize,
  weeklyRhythm,
} from '@/domain/stats/statsAggregation';
import type { TimerSession } from '@/domain/timer/types';
import { useRitualStore } from '@/store/ritualStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';

import { Bar } from './Bar';
import { BreakdownList } from './BreakdownList';
import { SessionListItem } from './SessionListItem';
import { SummaryCard } from './SummaryCard';

const MAX_BREAKDOWN_ENTRIES = 5;
const MAX_RECENT_SESSIONS = 20;

/** Cache-first (ritualStore), falling back to a direct DB read — includes archived rituals, so a
 * deleted ritual a historical session referenced still resolves to its real name. */
async function resolveRitualName(id: string): Promise<string> {
  const cached = useRitualStore.getState().rituals.find((r) => r.id === id);
  if (cached) return cached.name;
  const db = await getDatabase();
  const ritual = await getRitualById(db, id);
  return ritual?.name ?? 'Deleted Ritual';
}

async function resolveTaskTitle(id: string): Promise<string> {
  const db = await getDatabase();
  const task = await getTaskById(db, id);
  return task?.title ?? 'Deleted Task';
}

export function HistoryScreen() {
  const theme = useTheme();
  const weekStartsOn = useSettingsStore((s) => s.settings.weekStartsOn);
  const [sessions, setSessions] = useState<TimerSession[] | null>(null);
  const [ritualNames, setRitualNames] = useState<Record<string, string>>({});
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  // Collapsed by default — the breakdowns are the most domain-literacy-dependent part of
  // this screen ("by ritual", "by task"), so keeping them out of the first screenful is
  // what actually makes the simple case (today's number, a chart, recent sessions) read
  // as simple. Still one tap away for anyone who wants to dig in.
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const db = await getDatabase();
      const terminal = await listTerminalSessions(db);
      setSessions(terminal);
      setLoadError(null);

      const ritualIds = [...new Set(terminal.map((s) => s.ritualId).filter((id): id is string => id != null))];
      const taskIds = [...new Set(terminal.map((s) => s.taskId).filter((id): id is string => id != null))];
      const [nameEntries, titleEntries] = await Promise.all([
        Promise.all(ritualIds.map(async (id) => [id, await resolveRitualName(id)] as const)),
        Promise.all(taskIds.map(async (id) => [id, await resolveTaskTitle(id)] as const)),
      ]);
      setRitualNames(Object.fromEntries(nameEntries));
      setTaskTitles(Object.fromEntries(titleEntries));
    } catch (error) {
      console.error('[HistoryScreen] failed to load session history', error);
      setLoadError('Could not load session history.');
    }
  }, []);

  // Refetch every time this tab regains focus — a session finished on the Focus tab
  // should show up here immediately, matching RitualsListScreen/TodayScreen's pattern.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loadError && sessions == null) {
    return (
      <Screen>
        <EmptyState icon="alert-triangle" title="Couldn't load history" message={loadError} onRetry={() => void load()} />
      </Screen>
    );
  }

  if (sessions == null) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={theme.neutral.textMuted}>
            Loading…
          </Text>
        </View>
      </Screen>
    );
  }

  if (sessions.length === 0) {
    return (
      <Screen>
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
          <Text variant="title">History</Text>
        </View>
        <EmptyState
          icon="bar-chart-2"
          title="No sessions yet"
          message="Finish a focus session and it will show up here."
        />
      </Screen>
    );
  }

  const now = Date.now();
  const today = summarize(filterSessionsInRange(sessions, startOfDay(now), now + 1));
  const week = summarize(filterSessionsInRange(sessions, startOfWeek(now, weekStartsOn), now + 1));
  const month = summarize(filterSessionsInRange(sessions, startOfMonth(now), now + 1));

  const dailyBars = last7DaysBuckets(sessions, now);
  const maxDailyMs = Math.max(...dailyBars.map((b) => b.totalFocusMs), 1);

  const rhythm = weeklyRhythm(sessions, weekStartsOn);
  const maxRhythmMs = Math.max(...rhythm.map((d) => d.totalFocusMs), 1);

  const ritualBreakdown = groupByRitual(sessions)
    .filter((entry): entry is typeof entry & { key: string } => entry.key != null)
    .slice(0, MAX_BREAKDOWN_ENTRIES);
  const taskBreakdown = groupByTask(sessions)
    .filter((entry): entry is typeof entry & { key: string } => entry.key != null)
    .slice(0, MAX_BREAKDOWN_ENTRIES);

  const favoriteId = favoriteRitualId(sessions);
  const bestSegment = bestFocusSegment(sessions);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.xl,
          paddingBottom: theme.spacing.xxxl,
          alignSelf: 'center',
          width: '100%',
          maxWidth: theme.layout.maxContentWidth,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="title">History</Text>

        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="label" color={theme.neutral.textMuted}>
            Today
          </Text>
          <Text variant="title" style={{ fontSize: theme.fontSize.xxl }}>
            {today.sessionCount > 0 ? `${formatFocusDuration(today.totalFocusMs)} focused` : 'No focus time yet'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <SummaryCard label="This Week" summary={week} />
          <SummaryCard label="This Month" summary={month} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <View>
            <Text variant="label" color={theme.neutral.textMuted}>
              Last 7 Days
            </Text>
            <Text variant="caption" color={theme.neutral.textMuted}>
              Focus time each day this week
            </Text>
          </View>
          <Surface style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            {dailyBars.map((bucket) => (
              <Bar
                key={bucket.dateMs}
                heightRatio={bucket.totalFocusMs / maxDailyMs}
                label={WEEKDAY_SHORT_LABELS[new Date(bucket.dateMs).getDay()] ?? ''}
              />
            ))}
          </Surface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <View>
            <Text variant="label" color={theme.neutral.textMuted}>
              Weekly Rhythm
            </Text>
            <Text variant="caption" color={theme.neutral.textMuted}>
              Your usual pattern by weekday, across all-time
            </Text>
          </View>
          <Surface style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            {rhythm.map((day) => (
              <Bar
                key={day.dayOfWeek}
                heightRatio={day.totalFocusMs / maxRhythmMs}
                label={WEEKDAY_SHORT_LABELS[day.dayOfWeek] ?? ''}
                color={theme.neutral.textMuted}
              />
            ))}
          </Surface>
        </View>

        {(favoriteId ?? bestSegment) && (
          <Surface style={{ gap: theme.spacing.xs }}>
            {favoriteId && (
              <Text variant="body">Favorite ritual: {ritualNames[favoriteId] ?? '…'}</Text>
            )}
            {bestSegment && <Text variant="body">Best focus time: {TIME_OF_DAY_LABELS[bestSegment]}</Text>}
          </Surface>
        )}

        {(ritualBreakdown.length > 0 || taskBreakdown.length > 0) && (
          <View style={{ gap: theme.spacing.md }}>
            <Pressable
              onPress={() => setDetailsExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={detailsExpanded ? 'Hide details' : 'Show details'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
            >
              <Text variant="label" color={theme.neutral.textMuted}>
                Details
              </Text>
              <Feather
                name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.neutral.textMuted}
              />
            </Pressable>

            {detailsExpanded && (
              <View style={{ gap: theme.spacing.xl }}>
                {ritualBreakdown.length > 0 && (
                  <BreakdownList
                    title="By Ritual"
                    entries={ritualBreakdown}
                    resolveLabel={(key) => ritualNames[key] ?? '…'}
                  />
                )}

                {taskBreakdown.length > 0 && (
                  <BreakdownList title="By Task" entries={taskBreakdown} resolveLabel={(key) => taskTitles[key] ?? '…'} />
                )}
              </View>
            )}
          </View>
        )}

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color={theme.neutral.textMuted}>
            Recent Sessions
          </Text>
          <View style={{ gap: theme.spacing.sm }}>
            {sessions.slice(0, MAX_RECENT_SESSIONS).map((s) => (
              <SessionListItem
                key={s.id}
                session={s}
                subtitle={
                  (s.ritualId && ritualNames[s.ritualId]) || (s.taskId && taskTitles[s.taskId]) || null
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
