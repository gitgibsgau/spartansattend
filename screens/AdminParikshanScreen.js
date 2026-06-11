import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Modal,
    FlatList,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from '../components/ui/Gradient';
import { colors, spacing, radius, fonts, shadows } from '../theme';
import { useSeason } from '../contexts/SeasonContext';

// Both parikshan stages share the same instruments.
const SCORE_FIELDS = ['dhol', 'dhwaj', 'tasha', 'maintenance'];
const STAGE_COLLECTION = { mid: 'parikshanScores', final: 'finalParikshanScores' };
const STAGE_LABEL = { mid: 'Mid-Season', final: 'Final' };
const emptyScores = () => ({ dhol: '', dhwaj: '', tasha: '', maintenance: '' });

export default function AdminFinalParikshanScreen() {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedStudentName, setSelectedStudentName] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [loadingStudents, setLoadingStudents] = useState(false);
    const { currentSeason, midReleased, finalReleased, activeStage } = useSeason();

    // Which parikshan is being scored / released (super-admin can switch freely;
    // scorers are locked to the admin-controlled activeStage).
    const [stage, setStage] = useState('mid');
    const [settingActive, setSettingActive] = useState(false);

    const [scores, setScores] = useState(emptyScores());
    const [lockedFields, setLockedFields] = useState({});
    const [submittedBy, setSubmittedBy] = useState(null);
    // Mid-season summary shown as reference while scoring the Final stage.
    const [midSummary, setMidSummary] = useState({ dhol: null, dhwaj: null, tasha: null, maintenance: null, overall: null });

    const [status, setStatus] = useState({ show: false, type: '', text: '' });
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [togglingRelease, setTogglingRelease] = useState(false);
    const [isScorer, setIsScorer] = useState(false);

    // Scorers may only score the stage the admin has opened; super-admins always can.
    const scoringOpenForScorer = isScorer && activeStage != null;
    const canScore = isSuperAdmin || scoringOpenForScorer;
    const stageCollection = STAGE_COLLECTION[stage];
    const stageReleased = stage === 'mid' ? midReleased : finalReleased;

    // Lock non-admin scorers' view to the active stage.
    useEffect(() => {
        if (!isSuperAdmin && isScorer && activeStage) setStage(activeStage);
    }, [activeStage, isSuperAdmin, isScorer]);

    useEffect(() => {
        (async () => {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const u = userSnap.data();
                setIsSuperAdmin(!!u.isSuperAdmin);
                setIsScorer(!!u.isScorer);
            }
        })();
    }, []);

    const formatScore = (v, digits = 2) =>
        typeof v === 'number' && !Number.isNaN(v) ? v.toFixed(digits) : '—';

    const showBanner = (type, text) => {
        setStatus({ show: true, type, text });
        setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
    };

    // Super-admin sets which stage scorers can enter (or closes scoring).
    const updateActiveStage = async (value) => {
        setSettingActive(true);
        const next = activeStage === value ? null : value; // tapping the open stage closes it
        try {
            await setDoc(doc(db, 'globalConfig', 'parikshanSettings'), { activeStage: next }, { merge: true });
            showBanner('success', next ? `${STAGE_LABEL[next]} scoring opened for scorers.` : 'Scoring closed for scorers.');
        } catch (e) {
            console.error(e);
            showBanner('error', 'Failed to update scoring stage.');
        } finally {
            setSettingActive(false);
        }
    };

    const toggleReleaseResults = async () => {
        setTogglingRelease(true);
        const flagKey = stage === 'mid' ? 'midReleased' : 'finalReleased';
        const next = !stageReleased;
        try {
            await setDoc(doc(db, 'globalConfig', 'parikshanSettings'), { [flagKey]: next }, { merge: true });
            showBanner('success', `${STAGE_LABEL[stage]} results ${next ? 'released' : 'hidden'} successfully.`);
        } catch (e) {
            console.error(e);
            showBanner('error', 'Failed to update result visibility.');
        } finally {
            setTogglingRelease(false);
        }
    };

    const openStudentModal = async () => {
        setLoadingStudents(true);
        const userSnapshot = await getDocs(collection(db, 'users'));
        const studentDocs = userSnapshot.docs.filter((uDoc) => uDoc.data()?.role === 'student');

        const scoresQuery = query(
            collection(db, stageCollection),
            where('season', '==', currentSeason)
        );
        const scoresSnap = await getDocs(scoresQuery);
        const scoreMap = new Map();

        scoresSnap.docs.forEach((scoreDoc) => {
            const data = scoreDoc.data();
            const studentId = data.studentId || scoreDoc.id.replace(`_${currentSeason}`, '');
            if (studentId) {
                scoreMap.set(studentId, data);
            }
        });

        const list = studentDocs.map((uDoc) => {
            const u = uDoc.data();
            const f = scoreMap.get(uDoc.id);
            let badge = null;
            if (f) {
                const present = SCORE_FIELDS.filter((k) => typeof f[k] === 'number').length;
                badge = present === SCORE_FIELDS.length ? 'scored' : present > 0 ? 'partial' : null;
            }
            return { label: u.fullname || 'Unnamed', value: uDoc.id, badge };
        });

        list.sort((a, b) => {
            const rank = { scored: 0, partial: 1, null: 2, undefined: 2 };
            const rA = rank[a.badge];
            const rB = rank[b.badge];
            return rA !== rB ? rA - rB : a.label.localeCompare(b.label);
        });

        setStudents(list);
        setLoadingStudents(false);
        setModalVisible(true);
    };

    // Stage-agnostic summary. Supports legacy mid docs that stored dhol1/dhol2
    // instead of a single dhol value.
    const computeStageSummary = (data) => {
        if (!data) return { dhol: null, dhwaj: null, tasha: null, maintenance: null, overall: null };
        let dhol = typeof data.dhol === 'number' ? data.dhol : null;
        if (dhol === null) {
            const hasD1 = typeof data.dhol1 === 'number';
            const hasD2 = typeof data.dhol2 === 'number';
            if (hasD1 && hasD2) dhol = (data.dhol1 + data.dhol2) / 2;
            else if (hasD1) dhol = data.dhol1;
            else if (hasD2) dhol = data.dhol2;
        }
        const dhwaj = typeof data.dhwaj === 'number' ? data.dhwaj : null;
        const tasha = typeof data.tasha === 'number' ? data.tasha : null;
        const maintenance = typeof data.maintenance === 'number' ? data.maintenance : null;
        const parts = [dhol, dhwaj, tasha, maintenance].filter((x) => typeof x === 'number' && !Number.isNaN(x));
        const overall = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
        return { dhol, dhwaj, tasha, maintenance, overall };
    };

    useEffect(() => {
        if (!selectedStudent) return;
        (async () => {
            const docId = `${selectedStudent}_${currentSeason}`;
            const ref = doc(db, stageCollection, docId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const f = snap.data();
                const next = emptyScores();
                const locked = {};
                SCORE_FIELDS.forEach((k) => {
                    next[k] = typeof f[k] === 'number' ? f[k].toString() : '';
                    locked[k] = typeof f[k] === 'number';
                });
                setScores(next);
                setLockedFields(locked);
                setSubmittedBy(f.submittedByName || null);
            } else {
                setScores(emptyScores());
                setLockedFields({});
                setSubmittedBy(null);
            }

            // While scoring Final, show the Mid-Season scores as reference.
            if (stage === 'final') {
                const midRef = doc(db, 'parikshanScores', docId);
                const midSnap = await getDoc(midRef);
                setMidSummary(computeStageSummary(midSnap.exists() ? midSnap.data() : null));
            }
        })();
    }, [selectedStudent, currentSeason, stage]);

    const handleScoreChange = (field, value) => {
        if (/^\d{0,2}(\.\d)?$/.test(value) && (+value <= 10)) {
            setScores((prev) => ({ ...prev, [field]: value }));
        }
    };

    const handleSave = async () => {
        if (!canScore) return showBanner('error', 'You do not have permission to score.');
        if (!selectedStudent) return showBanner('error', 'Please select a student');
        const adminName = auth.currentUser?.displayName || 'Admin';

        const seasonScopedId = `${selectedStudent}_${currentSeason}`;
        const ref = doc(db, stageCollection, seasonScopedId);
        const existing = await getDoc(ref);
        const existingData = existing.exists() ? existing.data() : {};

        const updates = {
            studentId: selectedStudent,
            season: currentSeason,
            updatedAt: new Date(),
            submittedByName: adminName,
        };

        // Only write fields that aren't already locked (set once, immutable here).
        SCORE_FIELDS.forEach((k) => {
            if (!(k in existingData) && scores[k] !== '') updates[k] = +scores[k];
        });

        try {
            await setDoc(ref, { ...existingData, ...updates });
            showBanner('success', `${STAGE_LABEL[stage]} scores saved!`);
            setLockedFields((prev) => {
                const nextLocked = { ...prev };
                SCORE_FIELDS.forEach((k) => { nextLocked[k] = prev[k] || k in updates; });
                return nextLocked;
            });
        } catch (e) {
            console.error(e);
            showBanner('error', 'Error saving scores');
        }
    };

    const debounce = (fn, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; };
    const [filteredStudents, setFilteredStudents] = useState([]);
    const handleSearch = useCallback(debounce((text) => {
        setFilteredStudents(students.filter((s) => s.label.toLowerCase().includes(text.toLowerCase())));
    }, 300), [students]);

    useEffect(() => { handleSearch(searchText); }, [searchText, students]);

    const allFieldsLocked = SCORE_FIELDS.every((k) => lockedFields[k]);

    return (
        <AppBackgroundWrapper>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Animatable.View animation="fadeInDown">
                        <LinearGradient
                            colors={colors.primaryGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.headerCard}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.smallTitle}>{STAGE_LABEL[stage]} Parikshan</Text>
                                <Text style={styles.subTitle}>Record season results with confidence</Text>
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>Season {currentSeason || '—'}</Text>
                            </View>
                        </LinearGradient>
                    </Animatable.View>

                    {isSuperAdmin ? (
                        <>
                            {/* Stage switch: admin can navigate either stage freely */}
                            <View style={styles.segment}>
                                {['mid', 'final'].map((s) => {
                                    const active = stage === s;
                                    return (
                                        <TouchableOpacity
                                            key={s}
                                            style={[styles.segmentItem, active && styles.segmentItemActive]}
                                            onPress={() => setStage(s)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                                                {STAGE_LABEL[s]}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Scoring window: which stage scorers are allowed to fill */}
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Scoring window (for scorers)</Text>
                                <Text style={styles.controlHint}>
                                    Open the stage scorers should fill. Tap the open stage again to close scoring.
                                </Text>
                                <View style={styles.stageButtonsRow}>
                                    {['mid', 'final'].map((s) => {
                                        const open = activeStage === s;
                                        return (
                                            <TouchableOpacity
                                                key={s}
                                                style={[styles.stageBtn, open && styles.stageBtnOpen]}
                                                onPress={() => updateActiveStage(s)}
                                                disabled={settingActive}
                                                activeOpacity={0.85}
                                            >
                                                <Text style={[styles.stageBtnText, open && styles.stageBtnTextOpen]}>
                                                    {STAGE_LABEL[s]}{open ? '  • Open' : ''}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <Text style={styles.controlStatus}>
                                    {activeStage ? `${STAGE_LABEL[activeStage]} scoring is OPEN for scorers.` : 'Scoring is closed for scorers.'}
                                </Text>
                            </View>

                            <TouchableOpacity style={[styles.releasePill, stageReleased && styles.releasePillActive]}
                                onPress={toggleReleaseResults} disabled={togglingRelease}>
                                <Text style={[styles.releaseText, stageReleased && styles.releaseTextActive]}>
                                    {stageReleased ? `${STAGE_LABEL[stage]} Results Released` : `${STAGE_LABEL[stage]} Results Hidden`}
                                </Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        // Scorers: locked to the admin-opened stage (no free switch)
                        activeStage ? (
                            <View style={styles.stageChip}>
                                <Text style={styles.stageChipText}>Scoring: {STAGE_LABEL[stage]} Parikshan</Text>
                            </View>
                        ) : (
                            <View style={styles.noticeCard}>
                                <Text style={styles.noticeText}>
                                    Scoring is not open yet. Please wait for the admin to start a parikshan.
                                </Text>
                            </View>
                        )
                    )}

                    {/* Only those who can actually score pick a student. */}
                    {canScore && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Student selection</Text>
                            <TouchableOpacity style={[styles.dropdownBtn, selectedStudentName ? styles.selectedStudentCard : {}]}
                                onPress={openStudentModal} activeOpacity={0.7}>
                                <View style={styles.dropdownContent}>
                                    <Text style={styles.dropdownText}>{selectedStudentName || 'Choose student'}</Text>
                                    <Text style={styles.dropdownIcon}>⌄</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Modal visible={modalVisible} animationType="slide">
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrapper}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select student</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Text style={styles.modalClose}>Close</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.modalBody}>
                                <TextInput
                                    placeholder="Search students"
                                    value={searchText}
                                    onChangeText={setSearchText}
                                    style={styles.searchInput}
                                    placeholderTextColor="#94a3b8"
                                />
                                {loadingStudents ? (
                                    <ActivityIndicator size="large" color={colors.primary} style={styles.loadingSpinner} />
                                ) : (
                                    <FlatList
                                        data={filteredStudents}
                                        keyExtractor={(item) => item.value}
                                        contentContainerStyle={styles.studentList}
                                        showsVerticalScrollIndicator={false}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity style={styles.studentItem} onPress={() => {
                                                setSelectedStudent(item.value);
                                                setSelectedStudentName(item.label);
                                                setModalVisible(false);
                                            }}>
                                                <View style={styles.studentRow}>
                                                    <Text style={styles.studentLabel}>{item.label}</Text>
                                                    {item.badge === 'scored' && (
                                                        <View style={styles.scoredBadge}>
                                                            <Text style={styles.studentBadgeText}>Scored</Text>
                                                        </View>
                                                    )}
                                                    {item.badge === 'partial' && (
                                                        <View style={styles.partialBadge}>
                                                            <Text style={styles.studentBadgeText}>Partial</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    />
                                )}
                            </View>
                        </KeyboardAvoidingView>
                    </Modal>

                    {submittedBy && (
                        <View style={styles.noticeCard}>
                            <Text style={styles.noticeText}>{STAGE_LABEL[stage]} scores submitted by {submittedBy}</Text>
                        </View>
                    )}

                    {canScore && selectedStudent && stage === 'final' && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Mid-Season reference</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Dhol</Text>
                                <Text style={styles.summaryValue}>{formatScore(midSummary.dhol, 1)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Dhwaj</Text>
                                <Text style={styles.summaryValue}>{formatScore(midSummary.dhwaj, 1)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Tasha</Text>
                                <Text style={styles.summaryValue}>{formatScore(midSummary.tasha, 1)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Maintenance</Text>
                                <Text style={styles.summaryValue}>{formatScore(midSummary.maintenance, 1)}</Text>
                            </View>
                            <View style={[styles.summaryRow, styles.summaryDivider]}>
                                <Text style={[styles.summaryLabel, styles.summaryTitleText]}>Overall Avg</Text>
                                <Text style={[styles.summaryValue, styles.summaryTitleText]}>{formatScore(midSummary.overall, 2)}</Text>
                            </View>
                            <Text style={styles.summaryNote}>Average of Dhol, Dhwaj, Tasha and Maintenance.</Text>
                        </View>
                    )}

                    {canScore ? (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>{STAGE_LABEL[stage]} score entry</Text>
                            <View style={styles.form}>
                                {SCORE_FIELDS.map((field) => {
                                    if (isScorer && !isSuperAdmin && lockedFields[field]) return null;
                                    const label = field.charAt(0).toUpperCase() + field.slice(1);
                                    return (
                                        <View key={field} style={styles.fieldBlock}>
                                            <Text style={styles.label}>{label} (out of 10)</Text>
                                            <TextInput
                                                style={[styles.input, lockedFields[field] && styles.inputDisabled]}
                                                keyboardType="numeric"
                                                value={scores[field]}
                                                editable={!lockedFields[field]}
                                                onChangeText={(v) => handleScoreChange(field, v)}
                                                placeholder="0 - 10"
                                                placeholderTextColor="#94a3b8"
                                            />
                                        </View>
                                    );
                                })}
                            </View>
                            <TouchableOpacity
                                style={[styles.saveButtonShadow, allFieldsLocked && styles.saveButtonShadowDisabled]}
                                onPress={handleSave}
                                disabled={allFieldsLocked}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={allFieldsLocked ? [colors.textMuted, colors.textMuted] : colors.primaryGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.saveButton}
                                >
                                    <Text style={styles.saveText}>
                                        {allFieldsLocked ? 'All Scores Locked' : `Save ${STAGE_LABEL[stage]} Scores`}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : isScorer ? null : (
                        <View style={styles.noticeCard}>
                            <Text style={styles.noticeText}>You have view-only access. Scoring is limited to designated scorers.</Text>
                        </View>
                    )}

                    {status.show && (
                        <Animatable.View animation="slideInUp" style={[styles.statusBanner, status.type === 'error' ? styles.error : styles.success]}>
                            <Text style={styles.statusText}>{status.text}</Text>
                        </Animatable.View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </AppBackgroundWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing['2xl'], paddingBottom: spacing['4xl'] },
    headerCard: {
        borderRadius: radius['2xl'],
        padding: spacing.xl,
        marginBottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...shadows.primary,
    },
    smallTitle: {
        color: colors.textOnPrimary,
        fontSize: 22,
        fontFamily: fonts.bold,
        marginBottom: 4,
    },
    subTitle: {
        color: '#E0E7FF',
        fontSize: 13,
        fontFamily: fonts.regular,
    },
    badge: {
        backgroundColor: 'rgba(255,255,255,0.22)',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: radius.full,
    },
    badgeText: {
        color: colors.textOnPrimary,
        fontSize: 12,
        fontFamily: fonts.semibold,
    },
    segment: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.lg,
        padding: 4,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    segmentItem: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: 'center',
    },
    segmentItemActive: {
        backgroundColor: colors.surface,
        ...shadows.sm,
    },
    segmentText: {
        fontSize: 14,
        fontFamily: fonts.semibold,
        color: colors.textMuted,
    },
    segmentTextActive: {
        color: colors.primaryDark,
    },
    controlHint: {
        fontSize: 12.5,
        fontFamily: fonts.regular,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    stageButtonsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    stageBtn: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    stageBtnOpen: {
        backgroundColor: colors.successSoft,
        borderColor: colors.success,
    },
    stageBtnText: {
        fontSize: 14,
        fontFamily: fonts.semibold,
        color: colors.textSecondary,
    },
    stageBtnTextOpen: {
        color: colors.successDark,
    },
    controlStatus: {
        marginTop: spacing.md,
        fontSize: 12.5,
        fontFamily: fonts.medium,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    stageChip: {
        alignSelf: 'center',
        backgroundColor: colors.primarySoft,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.full,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: '#c7d2fe',
    },
    stageChipText: {
        color: colors.primaryDark,
        fontSize: 13,
        fontFamily: fonts.semibold,
    },
    releasePill: {
        backgroundColor: colors.surface,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: '#c7d2fe',
        alignSelf: 'center',
        marginBottom: spacing.lg,
    },
    releasePillActive: {
        backgroundColor: colors.primarySoft,
        borderColor: '#a5b4fc',
    },
    releaseText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: fonts.semibold,
    },
    releaseTextActive: {
        color: colors.primaryDark,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius['2xl'],
        padding: spacing.xl,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.md,
    },
    cardTitle: {
        fontSize: 16,
        color: colors.text,
        fontFamily: fonts.semibold,
        marginBottom: spacing.md,
    },
    dropdownBtn: {
        backgroundColor: colors.surfaceMuted,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    selectedStudentCard: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    dropdownText: {
        fontSize: 16,
        fontFamily: fonts.medium,
        color: colors.text,
    },
    dropdownContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownIcon: {
        fontSize: 18,
        color: colors.textSecondary,
        marginLeft: 8,
    },
    modalWrapper: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
        paddingTop: 56,
        paddingHorizontal: spacing['2xl'],
        paddingBottom: spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    modalTitle: {
        fontSize: 20,
        color: colors.text,
        fontFamily: fonts.bold,
    },
    modalClose: {
        color: colors.primary,
        fontSize: 16,
        fontFamily: fonts.semibold,
    },
    modalBody: {
        flex: 1,
        paddingHorizontal: spacing['2xl'],
        paddingTop: spacing.xl,
    },
    searchInput: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.lg,
        padding: 14,
        marginBottom: spacing.lg,
        color: colors.text,
        fontFamily: fonts.regular,
        borderWidth: 1,
        borderColor: colors.border,
    },
    loadingSpinner: { marginTop: spacing['2xl'] },
    studentList: { paddingBottom: spacing['4xl'] },
    studentItem: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
    },
    studentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    studentLabel: {
        fontSize: 16,
        color: colors.text,
        fontFamily: fonts.medium,
    },
    scoredBadge: {
        backgroundColor: colors.successSoft,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.md,
    },
    partialBadge: {
        backgroundColor: colors.warningSoft,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.md,
    },
    studentBadgeText: {
        color: colors.text,
        fontSize: 12,
        fontFamily: fonts.semibold,
    },
    noticeCard: {
        backgroundColor: colors.primarySoft,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: '#c7d2fe',
    },
    noticeText: {
        color: colors.primaryDark,
        fontSize: 14,
        fontFamily: fonts.medium,
        textAlign: 'center',
    },
    summaryRow: {
        paddingVertical: spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderColor: colors.border,
    },
    summaryDivider: {
        borderTopWidth: 1,
        borderColor: colors.border,
        marginTop: spacing.md,
        paddingTop: spacing.md,
    },
    summaryLabel: {
        fontFamily: fonts.regular,
        color: colors.textSecondary,
        fontSize: 14,
    },
    summaryValue: {
        fontFamily: fonts.semibold,
        color: colors.text,
        fontSize: 14,
    },
    summaryTitleText: {
        color: colors.text,
        fontSize: 15,
    },
    summaryNote: {
        marginTop: spacing.md,
        color: colors.textMuted,
        fontSize: 12,
        fontFamily: fonts.regular,
    },
    form: { marginTop: spacing.sm },
    fieldBlock: { marginBottom: spacing.md },
    label: {
        fontSize: 14,
        fontFamily: fonts.semibold,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.lg,
        padding: 14,
        fontSize: 16,
        fontFamily: fonts.regular,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputDisabled: {
        opacity: 0.65,
        backgroundColor: colors.border,
    },
    saveButtonShadow: {
        marginTop: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: colors.primary,
        ...shadows.primary,
    },
    saveButtonShadowDisabled: {
        backgroundColor: colors.textMuted,
        shadowOpacity: 0,
        elevation: 0,
    },
    saveButton: {
        paddingVertical: 16,
        borderRadius: radius.lg,
        alignItems: 'center',
    },
    saveText: {
        color: colors.textOnPrimary,
        fontFamily: fonts.semibold,
        fontSize: 16,
    },
    statusBanner: {
        position: 'absolute',
        bottom: spacing['2xl'],
        left: spacing['2xl'],
        right: spacing['2xl'],
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderLeftWidth: 6,
        ...shadows.md,
        backgroundColor: colors.surface,
        zIndex: 100,
    },
    statusText: {
        fontSize: 15,
        textAlign: 'center',
        fontFamily: fonts.medium,
        color: colors.text,
    },
    error: { backgroundColor: colors.dangerSoft, borderLeftColor: colors.danger },
    success: { backgroundColor: colors.successSoft, borderLeftColor: colors.success },
});
