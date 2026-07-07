// screens/EventsScreen.js
// Shared by students and admins. Students see upcoming events with an
// eligibility badge and can RSVP (Going / Can't make it); admins additionally
// get a "+" to create events via an inline modal.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  Modal,
  Switch,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { syncEventReminders } from '../utils/eventReminders';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { LinearGradient } from '../components/ui/Gradient';
import { GradientButton } from '../components/ui';
import { fetchAttendanceEligibility } from '../utils/eligibility';
import { useSeason } from '../contexts/SeasonContext';
import { colors, spacing, radius, fonts, shadows } from '../theme';

const dateParts = (ms) => {
  const d = new Date(ms || 0);
  return {
    month: d.toLocaleString(undefined, { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleString(undefined, { weekday: 'short' }),
    time: d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
};

// Whole-calendar-days from today to the event date, and an intuitive label.
const countdown = (ms, hasDate) => {
  if (!hasDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ev = new Date(ms); ev.setHours(0, 0, 0, 0);
  const d = Math.round((ev.getTime() - today.getTime()) / 86400000);
  if (d < 0) return { text: 'Ended', tone: 'muted' };
  if (d === 0) return { text: 'Today', tone: 'urgent' };
  if (d === 1) return { text: 'Tomorrow', tone: 'urgent' };
  if (d <= 7) return { text: `In ${d} days`, tone: 'soon' };
  return { text: `In ${d} days`, tone: 'normal' };
};

const fmtDeadline = (ms) =>
  new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// RSVP is open until the (optional) per-event deadline passes.
const rsvpOpen = (ev) => !ev.rsvpDeadlineMs || Date.now() <= ev.rsvpDeadlineMs;

export default function EventsScreen() {
  const { currentSeason } = useSeason();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState(null);
  const [fullname, setFullname] = useState('');
  const [eligibility, setEligibility] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendees, setAttendees] = useState(null); // admin: full RSVP list for open event
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  const [status, setStatus] = useState({ show: false, type: '', text: '' });
  const showBanner = (type, text) => {
    setStatus({ show: true, type, text });
    setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
  };

  // ---- Create-event modal state (admin) ----
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fVenue, setFVenue] = useState('');
  const [fDate, setFDate] = useState(''); // 'YYYY-MM-DD'
  const [fTime, setFTime] = useState('18:00'); // 'HH:MM' 24h
  const [fRequiresEligibility, setFRequiresEligibility] = useState(true);
  const [fThreshold, setFThreshold] = useState('80');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    if (!currentSeason) return;
    try {
      const uid = auth.currentUser.uid;

      // Role + name + eligibility in parallel.
      const [userSnap, elig] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        fetchAttendanceEligibility(uid, currentSeason),
      ]);
      const userData = userSnap.exists() ? userSnap.data() : {};
      const isAdmin = userData.role === 'admin';
      setRole(userData.role || 'student');
      setFullname(userData.fullname || 'Student');
      setEligibility(elig);

      // Admins see every event for the season (drafts + published). Students
      // read only published events — a single-equality filter (no composite
      // index; rule-enforced), with the season narrowed client-side.
      const evSnap = isAdmin
        ? await getDocs(query(collection(db, 'events'), where('season', '==', currentSeason)))
        : await getDocs(query(collection(db, 'events'), where('published', '==', true)));

      // Each student's own RSVP doc (1 read per event).
      const rows = await Promise.all(
        evSnap.docs.map(async (d) => {
          const data = d.data();
          let myStatus = null;
          try {
            const rsvpSnap = await getDoc(doc(db, 'events', d.id, 'rsvps', uid));
            if (rsvpSnap.exists()) myStatus = rsvpSnap.data().status;
          } catch (_) { /* non-fatal */ }
          return {
            id: d.id,
            ...data,
            // No date (TBD/declined) sorts to the bottom of the list.
            startsMs: data.startsAt?.toMillis ? data.startsAt.toMillis() : Number.MAX_SAFE_INTEGER,
            hasDate: !!(data.eventDate || data.startsAt),
            rsvpDeadlineMs: data.rsvpDeadline?.toMillis ? data.rsvpDeadline.toMillis() : null,
            goingCount: data.goingCount || 0,
            myStatus,
          };
        })
      );
      rows.sort((a, b) => a.startsMs - b.startsMs);
      const seasonRows = rows.filter((r) => r.season === currentSeason);
      setEvents(seasonRows);
      // Reschedule this device's local reminders from the current list.
      syncEventReminders(seasonRows);
    } catch (err) {
      console.error('Failed to load events:', err);
      showBanner('error', 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, [currentSeason]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Admin: load the full attendee list when an event is opened.
  useEffect(() => {
    if (!selectedEvent || role !== 'admin') {
      setAttendees(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setAttendeesLoading(true);
      try {
        const snap = await getDocs(collection(db, 'events', selectedEvent.id, 'rsvps'));
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => r.status === 'going' || r.status === 'declined');
        if (!cancelled) setAttendees(rows);
      } catch (err) {
        console.error('Failed to load attendees:', err);
        if (!cancelled) setAttendees([]);
      } finally {
        if (!cancelled) setAttendeesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedEvent, role]);

  // ---- RSVP (confirm, then permanently locked) ----
  const handleRsvp = (event, newStatus) => {
    if (event.myStatus) return; // already locked

    if (!rsvpOpen(event)) {
      showBanner('error', 'RSVP has closed for this event.');
      return;
    }

    const threshold = event.eligibilityThreshold || 80;
    if (event.requiresEligibility && newStatus === 'going' && (!eligibility || eligibility.pct < threshold)) {
      showBanner('error', `Reach ${threshold}% attendance to RSVP for this event.`);
      return;
    }

    Alert.alert(
      'Confirm RSVP',
      newStatus === 'going'
        ? `Mark yourself as Going to "${event.title}"?\n\nThis can't be changed later.`
        : `Mark yourself as Can't make it for "${event.title}"?\n\nThis can't be changed later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => commitRsvp(event, newStatus) },
      ]
    );
  };

  const commitRsvp = async (event, newStatus) => {
    const uid = auth.currentUser.uid;
    const bump = (e) =>
      e && e.id === event.id
        ? { ...e, myStatus: newStatus, goingCount: e.goingCount + (newStatus === 'going' ? 1 : 0) }
        : e;

    // Optimistic UI (list + open detail).
    setEvents((prev) => prev.map(bump));
    setSelectedEvent((prev) => bump(prev));

    try {
      const eventRef = doc(db, 'events', event.id);
      const rsvpRef = doc(db, 'events', event.id, 'rsvps', uid);
      await runTransaction(db, async (tx) => {
        const rsvpSnap = await tx.get(rsvpRef);
        if (rsvpSnap.exists() && rsvpSnap.data().status) return; // already locked server-side
        tx.set(rsvpRef, { status: newStatus, fullname, updatedAt: serverTimestamp() }, { merge: true });
        if (newStatus === 'going') tx.update(eventRef, { goingCount: increment(1) });
      });
    } catch (err) {
      console.error('RSVP failed:', err);
      showBanner('error', 'Could not save your RSVP.');
      load(); // resync from server on failure
    }
  };

  // ---- Publish toggle (admin) — gates student visibility ----
  const handleTogglePublish = async (event) => {
    const next = !event.published;
    const flip = (e) => (e && e.id === event.id ? { ...e, published: next } : e);
    setEvents((prev) => prev.map(flip));
    setSelectedEvent((prev) => flip(prev));
    try {
      await updateDoc(doc(db, 'events', event.id), { published: next });
      showBanner('success', next ? 'Event published. Students can see it.' : 'Event hidden from students.');
    } catch (err) {
      console.error('Publish toggle failed:', err);
      showBanner('error', 'Could not update publish state.');
      const revert = (e) => (e && e.id === event.id ? { ...e, published: !next } : e);
      setEvents((prev) => prev.map(revert));
      setSelectedEvent((prev) => revert(prev));
    }
  };

  // ---- Delete event (admin) — cascades the RSVP subcollection ----
  const handleDelete = (event) => {
    Alert.alert(
      'Delete event',
      `Delete "${event.title}"? This removes the event and all its RSVPs. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove RSVP docs first (Firestore doesn't cascade), then the event.
              const rsvpSnap = await getDocs(collection(db, 'events', event.id, 'rsvps'));
              if (!rsvpSnap.empty) {
                const batch = writeBatch(db);
                rsvpSnap.docs.forEach((d) => batch.delete(d.ref));
                await batch.commit();
              }
              await deleteDoc(doc(db, 'events', event.id));
              setSelectedEvent((prev) => (prev && prev.id === event.id ? null : prev));
              setEvents((prev) => prev.filter((e) => e.id !== event.id));
              showBanner('success', 'Event deleted.');
            } catch (err) {
              console.error('Delete event failed:', err);
              showBanner('error', 'Could not delete the event.');
            }
          },
        },
      ]
    );
  };

  // ---- Set / clear an event's RSVP deadline (admin) ----
  const [dlEditFor, setDlEditFor] = useState(null); // event id being edited
  const [dlDate, setDlDate] = useState('');
  const [dlTime, setDlTime] = useState('18:00');

  // ---- Set an event's eligibility gate (admin) ----
  const [elEditFor, setElEditFor] = useState(null);
  const [elOn, setElOn] = useState(false);
  const [elPct, setElPct] = useState('80');

  const openEligibilityEditor = (ev) => {
    setDlEditFor(null);
    setElEditFor(ev.id);
    setElOn(!!ev.requiresEligibility);
    setElPct(String(ev.eligibilityThreshold || 80));
  };

  const saveEligibility = async (ev) => {
    const pct = elOn ? Number(elPct) || 80 : null;
    if (elOn && (pct < 1 || pct > 100)) return showBanner('error', 'Threshold must be between 1 and 100%.');
    const apply = (e) => (e && e.id === ev.id ? { ...e, requiresEligibility: elOn, eligibilityThreshold: pct } : e);
    setEvents((prev) => prev.map(apply));
    setSelectedEvent((prev) => apply(prev));
    setElEditFor(null);
    try {
      await updateDoc(doc(db, 'events', ev.id), { requiresEligibility: elOn, eligibilityThreshold: pct });
      showBanner('success', 'Eligibility rule updated.');
    } catch (err) {
      console.error('Save eligibility failed:', err);
      showBanner('error', 'Could not update eligibility.');
      load();
    }
  };

  const openDeadlineEditor = (ev) => {
    setElEditFor(null);
    setDlEditFor(ev.id);
    if (ev.rsvpDeadlineMs) {
      const d = new Date(ev.rsvpDeadlineMs);
      setDlDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setDlTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setDlDate(''); setDlTime('18:00');
    }
  };

  const saveDeadline = async (ev, clear = false) => {
    let value = null;
    if (!clear) {
      if (!dlDate) return showBanner('error', 'Pick a deadline date.');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dlTime)) return showBanner('error', 'Time must be HH:MM (24h).');
      const dt = new Date(`${dlDate}T${dlTime}:00`);
      if (Number.isNaN(dt.getTime())) return showBanner('error', 'Invalid deadline.');
      if (dt.getTime() <= Date.now()) return showBanner('error', 'Deadline must be in the future.');
      if (ev.startsMs && ev.startsMs !== Number.MAX_SAFE_INTEGER && dt.getTime() > ev.startsMs + 86400000) {
        return showBanner('error', 'Deadline must be on or before the event date.');
      }
      value = Timestamp.fromDate(dt);
    }
    const ms = value ? value.toMillis() : null;
    const apply = (e) => (e && e.id === ev.id ? { ...e, rsvpDeadlineMs: ms } : e);
    setEvents((prev) => prev.map(apply));
    setSelectedEvent((prev) => apply(prev));
    setDlEditFor(null);
    try {
      await updateDoc(doc(db, 'events', ev.id), { rsvpDeadline: value });
      showBanner('success', clear ? 'RSVP deadline cleared.' : 'RSVP deadline set.');
    } catch (err) {
      console.error('Set deadline failed:', err);
      showBanner('error', 'Could not update the deadline.');
      load();
    }
  };

  // ---- Create event (admin) ----
  const resetForm = () => {
    setFTitle(''); setFDesc(''); setFVenue(''); setFDate(''); setFTime('18:00');
    setFRequiresEligibility(true); setFThreshold('80'); setShowDatePicker(false);
  };

  const handleCreate = async () => {
    if (!fTitle.trim()) return showBanner('error', 'Enter an event title.');
    if (!fDate) return showBanner('error', 'Pick a date.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fTime)) return showBanner('error', 'Time must be HH:MM (24h).');

    const startsAt = new Date(`${fDate}T${fTime}:00`);
    if (Number.isNaN(startsAt.getTime())) return showBanner('error', 'Invalid date/time.');

    setSaving(true);
    try {
      await addDoc(collection(db, 'events'), {
        title: fTitle.trim(),
        description: fDesc.trim(),
        venue: fVenue.trim(),
        startsAt: Timestamp.fromDate(startsAt),
        eventDate: fDate,
        startTime: startsAt.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' }),
        requiresEligibility: fRequiresEligibility,
        eligibilityThreshold: fRequiresEligibility ? (Number(fThreshold) || 80) : null,
        season: currentSeason,
        published: true, // manually-created events go live immediately (as before)
        goingCount: 0,
        createdBy: auth.currentUser.uid,
        createdByName: fullname,
        createdAt: serverTimestamp(),
      });
      setModalVisible(false);
      resetForm();
      showBanner('success', 'Event created.');
      load();
    } catch (err) {
      console.error('Failed to create event:', err);
      showBanner('error', 'Could not create event.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Render ----
  const now = Date.now();

  const renderEvent = ({ item, index }) => {
    const isPast = item.startsMs < now;
    const gated = item.requiresEligibility;
    const threshold = item.eligibilityThreshold || 80;
    const canGo = !gated || (eligibility && eligibility.pct >= threshold);
    const dp = item.hasDate ? dateParts(item.startsMs) : null;
    const cd = countdown(item.startsMs, item.hasDate);

    return (
      <Animatable.View animation="fadeInUp" duration={400} delay={Math.min(index * 60, 300)}>
        <Pressable
          onPress={() => setSelectedEvent(item)}
          style={({ pressed }) => [styles.card, isPast && styles.cardPast, pressed && styles.cardPressed]}
        >
          <View style={styles.cardTop}>
            <LinearGradient
              colors={isPast ? [colors.surfaceMuted, colors.surfaceMuted] : colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dateBadge}
            >
              {dp ? (
                <>
                  <Text style={[styles.dateMonth, isPast && styles.datePastText]}>{dp.month}</Text>
                  <Text style={[styles.dateDay, isPast && styles.datePastText]}>{dp.day}</Text>
                </>
              ) : (
                <Text style={[styles.dateMonth, isPast && styles.datePastText]}>TBD</Text>
              )}
            </LinearGradient>

            <View style={styles.headerMain}>
              <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.metaRow}>
                <Icon name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>
                  {dp ? `${dp.weekday} · ` : ''}{item.startTime || 'Time TBD'}
                </Text>
              </View>
              {!!item.reportingTime && (
                <View style={styles.metaRow}>
                  <Icon name="stopwatch-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.metaText}>Report by {item.reportingTime}</Text>
                </View>
              )}
              {!!item.venue && (
                <View style={styles.metaRow}>
                  <Icon name="location-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>{item.venue}</Text>
                </View>
              )}
            </View>

            <View style={styles.cardTopRight}>
              {cd && (
                <View style={[styles.cdPill, styles[`cd_${cd.tone}`]]}>
                  <Text style={[styles.cdText, styles[`cdText_${cd.tone}`]]}>{cd.text}</Text>
                </View>
              )}
              <Icon name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.cardFooter}>
            <View style={styles.goingWrap}>
              <Icon name="people" size={15} color={colors.primary} />
              <Text style={styles.goingCount}>{item.goingCount} going</Text>
            </View>

            {role === 'admin' ? (
              <View style={styles.adminActions}>
                <Pressable
                  onPress={() => handleTogglePublish(item)}
                  hitSlop={8}
                  style={[styles.publishBtn, item.published ? styles.publishOn : styles.publishOff]}
                >
                  <Icon
                    name={item.published ? 'eye' : 'eye-off-outline'}
                    size={14}
                    color={item.published ? colors.successDark : colors.textMuted}
                  />
                  <Text style={[styles.publishText, { color: item.published ? colors.successDark : colors.textMuted }]}>
                    {item.published ? 'Published' : 'Publish'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteBtn}>
                  <Icon name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </View>
            ) : isPast ? (
              <Text style={styles.pastLabel}>Ended</Text>
            ) : item.myStatus ? (
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: item.myStatus === 'going' ? colors.successSoft : colors.dangerSoft },
                ]}
              >
                <Icon
                  name={item.myStatus === 'going' ? 'checkmark-circle' : 'close-circle'}
                  size={14}
                  color={item.myStatus === 'going' ? colors.successDark : colors.danger}
                />
                <Text
                  style={[
                    styles.statusChipText,
                    { color: item.myStatus === 'going' ? colors.successDark : colors.danger },
                  ]}
                >
                  {item.myStatus === 'going' ? "You're going" : "Can't make it"}
                </Text>
              </View>
            ) : !rsvpOpen(item) ? (
              <Text style={styles.pastLabel}>RSVP closed</Text>
            ) : gated && !canGo ? (
              <Text style={styles.gateHint}>Reach {threshold}% to RSVP</Text>
            ) : (
              <Text style={styles.tapHint}>Tap to RSVP →</Text>
            )}
          </View>
        </Pressable>
      </Animatable.View>
    );
  };

  // ---- Event detail modal (full description + RSVP action) ----
  const renderDetail = () => {
    if (!selectedEvent) return null;
    const ev = selectedEvent;
    const isPast = ev.startsMs < now;
    const gated = ev.requiresEligibility;
    const threshold = ev.eligibilityThreshold || 80;
    const canGo = !gated || (eligibility && eligibility.pct >= threshold);
    const dp = ev.hasDate ? dateParts(ev.startsMs) : null;

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{ev.title}</Text>
              <TouchableOpacity onPress={() => setSelectedEvent(null)}>
                <Icon name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {role === 'admin' && (
              <Pressable
                onPress={() => handleTogglePublish(ev)}
                style={[styles.publishBtnLg, ev.published ? styles.publishOn : styles.publishOff]}
              >
                <Icon
                  name={ev.published ? 'eye' : 'eye-off-outline'}
                  size={16}
                  color={ev.published ? colors.successDark : colors.textMuted}
                />
                <Text style={[styles.publishText, { color: ev.published ? colors.successDark : colors.textMuted }]}>
                  {ev.published ? 'Published, visible to students' : 'Draft, tap to publish'}
                </Text>
              </Pressable>
            )}

            <View style={styles.detailMeta}>
              <Icon name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.detailMetaText}>
                {dp ? `${dp.weekday}, ${dp.month} ${dp.day} · ` : ''}{ev.startTime || 'Time TBD'}
              </Text>
            </View>
            {!!ev.reportingTime && (
              <View style={styles.detailMeta}>
                <Icon name="stopwatch-outline" size={16} color={colors.primary} />
                <Text style={styles.detailMetaText}>Report by {ev.reportingTime}</Text>
              </View>
            )}
            {!!ev.venue && (
              <View style={styles.detailMeta}>
                <Icon name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.detailMetaText}>{ev.venue}</Text>
              </View>
            )}
            <View style={styles.detailMeta}>
              <Icon name="people-outline" size={16} color={colors.primary} />
              <Text style={styles.detailMetaText}>{ev.goingCount} going</Text>
            </View>
            {!!ev.rsvpDeadlineMs && (
              <View style={styles.detailMeta}>
                <Icon name="hourglass-outline" size={16} color={rsvpOpen(ev) ? colors.primary : colors.danger} />
                <Text style={styles.detailMetaText}>
                  {rsvpOpen(ev) ? `RSVP by ${fmtDeadline(ev.rsvpDeadlineMs)}` : `RSVP closed · ${fmtDeadline(ev.rsvpDeadlineMs)}`}
                </Text>
              </View>
            )}

            {!!ev.description && (
              <Text style={styles.detailDesc}>{ev.description}</Text>
            )}

            <View style={styles.divider} />

            {role === 'admin' ? (
              <View>
                {/* RSVP deadline control — not offered once the event has ended */}
                {!isPast && (
                <View style={styles.adminDetailRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminDetailLabel}>RSVP DEADLINE</Text>
                    <Text style={styles.adminDetailValue}>
                      {ev.rsvpDeadlineMs ? fmtDeadline(ev.rsvpDeadlineMs) : 'None set'}
                    </Text>
                  </View>
                  {!!ev.rsvpDeadlineMs && dlEditFor !== ev.id && (
                    <Pressable onPress={() => saveDeadline(ev, true)} style={styles.smallBtn}>
                      <Text style={styles.smallBtnText}>Clear</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => (dlEditFor === ev.id ? setDlEditFor(null) : openDeadlineEditor(ev))}
                    style={[styles.smallBtn, styles.smallBtnPrimary]}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.primaryDark }]}>
                      {dlEditFor === ev.id ? 'Cancel' : ev.rsvpDeadlineMs ? 'Edit' : 'Set'}
                    </Text>
                  </Pressable>
                </View>
                )}

                {/* Eligibility gate control — upcoming events only */}
                {!isPast && (
                <View style={styles.adminDetailRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminDetailLabel}>ELIGIBILITY GATE</Text>
                    <Text style={styles.adminDetailValue}>
                      {ev.requiresEligibility ? `Requires ${ev.eligibilityThreshold || 80}% attendance` : 'Open to all'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => (elEditFor === ev.id ? setElEditFor(null) : openEligibilityEditor(ev))}
                    style={[styles.smallBtn, styles.smallBtnPrimary]}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.primaryDark }]}>
                      {elEditFor === ev.id ? 'Cancel' : 'Edit'}
                    </Text>
                  </Pressable>
                </View>
                )}

                {!isPast && elEditFor === ev.id && (
                  <View style={styles.elEditor}>
                    <View style={styles.switchRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.switchLabel}>Require attendance eligibility</Text>
                        <Text style={styles.switchHint}>Only students at/above the threshold can RSVP "Going".</Text>
                      </View>
                      <Switch
                        value={elOn}
                        onValueChange={setElOn}
                        trackColor={{ true: colors.primary, false: colors.borderStrong }}
                      />
                    </View>
                    {elOn && (
                      <View style={styles.thresholdRow}>
                        <Text style={styles.thresholdLabel}>Minimum attendance</Text>
                        <View style={styles.thresholdInputWrap}>
                          <TextInput
                            value={elPct}
                            onChangeText={(t) => setElPct(t.replace(/[^0-9]/g, '').slice(0, 3))}
                            placeholder="80"
                            placeholderTextColor={colors.textMuted}
                            style={styles.thresholdInput}
                            keyboardType="number-pad"
                            maxLength={3}
                          />
                          <Text style={styles.thresholdPct}>%</Text>
                        </View>
                      </View>
                    )}
                    <GradientButton
                      title="Save eligibility"
                      onPress={() => saveEligibility(ev)}
                      icon={<Icon name="shield-checkmark-outline" size={16} color={colors.textOnPrimary} />}
                      style={{ marginTop: spacing.md }}
                    />
                  </View>
                )}

                {!isPast && dlEditFor === ev.id ? (
                  <View>
                    <Calendar
                      minDate={new Date().toISOString().split('T')[0]}
                      onDayPress={(d) => setDlDate(d.dateString)}
                      markedDates={dlDate ? { [dlDate]: { selected: true, selectedColor: colors.primary } } : {}}
                      theme={{
                        todayTextColor: colors.primary,
                        arrowColor: colors.primary,
                        textMonthFontFamily: fonts.semibold,
                        textDayFontFamily: fonts.regular,
                        textDayHeaderFontFamily: fonts.medium,
                      }}
                      style={styles.calendar}
                    />
                    <Text style={styles.label}>Time (24h, HH:MM)</Text>
                    <TextInput
                      value={dlTime}
                      onChangeText={setDlTime}
                      placeholder="18:00"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                    <GradientButton
                      title="Save deadline"
                      onPress={() => saveDeadline(ev)}
                      icon={<Icon name="hourglass-outline" size={16} color={colors.textOnPrimary} />}
                      style={{ marginTop: spacing.md }}
                    />
                  </View>
                ) : (
                  <>
                    {attendeesLoading ? (
                      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
                    ) : (
                      (() => {
                        const going = (attendees || []).filter((a) => a.status === 'going');
                        const declined = (attendees || []).filter((a) => a.status === 'declined');
                        return (
                          <ScrollView style={styles.attendeeScroll} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.attendeeHeader, { color: colors.successDark }]}>
                              Going ({going.length})
                            </Text>
                            {going.length ? (
                              going.map((a) => (
                                <View key={a.id} style={styles.attendeeRow}>
                                  <Icon name="checkmark-circle" size={15} color={colors.success} />
                                  <Text style={styles.attendeeName}>{a.fullname || 'Unknown'}</Text>
                                </View>
                              ))
                            ) : (
                              <Text style={styles.attendeeEmpty}>No one yet.</Text>
                            )}

                            <Text style={[styles.attendeeHeader, { color: colors.danger, marginTop: spacing.lg }]}>
                              Can't make it ({declined.length})
                            </Text>
                            {declined.length ? (
                              declined.map((a) => (
                                <View key={a.id} style={styles.attendeeRow}>
                                  <Icon name="close-circle" size={15} color={colors.danger} />
                                  <Text style={styles.attendeeName}>{a.fullname || 'Unknown'}</Text>
                                </View>
                              ))
                            ) : (
                              <Text style={styles.attendeeEmpty}>None.</Text>
                            )}
                          </ScrollView>
                        );
                      })()
                    )}
                    <Pressable onPress={() => handleDelete(ev)} style={styles.detailDeleteBtn}>
                      <Icon name="trash-outline" size={16} color={colors.danger} />
                      <Text style={styles.detailDeleteText}>Delete event</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : isPast ? (
              <Text style={styles.detailNote}>This event has ended.</Text>
            ) : ev.myStatus ? (
              <View style={styles.lockedRow}>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: ev.myStatus === 'going' ? colors.successSoft : colors.dangerSoft },
                  ]}
                >
                  <Icon
                    name={ev.myStatus === 'going' ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={ev.myStatus === 'going' ? colors.successDark : colors.danger}
                  />
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: ev.myStatus === 'going' ? colors.successDark : colors.danger },
                    ]}
                  >
                    {ev.myStatus === 'going' ? "You're going" : "Can't make it"}
                  </Text>
                </View>
                <Text style={styles.lockedHint}>
                  <Icon name="lock-closed" size={11} color={colors.textMuted} /> RSVP locked
                </Text>
              </View>
            ) : !rsvpOpen(ev) ? (
              <Text style={styles.detailNote}>RSVP has closed for this event.</Text>
            ) : (
              <>
                <Text style={styles.rsvpPrompt}>Will you be there?</Text>
                {!!ev.rsvpDeadlineMs && (
                  <Text style={styles.deadlineHint}>RSVP closes {fmtDeadline(ev.rsvpDeadlineMs)}</Text>
                )}
                <View style={styles.detailRsvpRow}>
                  <Pressable
                    onPress={() => handleRsvp(ev, 'going')}
                    disabled={!canGo}
                    style={[styles.detailRsvpBtn, styles.detailGoing, !canGo && styles.rsvpDisabled]}
                  >
                    <Icon name="checkmark-circle-outline" size={18} color={canGo ? colors.successDark : colors.textMuted} />
                    <Text style={[styles.detailRsvpText, { color: canGo ? colors.successDark : colors.textMuted }]}>
                      Going
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRsvp(ev, 'declined')}
                    style={[styles.detailRsvpBtn, styles.detailDeclined]}
                  >
                    <Icon name="close-circle-outline" size={18} color={colors.danger} />
                    <Text style={[styles.detailRsvpText, { color: colors.danger }]}>Can't make it</Text>
                  </Pressable>
                </View>
                {gated && !canGo && (
                  <Text style={styles.gateHintDetail}>
                    You need {threshold}% attendance to RSVP "Going" for this event.
                  </Text>
                )}
                <Text style={styles.lockedHint}>Your choice is final once confirmed.</Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <AppBackgroundWrapper>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppBackgroundWrapper>
    );
  }

  return (
    <AppBackgroundWrapper>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Text style={styles.heading}>Events</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="calendar-clear-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>
              {role === 'admin'
                ? 'Tap the + button to create your first event.'
                : 'Upcoming events and performances will show up here.'}
            </Text>
          </View>
        }
      />

      {role === 'admin' && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => setModalVisible(true)}
        >
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabInner}
          >
            <Icon name="add" size={28} color={colors.textOnPrimary} />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Create-event modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Event</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[0]}
              keyExtractor={() => 'form'}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={() => (
                <View>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    value={fTitle}
                    onChangeText={setFTitle}
                    placeholder="e.g. Ganpati Visarjan Performance"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />

                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    value={fDesc}
                    onChangeText={setFDesc}
                    placeholder="Details, call time, what to bring..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, styles.textArea]}
                    multiline
                    textAlignVertical="top"
                  />

                  <Text style={styles.label}>Venue</Text>
                  <TextInput
                    value={fVenue}
                    onChangeText={setFVenue}
                    placeholder="e.g. Downtown San Jose"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />

                  <Text style={styles.label}>Date</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.selectRow]}
                    onPress={() => setShowDatePicker((s) => !s)}
                  >
                    <Text style={[styles.selectText, !fDate && { color: colors.textMuted }]}>
                      {fDate || 'Pick a date'}
                    </Text>
                    <Icon name="calendar-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <Calendar
                      minDate={new Date().toISOString().split('T')[0]}
                      onDayPress={(d) => { setFDate(d.dateString); setShowDatePicker(false); }}
                      markedDates={fDate ? { [fDate]: { selected: true, selectedColor: colors.primary } } : {}}
                      theme={{
                        todayTextColor: colors.primary,
                        arrowColor: colors.primary,
                        textMonthFontFamily: fonts.semibold,
                        textDayFontFamily: fonts.regular,
                        textDayHeaderFontFamily: fonts.medium,
                      }}
                      style={styles.calendar}
                    />
                  )}

                  <Text style={styles.label}>Time (24h, HH:MM)</Text>
                  <TextInput
                    value={fTime}
                    onChangeText={setFTime}
                    placeholder="18:00"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />

                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>Require attendance eligibility</Text>
                      <Text style={styles.switchHint}>Only students at/above the threshold can RSVP "Going".</Text>
                    </View>
                    <Switch
                      value={fRequiresEligibility}
                      onValueChange={setFRequiresEligibility}
                      trackColor={{ true: colors.primary, false: colors.borderStrong }}
                    />
                  </View>
                  {fRequiresEligibility && (
                    <View style={styles.thresholdRow}>
                      <Text style={styles.thresholdLabel}>Minimum attendance</Text>
                      <View style={styles.thresholdInputWrap}>
                        <TextInput
                          value={fThreshold}
                          onChangeText={(t) => setFThreshold(t.replace(/[^0-9]/g, '').slice(0, 3))}
                          placeholder="80"
                          placeholderTextColor={colors.textMuted}
                          style={styles.thresholdInput}
                          keyboardType="number-pad"
                          maxLength={3}
                        />
                        <Text style={styles.thresholdPct}>%</Text>
                      </View>
                    </View>
                  )}

                  <GradientButton
                    title="Create Event"
                    onPress={handleCreate}
                    loading={saving}
                    icon={<Icon name="add-circle-outline" size={18} color={colors.textOnPrimary} />}
                    style={{ marginTop: spacing.lg }}
                  />
                </View>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {renderDetail()}

      {status.show && (
        <Animatable.View
          animation="slideInUp"
          duration={300}
          style={[styles.statusBanner, status.type === 'error' ? styles.error : styles.success]}
        >
          <Text style={styles.statusText}>{status.text}</Text>
        </Animatable.View>
      )}
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  cardPressed: { opacity: 0.85 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  statusChipText: { fontSize: 12.5, fontFamily: fonts.semibold },
  tapHint: { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  publishBtnLg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    marginTop: spacing.md,
  },
  publishOn: { borderColor: colors.success, backgroundColor: colors.successSoft },
  publishOff: { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  publishText: { fontSize: 12.5, fontFamily: fonts.semibold },
  adminActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
  cardTopRight: { alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  cdPill: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.full },
  cdText: { fontSize: 11.5, fontFamily: fonts.bold },
  cd_urgent: { backgroundColor: colors.dangerSoft },
  cdText_urgent: { color: colors.danger },
  cd_soon: { backgroundColor: colors.primarySoft },
  cdText_soon: { color: colors.primaryDark },
  cd_normal: { backgroundColor: colors.surfaceMuted },
  cdText_normal: { color: colors.textSecondary },
  cd_muted: { backgroundColor: colors.surfaceMuted },
  cdText_muted: { color: colors.textMuted },
  adminDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  adminDetailLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  adminDetailValue: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, marginTop: 2 },
  smallBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  smallBtnPrimary: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  smallBtnText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  detailDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    marginTop: spacing.lg,
  },
  detailDeleteText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.danger },
  deadlineHint: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  thresholdLabel: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  thresholdInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  thresholdInput: {
    minWidth: 44,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  thresholdPct: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textMuted },
  elEditor: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  detailMetaText: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, flexShrink: 1 },
  detailDesc: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: spacing.lg,
  },
  detailNote: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  rsvpPrompt: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  detailRsvpRow: { flexDirection: 'row', gap: spacing.md },
  detailRsvpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  detailGoing: { borderColor: colors.success, backgroundColor: colors.successSoft },
  detailDeclined: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  detailRsvpText: { fontSize: 15, fontFamily: fonts.semibold },
  gateHintDetail: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.warning,
    marginTop: spacing.md,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  attendeeScroll: { maxHeight: 280, marginTop: spacing.md },
  attendeeHeader: { fontSize: 13, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  attendeeName: { fontSize: 15, fontFamily: fonts.medium, color: colors.text },
  attendeeEmpty: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, marginTop: spacing.sm },
  lockedHint: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.xl, paddingBottom: spacing['4xl'], flexGrow: 1 },
  heading: {
    fontSize: 23,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  cardPast: { opacity: 0.65 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dateBadge: {
    width: 52,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    ...shadows.primary,
  },
  dateMonth: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textOnPrimary,
    lineHeight: 26,
  },
  datePastText: { color: colors.textSecondary },
  headerMain: { flex: 1 },
  eventTitle: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  badgeText: { fontSize: 11, fontFamily: fonts.semibold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  metaText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, flexShrink: 1 },
  eventDesc: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  goingWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goingCount: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  pastLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  rsvpRow: { flexDirection: 'row', gap: spacing.sm },
  rsvpBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rsvpGoing: { borderColor: colors.success, backgroundColor: colors.successSoft },
  rsvpDeclined: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  rsvpDisabled: { opacity: 0.45 },
  rsvpText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  rsvpTextActive: { color: colors.text },
  gateHint: {
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.warning,
    marginTop: spacing.sm,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing['4xl'] },
  emptyTitle: { fontSize: 17, fontFamily: fonts.semibold, color: colors.text, marginTop: spacing.lg },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    borderRadius: radius.full,
    ...shadows.primary,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    padding: spacing.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  textArea: { minHeight: 80 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontSize: 15, fontFamily: fonts.regular, color: colors.text },
  calendar: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  switchLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  switchHint: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  statusBanner: {
    position: 'absolute',
    bottom: 30,
    left: spacing.xl,
    right: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderLeftWidth: 6,
    ...shadows.md,
    zIndex: 100,
    backgroundColor: colors.surface,
  },
  statusText: { fontSize: 15, fontFamily: fonts.medium, textAlign: 'center', color: colors.text },
  error: { backgroundColor: colors.dangerSoft, borderLeftColor: colors.danger },
  success: { backgroundColor: colors.successSoft, borderLeftColor: colors.success },
});
