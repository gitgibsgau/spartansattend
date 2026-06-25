/**
 * Seed a DEV Firebase project with sample data so the app boots and every flow
 * is testable. Creates login-ready Auth accounts + Firestore docs.
 *
 * ⚠️ Run this against your DEV project only (your local .env must point at it),
 * and run it while Firestore rules are OPEN (test mode):
 *   1. Dev Firebase → Firestore → Rules → temporarily set:  allow read, write: if true;
 *   2. node scripts/seed-dev.js
 *   3. Then paste the real firestore.rules and Publish.
 * (The strict rules intentionally block seeding admin/sessions/config docs.)
 *
 * Login accounts created (password for all: devpass123):
 *   admin@dev.test · student@dev.test · costume@dev.test · donation@dev.test
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, collection, Timestamp } = require('firebase/firestore');

function loadEnv() {
  const out = {};
  const p = path.join(__dirname, '..', '.env');
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const SEASON = '2026';
const PASSWORD = 'devpass123';
const now = Date.now();
const daysAgo = (d) => Timestamp.fromMillis(now - d * 86400000);

// Login-ready accounts (Auth + matching users doc).
const ACCOUNTS = [
  { email: 'admin@dev.test', fullname: 'Dev Admin', role: 'admin', avatarColor: '#6366F1' },
  {
    email: 'student@dev.test', fullname: 'Dev Student', role: 'student',
    instrument: ['Dhol', 'Dhwaj'], joinedYear: 2024, kurtaSize: '40', jacketSize: '40',
    company: 'DevCo', group: 1, groupRole: 'member', groupLead: 'Dev Lead', avatarColor: '#0D9488', avatarEmoji: '🥁',
  },
  { email: 'costume@dev.test', fullname: 'Dev Costume Admin', role: 'student', adminScopes: ['costume'], avatarColor: '#F97316' },
  { email: 'donation@dev.test', fullname: 'Dev Donation Admin', role: 'student', adminScopes: ['donation'], avatarColor: '#DB2777' },
];

// Extra roster-only students (no login) to make rosters/counts realistic.
const ROSTER = [
  { fullname: 'Asha Kale', gender: 'F', kurtaSize: '36', jacketSize: '38', company: 'Acme', group: 2 },
  { fullname: 'Rohan Pawar', kurtaSize: '42', jacketSize: '42', company: 'Globex', group: 3 },
  { fullname: 'Meera Joshi', kurtaSize: '38', jacketSize: '40', company: 'Initech', group: 4 },
  { fullname: 'Sahil Rane', kurtaSize: '44', jacketSize: '44', company: 'Acme', group: 1 },
  { fullname: 'Pooja Shah', kurtaSize: '36', jacketSize: '36', company: 'Hooli', group: 2 },
];

(async () => {
  const env = loadEnv();
  const app = initializeApp({
    apiKey: env.FIREBASE_API_KEY, authDomain: env.FIREBASE_AUTH_DOMAIN, projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET, messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID, appId: env.FIREBASE_APP_ID,
  });
  const db = getFirestore(app);
  const auth = getAuth(app);

  console.log(`Seeding project: ${env.FIREBASE_PROJECT_ID}\n`);
  if (/spartansattend-5c2c7/.test(env.FIREBASE_PROJECT_ID || '')) {
    console.error('Refusing to run: that looks like PROD. Point .env at your dev project.'); process.exit(1);
  }

  // 1) Login accounts + user docs.
  const created = [];
  let studentUid = null;
  for (const a of ACCOUNTS) {
    let uid;
    try {
      uid = (await createUserWithEmailAndPassword(auth, a.email, PASSWORD)).user.uid;
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') uid = (await signInWithEmailAndPassword(auth, a.email, PASSWORD)).user.uid;
      else throw e;
    }
    const { email, ...rest } = a;
    await setDoc(doc(db, 'users', uid), { email: a.email, createdAt: new Date().toISOString(), ...rest }, { merge: true });
    if (a.email === 'student@dev.test') studentUid = uid;
    created.push(a.email);
  }

  // 2) Roster-only students.
  for (let i = 0; i < ROSTER.length; i++) {
    const r = ROSTER[i];
    await setDoc(doc(db, 'users', `seed_student_${i + 1}`), {
      role: 'student', createdAt: new Date().toISOString(), joinedYear: 2026, ...r,
    }, { merge: true });
  }

  // 3) Season/config so the app boots.
  await setDoc(doc(db, 'globalConfig', 'parikshanSettings'), {
    currentSeason: SEASON, activeStage: null, midReleased: false, finalReleased: false,
  }, { merge: true });

  // 4) A few sessions (past dates + codes).
  const sessions = [
    { id: 'seed_sess_1', title: 'Practice 1', code: 'DEV001', timestamp: daysAgo(10) },
    { id: 'seed_sess_2', title: 'Practice 2', code: 'DEV002', timestamp: daysAgo(7) },
    { id: 'seed_sess_3', title: 'Practice 3', code: 'DEV003', timestamp: daysAgo(3) },
  ];
  for (const s of sessions) await setDoc(doc(db, 'sessions', s.id), { ...s, season: SEASON }, { merge: true });

  // 5) Mark the dev student present for 2 of 3 sessions.
  if (studentUid) {
    for (const sid of ['seed_sess_1', 'seed_sess_2']) {
      await setDoc(doc(db, 'attendance', `${studentUid}_${sid}`), {
        studentId: studentUid, sessionId: sid, season: SEASON, markedAt: Timestamp.now(), corrected: false,
      }, { merge: true });
    }
  }

  console.log('Seeded:');
  console.log(`  • ${created.length} login accounts (password: ${PASSWORD})`);
  created.forEach((e) => console.log(`      ${e}`));
  console.log(`  • ${ROSTER.length} roster-only students`);
  console.log(`  • globalConfig (season ${SEASON}), ${sessions.length} sessions, sample attendance`);
  console.log('\nNext: paste the real firestore.rules into the dev project and Publish.');
  process.exit(0);
})().catch((e) => { console.error('\nSeed failed:', e?.message || e); process.exit(1); });
