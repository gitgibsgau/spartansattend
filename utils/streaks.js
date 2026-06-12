// utils/streaks.js
// Attendance streaks + achievement badges, derived purely from existing
// sessions/attendance data (no new collection needed).
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Pure: given sessions [{ id, ts }] and a Set of attended session ids, return
 * { attended, total, currentStreak, longestStreak }.
 *  - currentStreak: consecutive most-recent sessions attended (0 if the latest
 *    session was missed).
 *  - longestStreak: longest consecutive attended run in the season.
 */
export function tallyStreaks(sessions, attendedSet) {
  const ordered = [...sessions].sort((a, b) => a.ts - b.ts);
  let run = 0;
  let longest = 0;
  let attended = 0;
  for (const s of ordered) {
    if (attendedSet.has(s.id)) {
      run += 1;
      attended += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  return { attended, total: ordered.length, currentStreak: run, longestStreak: longest };
}

/** Fetch a student's season attendance and compute streak stats. */
export async function fetchAttendanceStats(uid, season) {
  const [sessionsSnap, attendanceSnap] = await Promise.all([
    getDocs(query(collection(db, 'sessions'), where('season', '==', season))),
    getDocs(
      query(
        collection(db, 'attendance'),
        where('studentId', '==', uid),
        where('season', '==', season)
      )
    ),
  ]);

  const sessions = sessionsSnap.docs.map((d) => ({
    id: d.id,
    ts: d.data().timestamp?.seconds ? d.data().timestamp.seconds * 1000 : 0,
  }));
  const attendedSet = new Set(attendanceSnap.docs.map((d) => d.data().sessionId));

  return tallyStreaks(sessions, attendedSet);
}

/**
 * Derive the achievement badge list (earned/locked) from stats. Returns an
 * array of { id, icon, label, desc, earned }. Streak badges key off the
 * longest streak so they stay earned once unlocked.
 */
// Years in the pathak required for the Veteran badge.
export const VETERAN_YEARS = 3;

/**
 * Derive the achievement badge list (earned/locked) from stats.
 *  - Streak badges key off the longest streak (stay earned once unlocked).
 *  - Veteran is tenure-based: years in the pathak (currentSeason - joinedYear + 1),
 *    since a single season has too few practices to ever hit a high count.
 */
export function computeBadges({ attended, total, longestStreak, joinedYear, currentSeason }) {
  const ratio = total ? attended / total : 0;
  const tenureYears =
    joinedYear && currentSeason ? currentSeason - joinedYear + 1 : 0;

  return [
    { id: 'first', icon: 'footsteps', label: 'First Step', desc: 'Attend your first practice', earned: attended >= 1 },
    { id: 'regular', icon: 'star', label: 'Regular', desc: 'Attend 10 practices', earned: attended >= 10 },
    {
      id: 'veteran',
      icon: 'trophy',
      label: 'Veteran',
      desc: joinedYear
        ? `${VETERAN_YEARS}+ years in the pathak`
        : 'Set your join year in Edit Profile',
      earned: tenureYears >= VETERAN_YEARS,
    },
    { id: 'streak3', icon: 'flame', label: 'On Fire', desc: '3 practices in a row', earned: longestStreak >= 3 },
    { id: 'streak5', icon: 'flash', label: 'On a Roll', desc: '5 practices in a row', earned: longestStreak >= 5 },
    { id: 'streak10', icon: 'rocket', label: 'Unstoppable', desc: '10 practices in a row', earned: longestStreak >= 10 },
    { id: 'eligible', icon: 'shield-checkmark', label: 'Eligible', desc: 'Reach 80% attendance', earned: total > 0 && ratio >= 0.8 },
    { id: 'perfect', icon: 'ribbon', label: 'Perfect Season', desc: '100% attendance', earned: total > 0 && ratio >= 1 },
  ];
}
