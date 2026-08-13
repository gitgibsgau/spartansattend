/**
 * SpartansAttend HTTP API (Cloud Functions, 2nd gen) for the external logistics
 * app. Read-only over Firestore via the Admin SDK. Auth: X-API-Key header must
 * match the LOGISTICS_API_KEY secret.
 *
 * Routes (under the deployed function URL):
 *   GET /events              -> upcoming published events [{ id, title, date, startTime, reportingTime }]
 *   GET /events/:id/going    -> names of people who RSVP'd "Going" to that event
 *   GET /attendance          -> attendance for everyone who attended >=1 session this season
 *                               { season, totalSessions, attendance: [{ name, attended, total, percent, lastAttended }] }
 *
 * Set the key once:  firebase functions:secrets:set LOGISTICS_API_KEY
 * Deploy:            firebase deploy --only functions
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const express = require('express');

admin.initializeApp();
const db = admin.firestore();
const LOGISTICS_API_KEY = defineSecret('LOGISTICS_API_KEY');

const app = express();

// API-key auth on every route.
app.use((req, res, next) => {
  const key = req.get('X-API-Key');
  if (!key || key !== LOGISTICS_API_KEY.value()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Upcoming published events (so logistics can pick one).
app.get('/events', async (req, res) => {
  try {
    const snap = await db.collection('events').where('published', '==', true).get();
    const cutoff = Date.now() - 86400000; // include today
    const events = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((e) => {
        const ms = e.startsAt && e.startsAt.toMillis ? e.startsAt.toMillis() : 0;
        return !ms || ms >= cutoff;
      })
      .map((e) => ({ id: e.id, title: e.title || '', date: e.eventDate || null, startTime: e.startTime || null, reportingTime: e.reportingTime || null }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    res.json({ count: events.length, events });
  } catch (err) {
    console.error('GET /events failed:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Names of people who said "Going" to an event.
app.get('/events/:id/going', async (req, res) => {
  try {
    const { id } = req.params;
    const ev = await db.collection('events').doc(id).get();
    if (!ev.exists) return res.status(404).json({ error: 'Event not found' });

    const rsvps = await db.collection('events').doc(id).collection('rsvps').get();
    const goingUids = rsvps.docs.filter((d) => d.data().status === 'going').map((d) => d.id);

    let names = [];
    if (goingUids.length) {
      const userDocs = await db.getAll(...goingUids.map((uid) => db.collection('users').doc(uid)));
      names = userDocs.filter((u) => u.exists).map((u) => u.data().fullname || u.id);
    }
    names.sort((a, b) => a.localeCompare(b));
    res.json({ eventId: id, title: ev.data().title || '', date: ev.data().eventDate || null, count: names.length, going: names });
  } catch (err) {
    console.error('GET /events/:id/going failed:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Per-member attendance for the current season (attended / total, %, last date).
app.get('/attendance', async (req, res) => {
  try {
    const cfg = await db.collection('globalConfig').doc('parikshanSettings').get();
    const season = cfg.exists ? cfg.data().currentSeason : null;
    if (!season) return res.status(500).json({ error: 'No current season configured' });

    // Sessions this season -> sessionId => start time (ms). Total = count.
    const sessSnap = await db.collection('sessions').where('season', '==', season).get();
    const sessionMs = new Map();
    sessSnap.forEach((d) => {
      const t = d.data().timestamp;
      sessionMs.set(d.id, t && t.toMillis ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0));
    });
    const totalSessions = sessionMs.size;

    // Attendance this season -> per student: distinct valid sessions + latest date.
    // Attendance for a deleted session (sessionId not in sessionMs) is ignored, so
    // counts never exceed totalSessions (matches the app's streak tally).
    const attSnap = await db.collection('attendance').where('season', '==', season).get();
    const perStudent = new Map(); // uid -> { sessions:Set, lastMs:number }
    attSnap.forEach((d) => {
      const { studentId, sessionId } = d.data();
      if (!studentId || !sessionMs.has(sessionId)) return;
      let rec = perStudent.get(studentId);
      if (!rec) { rec = { sessions: new Set(), lastMs: 0 }; perStudent.set(studentId, rec); }
      rec.sessions.add(sessionId);
      const ms = sessionMs.get(sessionId);
      if (ms > rec.lastMs) rec.lastMs = ms;
    });

    // Names for the attendees (only need the user docs for display).
    const usersSnap = await db.collection('users').get();
    const nameById = new Map();
    usersSnap.forEach((d) => nameById.set(d.id, d.data().fullname || d.id));

    // One row per person who attended >= 1 session this season (season attendees
    // only — never-attended / stale accounts are excluded).
    const rows = [];
    for (const [uid, rec] of perStudent) {
      const attended = rec.sessions.size;
      rows.push({
        name: nameById.get(uid) || uid,
        attended,
        total: totalSessions,
        percent: totalSessions ? Math.round((attended / totalSessions) * 100) : 0,
        lastAttended: rec.lastMs ? new Date(rec.lastMs).toISOString().slice(0, 10) : null,
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ season, totalSessions, count: rows.length, attendance: rows });
  } catch (err) {
    console.error('GET /attendance failed:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

exports.api = onRequest({ secrets: [LOGISTICS_API_KEY], region: 'us-central1' }, app);
