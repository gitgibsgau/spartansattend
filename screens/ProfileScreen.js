import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import {
    doc,
    getDoc,
    onSnapshot,
    collection,
    query,
    where,
    getDocs,
    setDoc
} from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSeason } from '../contexts/SeasonContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { tallyStreaks, computeBadges } from '../utils/streaks';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { Avatar } from '../components/ui/Avatar';
import ProgressRing from '../components/ui/ProgressRing';
import { colors, spacing, radius, fonts, shadows } from '../theme';

// Safely format numbers everywhere (prevents .toFixed on null/undefined)
const formatScore = (v, digits = 1) =>
    typeof v === 'number' && !Number.isNaN(v) ? v.toFixed(digits) : 'N/A';

export default function ProfileScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState({ show: false, type: '', text: '' });
    const [modalVisible, setModalVisible] = useState(false);

    // Season + per-stage release flags (centralized)
    const { currentSeason, midReleased, finalReleased } = useSeason();
    const { unreadCount } = useNotifications();
    const insets = useSafeAreaInsets();

    const [showConfetti, setShowConfetti] = useState(false);

    // ---- helpers ----
    // Mid-season average. Supports new docs ({dhol,dhwaj,tasha,maintenance}) and
    // legacy docs that stored dhol1/dhol2 instead of a single dhol.
    const computeFirstAverage = (data) => {
        if (!data) return { average: null, dholAvg: null, tasha: null, dhwaj: null, maintenance: null };

        let dholAvg = typeof data.dhol === 'number' ? data.dhol : null;
        if (dholAvg === null) {
            const hasD1 = typeof data.dhol1 === 'number';
            const hasD2 = typeof data.dhol2 === 'number';
            if (hasD1 && hasD2) dholAvg = (data.dhol1 + data.dhol2) / 2;
            else if (hasD1) dholAvg = data.dhol1;
            else if (hasD2) dholAvg = data.dhol2;
        }

        const tasha = typeof data.tasha === 'number' ? data.tasha : null;
        const dhwaj = typeof data.dhwaj === 'number' ? data.dhwaj : null;
        const maintenance = typeof data.maintenance === 'number' ? data.maintenance : null;

        const parts = [dholAvg, tasha, dhwaj, maintenance].filter(
            (x) => typeof x === 'number' && !Number.isNaN(x)
        );
        const average = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;

        return { average, dholAvg, tasha, dhwaj, maintenance };
    };

    const computeFinalAverage = (data) => {
        if (!data) return { average: null, dhol: null, dhwaj: null, tasha: null, maintenance: null };

        const dhol = typeof data.dhol === 'number' ? data.dhol : null;
        const dhwaj = typeof data.dhwaj === 'number' ? data.dhwaj : null;
        const tasha = typeof data.tasha === 'number' ? data.tasha : null;
        const maintenance = typeof data.maintenance === 'number' ? data.maintenance : null;

        const parts = [dhol, dhwaj, tasha, maintenance].filter(
            (x) => typeof x === 'number' && !Number.isNaN(x)
        );
        const average = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;

        return { average, dhol, dhwaj, tasha, maintenance };
    };

    // Live listener for the core user doc. Profile info (name, instrument,
    // device, avatar) always reflects server truth and is never blanked by a
    // transient read or by a failure in the multi-read stats load below. The
    // field guard ignores empty/partial emissions so good data is never wiped.
    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const unsub = onSnapshot(
            doc(db, 'users', uid),
            (snap) => {
                const data = snap.data();
                if (data && (data.fullname || data.email || data.role)) {
                    setUser((prev) => ({ ...prev, ...data, id: uid }));
                }
            },
            (err) => console.warn('Profile user snapshot error:', err)
        );
        return unsub;
    }, []);

    useFocusEffect(
        useCallback(() => {
        const loadUser = async () => {
            try {
                const uid = auth.currentUser.uid;
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data();

                    // attendance filtered by season
                    const attendanceQueryRef = query(
                        collection(db, 'attendance'),
                        where('studentId', '==', uid),
                        where('season', '==', currentSeason)
                    );
                    const attendanceSnap = await getDocs(attendanceQueryRef);
                    
                    // sessions filtered by season
                    const sessionsQueryRef = query(
                        collection(db, 'sessions'),
                        where('season', '==', currentSeason)
                    );
                    const sessionsSnap = await getDocs(sessionsQueryRef);
                    const sessionCount = sessionsSnap.size;

                    // FIRST parikshan - doc ID includes season
                    const firstRef = doc(db, 'parikshanScores', `${uid}_${currentSeason}`);
                    const firstSnap = await getDoc(firstRef);
                    const firstData = firstSnap.exists() ? firstSnap.data() : null;
                    const {
                        average: firstAverage,
                        dholAvg: firstDholAvg,
                        tasha: firstTasha,
                        dhwaj: firstDhwaj,
                        maintenance: firstMaintenance,
                    } = computeFirstAverage(firstData);

                    // FINAL parikshan - doc ID includes season
                    const finalRef = doc(db, 'finalParikshanScores', `${uid}_${currentSeason}`);
                    const finalSnap = await getDoc(finalRef);
                    const finalData = finalSnap.exists() ? finalSnap.data() : null;
                    const {
                        average: finalAverage,
                        dhol: finalDhol,
                        dhwaj: finalDhwaj,
                        tasha: finalTasha,
                        maintenance: finalMaintenance,
                    } = computeFinalAverage(finalData);

                    // Weighted (40% Mid + 60% Final) — treat missing side as 0
                    const firstComponent = typeof firstAverage === 'number' ? firstAverage : 0;
                    const finalComponent = typeof finalAverage === 'number' ? finalAverage : 0;
                    const weightedAverage = firstComponent * 0.4 + finalComponent * 0.6;

                    // Confetti the first time any released stage has a score to show.
                    const anyExists = typeof firstAverage === 'number' || typeof finalAverage === 'number';
                    const anyReleased = midReleased || finalReleased;
                    let shouldShowConfetti = false;
                    if (anyReleased && anyExists && !userData?.confettiCombinedShown) {
                        shouldShowConfetti = true;
                        await setDoc(userRef, { confettiCombinedShown: true }, { merge: true });
                    }

                    // Count events this student has RSVP'd "Going" to this season.
                    let goingEventsCount = 0;
                    try {
                        const evSnap = await getDocs(
                            query(collection(db, 'events'), where('season', '==', currentSeason))
                        );
                        const rsvpChecks = await Promise.all(
                            evSnap.docs.map(async (evDoc) => {
                                const rsvpSnap = await getDoc(doc(db, 'events', evDoc.id, 'rsvps', uid));
                                return rsvpSnap.exists() && rsvpSnap.data().status === 'going';
                            })
                        );
                        goingEventsCount = rsvpChecks.filter(Boolean).length;
                    } catch (e) {
                        console.error('Failed to count RSVPs:', e);
                    }

                    // Attendance streak (reuse the snaps already fetched above).
                    const attendedIds = new Set(
                        attendanceSnap.docs.map((d) => d.data().sessionId)
                    );
                    const sessionsForStreak = sessionsSnap.docs.map((d) => ({
                        id: d.id,
                        ts: d.data().timestamp?.seconds ? d.data().timestamp.seconds * 1000 : 0,
                    }));
                    const { currentStreak, longestStreak } = tallyStreaks(
                        sessionsForStreak,
                        attendedIds
                    );

                    setUser((prev) => ({
                        ...prev,
                        ...userData,
                        id: uid,
                        attendanceCount: attendanceSnap.size,
                        currentStreak,
                        longestStreak,
                        goingEventsCount,
                        sessionsCount: sessionCount,

                        averageFirst: firstAverage,
                        averageFinal: finalAverage,
                        weightedAverage,

                        detailedFirst: firstData || {},
                        detailedFinal: finalData || {},

                        firstDholAvg,
                        firstTasha,
                        firstDhwaj,
                        firstMaintenance,

                        finalDhol,
                        finalDhwaj,
                        finalTasha,
                        finalMaintenance,
                    }));

                    if (shouldShowConfetti) {
                        setTimeout(() => setShowConfetti(true), 1000);
                        setTimeout(() => setShowConfetti(true), 4000);
                    }
                }
            } catch (error) {
                console.error('Failed to load user data:', error);
                showBanner('error', 'Failed to load profile.');
            }
        };

        // Guard + depend on currentSeason: on first render currentSeason is the
        // fallback year (set before the globalConfig snapshot resolves). Running
        // the query then would use a stale/mismatched season and return 0 docs.
        // Re-run once the real season is available (matches AttendanceViewScreen).
        if (currentSeason) loadUser();
        }, [currentSeason, midReleased, finalReleased])
    );

    const showBanner = (type, text) => {
        setStatus({ show: true, type, text });
        setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
    };

    if (!user) return null;

    // Per-stage display:
    //  • Once Final is released, show the weighted (40% Mid / 60% Final) score.
    //  • Otherwise, if only Mid is released, show the Mid-Season score alone.
    const hasFirst = typeof user.averageFirst === 'number';
    const hasFinal = typeof user.averageFinal === 'number';
    const anyReleased = midReleased || finalReleased;

    let scoreView = null;
    if (finalReleased && (hasFirst || hasFinal)) {
        scoreView = {
            label: 'Parikshan Score (Weighted: 40% Mid • 60% Final)',
            value: user.weightedAverage,
            note: 'Missing either parikshan is counted as 0 for weighting.',
        };
    } else if (midReleased && hasFirst) {
        scoreView = {
            label: 'Mid-Season Parikshan Score',
            value: user.averageFirst,
            note: 'Final parikshan results will be added later in the season.',
        };
    }
    const hasScoresToShow = !!scoreView;

    // ---- Attendance eligibility (80% needed for event allocations) ----
    const attended = user.attendanceCount || 0;
    const totalSessions = user.sessionsCount || 0;
    const attendanceRatio = totalSessions > 0 ? attended / totalSessions : 0;
    const attendancePct = Math.round(attendanceRatio * 100);
    const isEligible = totalSessions > 0 && attendanceRatio >= 0.8;
    const sessionsToQualify =
        totalSessions > 0 ? Math.max(0, Math.ceil(0.8 * totalSessions) - attended) : 0;

    // ---- Streak & badges ----
    const badges = computeBadges({
        attended,
        total: totalSessions,
        longestStreak: user.longestStreak || 0,
        joinedYear: user.joinedYear || null,
        currentSeason,
    });
    const earnedBadges = badges.filter((b) => b.earned).length;
    const currentStreak = user.currentStreak || 0;

    return (
        <AppBackgroundWrapper>
            <ScrollView
                contentContainerStyle={[styles.scrollContainer, { paddingTop: insets.top + spacing.lg }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Animatable.View animation="fadeInUp" delay={100} style={styles.container}>
                    <View style={styles.header}>
                        <Avatar name={user.fullname} color={user.avatarColor} size={96} />
                        <Text style={styles.name}>{user.fullname}</Text>
                        <Text style={styles.text}>{user.email}</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Attendance</Text>
                        <View style={styles.trackerRow}>
                            <ProgressRing
                                size={104}
                                strokeWidth={11}
                                progress={attendanceRatio}
                                gradient={isEligible ? [colors.success, '#34D399'] : colors.primaryGradient}
                                centerLabel={`${attendancePct}%`}
                                centerSubLabel={`${attended}/${totalSessions}`}
                            />
                            <View style={styles.trackerInfo}>
                                <View
                                    style={[
                                        styles.eligibilityPill,
                                        { backgroundColor: isEligible ? colors.successSoft : colors.warningSoft },
                                    ]}
                                >
                                    <Icon
                                        name={isEligible ? 'checkmark-circle' : 'alert-circle'}
                                        size={16}
                                        color={isEligible ? colors.successDark : colors.warning}
                                    />
                                    <Text
                                        style={[
                                            styles.eligibilityText,
                                            { color: isEligible ? colors.successDark : colors.warning },
                                        ]}
                                    >
                                        {isEligible ? 'Eligible for events' : 'Not yet eligible'}
                                    </Text>
                                </View>
                                <Text style={styles.trackerHint}>
                                    {totalSessions === 0
                                        ? 'No sessions this season yet.'
                                        : isEligible
                                            ? `You've attended ${attended} of ${totalSessions} sessions. Keep it up!`
                                            : `Attend ${sessionsToQualify} more ${sessionsToQualify === 1 ? 'session' : 'sessions'} to reach 80%.`}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.amberNote}>
                            Note: 80% attendance is required for event allocations.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('Achievements')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cardLabel}>Streak & Badges</Text>
                        <View style={styles.cardRow}>
                            <View style={styles.streakRow}>
                                <Icon
                                    name="flame"
                                    size={22}
                                    color={currentStreak > 0 ? '#F97316' : colors.textMuted}
                                />
                                <Text style={styles.streakValue}>
                                    {currentStreak} {currentStreak === 1 ? 'session' : 'sessions'} · {earnedBadges}/{badges.length} badges
                                </Text>
                            </View>
                            <Icon name="chevron-forward-outline" size={20} color="#64748b" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('Events')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cardLabel}>My Events</Text>
                        <View style={styles.cardRow}>
                            <Text style={styles.cardValue}>
                                {user.goingEventsCount || 0} {user.goingEventsCount === 1 ? 'event' : 'events'} going
                            </Text>
                            <Icon name="chevron-forward-outline" size={20} color="#64748b" />
                        </View>
                    </TouchableOpacity>

                    {/* Pending / No score banners */}
                    {!anyReleased && (
                        <Animatable.View animation="fadeInDown" duration={500} style={styles.pendingBanner}>
                            <Text style={styles.pendingText}>🎓 Parikshan results will be available soon.</Text>
                        </Animatable.View>
                    )}

                    {anyReleased && !hasScoresToShow && (
                        <Animatable.View animation="fadeInDown" duration={500} style={styles.pendingBanner}>
                            <Text style={styles.pendingText}>No scores available.</Text>
                            <Text style={styles.pendingSubText}>Please contact your Lead/Season Manager if this seems incorrect.</Text>
                        </Animatable.View>
                    )}

                    {/* Stage-aware score card: Mid-only or Weighted (Mid+Final). */}
                    {hasScoresToShow && (
                        <>
                            <TouchableOpacity
                                style={[styles.card, styles.releasedScoreCard]}
                                onPress={() => setModalVisible(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cardLabel}>
                                    {scoreView.label}
                                </Text>
                                <View style={styles.cardRow}>
                                    <Text style={styles.cardValue}>{formatScore(scoreView.value, 1)} / 10</Text>
                                    <Icon name="chevron-forward-outline" size={20} color="#64748b" />
                                </View>
                                {scoreView.note && (
                                    <Text style={styles.amberNote}>
                                        {scoreView.note}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {showConfetti && (
                                <>
                                    <ConfettiCannon
                                        count={80}
                                        origin={{ x: 200, y: -20 }}
                                        fadeOut
                                        explosionSpeed={350}
                                        fallSpeed={2500}
                                    />
                                    <ConfettiCannon
                                        count={80}
                                        origin={{ x: 50, y: -20 }}
                                        fadeOut
                                        explosionSpeed={350}
                                        fallSpeed={2500}
                                    />
                                </>
                            )}
                        </>
                    )}

                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Instrument</Text>
                        <View style={styles.cardRow}>
                            <Text style={styles.cardValue}>
                                {Array.isArray(user.instrument)
                                    ? (user.instrument.length ? user.instrument.join(' + ') : 'Not set')
                                    : (user.instrument || 'Not set')}
                            </Text>
                            <Icon name="musical-notes-outline" size={20} color={colors.primary} />
                        </View>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Device</Text>
                        <Text style={styles.cardValue}>{user.deviceId || 'N/A'}</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Joined</Text>
                        <Text style={styles.cardValue}>
                            {user.createdAt
                                ? new Date(user.createdAt).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })
                                : 'N/A'}
                        </Text>
                    </View>

                    {(!!user.emergencyContactName || !!user.emergencyContactPhone) && (
                        <View style={styles.card}>
                            <Text style={styles.cardLabel}>Emergency Contact</Text>
                            <Text style={styles.cardValue}>
                                {user.emergencyContactName || 'N/A'}
                            </Text>
                            {!!user.emergencyContactPhone && (
                                <Text style={styles.text}>{user.emergencyContactPhone}</Text>
                            )}
                        </View>
                    )}

                    {/* Modal Breakdown */}
                    <Modal visible={modalVisible} transparent animationType="slide">
                        <View style={styles.modalBackdrop}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Parikshan Breakdown</Text>

                                {/* Mid-Season (shown once mid is released) */}
                                {midReleased && (
                                    <>
                                        <Text style={[styles.modalSectionTitle]}>Mid-Season Parikshan</Text>
                                        <Text style={styles.modalItem}>
                                            Dhol: {typeof user.firstDholAvg === 'number' ? `${formatScore(user.firstDholAvg, 1)} / 10` : 'N/A'}
                                        </Text>
                                        <Text style={styles.modalItem}>
                                            Dhwaj: {typeof user.firstDhwaj === 'number' ? `${formatScore(user.firstDhwaj, 1)} / 10` : 'N/A'}
                                        </Text>
                                        <Text style={styles.modalItem}>
                                            Tasha: {typeof user.firstTasha === 'number' ? `${formatScore(user.firstTasha, 1)} / 10` : 'N/A'}
                                        </Text>
                                        <Text style={styles.modalItem}>
                                            Maintenance: {typeof user.firstMaintenance === 'number' ? `${formatScore(user.firstMaintenance, 1)} / 10` : 'N/A'}
                                        </Text>
                                        <Text style={[styles.modalItem, styles.modalEm]}>
                                            Mid-Season Avg: {typeof user.averageFirst === 'number' ? `${formatScore(user.averageFirst, 1)} / 10` : 'N/A'}
                                        </Text>
                                        <View style={{ height: 12 }} />
                                    </>
                                )}

                                {/* Final + Weighted (shown once final is released) */}
                                {finalReleased && (
                                    <>
                                        <Text style={[styles.modalSectionTitle]}>Final Parikshan</Text>
                                        <Text style={styles.modalItem}>
                                            Dhol: {typeof user.finalDhol === 'number' ? `${formatScore(user.finalDhol, 1)} / 10` : 'N/A'}
                                        </Text>
                                        <Text style={styles.modalItem}>
                                            Dhwaj: {typeof user.finalDhwaj === 'number' ? `${formatScore(user.finalDhwaj, 1)} / 10` : 'N/A'}
                                        </Text>
                                        <Text style={styles.modalItem}>
                                            Tasha: {typeof user.finalTasha === 'number' ? `${formatScore(user.finalTasha, 1)} / 10` : 'N/A'}
                                        </Text>
                                        <Text style={styles.modalItem}>
                                            Maintenance: {typeof user.finalMaintenance === 'number' ? `${formatScore(user.finalMaintenance, 1)} / 10` : 'N/A'}
                                        </Text>
                                        <Text style={[styles.modalItem, styles.modalEm]}>
                                            Final Avg: {typeof user.averageFinal === 'number' ? `${formatScore(user.averageFinal, 1)} / 10` : 'N/A'}
                                        </Text>

                                        <View style={{ height: 12 }} />

                                        <Text style={[styles.modalSectionTitle]}>Overall (Weighted)</Text>
                                        <Text style={[styles.modalItem, styles.modalEm]}>
                                            Weighted Avg (40/60): {formatScore(user.weightedAverage, 1)} / 10
                                        </Text>
                                        <Text style={[styles.modalItem]}>{`(Mid contributes ${formatScore(
                                            typeof user.averageFirst === 'number' ? user.averageFirst * 0.4 : 0,
                                            1
                                        )}, Final contributes ${formatScore(
                                            typeof user.averageFinal === 'number' ? user.averageFinal * 0.6 : 0,
                                            1
                                        )})`}</Text>
                                    </>
                                )}

                                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.modalCloseText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {status.show && (
                        <Animatable.View
                            animation="slideInUp"
                            style={[
                                styles.statusBanner,
                                status.type === 'error' ? styles.error : styles.success,
                            ]}
                        >
                            <Text style={styles.statusText}>{status.text}</Text>
                        </Animatable.View>
                    )}
                </Animatable.View>
            </ScrollView>

            <TouchableOpacity
                style={[styles.bellFab, { top: insets.top + spacing.sm }]}
                onPress={() => navigation.navigate('Notifications')}
                activeOpacity={0.7}
                accessibilityLabel="Notifications"
            >
                <Icon name="notifications-outline" size={22} color={colors.primary} />
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.editFab, { top: insets.top + spacing.sm }]}
                onPress={() => navigation.navigate('EditProfile')}
                activeOpacity={0.7}
                accessibilityLabel="Edit profile"
            >
                <Icon name="create-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
        </AppBackgroundWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingTop: 24,
        paddingBottom: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    editFab: {
        position: 'absolute',
        right: spacing.xl,
        width: 42,
        height: 42,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.md,
    },
    bellFab: {
        position: 'absolute',
        left: spacing.xl,
        width: 42,
        height: 42,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.md,
    },
    badge: {
        position: 'absolute',
        top: -3,
        right: -3,
        minWidth: 18,
        height: 18,
        borderRadius: radius.full,
        paddingHorizontal: 4,
        backgroundColor: colors.danger,
        borderWidth: 1.5,
        borderColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        fontSize: 10,
        fontFamily: fonts.bold,
        color: '#fff',
    },
    name: {
        fontSize: 24,
        fontFamily: 'Poppins_600SemiBold',
        color: '#1e293b',
        marginTop: 8,
    },
    text: {
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        color: '#64748b',
        marginTop: 2,
    },
    card: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 18,
        shadowColor: '#0f172a',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 18,
        elevation: 4,
        marginBottom: 24,
    },
    cardLabel: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: '#475569',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 18,
        fontFamily: 'Poppins_600SemiBold',
        color: '#1e293b',
        marginBottom: 8,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    streakRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    streakValue: {
        fontSize: 17,
        fontFamily: 'Poppins_600SemiBold',
        color: '#1e293b',
    },
    trackerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
    },
    trackerInfo: {
        flex: 1,
        marginLeft: spacing.lg,
    },
    eligibilityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: radius.full,
        marginBottom: spacing.sm,
    },
    eligibilityText: {
        fontFamily: fonts.semibold,
        fontSize: 12.5,
        marginLeft: 5,
    },
    trackerHint: {
        fontFamily: fonts.regular,
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 19,
    },
    pendingBanner: {
        width: '100%',
        backgroundColor: '#fff7ed',
        borderLeftColor: '#f97316',
        borderLeftWidth: 6,
        padding: 12,
        borderRadius: 10,
        marginBottom: 24,
    },
    pendingText: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: '#92400e',
        textAlign: 'center',
    },
    pendingSubText: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#475569',
        marginTop: 4,
        textAlign: 'center',
    },
    statusBanner: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        padding: 12,
        borderRadius: 10,
        borderLeftWidth: 6,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
        zIndex: 100,
        backgroundColor: '#fff',
    },
    statusText: {
        fontSize: 15,
        fontFamily: 'Poppins_400Regular',
        textAlign: 'center',
    },
    error: {
        backgroundColor: '#fee2e2',
        borderLeftColor: '#dc2626',
    },
    success: {
        backgroundColor: '#d1fae5',
        borderLeftColor: '#059669',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        width: '80%',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: 'Poppins_600SemiBold',
        marginBottom: 12,
        color: '#1e293b',
    },
    modalSectionTitle: {
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
        color: '#1e293b',
        marginTop: 8,
        marginBottom: 4,
        alignSelf: 'flex-start',
    },
    modalItem: {
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        color: '#334155',
        marginVertical: 2,
        alignSelf: 'flex-start',
    },
    modalEm: {
        fontFamily: 'Poppins_600SemiBold',
    },
    modalCloseButton: {
        marginTop: 16,
        backgroundColor: '#4f46e5',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    modalCloseText: {
        color: '#fff',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 16,
    },
    amberNote: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#b45309',
        marginTop: 8,
    },
    releasedScoreCard: {
        backgroundColor: '#e0f2fe',
        borderLeftWidth: 4,
        borderLeftColor: '#0284c7',
    },
    scrollContainer: {
        paddingBottom: 80,
        paddingHorizontal: 24,
    },
});