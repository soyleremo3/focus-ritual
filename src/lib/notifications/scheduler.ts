import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationPlan } from '@/domain/notifications/notificationPlan';

const PHASE_END_NOTIFICATION_ID = 'focus-ritual-phase-end';
const ANDROID_CHANNEL_ID = 'timer';

/**
 * ERR_UNAVAILABLE means "not implemented on this platform" — expo-notifications has no
 * web implementation for scheduled/cancelled notifications (only permissions, which use
 * the browser's own Notification API). That's an expected, permanent condition on web, not
 * a bug worth an error-level log on every single timer action — so it's swallowed quietly
 * here while any other, genuinely unexpected failure still surfaces normally.
 */
function logUnlessUnavailable(context: string, error: unknown): void {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
  if (code === 'ERR_UNAVAILABLE') return;
  console.error(`[notifications] ${context}`, error);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * One-time setup — safe to call every app start, no permission required. Call from
 * app/_layout.tsx alongside the other module-level audio/font setup.
 */
export async function initNotifications(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Focus Timer',
      importance: Notifications.AndroidImportance.HIGH,
    });
  } catch (error) {
    console.error('[notifications] failed to set up Android channel', error);
  }
}

/**
 * Checks first, only prompts if genuinely undetermined, and never re-prompts once the
 * user has said no (canAskAgain reflects that). Never throws — a denial or a platform
 * that doesn't support local notifications just means schedulePhaseEndNotification()
 * silently does nothing; it must never block starting or running a timer.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error) {
    logUnlessUnavailable('failed to check/request permission', error);
    return false;
  }
}

export async function cancelPhaseEndNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(PHASE_END_NOTIFICATION_ID);
  } catch (error) {
    logUnlessUnavailable('failed to cancel', error);
  }
}

/**
 * Always cancels any previous phase-end notification first, then schedules this one under
 * the same fixed identifier — a session's phase-end notification is always singular, so
 * there's never a need to track identifiers across pause/resume/reconcile: cancel-then-
 * reschedule against the fixed ID is idempotent and correct even if the previous one
 * already fired (cancelling an already-fired/nonexistent notification is a harmless no-op).
 */
export async function schedulePhaseEndNotification(plan: NotificationPlan): Promise<void> {
  try {
    await cancelPhaseEndNotification();
    await Notifications.scheduleNotificationAsync({
      identifier: PHASE_END_NOTIFICATION_ID,
      content: { title: plan.title, body: plan.body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: plan.fireAtMs,
        channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
      },
    });
  } catch (error) {
    logUnlessUnavailable('failed to schedule', error);
  }
}
