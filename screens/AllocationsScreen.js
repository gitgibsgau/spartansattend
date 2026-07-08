// screens/AllocationsScreen.js
// Student-facing Allocations tab. Placeholder "coming soon" state that previews
// the planned layout: an availability/allocated summary up top, then each
// RSVP'd event tagged with the student's assigned role (Dhol, Dhwaj, Tasha,
// Toll, Zanj, Media, Event Management) — with a dhol number when on Dhol.
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { LinearGradient } from '../components/ui/Gradient';
import { colors, spacing, radius, fonts, shadows } from '../theme';

const ROLES = ['Dhol', 'Dhwaj', 'Tasha', 'Toll', 'Zanj', 'Media', 'Event Management'];

export default function AllocationsScreen() {
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
            <View style={styles.soonPill}>
              <Icon name="time-outline" size={13} color={colors.textOnPrimary} />
              <Text style={styles.soonText}>Coming soon</Text>
            </View>
          </LinearGradient>
        </Animatable.View>

        {/* Preview of the summary card (values arrive with the live feature) */}
        <Animatable.View animation="fadeInUp" duration={500} delay={100} style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Icon name="checkmark-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.summarySoon}>Soon</Text>
            <Text style={styles.summaryLabel}>Availability given</Text>
          </View>
          <View style={styles.summaryTile}>
            <Icon name="ribbon-outline" size={20} color={colors.primary} />
            <Text style={styles.summarySoon}>Soon</Text>
            <Text style={styles.summaryLabel}>Events allocated</Text>
          </View>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" duration={500} delay={200} style={styles.card}>
          <Text style={styles.cardTitle}>What you'll see here</Text>
          <Text style={styles.cardBody}>
            Once the team finalises assignments, this tab will show every event you said you're
            available for, along with the role you've been given for it.
          </Text>

          <Text style={styles.rolesLabel}>Possible roles</Text>
          <View style={styles.chipRow}>
            {ROLES.map((r) => (
              <View key={r} style={styles.chip}>
                <Text style={styles.chipText}>{r}</Text>
              </View>
            ))}
          </View>

          <View style={styles.noteBox}>
            <Icon name="musical-notes-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
            <Text style={styles.noteText}>
              If you're allocated to Dhol, your assigned dhol number will be shown on the event.
            </Text>
          </View>
        </Animatable.View>

        <Text style={styles.footer}>We'll let you know as soon as allocations go live.</Text>
      </ScrollView>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing['4xl'] },
  hero: {
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.primary,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: { fontSize: 24, fontFamily: fonts.bold, color: colors.textOnPrimary },
  heroSub: { fontSize: 13, fontFamily: fonts.regular, color: '#E0E7FF', marginTop: 4 },
  soonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  soonText: { color: colors.textOnPrimary, fontSize: 12, fontFamily: fonts.semibold },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'flex-start',
    ...shadows.sm,
  },
  summarySoon: { fontSize: 20, fontFamily: fonts.bold, color: colors.textMuted, marginTop: spacing.sm },
  summaryLabel: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  cardTitle: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text, marginBottom: spacing.sm },
  cardBody: { fontSize: 13.5, lineHeight: 20, fontFamily: fonts.regular, color: colors.textSecondary },
  rolesLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.primaryDark },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.regular, color: colors.primaryDark },
  footer: {
    textAlign: 'center',
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
});
