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
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
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
      setRole(userData.role || 'student');
      setFullname(userData.fullname || 'Student');
      setEligibility(elig);

      // Events for this season (sorted client-side to avoid a composite index).
      const evSnap = await getDocs(
        query(collection(db, 'events'), where('season', '==', currentSeason))
      );

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
            startsMs: data.startsAt?.toMillis ? data.startsAt.toMillis() : 0,
            goingCount: data.goingCount || 0,
            myStatus,
          };
        })
      );
      rows.sort((a, b) => a.startsMs - b.startsMs);
      setEvents(rows);
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

    if (event.requiresEligibility && newStatus === 'going' && !eligibility?.isEligible) {
      showBanner('error', 'Reach 80% attendance to RSVP for this event.');
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

  // ---- Create event (admin) ----
  const resetForm = () => {
    setFTitle(''); setFDesc(''); setFVenue(''); setFDate(''); setFTime('18:00');
    setFRequiresEligibility(true); setShowDatePicker(false);
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
        requiresEligibility: fRequiresEligibility,
        season: currentSeason,
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
    const canGo = !gated || eligibility?.isEligible;
    const dp = dateParts(item.startsMs);

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
              <Text style={[styles.dateMonth, isPast && styles.datePastText]}>{dp.month}</Text>
              <Text style={[styles.dateDay, isPast && styles.datePastText]}>{dp.day}</Text>
            </LinearGradient>

            <View style={styles.headerMain}>
              <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.metaRow}>
                <Icon name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>{dp.weekday} · {dp.time}</Text>
              </View>
              {!!item.venue && (
                <View style={styles.metaRow}>
                  <Icon name="location-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>{item.venue}</Text>
                </View>
              )}
            </View>

            <Icon name="chevron-forward" size={20} color={colors.textMuted} />
          </View>

          <View style={styles.divider} />

          <View style={styles.cardFooter}>
            <View style={styles.goingWrap}>
              <Icon name="people" size={15} color={colors.primary} />
              <Text style={styles.goingCount}>{item.goingCount} going</Text>
            </View>

            {role === 'admin' ? (
              <Text style={styles.tapHint}>View details →</Text>
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
            ) : gated && !canGo ? (
              <Text style={styles.gateHint}>Reach 80% to RSVP</Text>
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
    const canGo = !gated || eligibility?.isEligible;
    const dp = dateParts(ev.startsMs);

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

            <View style={styles.detailMeta}>
              <Icon name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.detailMetaText}>{dp.weekday}, {dp.month} {dp.day} · {dp.time}</Text>
            </View>
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

            {!!ev.description && (
              <Text style={styles.detailDesc}>{ev.description}</Text>
            )}

            <View style={styles.divider} />

            {role === 'admin' ? (
              <View>
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
            ) : (
              <>
                <Text style={styles.rsvpPrompt}>Will you be there?</Text>
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
                    You need 80% attendance to RSVP "Going" for this event.
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
                      <Text style={styles.switchLabel}>Require 80% attendance</Text>
                      <Text style={styles.switchHint}>Only eligible students can RSVP "Going".</Text>
                    </View>
                    <Switch
                      value={fRequiresEligibility}
                      onValueChange={setFRequiresEligibility}
                      trackColor={{ true: colors.primary, false: colors.borderStrong }}
                    />
                  </View>

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
