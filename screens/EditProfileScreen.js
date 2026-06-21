import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
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
import { useHeaderHeight } from '@react-navigation/elements';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getInitials } from '../components/ui/Avatar';
import { colors, spacing, radius, fonts, shadows } from '../theme';

// Self-selectable primary instruments. Dhwaj is not picked directly — it's
// auto-attached to Dhol players. Zanj and Toll are assigned by the pathak, so
// they aren't offered here (see the note in the form).
const PRIMARY_INSTRUMENTS = ['Dhol', 'Tasha'];

// Costume sizes students self-report — shown as the numeric (chest) size.
// Letter equivalents: 32=XXS 34=XS 36=S 38=M 40=L 42=XL 44=2XL 46=3XL 48=4XL.
// Kurta Set and Jacket are sized independently. Handout (kurtaReceived /
// jacketReceived) is NOT set here — only a costumeAdmin marks it.
const COSTUME_SIZES = ['32', '34', '36', '38', '40', '42', '44', '46', '48'];

// Normalize whatever shape `instrument` is stored as (legacy single string,
// array, or null) into an array, and enforce the Dhol ⇒ Dhwaj rule.
const normalizeInstruments = (raw) => {
    const arr = Array.isArray(raw) ? [...raw] : raw ? [raw] : [];
    if (arr.includes('Dhol') && !arr.includes('Dhwaj')) arr.push('Dhwaj');
    return arr;
};

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
    '#059669', // emerald
    '#EAB308', // amber
    '#06B6D4', // cyan
    '#0EA5E9', // sky
    '#C026D3', // fuchsia
    '#E11D48', // rose
    '#65A30D', // lime
    '#9333EA', // purple
];

// Optional preset avatar glyphs (themed). Picking one shows it on the chosen
// color; clearing it falls back to the user's initials.
const AVATAR_EMOJIS = ['🥁', '🚩', '🦁', '🔥', '⭐', '👑', '🎭', '⚔️'];

