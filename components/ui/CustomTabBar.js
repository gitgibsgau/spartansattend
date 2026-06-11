// components/ui/CustomTabBar.js
// A modern floating bottom tab bar: rounded, lifted off the edges with a soft
// shadow. The active tab shows a gradient pill behind its icon; labels sit
// below in a small font. Drop-in replacement via <Tab.Navigator tabBar={...}>.
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from './Gradient';
import { colors, spacing, radius, fonts, shadows } from '../../theme';

export default function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            options.tabBarLabel ?? options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const renderIcon = (color) =>
            options.tabBarIcon
              ? options.tabBarIcon({ focused, color, size: 22 })
              : null;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.item}
            >
              {focused ? (
                <LinearGradient
                  colors={colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activePill}
                >
                  {renderIcon(colors.textOnPrimary)}
                </LinearGradient>
              ) : (
                <View style={styles.inactiveIcon}>
                  {renderIcon(colors.textMuted)}
                </View>
              )}
              <Text
                numberOfLines={1}
                style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    width: 40,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primary,
  },
  inactiveIcon: {
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    marginTop: 3,
    fontFamily: fonts.medium,
  },
  labelActive: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
  },
  labelInactive: {
    color: colors.textMuted,
  },
});
