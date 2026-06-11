// screens/EventsScreen.js
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { LinearGradient } from '../components/ui/Gradient';
import { colors, spacing, radius, fonts, shadows } from '../theme';

export default function EventsScreen() {
  return (
    <AppBackgroundWrapper>
      <View style={styles.container}>
        <Animatable.View animation="fadeInUp" delay={200} style={styles.card}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <Icon name="calendar" size={44} color={colors.textOnPrimary} />
          </LinearGradient>
          <Text style={styles.title}>Events Coming Soon!</Text>
          <Text style={styles.subtitle}>
            Stay tuned for upcoming Spartan events and announcements.
          </Text>
        </Animatable.View>
      </View>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadows.primary,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
