import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { auth, db } from '../firebase';
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    setDoc
} from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import ConfettiCannon from 'react-native-confetti-cannon';
import {
    useFonts,
    Poppins_600SemiBold,
    Poppins_400Regular,
} from '@expo-google-fonts/poppins';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';

export default function ProfileScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState({ show: false, type: '', text: '' });
    const [modalVisible, setModalVisible] = useState(false);

    // SINGLE release flag
    const [parikshanReleased, setParikshanReleased] = useState(false);

    const [showConfetti, setShowConfetti] = useState(false);

    const [fontsLoaded] = useFonts({
        Poppins_600SemiBold,
        Poppins_400Regular,
    });

    const computeFirstAverage = (data) => {
        if (!data) return { average: null, dholAvg: null, tasha: null, dhwaj: null, maintenance: null };
        let dholAvg = null;
        const hasD1 = typeof data.dhol1 === 'number';
        const hasD2 = typeof data.dhol2 === 'number';
        if (hasD1 && hasD2) dholAvg = (data.dhol1 + data.dhol2) / 2;
        else if (hasD1) dholAvg = data.dhol1;
        else if (hasD2) dholAvg = data.dhol2;

        const tasha = typeof data.tasha === 'number' ? data.tasha : null;
        const dhwaj = typeof data.dhwaj === 'number' ? data.dhwaj : null;
        const maintenance = typeof data.maintenance === 'number' ? data.maintenance : null;
        const parts = [dholAvg, tasha, dhwaj, maintenance].filter((x) => typeof x === 'number' && !Number.isNaN(x));
        const average = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
        return { average, dholAvg, tasha, dhwaj, maintenance };
    };

    const computeFinalAverage = (data) => {
        if (!data) return { average: null, dhol: null, dhwaj: null, tasha: null };
        const dhol = typeof data.dhol === 'number' ? data.dhol : null;
        const dhwaj = typeof data.dhwaj === 'number' ? data.dhwaj : null;
        const tasha = typeof data.tasha === 'number' ? data.tasha : null;
        const parts = [dhol, dhwaj, tasha].filter((x) => typeof x === 'number' && !Number.isNaN(x));
        const average = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
        return { average, dhol, dhwaj, tasha };
    };

    useEffect(() => {
        const loadUser = async () => {
            try {
                const uid = auth.currentUser.uid;
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);

                // SINGLE release flag
                const settingsRef = doc(db, 'globalConfig', 'parikshanSettings');
                const settingsSnap = await getDoc(settingsRef);
                const isReleased = settingsSnap.exists() && settingsSnap.data().parikshanReleased === true;
                setParikshanReleased(isReleased);

                if (userSnap.exists()) {
                    const userData = userSnap.data();

                    const attendanceQuery = query(collection(db, 'attendance'), where('studentId', '==', uid));
                    const attendanceSnap = await getDocs(attendanceQuery);
                    const sessionsSnap = await getDocs(collection(db, 'sessions'));
                    const sessionCount = sessionsSnap.size;

                    // FIRST
                    const firstRef = doc(db, 'parikshanScores', uid);
                    const firstSnap = await getDoc(firstRef);
                    const firstData = firstSnap.exists() ? firstSnap.data() : null;
                    const {
                        average: firstAverage,
                        dholAvg: firstDholAvg,
                        tasha: firstTasha,
                        dhwaj: firstDhwaj,
                        maintenance: firstMaintenance,
                    } = computeFirstAverage(firstData);

                    // FINAL
                    const finalRef = doc(db, 'finalParikshanScores', uid);
                    const finalSnap = await getDoc(finalRef);
                    const finalData = finalSnap.exists() ? finalSnap.data() : null;
                    const {
                        average: finalAverage,
                        dhol: finalDhol,
                        dhwaj: finalDhwaj,
                        tasha: finalTasha,
                    } = computeFinalAverage(finalData);

                    // Combined (if both exist)
                    let combinedAverage = null;
                    if (typeof firstAverage === 'number' && typeof finalAverage === 'number') {
                        combinedAverage = (firstAverage + finalAverage) / 2;
                    }

                    // Confetti: first time combined becomes visible (single flag)
                    let shouldShowConfetti = false;
                    const combinedIsVisible = isReleased && typeof combinedAverage === 'number';
                    if (combinedIsVisible && !userData?.confettiCombinedShown) {
                        shouldShowConfetti = true;
                        await setDoc(userRef, { confettiCombinedShown: true }, { merge: true });
                    }

                    setUser({
                        ...userData,
                        id: uid,
                        attendanceCount: attendanceSnap.size,
                        sessionsCount: sessionCount,

                        averageFirst: firstAverage,
                        averageFinal: finalAverage,
                        combinedAverage,

                        detailedFirst: firstData || {},
                        detailedFinal: finalData || {},

                        firstDholAvg,
                        firstTasha,
                        firstDhwaj,
                        firstMaintenance,

                        finalDhol,
                        finalDhwaj,
                        finalTasha,
                    });

                    if (shouldShowConfetti) {
                        setTimeout(() => setShowConfetti(true), 1000);
                    }
                }
            } catch (error) {
                console.error('Failed to load user data:', error);
                showBanner('error', 'Failed to load profile.');
            }
        };

        loadUser();
    }, []);

    const showBanner = (type, text) => {
        setStatus({ show: true, type, text });
        setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
    };

    if (!fontsLoaded || !user) return null;

    // visibility with one flag
    const canShowFirst = parikshanReleased && typeof user.averageFirst === 'number';
    const canShowFinal = parikshanReleased && typeof user.averageFinal === 'number';
    const canShowCombined = parikshanReleased && typeof user.averageFirst === 'number' && typeof user.averageFinal === 'number';

    const displayValue = canShowCombined
        ? user.combinedAverage
        : canShowFirst
            ? user.averageFirst
            : canShowFinal
                ? user.averageFinal
                : null;

    const hasScoresToShow = displayValue != null;

    return (
        <AppBackgroundWrapper>
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Animatable.View animation="fadeInUp" delay={100} style={styles.container}>
                    <View style={styles.header}>
                        <Icon name="person-circle-outline" size={90} color="#1E3A8A" />
                        <Text style={styles.name}>{user.fullname}</Text>
                        <Text style={styles.text}>{user.email}</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Total Attendance</Text>
                        <Text style={styles.cardValue}>{user.attendanceCount ?? '0'} out of {user.sessionsCount}</Text>
                        <Text style={styles.cardLabel}>Attendance %</Text>
                        <Text style={styles.cardValue}>
                            {user.attendanceCount > 0
                                ? `${((user.attendanceCount / user.sessionsCount) * 100).toFixed(1)}%`
                                : '0%'}
                        </Text>
                        <Text style={styles.amberNote}>
                            Note: 80% attendance is required for event allocations.
                        </Text>
                    </View>

                    {/* Pending / No score banners */}
                    {!parikshanReleased && (
                        <Animatable.View animation="fadeInDown" duration={500} style={styles.pendingBanner}>
                            <Text style={styles.pendingText}>🎓 Parikshan results will be available soon.</Text>
                        </Animatable.View>
                    )}

                    {parikshanReleased && !hasScoresToShow && (
                        <Animatable.View animation="fadeInDown" duration={500} style={styles.pendingBanner}>
                            <Text style={styles.pendingText}>No scores available.</Text>
                            <Text style={styles.pendingSubText}>Please contact your Lead/Season Manager if this seems incorrect.</Text>
                        </Animatable.View>
                    )}

                    {/* Scores */}
                    {parikshanReleased && hasScoresToShow && (
                        <>
                            <TouchableOpacity style={[styles.card, styles.releasedScoreCard]} onPress={() => setModalVisible(true)} activeOpacity={0.7}>
                                <Text style={styles.cardLabel}>
                                    {canShowCombined ? 'Parikshan Score (Combined: First + Final)' : canShowFirst ? 'Parikshan Score (First)' : 'Parikshan Score (Final)'}
                                </Text>
                                <View style={styles.cardRow}>
                                    <Text style={styles.cardValue}>{displayValue.toFixed(1)} / 10</Text>
                                    <Icon name="chevron-forward-outline" size={20} color="#64748b" />
                                </View>
                                <Text style={styles.amberNote}>
                                    First uses Dhol Avg, Tasha, Dhwaj, Maintenance. Final uses Dhol, Dhwaj, (optional) Tasha.
                                </Text>
                            </TouchableOpacity>

                            {showConfetti && (
                                <ConfettiCannon count={50} origin={{ x: 200, y: -20 }} fadeOut explosionSpeed={300} />
                            )}
                        </>
                    )}

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

                    {/* Modal Breakdown */}
                    <Modal visible={modalVisible} transparent animationType="slide">
                        <View style={styles.modalBackdrop}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Parikshan Breakdown</Text>

                                {/* First */}
                                <Text style={[styles.modalSectionTitle]}>First Parikshan</Text>
                                <Text style={styles.modalItem}>
                                    Dhol (Avg): {typeof user.firstDholAvg === 'number' ? `${user.firstDholAvg.toFixed(1)} / 10` : 'N/A'}
                                </Text>
                                <Text style={styles.modalItem}>
                                    Tasha: {typeof user.firstTasha === 'number' ? `${user.firstTasha} / 10` : 'N/A'}
                                </Text>
                                <Text style={styles.modalItem}>
                                    Dhwaj: {typeof user.firstDhwaj === 'number' ? `${user.firstDhwaj} / 10` : 'N/A'}
                                </Text>
                                <Text style={styles.modalItem}>
                                    Maintenance: {typeof user.firstMaintenance === 'number' ? `${user.firstMaintenance} / 10` : 'N/A'}
                                </Text>
                                <Text style={[styles.modalItem, styles.modalEm]}>
                                    First Avg: {typeof user.averageFirst === 'number' ? `${user.averageFirst.toFixed(1)} / 10` : 'N/A'}
                                </Text>

                                <View style={{ height: 12 }} />

                                {/* Final */}
                                <Text style={[styles.modalSectionTitle]}>Final Parikshan</Text>
                                <Text style={styles.modalItem}>
                                    Dhol: {typeof user.finalDhol === 'number' ? `${user.finalDhol} / 10` : 'N/A'}
                                </Text>
                                <Text style={styles.modalItem}>
                                    Dhwaj: {typeof user.finalDhwaj === 'number' ? `${user.finalDhwaj} / 10` : 'N/A'}
                                </Text>
                                <Text style={styles.modalItem}>
                                    Tasha: {typeof user.finalTasha === 'number' ? `${user.finalTasha} / 10` : 'N/A'}
                                </Text>
                                <Text style={[styles.modalItem, styles.modalEm]}>
                                    Final Avg: {typeof user.averageFinal === 'number' ? `${user.averageFinal.toFixed(1)} / 10` : 'N/A'}
                                </Text>

                                <View style={{ height: 12 }} />

                                {/* Combined */}
                                <Text style={[styles.modalSectionTitle]}>Combined</Text>
                                <Text style={[styles.modalItem, styles.modalEm]}>
                                    {(typeof user.combinedAverage === 'number')
                                        ? `Combined Avg: ${user.combinedAverage.toFixed(1)} / 10`
                                        : 'Combined Avg: N/A'}
                                </Text>

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
        </AppBackgroundWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
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
        backgroundColor: '#f1f5f9',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
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