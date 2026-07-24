/**
 * SpartansAttend HTTP API (Cloud Functions, 2nd gen) for the external logistics
 * app. Read-only over Firestore via the Admin SDK. Auth: X-API-Key header must
 * match the LOGISTICS_API_KEY secret.
 *
 * Routes (under the deployed function URL):
 *   GET /events              -> upcoming published events [{ id, title, date, startTime, reportingTime }]
 *   GET /events/:id/going    -> names of people who RSVP'd "Going" to that event
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

exports.api = onRequest({ secrets: [LOGISTICS_API_KEY], region: 'us-central1' }, app);
