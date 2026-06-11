import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { LinearGradient } from '../components/ui/Gradient';
import { colors, spacing, radius, fonts, shadows } from '../theme';
import { db, auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function AttendanceHome({ navigation, route }) {
  const [showBanner, setShowBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user role from Firestore
    const fetchRole = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setRole(userDoc.data()?.role || 'student');
        } else {
          setRole('student'); // fallback
        }
      } catch (err) {
        console.error('Error fetching role:', err);
        setRole('student');
      } finally {
        setLoading(false);
      }
    };
    fetchRole();
  }, []);

  useEffect(() => {
    if (route?.params?.fromScreen) {
      setBannerMessage(`Returned to Attendance`);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    }
  }, [route]);

  // Rich action row: colored icon badge + title/subtitle + chevron.
  const ActionCard = ({ title, subtitle, iconName, gradient, onPress, delay }) => (
    <Animatable.View animation="fadeInUp" delay={delay} style={styles.cardWrap}>
      <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.85}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBadge}
        >
          <Icon name={iconName} size={26} color={colors.textOnPrimary} />
        </LinearGradient>
        <View style={styles.cardTextWrap}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <Icon name="chevron-forward" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </Animatable.View>
  );

  if (loading) {
    return (
      <AppBackgroundWrapper>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppBackgroundWrapper>
    );
  }

  return (
    <AppBackgroundWrapper>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInDown" duration={600}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIcon}>
              <Icon name="calendar" size={28} color={colors.textOnPrimary} />
            </View>
            <Text style={styles.heroTitle}>Attendance</Text>
            <Text style={styles.heroSubtitle}>Mark and track your practice sessions</Text>
          </LinearGradient>
        </Animatable.View>

        <ActionCard
          title="Mark Your Attendance"
          subtitle="Scan the session QR code"
          iconName="qr-code-outline"
          gradient={colors.primaryGradient}
          onPress={() => navigation.navigate('ManualEntry')}
          delay={150}
        />
        <ActionCard
          title="View Attendance"
          subtitle="Your session history & calendar"
          iconName="calendar-outline"
          gradient={['#8B5CF6', '#A78BFA']}
          onPress={() => navigation.navigate('AttendanceView')}
          delay={300}
        />

        {/* ✅ Show only if NOT student */}
        {role !== 'student' && (
          <ActionCard
            title="Attendance Requests"
            subtitle="Review correction requests"
            iconName="checkmark-done-outline"
            gradient={[colors.success, '#10B981']}
            onPress={() => navigation.navigate('AdminAttendanceRequests')}
            delay={450}
          />
        )}

        {showBanner && (
          <Animatable.View
            animation="slideInUp"
            duration={400}
            style={[styles.statusBanner, styles.success]}
          >
            <Text style={styles.statusText}>{bannerMessage}</Text>
          </Animatable.View>
        )}
      </ScrollView>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center', // center the hero + cards so short content isn't jammed at the top
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.background,
  },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: {
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
    ...shadows.primary,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.textOnPrimary,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#E0E7FF',
    marginTop: 4,
  },
  cardWrap: {
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
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
  },
  statusText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  success: {
    backgroundColor: colors.successSoft,
    borderLeftColor: colors.success,
  },
});
