// components/ui/ProgressRing.js
// Circular progress ring backed by react-native-svg (already in the dev client).
// Used for the attendance-eligibility tracker.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { colors, fonts } from '../../theme';

export default function ProgressRing({
  size = 120,
  strokeWidth = 12,
  progress = 0, // 0..1
  trackColor = colors.surfaceMuted,
  gradient = colors.primaryGradient,
  centerLabel, // string shown big in the middle
  centerSubLabel, // small string under it
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[gradient.length - 1]} />
          </SvgLinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          // start from top (12 o'clock)
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {(centerLabel != null || centerSubLabel != null) && (
        <View style={styles.center} pointerEvents="none">
          {centerLabel != null && <Text style={styles.label}>{centerLabel}</Text>}
          {centerSubLabel != null && <Text style={styles.subLabel}>{centerSubLabel}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.text,
  },
  subLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
