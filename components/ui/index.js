// components/ui/index.js
// Small, reusable UI primitives built on the central theme.
import React from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from './Gradient';
import { colors, spacing, radius, fonts, typography, shadows } from '../../theme';

/* ----------------------------- Card ----------------------------- */
export function Card({ style, children, padded = true, ...rest }) {
  return (
    <View
      style={[styles.card, padded && styles.cardPadded, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

/* ------------------------- GradientButton ------------------------ */
// Primary call-to-action with the indigo->violet gradient.
export function GradientButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon = null, // optional leading element (e.g. <Ionicons .../>)
  style,
  textStyle,
  colors: gradientColors = colors.primaryGradient,
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btnShadow,
        { opacity: isDisabled ? 0.6 : pressed ? 0.92 : 1, transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }] },
        style,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btn}
      >
        {loading ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <View style={styles.btnContent}>
            {icon}
            <Text style={[styles.btnText, !!icon && { marginLeft: spacing.sm }, textStyle]}>
              {title}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/* -------------------------- OutlineButton ------------------------ */
export function OutlineButton({ title, onPress, disabled = false, icon = null, style, textStyle, tone = 'primary' }) {
  const toneColor =
    tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outlineBtn,
        { borderColor: toneColor, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <View style={styles.btnContent}>
        {icon}
        <Text style={[styles.outlineBtnText, { color: toneColor }, !!icon && { marginLeft: spacing.sm }, textStyle]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

/* ----------------------------- Badge ----------------------------- */
// tone: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'muted'
export function Badge({ label, tone = 'muted', style, textStyle }) {
  const map = {
    primary: [colors.primarySoft, colors.primaryDark],
    success: [colors.successSoft, colors.successDark],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
    muted: [colors.surfaceMuted, colors.textSecondary],
  };
  const [bg, fg] = map[tone] || map.muted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.badgeText, { color: fg }, textStyle]}>{label}</Text>
    </View>
  );
}

/* -------------------------- SectionTitle ------------------------- */
export function SectionTitle({ children, style }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  cardPadded: {
    padding: spacing.xl,
  },
  btnShadow: {
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  btn: {
    borderRadius: radius.lg,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  outlineBtn: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  outlineBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: typography.title.fontSize,
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
