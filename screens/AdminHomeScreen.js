import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { auth, db } from '../firebase';
import { doc, onSnapshot, collection, getDocs, query, where } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from '../components/ui/Gradient';
import { colors, spacing, radius, fonts, shadows } from '../theme';
import { useSeason } from '../contexts/SeasonContext';

export default function AdminHomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({
    students: 0,
    sessions: 0,
    rebinds: 0,
  });
  const [status, setStatus] = useState({ show: false, type: '', text: '' });

  const fetchCounts = async (season) => {
    const usersSnap = await getDocs(collection(db, 'users'));
    const sessionsQuery = query(collection(db, 'sessions'), where('season', '==', season));
    const sessionsSnap = await getDocs(sessionsQuery);
    const rebindsSnap = await getDocs(collection(db, 'users'));
    const rebindCount = rebindsSnap.docs.filter(
      (doc) => doc.data().rebindRequest === true
    ).length;

    setCounts({
      students: usersSnap.size,
      sessions: sessionsSnap.size,
      rebinds: rebindCount,
    });
  };

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Live listener instead of a one-shot getDoc: it converges to the server
    // copy (correcting any partial/transient cache read) and live-updates on
    // profile edits. The field guard ensures an empty/partial emission can
    // never blank out an already-populated card.
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const data = snap.data();
        if (data && (data.fullname || data.email || data.role)) {
          setUser((prev) => ({ ...prev, ...data }));
        }
      },
      (err) => console.warn('Admin user snapshot error:', err)
    );

    return unsub;
    // fetchCounts is driven by the currentSeason effect below
  }, []);

  const { currentSeason, activeStage, midReleased, finalReleased } = useSeason();
  const STAGE_LABEL = { mid: 'Mid-Season', final: 'Final' };

  useEffect(() => {
    if (currentSeason) fetchCounts(currentSeason);
  }, [currentSeason]);

  const showBanner = (type, text) => {
    setStatus({ show: true, type, text });
    setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
  };
  
  if (!user) return null;

  return (
    <AppBackgroundWrapper>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInDown" duration={600}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Dashboard</Text>
              <Text style={styles.greeting}>{user.fullname?.split(' ')[0]}</Text>
              <Text style={styles.subtitle}>Admin overview for the current season</Text>
            </View>
            {currentSeason && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Season {currentSeason}</Text>
              </View>
            )}
          </LinearGradient>
        </Animatable.View>

        <View style={styles.statGrid}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.metricCard, styles.metricPrimary]}
          >
            <View style={styles.iconCircleOnPrimary}>
              <Icon name="people" size={20} color={colors.textOnPrimary} />
            </View>
            <Text style={styles.metricValue}>{counts.students}</Text>
            <Text style={styles.metricLabelLight}>Students</Text>
          </LinearGradient>
          <View style={[styles.metricCard, styles.metricSecondary, styles.metricCardMiddle]}>
            <View style={styles.iconCircleSecondary}>
              <Icon name="qr-code" size={20} color={colors.primaryDark} />
            </View>
            <Text style={styles.metricValueDark}>{counts.sessions}</Text>
            <Text style={styles.metricLabel}>Sessions</Text>
          </View>
          <View style={[styles.metricCard, styles.metricSecondary]}>
            <View style={styles.iconCircleSecondary}>
              <Icon name="help-circle" size={20} color={colors.primaryDark} />
            </View>
            <Text style={styles.metricValueDark}>{counts.rebinds}</Text>
            <Text style={styles.metricLabel}>Rebind Requests</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionCard, styles.cardSpacing]}
          onPress={() => navigation.navigate('SendNotification')}
          activeOpacity={0.8}
        >
          <View style={styles.actionIcon}>
            <Icon name="megaphone-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Send Announcement</Text>
            <Text style={styles.actionSub}>Push a message to all students' inboxes</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.cardSpacing]}
          onPress={() => navigation.navigate('ResetDevice')}
          activeOpacity={0.8}
        >
          <View style={styles.actionIcon}>
            <Icon name="phone-portrait-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Device Bindings</Text>
            <Text style={styles.actionSub}>Reset a student's device, or all devices for a new season</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={[styles.infoCard, styles.cardSpacing]}>
          <Text style={styles.sectionTitle}>Parikshan status</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Icon name="create-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.statusLabel}>Scoring window</Text>
            </View>
            <View style={[styles.statusChip, activeStage ? styles.chipOpen : styles.chipClosed]}>
              <Text style={[styles.statusChipText, activeStage ? styles.chipTextOpen : styles.chipTextClosed]}>
                {activeStage ? `${STAGE_LABEL[activeStage]} open` : 'Closed'}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Icon name="eye-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.statusLabel}>Mid-Season results</Text>
            </View>
            <View style={[styles.statusChip, midReleased ? styles.chipOpen : styles.chipMuted]}>
              <Text style={[styles.statusChipText, midReleased ? styles.chipTextOpen : styles.chipTextMuted]}>
                {midReleased ? 'Released' : 'Hidden'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusRow, styles.statusRowLast]}>
            <View style={styles.statusLeft}>
              <Icon name="eye-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.statusLabel}>Final results</Text>
            </View>
            <View style={[styles.statusChip, finalReleased ? styles.chipOpen : styles.chipMuted]}>
              <Text style={[styles.statusChipText, finalReleased ? styles.chipTextOpen : styles.chipTextMuted]}>
                {finalReleased ? 'Released' : 'Hidden'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Account details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>{user.role}</Text>
          </View>
        </View>

      </ScrollView>

      {status.show && (
        <Animatable.View
          animation="slideInUp"
          style={[
            styles.banner,
            status.type === 'error' ? styles.error : styles.success,
          ]}
        >
          <Text style={styles.bannerText}>{status.text}</Text>
        </Animatable.View>
      )}
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing['2xl'],
    paddingTop: spacing['2xl'] + 4,
    paddingBottom: spacing['4xl'],
    backgroundColor: colors.background,
  },
  headerCard: {
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    marginBottom: spacing['2xl'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.primary,
  },
  title: {
    fontSize: 13,
    color: '#C7D2FE',
    fontFamily: fonts.regular,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.textOnPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: '#E0E7FF',
    fontFamily: fonts.regular,
    marginTop: 4,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
  },
  badgeText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing['2xl'],
  },
  metricCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    minHeight: 148,
    justifyContent: 'space-between',
  },
  metricCardMiddle: {
    marginHorizontal: 10,
  },
  metricPrimary: {
    ...shadows.primary,
  },
  metricSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  iconCircleOnPrimary: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconCircleSecondary: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  metricValue: {
    fontSize: 30,
    fontFamily: fonts.bold,
    color: colors.textOnPrimary,
    marginBottom: 4,
  },
  metricValueDark: {
    fontSize: 30,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  metricLabelLight: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#E0E7FF',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  infoRow: {
    marginBottom: spacing.lg,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  cardSpacing: {
    marginBottom: spacing.lg,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  actionSub: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  statusRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusLabel: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  statusChip: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  chipOpen: { backgroundColor: colors.successSoft },
  chipTextOpen: { color: colors.successDark },
  chipClosed: { backgroundColor: colors.dangerSoft },
  chipTextClosed: { color: colors.danger },
  chipMuted: { backgroundColor: colors.surfaceMuted },
  chipTextMuted: { color: colors.textMuted },
  banner: {
    position: 'absolute',
    bottom: 20,
    left: spacing.xl,
    right: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderLeftWidth: 6,
    zIndex: 999,
    ...shadows.md,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderLeftColor: colors.success,
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderLeftColor: colors.danger,
  },
  bannerText: {
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
  },
});