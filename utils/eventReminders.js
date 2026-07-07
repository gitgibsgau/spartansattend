// utils/eventReminders.js
// On-device scheduled reminders for upcoming events. No backend: each device
// (re)schedules its OWN local notifications from the current event list, so
// call syncEventReminders() whenever events load. It cancels and reschedules
// every time, keeping reminders in sync as events/RSVPs change.
//
// Reminders per upcoming event: 3 days before, the day before, event morning,
// and — only for people who haven't RSVP'd yet — as the RSVP deadline nears.
import { Platform } from 'react-native';

// Guarded require: no-ops in runtimes without the native module (Expo Go, or a
// build made before expo-notifications was added).
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('expo-notifications unavailable; event reminders disabled:', e?.message);
}

const DAY = 86400000;
// iOS caps pending local notifications at 64 — stay comfortably under.
const MAX_SCHEDULED = 58;

const atHour = (ms, hour) => {
  const d = new Date(ms);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const fmtDay = (ms) =>
  new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * Reschedule all local event reminders from the given event rows.
 * Each row is expected to carry: id, title, startsMs, startTime, venue,
 * reportingTime, published, rsvpDeadlineMs, myStatus.
 */
export async function syncEventReminders(events = []) {
  if (!Notifications) return;
  try {
    // Local notifications need the same permission as push. Ask once if the
    // user hasn't been prompted yet (covers simulators, which skip the
    // push-token flow); never nag if they've already decided.
    let { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = Date.now();
    const upcoming = events
      .filter(
        (e) =>
          e.published !== false &&
          e.startsMs &&
          e.startsMs !== Number.MAX_SAFE_INTEGER &&
          e.startsMs > now
      )
      .sort((a, b) => a.startsMs - b.startsMs);

    const jobs = [];
    for (const e of upcoming) {
      const title = e.title || 'Event';
      const when = `${fmtDay(e.startsMs)}${e.startTime ? ` · ${e.startTime}` : ''}`;
      const venue = e.venue ? ` ${e.venue}.` : '';

      const threeDays = atHour(e.startsMs - 3 * DAY, 9);
      if (threeDays.getTime() > now)
        jobs.push({ at: threeDays, title: `🥁 ${title} in 3 days`, body: `${when}.${venue}`, id: e.id });

      const dayBefore = atHour(e.startsMs - DAY, 9);
      if (dayBefore.getTime() > now)
        jobs.push({ at: dayBefore, title: `🥁 ${title} is tomorrow`, body: `${when}.${venue}`, id: e.id });

      const dayOf = atHour(e.startsMs, 8);
      if (dayOf.getTime() > now)
        jobs.push({
          at: dayOf,
          title: `🥁 ${title} is today`,
          body: e.reportingTime ? `Report by ${e.reportingTime}.${venue}` : `${when}.${venue}`,
          id: e.id,
        });

      // Only nudge people who haven't responded yet.
      if (e.rsvpDeadlineMs && e.rsvpDeadlineMs > now && !e.myStatus) {
        const dlSoon = new Date(e.rsvpDeadlineMs - DAY);
        if (dlSoon.getTime() > now)
          jobs.push({
            at: dlSoon,
            title: `⏰ RSVP closing: ${title}`,
            body: `RSVP closes ${fmtDay(e.rsvpDeadlineMs)}. Tap to respond.`,
            id: e.id,
          });
      }
    }

    jobs.sort((a, b) => a.at - b.at);
    const DATE_TRIGGER = Notifications.SchedulableTriggerInputTypes?.DATE ?? 'date';
    for (const j of jobs.slice(0, MAX_SCHEDULED)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: j.title, body: j.body, data: { eventId: j.id }, sound: 'default' },
        trigger: { type: DATE_TRIGGER, date: j.at },
      });
    }
  } catch (err) {
    console.log('Failed to schedule event reminders:', err?.message || err);
  }
}
