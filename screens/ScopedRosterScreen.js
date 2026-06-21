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
// - costume: tracks two independently-sized items (Kurta Set, Jacket), each
//   with its own handout toggle, plus a size-wise inventory dashboard.
// - donation: a read-only list of company names.
const SCOPE_CONFIG = {
    costume: {
        title: 'Costume Roster',
        empty: 'No spartans have set a costume size yet.',
        items: [
            { key: 'kurta', label: 'Kurta Set', sizeField: 'kurtaSize', receivedField: 'kurtaReceived' },
            { key: 'jacket', label: 'Jacket', sizeField: 'jacketSize', receivedField: 'jacketReceived' },
        ],
    },
    donation: {
        title: 'Donation Roster',
        empty: 'No spartans have added a company yet.',
        secondaryLabel: 'Company',
        secondary: (u) => u.company || '—',
    },
};

export default function ScopedRosterScreen({ route, navigation }) {
    const scope = route?.params?.scope;
    const config = SCOPE_CONFIG[scope];

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [savingKey, setSavingKey] = useState(null);

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

    // Size-wise inventory per item: how many of each size are needed and how
    // many are still pending (not yet handed out).
    const inventory = useMemo(() => {
        if (!config?.items) return null;
        return config.items.map((item) => {
            const bySize = {};
            students.forEach((s) => {
                const size = s[item.sizeField];
                if (!size) return;
                if (!bySize[size]) bySize[size] = { total: 0, received: 0 };
                bySize[size].total += 1;
                if (s[item.receivedField]) bySize[size].received += 1;
            });
            const rows = Object.keys(bySize)
                .sort((a, b) => Number(a) - Number(b))
                .map((size) => ({
                    size,
                    total: bySize[size].total,
                    pending: bySize[size].total - bySize[size].received,
                }));
            return {
                ...item,
                rows,
                pending: rows.reduce((n, r) => n + r.pending, 0),
                total: rows.reduce((n, r) => n + r.total, 0),
            };
        });
    }, [students, config]);

    const toggleField = async (student, field) => {
        const next = !student[field];
        const key = `${student.id}:${field}`;
        setSavingKey(key);
        // Optimistic update; revert on failure.
        setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, [field]: next } : s)));
        try {
            await updateDoc(doc(db, 'users', student.id), { [field]: next });
        } catch (err) {
            console.error('Failed to update roster entry:', err);
            setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, [field]: !next } : s)));
        } finally {
            setSavingKey(null);
        }
    };

    if (!config) {
        return (
            <AppBackgroundWrapper>
                <View style={styles.center}><Text style={styles.empty}>Unknown roster.</Text></View>
            </AppBackgroundWrapper>
        );
    }

    if (loading) {
        return (
            <AppBackgroundWrapper>
                <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            </AppBackgroundWrapper>
        );
    }

    const ReceivedToggle = ({ student, field }) => {
        const on = !!student[field];
        const saving = savingKey === `${student.id}:${field}`;
        return (
            <Pressable
                onPress={() => toggleField(student, field)}
                disabled={saving}
                style={[styles.toggle, on ? styles.toggleOn : styles.toggleOff]}
            >
                {saving ? (
                    <ActivityIndicator size="small" color={on ? colors.successDark : colors.textMuted} />
                ) : (
                    <>
                        <Icon
                            name={on ? 'checkmark-circle' : 'ellipse-outline'}
                            size={15}
                            color={on ? colors.successDark : colors.textMuted}
                        />
                        <Text style={[styles.toggleText, on ? styles.toggleTextOn : styles.toggleTextOff]}>
                            {on ? 'Received' : 'Mark'}
                        </Text>
                    </>
                )}
            </Pressable>
        );
    };

    const renderItem = ({ item }) => (
        <View style={styles.row}>
            <Text style={styles.name}>{item.fullname || 'Unknown'}</Text>
            {config.items ? (
                config.items.map((it) => (
                    <View key={it.key} style={styles.itemLine}>
                        <Text style={styles.itemLabel}>
                            {it.label}: <Text style={styles.itemSize}>{item[it.sizeField] || '—'}</Text>
                        </Text>
                        <ReceivedToggle student={item} field={it.receivedField} />
                    </View>
                ))
            ) : (
                <Text style={styles.secondary}>
                    {config.secondaryLabel}: <Text style={styles.secondaryValue}>{config.secondary(item)}</Text>
                </Text>
            )}
        </View>
    );

    const ListHeader = (
        <>
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

            {inventory && (
                <View style={styles.inventoryWrap}>
                    {inventory.map((inv) => (
                        <View key={inv.key} style={styles.inventoryCard}>
                            <View style={styles.inventoryHeader}>
                                <Text style={styles.inventoryTitle}>{inv.label}</Text>
                                <Text style={styles.inventoryPending}>{inv.pending} still needed</Text>
                            </View>
                            {inv.rows.length === 0 ? (
                                <Text style={styles.inventoryEmpty}>No sizes set yet</Text>
                            ) : (
                                <View style={styles.invGrid}>
                                    {inv.rows.map((r) => (
                                        <View key={r.size} style={styles.invCell}>
                                            <Text style={styles.invSize}>{r.size}</Text>
                                            <Text style={styles.invCount}>
                                                <Text style={styles.invPending}>{r.pending}</Text>
                                                <Text style={styles.invTotal}> / {r.total}</Text>
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))}
                    <Text style={styles.invLegend}>pending / total per size</Text>
                </View>
            )}

            <Text style={styles.summary}>
                {students.length} spartan{students.length === 1 ? '' : 's'}
            </Text>
        </>
    );

    return (
        <AppBackgroundWrapper>
            <View style={styles.container}>
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    ListHeaderComponent={ListHeader}
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

    inventoryWrap: { marginBottom: spacing.md },
    inventoryCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.sm,
        ...shadows.sm,
    },
    inventoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    inventoryTitle: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
    inventoryPending: { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },
    inventoryEmpty: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted },
    invGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    invCell: {
        minWidth: 64,
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.md,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    invSize: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
    invCount: { fontSize: 13, marginTop: 2 },
    invPending: { fontFamily: fonts.bold, color: colors.primary },
    invTotal: { fontFamily: fonts.regular, color: colors.textMuted },
    invLegend: { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'right' },

    summary: { fontSize: 13, fontFamily: fonts.medium, color: colors.textMuted, marginBottom: spacing.md },

    row: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.sm,
        ...shadows.sm,
    },
    name: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text, marginBottom: 6 },
    itemLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    itemLabel: { fontSize: 13.5, fontFamily: fonts.regular, color: colors.textMuted },
    itemSize: { fontFamily: fonts.bold, color: colors.text },
    secondary: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted },
    secondaryValue: { fontFamily: fonts.semibold, color: colors.textSecondary },
    toggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 11,
        borderRadius: radius.full,
        minWidth: 104,
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
