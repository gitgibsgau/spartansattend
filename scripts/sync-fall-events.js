// Sync the 10 confirmed Sep events from gsynch as UNPUBLISHED drafts, storing a
// custom app tag (eventTag/eventTagLabel). Numbering is date-then-time order
// continuing after Aug 15's Event 1 & 2 — hardcoded id->tag so it's not fragile.
// Re-syncing preserves published/allocationsPublished/goingCount.
//
// Dry-run: EVENTS_API_KEY=.. ADMIN_EMAIL=.. ADMIN_PASSWORD=.. node scripts/sync-fall-events.js
// Apply:   ... node scripts/sync-fall-events.js --apply
const fs = require('fs'), path = require('path');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc, setDoc, Timestamp } = require('firebase/firestore');

const API_URL = 'https://events.gsynch.com/api/integrations/events';
const API_KEY = process.env.EVENTS_API_KEY || '641dbd4e7404ad63f35b8d0db89d9119241fa945f148edd23a06cede53bf3014';

// gsynch id -> app event tag (date, then time; Sep 27 morning Konark before evening SJSU).
const TAGS = { 38: 3, 36: 4, 41: 5, 39: 6, 40: 7, 42: 8, 59: 9, 43: 10, 58: 11, 44: 12 };
// Manual city for events with no address in gsynch (so re-sync won't blank it).
const CITY_OVERRIDE = { 58: 'Cupertino' };

function loadEnv() {
  const out = {}; const p = path.join(__dirname, '..', '.env');
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}
// City from a full address (part before the "ST" / "ST ZIP" token).
const cityOf = (addr) => {
  if (!addr) return '';
  const parts = String(addr).split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = 1; i < parts.length; i++) {
    if (/^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(parts[i])) return parts[i - 1];
  }
  const cleaned = parts.filter((p) => !/^usa$/i.test(p) && !/^\d{5}/.test(p));
  return cleaned[cleaned.length - 1] || String(addr);
};
const seasonOf = (ev) => { const m = String(ev.season_name || '').match(/(\d{4})/); return m ? m[1] : String(ev.season_id ?? ''); };
const startsAtOf = (ev) => { if (!ev.event_date) return null; const d = new Date(`${ev.event_date}T00:00:00`); return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d); };

(async () => {
  const apply = process.argv.includes('--apply');
  const env = loadEnv();
  const app = initializeApp({
    apiKey: env.FIREBASE_API_KEY, authDomain: env.FIREBASE_AUTH_DOMAIN, projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET, messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID, appId: env.FIREBASE_APP_ID,
  });
  const db = getFirestore(app);
  await signInWithEmailAndPassword(getAuth(app), process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);

  const res = await fetch(API_URL, { headers: { 'X-API-Key': API_KEY } });
  if (!res.ok) { console.error(`API error ${res.status}`); process.exit(1); }
  const byId = new Map(((await res.json()).events || []).map((e) => [e.id, e]));

  console.log(`\n=== ${apply ? 'APPLYING' : 'DRY-RUN'} fall-event sync (10 events) ===\n`);
  const plan = [];
  for (const [gid, tag] of Object.entries(TAGS)) {
    const ev = byId.get(Number(gid));
    if (!ev) { console.log(`  ⚠ gsynch id ${gid} not in API — skipped`); continue; }
    const id = `gsynch_${ev.id}`;
    const prior = await getDoc(doc(db, 'events', id));
    const apiFields = {
      // Member-visible title is the tag itself, so NO app version can leak the
      // real name (it's not in the downloaded doc's `title`). Real name lives in
      // realTitle and is shown only after RSVP closes / event passes.
      title: `Event ${tag}`,
      realTitle: ev.title || 'Untitled event',
      venue: CITY_OVERRIDE[ev.id] || cityOf(ev.location),  // member-visible: city only
      realVenue: ev.location || '',                        // full address, revealed after RSVP closes

      eventDate: ev.event_date || null,
      startsAt: startsAtOf(ev),
      startTime: ev.start_time || null,
      reportingTime: ev.reporting_time || null,
      season: seasonOf(ev),
      status: ev.status || null,
      eventTag: tag,
      eventTagLabel: `Event ${tag}`,
      source: 'gsynch',
      externalId: ev.id,
      syncedAt: Timestamp.now(),
    };
    plan.push({ id, ref: doc(db, 'events', id), apiFields, exists: prior.exists(), label: `Event ${tag}`, title: ev.title, date: ev.event_date });
    console.log(`  ${`Event ${tag}`.padEnd(9)} ${id.padEnd(11)} ${ev.event_date}  ${(ev.title || '').padEnd(28)} ${prior.exists() ? '(update, state preserved)' : '(new draft)'}`);
  }

  if (!apply) { console.log(`\nDRY-RUN — nothing written. Re-run with --apply.`); process.exit(0); }
  console.log(`\nWriting ${plan.length}...`);
  for (const p of plan) {
    if (p.exists) await setDoc(p.ref, p.apiFields, { merge: true });
    else await setDoc(p.ref, { ...p.apiFields, published: false, allocationsPublished: false, requiresEligibility: false, goingCount: 0, createdAt: Timestamp.now() });
  }
  console.log(`Done. ${plan.length} events synced as unpublished drafts with tags.`);
  process.exit(0);
})().catch((e) => { console.error('Failed:', e?.message || e); process.exit(1); });
