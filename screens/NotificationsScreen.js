import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { useNotifications } from '../contexts/NotificationsContext';
import { colors, spacing, radius, fonts, shadows } from '../theme';

// Relative-ish timestamp: "Just now", "3h ago", or a date for older items.
const formatWhen = (ms) => {
    if (!ms) return '';
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function NotificationsScreen() {
    const { notifications, lastReadAt, markAllRead } = useNotifications();

    // Mark everything read once the inbox is opened.
    useFocusEffect(
        useCallback(() => {
            markAllRead();
        }, [markAllRead])
    );

    const renderItem = ({ item, index }) => {
        const unread = item.createdMs > lastReadAt;
        return (
            <Animatable.View
                animation="fadeInUp"
                duration={400}
                delay={Math.min(index * 50, 300)}
                style={[styles.card, unread && styles.cardUnread]}
            >
                <View style={styles.iconWrap}>
                    <Icon name="notifications" size={18} color={colors.primary} />
                    {unread && <View style={styles.unreadDot} />}
                </View>
                <View style={styles.body}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={2}>
                            {item.title || 'Notification'}
                        </Text>
                        <Text style={styles.time}>{formatWhen(item.createdMs)}</Text>
                    </View>
                    {!!item.body && <Text style={styles.message}>{item.body}</Text>}
                    {!!item.createdByName && (
                        <Text style={styles.sender}>— {item.createdByName}</Text>
                    )}
                </View>
            </Animatable.View>
        );
    };

    return (
        <AppBackgroundWrapper>
            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Icon name="notifications-off-outline" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>No notifications yet</Text>
                        <Text style={styles.emptyText}>
                            Announcements from your leads will show up here.
                        </Text>
                    </View>
                }
            />
        </AppBackgroundWrapper>
    );
}

const styles = StyleSheet.create({
    list: {
        padding: spacing.xl,
        paddingBottom: spacing['3xl'],
        flexGrow: 1,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius['2xl'],
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    cardUnread: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: radius.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    unreadDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 11,
        height: 11,
        borderRadius: radius.full,
        backgroundColor: colors.danger,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    body: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    title: {
        flex: 1,
        fontSize: 15,
        fontFamily: fonts.semibold,
        color: colors.text,
        marginRight: spacing.sm,
    },
    time: {
        fontSize: 11.5,
        fontFamily: fonts.regular,
        color: colors.textMuted,
    },
    message: {
        fontSize: 14,
        fontFamily: fonts.regular,
        color: colors.textSecondary,
        lineHeight: 20,
        marginTop: 3,
    },
    sender: {
        fontSize: 12,
        fontFamily: fonts.medium,
        color: colors.textMuted,
        marginTop: 6,
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: spacing['4xl'],
    },
    emptyTitle: {
        fontSize: 17,
        fontFamily: fonts.semibold,
        color: colors.text,
        marginTop: spacing.lg,
    },
    emptyText: {
        fontSize: 14,
        fontFamily: fonts.regular,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.sm,
        paddingHorizontal: spacing.xl,
        lineHeight: 20,
    },
});
