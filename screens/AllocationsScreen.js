// screens/AllocationsScreen.js
// Student-facing Allocations tab. Shows, for each upcoming event whose
// allocations have been published (event.allocationsPublished === true), the
// role this member has been assigned (Dhol, Dhwaj, Main Dhwaj, Tasha, Toll,
// Zanj, Media, Event Mgmt), plus reporting/start time and venue. Reads the
// member's own doc from events/{id}/allocations/{uid}. The staged reveal is
// gated by allocationsPublished (admins flip it once assignments are final).
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { LinearGradient } from '../components/ui/Gradient';
import { db, auth } from '../firebase';
import { useSeason } from '../contexts/SeasonContext';
import { colors, spacing, radius, fonts, shadows } from '../theme';

const dateBadge = (ms, eventDate) => {
  const d = ms ? new Date(ms) : (eventDate ? new Date(`${eventDate}T00:00:00`) : null);
  if (!d || Number.isNaN(d.getTime())) return { month: '—', day: '' };
  return {
    month: d.toLocaleString(undefined, { month: 'short' }).toUpperCase(),
    day: d.getDate(),
  };
};

// Icon per allocation role (falls back to musical-notes).
const ROLE_ICON = {
  Dhol: 'musical-notes',
  Tasha: 'musical-notes',
  Dhwaj: 'flag',
  'Main Dhwaj': 'flag',
  Toll: 'ellipse',
  Zanj: 'disc',
  Media: 'camera',
  'Event Mgmt': 'clipboard',
  'Event Management': 'clipboard',
};

// Per-role chip colors (soft bg + darker text), echoing the allocation sheet's
// colour coding. `bg` is the pill background, `fg` the icon + label colour.
const ROLE_STYLE = {
  Dhol: { bg: '#EEF2FF', fg: '#4338CA' },          // indigo
  Tasha: { bg: '#FCE7F3', fg: '#BE185D' },         // pink
  Dhwaj: { bg: '#FEF3C7', fg: '#B45309' },         // amber
  'Main Dhwaj': { bg: '#FFEDD5', fg: '#C2410C' },  // orange
  'Event Mgmt': { bg: '#DCFCE7', fg: '#15803D' },  // green
  'Event Management': { bg: '#DCFCE7', fg: '#15803D' },
  Media: { bg: '#CCFBF1', fg: '#0F766E' },         // teal
  Toll: { bg: '#EDE9FE', fg: '#6D28D9' },          // violet
  Zanj: { bg: '#F1F5F9', fg: '#475569' },          // slate
  default: { bg: '#EEF2FF', fg: '#4338CA' },
};

