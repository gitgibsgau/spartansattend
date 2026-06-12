import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useSeason } from '../contexts/SeasonContext';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { LinearGradient } from '../components/ui/Gradient';
import { fetchAttendanceStats, computeBadges } from '../utils/streaks';
import { colors, spacing, radius, fonts, shadows } from '../theme';

export default function AchievementsScreen() {
  const { currentSeason } = useSeason();
  const [stats, setStats] = useState(null);
  const [joinedYear, setJoinedYear] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!currentSeason) return;
        try {
          const uid = auth.currentUser.uid;
          const [s, userSnap] = await Promise.all([
            fetchAttendanceStats(uid, currentSeason),
            getDoc(doc(db, 'users', uid)),
          ]);
          if (!cancelled) {
            setStats(s);
            setJoinedYear(userSnap.exists() ? userSnap.data().joinedYear || null : null);
          }
        } catch (err) {
          console.error('Failed to load achievements:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [currentSeason])
  );

  if (loading || !stats) {
    return (
      <AppBackgroundWrapper>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppBackgroundWrapper>
    );
  }

  const badges = computeBadges({ ...stats, joinedYear, currentSeason });
  const earned = badges.filter((b) => b.earned).length;

  return (
    <AppBackgroundWrapper>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Streak hero */}
        <Animatable.View animation="fadeInDown" duration={500}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Icon name="flame" size={40} color="#FDBA74" />
            <Text style={styles.heroStreak}>{stats.currentStreak}</Text>
            <Text style={styles.heroLabel}>
              session streak{stats.currentStreak === 1 ? '' : ''}
            </Text>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{stats.longestStreak}</Text>
                <Text style={styles.heroStatLabel}>Longest</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{stats.attended}/{stats.total}</Text>
                <Text style={styles.heroStatLabel}>Attended</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{earned}/{badges.length}</Text>
                <Text style={styles.heroStatLabel}>Badges</Text>
              </View>
            </View>
          </LinearGradient>
        </Animatable.View>

        {joinedYear ? (
          <Text style={styles.membership}>
            🥁 Member since {joinedYear} · {currentSeason - joinedYear + 1}
            {currentSeason - joinedYear + 1 === 1 ? ' season' : ' seasons'} in the pathak
          </Text>
        ) : (
          <Text style={styles.membership}>
            Add your join year in Edit Profile to unlock the Veteran badge.
          </Text>
        )}

        {stats.currentStreak === 0 && stats.total > 0 && (
          <Text style={styles.encouragement}>
            Attend the next practice to start a new streak 🔥
          </Text>
        )}

        <Text style={styles.sectionTitle}>Badges</Text>
        <View style={styles.grid}>
          {badges.map((b, i) => (
            <Animatable.View
              key={b.id}
              animation="fadeInUp"
              duration={400}
              delay={Math.min(i * 60, 400)}
              style={[styles.badge, !b.earned && styles.badgeLocked]}
            >
              <View style={[styles.badgeIcon, { backgroundColor: b.earned ? colors.primarySoft : colors.surfaceMuted }]}>
                <Icon
                  name={b.earned ? b.icon : 'lock-closed'}
                  size={24}
                  color={b.earned ? colors.primary : colors.textMuted}
                />
              </View>
              <Text style={[styles.badgeLabel, !b.earned && styles.badgeLabelLocked]}>{b.label}</Text>
              <Text style={styles.badgeDesc}>{b.desc}</Text>
              {b.earned && (
                <View style={styles.earnedTag}>
                  <Icon name="checkmark" size={11} color={colors.successDark} />
                  <Text style={styles.earnedText}>Earned</Text>
                </View>
              )}
            </Animatable.View>
          ))}
        </View>
      </ScrollView>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  hero: {
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.primary,
  },
  heroStreak: {
    fontSize: 52,
    fontFamily: fonts.bold,
    color: colors.textOnPrimary,
    lineHeight: 58,
    marginTop: spacing.sm,
  },
  heroLabel: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: '#E0E7FF',
    marginBottom: spacing.lg,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignSelf: 'stretch',
    justifyContent: 'space-around',
  },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatValue: { fontSize: 18, fontFamily: fonts.bold, color: colors.textOnPrimary },
  heroStatLabel: { fontSize: 11, fontFamily: fonts.medium, color: '#E0E7FF', marginTop: 2 },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.25)' },
  membership: {
    fontSize: 13.5,
    fontFamily: fonts.semibold,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  encouragement: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badge: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  badgeLocked: { opacity: 0.75 },
  badgeIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badgeLabel: {
    fontSize: 14.5,
    fontFamily: fonts.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  badgeLabelLocked: { color: colors.textSecondary },
  badgeDesc: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 16,
  },
  earnedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successSoft,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  earnedText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.successDark },
});
