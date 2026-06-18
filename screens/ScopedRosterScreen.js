import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import Icon from 'react-native-vector-icons/Ionicons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { colors, spacing, radius, fonts, shadows } from '../theme';

// Config-driven roster shared by the costume and donation scoped admins.
// Each scope decides its title, the secondary field shown per spartan, and
// whether a per-row toggle (e.g. costume handout) is editable.
const SCOPE_CONFIG = {
    costume: {
        title: 'Costume Roster',
        empty: 'No spartans have set a costume size yet.',
        secondaryLabel: 'Size',
        secondary: (u) => u.costumeSize || '—',
        toggle: { field: 'costumeReceived', onText: 'Received', offText: 'Mark received' },
    },
    donation: {
        title: 'Donation Roster',
        empty: 'No spartans have added a company yet.',
        secondaryLabel: 'Company',
        secondary: (u) => u.company || '—',
        toggle: null,
    },
};

export default function ScopedRosterScreen({ route, navigation }) {
    const scope = route?.params?.scope;
    const config = SCOPE_CONFIG[scope];

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [savingId, setSavingId] = useState(null);

    useLayoutEffect(() => {
        if (config) navigation.setOptions({ title: config.title });
    }, [navigation, config]);

    useEffect(() => {
        if (!config) return;
        const load = async () => {
            try {
                const snap = await getDocs(
                    query(collection(db, 'users'), where('role', '==', 'student'))
                );
                const rows = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.fullname || '').localeCompare(b.fullname || ''));
                setStudents(rows);
            } catch (err) {
                console.error('Failed to load roster:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [config]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return students;
        return students.filter((s) => (s.fullname || '').toLowerCase().includes(q));
    }, [students, search]);

    const receivedCount = useMemo(
        () => (config?.toggle ? students.filter((s) => s[config.toggle.field]).length : 0),
        [students, config]
    );

    const toggleReceived = async (student) => {
        const field = config.toggle.field;
        const next = !student[field];
        setSavingId(student.id);
        // Optimistic update; revert on failure.
        setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, [field]: next } : s)));
        try {
            await updateDoc(doc(db, 'users', student.id), { [field]: next });
        } catch (err) {
            console.error('Failed to update roster entry:', err);
            setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, [field]: !next } : s)));
        } finally {
            setSavingId(null);
        }
    };

    if (!config) {
        return (
            <AppBackgroundWrapper>
                <View style={styles.center}>
                    <Text style={styles.empty}>Unknown roster.</Text>
                </View>
            </AppBackgroundWrapper>
        );
    }

    if (loading) {
        return (
            <AppBackgroundWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </AppBackgroundWrapper>
        );
    }

    const renderItem = ({ item }) => {
        const on = config.toggle ? !!item[config.toggle.field] : false;
        return (
            <View style={styles.row}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.fullname || 'Unknown'}</Text>
                    <Text style={styles.secondary}>
                        {config.secondaryLabel}: <Text style={styles.secondaryValue}>{config.secondary(item)}</Text>
                    </Text>
                </View>
                {config.toggle && (
                    <Pressable
                        onPress={() => toggleReceived(item)}
                        disabled={savingId === item.id}
                        style={[styles.toggle, on ? styles.toggleOn : styles.toggleOff]}
                    >
                        {savingId === item.id ? (
                            <ActivityIndicator size="small" color={on ? colors.successDark : colors.textMuted} />
                        ) : (
                            <>
                                <Icon
                                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={16}
                                    color={on ? colors.successDark : colors.textMuted}
                                />
                                <Text style={[styles.toggleText, on ? styles.toggleTextOn : styles.toggleTextOff]}>
                                    {on ? config.toggle.onText : config.toggle.offText}
                                </Text>
                            </>
                        )}
                    </Pressable>
                )}
            </View>
        );
    };

    return (
        <AppBackgroundWrapper>
            <View style={styles.container}>
                <View style={styles.searchWrap}>
                    <Icon name="search" size={18} color={colors.textMuted} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search by name"
                        placeholderTextColor={colors.textMuted}
                        style={styles.searchInput}
                        autoCapitalize="words"
                    />
                </View>

                <Text style={styles.summary}>
                    {config.toggle
                        ? `${receivedCount}/${students.length} received`
                        : `${students.length} spartan${students.length === 1 ? '' : 's'}`}
                </Text>

                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
                    ListEmptyComponent={<Text style={styles.empty}>{config.empty}</Text>}
                    keyboardShouldPersistTaps="handled"
                />
            </View>
        </AppBackgroundWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: 10,
        marginBottom: spacing.md,
    },
    searchInput: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.text },
    summary: {
        fontSize: 13,
        fontFamily: fonts.medium,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.sm,
        ...shadows.sm,
    },
    name: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
    secondary: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
    secondaryValue: { fontFamily: fonts.semibold, color: colors.textSecondary },
    toggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: radius.full,
        minWidth: 116,
        justifyContent: 'center',
    },
    toggleOn: { backgroundColor: colors.successSoft },
    toggleOff: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    toggleText: { fontSize: 12.5, fontFamily: fonts.semibold },
    toggleTextOn: { color: colors.successDark },
    toggleTextOff: { color: colors.textMuted },
    empty: {
        textAlign: 'center',
        marginTop: spacing['3xl'],
        fontSize: 14,
        fontFamily: fonts.regular,
        color: colors.textMuted,
    },
});
