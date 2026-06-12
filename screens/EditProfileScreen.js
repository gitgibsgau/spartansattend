import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    ActivityIndicator,
} from 'react-native';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { GradientButton } from '../components/ui';
import { getInitials } from '../components/ui/Avatar';
import { colors, spacing, radius, fonts, shadows } from '../theme';

// Instruments offered in the pathak. Kept in sync with the parikshan stages.
const INSTRUMENTS = ['Dhol', 'Tasha', 'Dhwaj'];

// Avatar color choices (no photo upload required — works without Storage).
const AVATAR_COLORS = [
    '#6366F1', // indigo (default)
    '#8B5CF6', // violet
    '#0D9488', // teal
    '#F97316', // orange
    '#DC2626', // red
    '#2563EB', // blue
    '#DB2777', // pink
    '#475569', // slate
];

export default function EditProfileScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [fullname, setFullname] = useState('');
    const [email, setEmail] = useState('');
    const [instrument, setInstrument] = useState(null);
    const [joinedYear, setJoinedYear] = useState('');
    const [emergencyName, setEmergencyName] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');
    const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

    const [status, setStatus] = useState({ show: false, type: '', text: '' });

    useEffect(() => {
        const load = async () => {
            try {
                const uid = auth.currentUser.uid;
                const snap = await getDoc(doc(db, 'users', uid));
                if (snap.exists()) {
                    const d = snap.data();
                    setFullname(d.fullname || '');
                    setEmail(d.email || '');
                    setInstrument(d.instrument || null);
                    setJoinedYear(d.joinedYear ? String(d.joinedYear) : '');
                    setEmergencyName(d.emergencyContactName || '');
                    setEmergencyPhone(d.emergencyContactPhone || '');
                    setAvatarColor(d.avatarColor || AVATAR_COLORS[0]);
                }
            } catch (err) {
                console.error('Failed to load profile for edit:', err);
                showBanner('error', 'Could not load your profile.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const showBanner = (type, text) => {
        setStatus({ show: true, type, text });
        setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
    };

    const handleSave = async () => {
        if (!fullname.trim()) {
            showBanner('error', 'Please enter your name.');
            return;
        }
        // Light phone validation — optional field, but if present should look valid.
        if (emergencyPhone.trim() && !/^[+\d][\d\s()-]{6,}$/.test(emergencyPhone.trim())) {
            showBanner('error', 'Please enter a valid emergency phone number.');
            return;
        }
        // Join year — optional, but if present must be a sensible 4-digit year.
        const currentYear = new Date().getFullYear();
        let joinedYearValue = null;
        if (joinedYear.trim()) {
            joinedYearValue = Number(joinedYear.trim());
            if (!Number.isInteger(joinedYearValue) || joinedYearValue < 1980 || joinedYearValue > currentYear) {
                showBanner('error', `Enter a valid join year (1980–${currentYear}).`);
                return;
            }
        }

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            await setDoc(
                doc(db, 'users', uid),
                {
                    fullname: fullname.trim(),
                    instrument: instrument || null,
                    joinedYear: joinedYearValue,
                    emergencyContactName: emergencyName.trim(),
                    emergencyContactPhone: emergencyPhone.trim(),
                    avatarColor,
                },
                { merge: true }
            );
            showBanner('success', 'Profile updated.');
            setTimeout(() => navigation.goBack(), 700);
        } catch (err) {
            console.error('Failed to save profile:', err);
            showBanner('error', 'Could not save changes. Try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AppBackgroundWrapper>
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </AppBackgroundWrapper>
        );
    }

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
                        {/* Avatar preview */}
                        <Animatable.View animation="fadeInDown" duration={500} style={styles.avatarWrap}>
                            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                                <Text style={styles.avatarInitials}>{getInitials(fullname)}</Text>
                            </View>
                            <Text style={styles.avatarHint}>Pick your avatar color</Text>
                            <View style={styles.swatchRow}>
                                {AVATAR_COLORS.map((c) => {
                                    const selected = c === avatarColor;
                                    return (
                                        <Pressable
                                            key={c}
                                            onPress={() => setAvatarColor(c)}
                                            style={[
                                                styles.swatch,
                                                { backgroundColor: c },
                                                selected && styles.swatchSelected,
                                            ]}
                                        >
                                            {selected && (
                                                <Icon name="checkmark" size={16} color="#fff" />
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </Animatable.View>

                        {/* Form */}
                        <View style={styles.card}>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                value={fullname}
                                onChangeText={setFullname}
                                placeholder="Your name"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                autoCapitalize="words"
                            />

                            <Text style={styles.label}>Email</Text>
                            <View style={[styles.input, styles.inputDisabled]}>
                                <Text style={styles.disabledText}>{email || '—'}</Text>
                            </View>
                            <Text style={styles.helper}>Email can't be changed here.</Text>

                            <Text style={styles.label}>Instrument</Text>
                            <View style={styles.chipRow}>
                                {INSTRUMENTS.map((inst) => {
                                    const selected = instrument === inst;
                                    return (
                                        <Pressable
                                            key={inst}
                                            onPress={() => setInstrument(selected ? null : inst)}
                                            style={[styles.chip, selected && styles.chipSelected]}
                                        >
                                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                                {inst}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>Year Joined the Pathak</Text>
                            <TextInput
                                value={joinedYear}
                                onChangeText={(t) => setJoinedYear(t.replace(/[^0-9]/g, ''))}
                                placeholder="e.g. 2021"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                keyboardType="number-pad"
                                maxLength={4}
                            />
                            <Text style={styles.helper}>Used for your membership tenure & Veteran badge.</Text>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Emergency Contact</Text>
                            <Text style={styles.label}>Contact Name</Text>
                            <TextInput
                                value={emergencyName}
                                onChangeText={setEmergencyName}
                                placeholder="e.g. Parent / Guardian"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                autoCapitalize="words"
                            />
                            <Text style={styles.label}>Contact Phone</Text>
                            <TextInput
                                value={emergencyPhone}
                                onChangeText={setEmergencyPhone}
                                placeholder="e.g. +1 408 555 0123"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <GradientButton
                            title="Save Changes"
                            onPress={handleSave}
                            loading={saving}
                            icon={<Icon name="save-outline" size={18} color={colors.textOnPrimary} />}
                            style={styles.saveBtn}
                        />
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {status.show && (
                <Animatable.View
                    animation="slideInUp"
                    duration={300}
                    style={[
                        styles.statusBanner,
                        status.type === 'error' ? styles.error : styles.success,
                    ]}
                >
                    <Text style={styles.statusText}>{status.text}</Text>
                </Animatable.View>
            )}
        </AppBackgroundWrapper>
    );
}

const styles = StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: {
        padding: spacing.xl,
        paddingBottom: 60,
    },
    avatarWrap: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.primary,
    },
    avatarInitials: {
        color: '#fff',
        fontSize: 36,
        fontFamily: fonts.bold,
    },
    avatarHint: {
        marginTop: spacing.md,
        fontSize: 13,
        fontFamily: fonts.medium,
        color: colors.textMuted,
    },
    swatchRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    swatch: {
        width: 34,
        height: 34,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    swatchSelected: {
        borderColor: colors.text,
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
    sectionTitle: {
        fontSize: 16,
        fontFamily: fonts.semibold,
        color: colors.text,
        marginBottom: spacing.md,
    },
    label: {
        fontSize: 12.5,
        fontFamily: fonts.medium,
        color: colors.textMuted,
        marginBottom: 6,
        marginTop: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
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
    inputDisabled: {
        backgroundColor: colors.backgroundAlt,
        justifyContent: 'center',
    },
    disabledText: {
        fontSize: 15,
        fontFamily: fonts.regular,
        color: colors.textMuted,
    },
    helper: {
        fontSize: 11.5,
        fontFamily: fonts.regular,
        color: colors.textMuted,
        marginTop: 5,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: 4,
    },
    chip: {
        paddingVertical: 9,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.full,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    chipSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    chipText: {
        fontSize: 14,
        fontFamily: fonts.medium,
        color: colors.textSecondary,
    },
    chipTextSelected: {
        color: colors.primaryDark,
        fontFamily: fonts.semibold,
    },
    saveBtn: {
        marginTop: spacing.sm,
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
        backgroundColor: colors.surface,
    },
    statusText: {
        fontSize: 15,
        fontFamily: fonts.medium,
        textAlign: 'center',
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
