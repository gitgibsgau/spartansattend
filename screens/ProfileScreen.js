import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { auth, db } from '../firebase';
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
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
    const [parikshanReleased, setParikshanReleased] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    const [fontsLoaded] = useFonts({
        Poppins_600SemiBold,
        Poppins_400Regular,
    });

    useEffect(() => {
        const loadUser = async () => {
            try {
                const uid = auth.currentUser.uid;
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);

                const settingsRef = doc(db, 'globalConfig', 'parikshanSettings');
                const settingsSnap = await getDoc(settingsRef);
                const isReleased = settingsSnap.exists() && settingsSnap.data().parikshanReleased === true;
                setParikshanReleased(isReleased);

                if (userSnap.exists()) {
                    const userData = userSnap.data();

                    const attendanceQuery = query(
                        collection(db, 'attendance'),
                        where('studentId', '==', uid)
                    );
                    const attendanceSnap = await getDocs(attendanceQuery);

                    const scoreRef = doc(db, 'parikshanScores', uid);
                    const scoreSnap = await getDoc(scoreRef);
                    let averageScore = null;
                    let detailedScores = {};

                    if (scoreSnap.exists()) {
                        const data = scoreSnap.data();
                        const values = ['dhol', 'maintenance', 'dhwaj', 'tasha']
                            .filter(k => k in data && typeof data[k] === 'number')
                            .map(k => data[k]);
                        if (values.length > 0) {
                            averageScore = values.reduce((a, b) => a + b, 0) / values.length;
                        }
                        detailedScores = data;
                    }

                    if (isReleased && averageScore !== null) {
                        setShowConfetti(true); // trigger once when visible
                    }

                    setUser({
                        ...userData,
                        id: uid,
                        attendanceCount: attendanceSnap.size,
                        averageScore,
                        detailedScores,
                    });
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

    const hasScores = user.averageScore != null;

    return (
        <AppBackgroundWrapper>
            <Animatable.View animation="fadeInUp" delay={100} style={styles.container}>
                <View style={styles.header}>
                    <Icon name="person-circle-outline" size={90} color="#1E3A8A" />
                    <Text style={styles.name}>{user.fullname}</Text>
                    <Text style={styles.text}>{user.email}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Total Attendance</Text>
                    <Text style={styles.cardValue}>{user.attendanceCount ?? '0'}</Text>
                </View>

                {/* 🎓 Results pending */}
                {hasScores && !parikshanReleased && (
                    <Animatable.View animation="fadeInDown" duration={500} style={styles.pendingBanner}>
                        <Text style={styles.pendingText}>🎓 Parikshan results will be available soon.</Text>
                    </Animatable.View>
                )}

                {/* ✅ Show if scores are released */}
                {hasScores && parikshanReleased && (
                    <>
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => setModalVisible(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cardLabel}>Parikshan Score</Text>
                            <View style={styles.cardRow}>
                                <Text style={styles.cardValue}>{user.averageScore.toFixed(1)} / 10</Text>
                                <Icon name="chevron-forward-outline" size={20} color="#64748b" />
                            </View>
                        </TouchableOpacity>

                        {showConfetti && (
                            <ConfettiCannon
                                count={50}
                                origin={{ x: 200, y: -20 }}
                                fadeOut
                                explosionSpeed={300}
                            />
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

                <Modal visible={modalVisible} transparent animationType="slide">
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Parikshan Breakdown</Text>
                            {['dhol', 'maintenance', 'dhwaj', 'tasha'].map((key) => (
                                key in user.detailedScores && (
                                    <Text key={key} style={styles.modalItem}>
                                        {key.charAt(0).toUpperCase() + key.slice(1)}: {user.detailedScores[key]} / 10
                                    </Text>
                                )
                            ))}
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setModalVisible(false)}
                            >
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
        </AppBackgroundWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
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
    modalItem: {
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        color: '#334155',
        marginVertical: 4,
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
});