export default function AllocationsScreen() {
  const { currentSeason } = useSeason();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = async () => {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid || !currentSeason) { if (alive) setLoading(false); return; }

          // Published events this season whose allocations are live (past + upcoming).
          const snap = await getDocs(query(collection(db, 'events'), where('published', '==', true)));
          const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
          const todayMs = startOfToday.getTime();
          const evs = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((e) => e.season === currentSeason && e.allocationsPublished === true)
            .map((e) => ({ ...e, startsMs: e.startsAt?.toMillis ? e.startsAt.toMillis() : 0 }));

          // Keep only events this member is actually allocated to; an event is
          // "done" once its calendar day has passed.
          const mine = (await Promise.all(
            evs.map(async (e) => {
              const [aSnap, rSnap] = await Promise.all([
                getDoc(doc(db, 'events', e.id, 'allocations', uid)),
                getDoc(doc(db, 'events', e.id, 'rsvps', uid)),
              ]);
              if (!aSnap.exists()) return null;
              return {
                id: e.id,
                title: e.title || 'Event',
                eventDate: e.eventDate || null,
                startsMs: e.startsMs,
                startTime: e.startTime || null,
                reportingTime: e.reportingTime || null,
                venue: e.venue || null,
                allocation: aSnap.data().allocation || null,
                dholNumber: aSnap.data().dholNumber || null,
                going: rSnap.exists() && rSnap.data().status === 'going',
                done: !!e.startsMs && e.startsMs < todayMs,
              };
            })
          )).filter(Boolean);
          // Upcoming first (soonest first), then completed (most recent first).
          mine.sort((a, b) =>
            a.done !== b.done ? (a.done ? 1 : -1) : (a.done ? b.startsMs - a.startsMs : a.startsMs - b.startsMs)
          );
          if (alive) { setEvents(mine); setLoading(false); }
        } catch (err) {
          console.error('Failed to load allocations:', err);
          if (alive) setLoading(false);
        }
      };
      setLoading(true);
      load();
      return () => { alive = false; };
    }, [currentSeason])
  );

  const allocatedCount = events.length;
  const completedCount = events.filter((e) => e.done).length;

  return (
    <AppBackgroundWrapper>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInDown" duration={500}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIcon}>
              <Icon name="clipboard" size={24} color={colors.textOnPrimary} />
            </View>
            <Text style={styles.heroTitle}>Allocations</Text>
            <Text style={styles.heroSub}>Your event assignments, all in one place</Text>
          </LinearGradient>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" duration={500} delay={100} style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Icon name="ribbon-outline" size={20} color={colors.primary} />
            <Text style={styles.summaryValue}>{allocatedCount}</Text>
            <Text style={styles.summaryLabel}>Events allocated</Text>
          </View>
          <View style={styles.summaryTile}>
            <Icon name="checkmark-done-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.summaryValue}>{completedCount}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
        </Animatable.View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="clipboard-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No allocations yet</Text>
            <Text style={styles.emptyBody}>
              When the team publishes assignments for an upcoming event, your role will show up here.
            </Text>
          </View>
        ) : (
          events.map((e, i) => {
            const badge = dateBadge(e.startsMs, e.eventDate);
            const icon = (e.allocation && ROLE_ICON[e.allocation]) || 'musical-notes';
            const rs = (e.allocation && ROLE_STYLE[e.allocation]) || ROLE_STYLE.default;
            return (
              <Animatable.View
                key={e.id}
                animation="fadeInUp"
                duration={400}
                delay={120 + i * 60}
                style={[styles.card, e.done && styles.cardDone]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateMonth}>{badge.month}</Text>
                    <Text style={styles.dateDay}>{badge.day}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{e.title}</Text>
                    {!!e.venue && (
                      <View style={styles.metaRow}>
                        <Icon name="location-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.metaText} numberOfLines={2}>{e.venue}</Text>
                      </View>
                    )}
                  </View>
                  <View style={e.done ? styles.donePill : styles.upcomingPill}>
                    <Icon
                      name={e.done ? 'checkmark-done' : 'time-outline'}
                      size={12}
                      color={e.done ? colors.textMuted : colors.primaryDark}
                    />
                    <Text style={e.done ? styles.donePillText : styles.upcomingPillText}>
                      {e.done ? 'Done' : 'Upcoming'}
                    </Text>
                  </View>
                </View>

                {e.allocation ? (
                  <View style={[styles.roleChip, { backgroundColor: rs.bg }]}>
                    <Icon name={icon} size={15} color={rs.fg} />
                    <Text style={[styles.roleChipText, { color: rs.fg }]}>
                      {e.allocation}{e.dholNumber ? `  ·  #${e.dholNumber}` : ''}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.divider} />
                <View style={styles.timesRow}>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeLabel}>Reporting</Text>
                    <Text style={styles.timeValue}>{e.reportingTime || '—'}</Text>
                  </View>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeLabel}>Performance</Text>
                    <Text style={styles.timeValue}>{e.startTime || '—'}</Text>
                  </View>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeLabel}>Your RSVP</Text>
                    <Text style={[styles.timeValue, { color: e.going ? colors.successDark : colors.textMuted }]}>
                      {e.going ? 'Going' : '—'}
                    </Text>
                  </View>
                </View>
              </Animatable.View>
            );
          })
        )}
      </ScrollView>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing['4xl'] },
  hero: { borderRadius: radius['2xl'], padding: spacing.xl, marginBottom: spacing.lg, ...shadows.primary },
  heroIcon: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  heroTitle: { fontSize: 24, fontFamily: fonts.bold, color: colors.textOnPrimary },
  heroSub: { fontSize: 13, fontFamily: fonts.regular, color: '#E0E7FF', marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  summaryTile: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, alignItems: 'flex-start', ...shadows.sm,
  },
  summaryValue: { fontSize: 22, fontFamily: fonts.bold, color: colors.text, marginTop: spacing.sm },
  summaryLabel: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 2 },
  center: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radius['2xl'], padding: spacing.xl,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', ...shadows.md,
  },
  emptyTitle: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text, marginTop: spacing.md },
  emptyBody: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius['2xl'], padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, ...shadows.md,
  },
  cardDone: { opacity: 0.72 },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dateBadge: {
    width: 52, borderRadius: radius.lg, backgroundColor: colors.primarySoft,
    alignItems: 'center', paddingVertical: spacing.sm,
  },
  dateMonth: { fontSize: 11, fontFamily: fonts.bold, color: colors.primaryDark, letterSpacing: 0.5 },
  dateDay: { fontSize: 20, fontFamily: fonts.bold, color: colors.primaryDark, lineHeight: 24 },
  cardTitle: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaText: { flex: 1, fontSize: 12.5, fontFamily: fonts.regular, color: colors.textMuted },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: radius.full, marginTop: spacing.md,
  },
  roleChipText: { fontSize: 14, fontFamily: fonts.bold },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F1F5F9', paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.full,
  },
  donePillText: { color: colors.textMuted, fontSize: 11.5, fontFamily: fonts.semibold },
  upcomingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primarySoft, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.full,
  },
  upcomingPillText: { color: colors.primaryDark, fontSize: 11.5, fontFamily: fonts.semibold },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  timesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeItem: { alignItems: 'flex-start' },
  timeLabel: {
    fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  timeValue: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, marginTop: 3 },
});
