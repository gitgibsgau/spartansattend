import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import { auth, db } from '../firebase';
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    serverTimestamp,
} from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { GradientButton } from '../components/ui';
import { sendPushToTokens } from '../utils/notifications';
import { colors, spacing, radius, fonts, shadows } from '../theme';

const TITLE_MAX = 60;
const BODY_MAX = 240;

export default function AdminSendNotificationScreen() {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState({ show: false, type: '', text: '' });

    const showBanner = (type, text) => {
        setStatus({ show: true, type, text });
        setTimeout(() => setStatus({ show: false, type: '', text: '' }), 4000);
    };

    const handleSend = async () => {
        if (!title.trim()) {
            showBanner('error', 'Please enter a title.');
            return;
        }
        if (!body.trim()) {
            showBanner('error', 'Please enter a message.');
            return;
        }

        setSending(true);
        Keyboard.dismiss();
        try {
            const uid = auth.currentUser.uid;

            // Sender's display name (best-effort, for attribution in the inbox).
            let senderName = 'Admin';
            try {
                const meSnap = await getDoc(doc(db, 'users', uid));
                if (meSnap.exists()) senderName = meSnap.data().fullname || 'Admin';
            } catch (_) { /* non-fatal */ }

            // 1) Persist to the inbox feed (students read this live).
            await addDoc(collection(db, 'notifications'), {
                title: title.trim(),
                body: body.trim(),
                createdAt: serverTimestamp(),
                createdBy: uid,
                createdByName: senderName,
                audience: 'all',
            });

            // 2) Collect every registered push token and fan out via Expo.
            const usersSnap = await getDocs(collection(db, 'users'));
            const tokens = [];
            usersSnap.forEach((d) => {
                const t = d.data().pushTokens;
                if (Array.isArray(t)) tokens.push(...t);
            });
            const uniqueTokens = [...new Set(tokens)];

            const sent = await sendPushToTokens(uniqueTokens, {
                title: title.trim(),
                body: body.trim(),
                data: { type: 'announcement' },
            });

            showBanner(
                'success',
                uniqueTokens.length
                    ? `Sent to inbox • pushed to ${sent} device${sent === 1 ? '' : 's'}.`
                    : 'Posted to inbox. No registered devices to push yet.'
            );
            setTitle('');
            setBody('');
        } catch (err) {
            console.error('Failed to send notification:', err);
            showBanner('error', 'Could not send. Please try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <AppBackgroundWrapper>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <ScrollView
                        contentContainerStyle={styles.scroll}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <Animatable.View animation="fadeInDown" duration={500} style={styles.hero}>
                            <View style={styles.heroIcon}>
                                <Icon name="megaphone-outline" size={26} color={colors.primary} />
                            </View>
                            <Text style={styles.heroTitle}>Send Announcement</Text>
                            <Text style={styles.heroSub}>
                                Posts to every student's inbox and pushes to their devices.
                            </Text>
                        </Animatable.View>

                        <View style={styles.card}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Title</Text>
                                <Text style={styles.counter}>{title.length}/{TITLE_MAX}</Text>
                            </View>
                            <TextInput
                                value={title}
                                onChangeText={(t) => t.length <= TITLE_MAX && setTitle(t)}
                                placeholder="e.g. Practice moved to 6 PM"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                            />

                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Message</Text>
                                <Text style={styles.counter}>{body.length}/{BODY_MAX}</Text>
                            </View>
                            <TextInput
                                value={body}
                                onChangeText={(t) => t.length <= BODY_MAX && setBody(t)}
                                placeholder="Write your announcement..."
                                placeholderTextColor={colors.textMuted}
                                style={[styles.input, styles.textArea]}
                                multiline
                                textAlignVertical="top"
                            />
                        </View>

                        <GradientButton
                            title={sending ? 'Sending...' : 'Send to all students'}
                            onPress={handleSend}
                            loading={sending}
                            icon={<Icon name="send" size={18} color={colors.textOnPrimary} />}
                        />
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {status.show && (
                <Animatable.View
                    animation="slideInUp"
                    duration={300}
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
    scroll: {
        padding: spacing.xl,
        paddingBottom: spacing['3xl'],
    },
    hero: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    heroIcon: {
        width: 56,
        height: 56,
        borderRadius: radius.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    heroTitle: {
        fontSize: 20,
        fontFamily: fonts.bold,
        color: colors.text,
    },
    heroSub: {
        fontSize: 13.5,
        fontFamily: fonts.regular,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 4,
        paddingHorizontal: spacing.lg,
        lineHeight: 19,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.md,
        marginBottom: spacing.lg,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.md,
        marginBottom: 6,
    },
    label: {
        fontSize: 12.5,
        fontFamily: fonts.medium,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    counter: {
        fontSize: 11.5,
        fontFamily: fonts.regular,
        color: colors.textMuted,
    },
    input: {
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingVertical: 13,
        paddingHorizontal: spacing.lg,
        fontSize: 15,
        fontFamily: fonts.regular,
        color: colors.text,
    },
    textArea: {
        minHeight: 120,
    },
    banner: {
        position: 'absolute',
        bottom: 30,
        left: spacing.xl,
        right: spacing.xl,
        padding: spacing.lg,
        borderRadius: radius.md,
        borderLeftWidth: 6,
        ...shadows.md,
        zIndex: 100,
        backgroundColor: colors.surface,
    },
    bannerText: {
        fontSize: 15,
        fontFamily: fonts.medium,
        textAlign: 'center',
        color: colors.text,
    },
    error: {
        backgroundColor: colors.dangerSoft,
        borderLeftColor: colors.danger,
    },
    success: {
        backgroundColor: colors.successSoft,
        borderLeftColor: colors.success,
    },
});
