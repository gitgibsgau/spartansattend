// components/ui/Avatar.js
// Initials-based avatar (no photo upload / Storage needed). Renders the user's
// initials on a solid color chosen in Edit Profile, falling back to the brand
// gradient when no color is set.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from './Gradient';
import { colors, radius, fonts, shadows } from '../../theme';

export function getInitials(name) {
    if (!name || !name.trim()) return '?';
    return name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

export function Avatar({ name, color, size = 96, withShadow = true }) {
    const initials = getInitials(name);
    const fontSize = Math.round(size * 0.38);
    const base = {
        width: size,
        height: size,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
    };

    if (color) {
        return (
            <View style={[base, { backgroundColor: color }, withShadow && shadows.primary]}>
                <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
            </View>
        );
    }

    // No color chosen yet → brand gradient.
    return (
        <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[base, withShadow && shadows.primary]}
        >
            <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    initials: {
        color: '#fff',
        fontFamily: fonts.bold,
    },
});

export default Avatar;
