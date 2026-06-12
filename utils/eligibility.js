// utils/eligibility.js
// Shared attendance-eligibility helper. A student is "eligible" for event
// allocations once they've attended >= 80% of the season's sessions.
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const ELIGIBILITY_THRESHOLD = 0.8;

/**
 * Compute a student's attendance eligibility for a season.
 * Returns { attended, total, ratio, pct, isEligible }.
 */
export async function fetchAttendanceEligibility(uid, season) {
  const [attendanceSnap, sessionsSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'attendance'),
        where('studentId', '==', uid),
        where('season', '==', season)
      )
    ),
    getDocs(query(collection(db, 'sessions'), where('season', '==', season))),
  ]);

  const attended = attendanceSnap.size;
  const total = sessionsSnap.size;
  const ratio = total > 0 ? attended / total : 0;

  return {
    attended,
    total,
    ratio,
    pct: Math.round(ratio * 100),
    isEligible: total > 0 && ratio >= ELIGIBILITY_THRESHOLD,
  };
}