export default function EditProfileScreen({ navigation }) {
    const headerHeight = useHeaderHeight();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [fullname, setFullname] = useState('');
    const [email, setEmail] = useState('');
    const [instrument, setInstrument] = useState([]);
    const [joinedYear, setJoinedYear] = useState('');
    const [emergencyName, setEmergencyName] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');
    const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
    const [avatarEmoji, setAvatarEmoji] = useState(null);
    const [kurtaSize, setKurtaSize] = useState(null);
    const [jacketSize, setJacketSize] = useState(null);
    const [company, setCompany] = useState('');

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
                    setInstrument(normalizeInstruments(d.instrument));
                    setJoinedYear(d.joinedYear ? String(d.joinedYear) : '');
                    setEmergencyName(d.emergencyContactName || '');
                    setEmergencyPhone(d.emergencyContactPhone || '');
                    setAvatarColor(d.avatarColor || AVATAR_COLORS[0]);
                    setAvatarEmoji(d.avatarEmoji || null);
                    setKurtaSize(d.kurtaSize || null);
                    setJacketSize(d.jacketSize || null);
                    setCompany(d.company || '');
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

    // Single primary selection. Picking Dhol auto-attaches Dhwaj; picking the
    // currently-selected instrument again clears it.
    const selectPrimary = (inst) => {
        setInstrument((prev) => {
            if (prev.includes(inst)) return [];
            return inst === 'Dhol' ? ['Dhol', 'Dhwaj'] : [inst];
        });
    };
    const dholSelected = instrument.includes('Dhol');

    const handleSave = useCallback(async () => {
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
                    instrument: instrument.length ? instrument : null,
                    joinedYear: joinedYearValue,
                    emergencyContactName: emergencyName.trim(),
                    emergencyContactPhone: emergencyPhone.trim(),
                    avatarColor,
                    avatarEmoji: avatarEmoji || null,
                    kurtaSize: kurtaSize || null,
                    jacketSize: jacketSize || null,
                    company: company.trim(),
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
    }, [fullname, emergencyPhone, joinedYear, instrument, emergencyName, avatarColor, avatarEmoji, kurtaSize, jacketSize, company, navigation]);

    // Always-visible Save in the header so there's no scroll-to-bottom hunt.
    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    hitSlop={10}
                    style={({ pressed }) => [styles.headerSave, pressed && { opacity: 0.5 }]}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <Text style={styles.headerSaveText}>Save</Text>
                    )}
                </Pressable>
            ),
        });
    }, [navigation, handleSave, saving]);

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
                keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <ScrollView
                        contentContainerStyle={styles.scroll}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Avatar preview */}
                        <Animatable.View animation="fadeInDown" duration={500} style={styles.avatarWrap}>
                            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                                {avatarEmoji ? (
                                    <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
                                ) : (
                                    <Text style={styles.avatarInitials}>{getInitials(fullname)}</Text>
                                )}
                            </View>

                            <Text style={styles.avatarHint}>Pick an avatar</Text>
                            <View style={styles.swatchRow}>
                                <Pressable
                                    onPress={() => setAvatarEmoji(null)}
                                    style={[styles.emojiChip, !avatarEmoji && styles.emojiChipSelected]}
                                >
                                    <Text style={styles.emojiInitials}>{getInitials(fullname)}</Text>
                                </Pressable>
                                {AVATAR_EMOJIS.map((e) => {
                                    const selected = avatarEmoji === e;
                                    return (
                                        <Pressable
                                            key={e}
                                            onPress={() => setAvatarEmoji(e)}
                                            style={[styles.emojiChip, selected && styles.emojiChipSelected]}
                                        >
                                            <Text style={styles.emojiGlyph}>{e}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={styles.avatarHint}>Pick a color</Text>
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
                                {PRIMARY_INSTRUMENTS.map((inst) => {
                                    const selected = instrument.includes(inst);
                                    return (
                                        <Pressable
                                            key={inst}
                                            onPress={() => selectPrimary(inst)}
                                            style={[styles.chip, selected && styles.chipSelected]}
                                        >
                                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                                {inst}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                                {dholSelected && (
                                    <View style={[styles.chip, styles.chipLocked]}>
                                        <Icon name="lock-closed" size={12} color={colors.primaryDark} style={{ marginRight: 5 }} />
                                        <Text style={[styles.chipText, styles.chipTextSelected]}>Dhwaj · included</Text>
                                    </View>
                                )}
                            </View>
                            {dholSelected && (
                                <Text style={styles.helper}>Dhol players also carry Dhwaj — it's added automatically.</Text>
                            )}

                            <View style={styles.noteBox}>
                                <Icon name="information-circle-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
                                <Text style={styles.noteText}>
                                    Zanj and Toll aren't self-selected — spartans are chosen for them by the pathak. If you play Tasha, you may also be picked for Zanj or Toll.
                                </Text>
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
                            <Text style={styles.sectionTitle}>Costume Size</Text>

                            <Text style={styles.label}>Kurta Set Size</Text>
                            <View style={styles.chipRow}>
                                {COSTUME_SIZES.map((size) => {
                                    const selected = kurtaSize === size;
                                    return (
                                        <Pressable
                                            key={size}
                                            onPress={() => setKurtaSize(selected ? null : size)}
                                            style={[styles.chip, selected && styles.chipSelected]}
                                        >
                                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{size}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>Jacket Size</Text>
                            <View style={styles.chipRow}>
                                {COSTUME_SIZES.map((size) => {
                                    const selected = jacketSize === size;
                                    return (
                                        <Pressable
                                            key={size}
                                            onPress={() => setJacketSize(selected ? null : size)}
                                            style={[styles.chip, selected && styles.chipSelected]}
                                        >
                                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{size}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={styles.helper}>Numeric (chest) size — 32=XXS · 38=M · 48=4XL. Handout is marked by the costume team.</Text>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Company</Text>
                            <TextInput
                                value={company}
                                onChangeText={setCompany}
                                placeholder="e.g. Acme Corp"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                autoCapitalize="words"
                            />
                            <Text style={styles.helper}>Used for employer donation-match programs.</Text>
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

                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {status.show && (
                <Animatable.View
                    animation="slideInDown"
                    duration={300}
                    style={[
                        styles.statusBanner,
                        { top: insets.top + 12 },
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
    avatarEmoji: {
        fontSize: 48,
    },
    emojiChip: {
        width: 40,
        height: 40,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceMuted,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    emojiChipSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    emojiGlyph: {
        fontSize: 20,
    },
    emojiInitials: {
        fontSize: 14,
        fontFamily: fonts.bold,
        color: colors.textSecondary,
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
    chipLocked: {
        flexDirection: 'row',
        alignItems: 'center',
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
        opacity: 0.9,
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
    noteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        backgroundColor: colors.primarySoft,
        borderRadius: radius.md,
        padding: spacing.md,
        marginTop: spacing.md,
    },
    noteText: {
        flex: 1,
        fontSize: 12.5,
        lineHeight: 18,
        fontFamily: fonts.regular,
        color: colors.primaryDark,
    },
    headerSave: {
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
    },
    headerSaveText: {
        fontSize: 16,
        fontFamily: fonts.semibold,
        color: colors.primary,
    },
    statusBanner: {
        position: 'absolute',
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
