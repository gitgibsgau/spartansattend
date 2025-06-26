import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import {
    useFonts,
    Poppins_600SemiBold,
    Poppins_400Regular,
} from '@expo-google-fonts/poppins';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';

export default function ProfileScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState({ show: false, type: '', text: '' });

    const [fontsLoaded] = useFonts({
        Poppins_600SemiBold,
        Poppins_400Regular,
    });

    useEffect(() => {
        const loadUser = async () => {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                setUser(userSnap.data());
            }
        };
        loadUser();
    }, []);

    const showBanner = (type, text) => {
        setStatus({ show: true, type, text });
        setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
    };

    const handleRebindRequest = async () => {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.rebindRequest) {
                return showBanner('error', 'You already have a pending request.');
            }
            await updateDoc(userRef, { rebindRequest: true });
            showBanner('success', 'Device rebind request submitted.');
        }
    };

    if (!fontsLoaded || !user) return null;

    return (
        <AppBackgroundWrapper>
            <Animatable.View animation="fadeInUp" delay={100} style={styles.container}>
                <View style={styles.header}>
                    <Icon name="person-circle-outline" size={90} color="#1E3A8A" />
                    <Text style={styles.name}>{user.fullname}</Text>
                    <Text style={styles.text}>{user.email}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Student ID</Text>
                    <Text style={styles.cardValue}>{user.sid || 'N/A'}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Total Attendance</Text>
                    <Text style={styles.cardValue}>{user.sid || 'N/A'}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Events Allocated</Text>
                    <Text style={styles.cardValue}>{user.sid || 'N/A'}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Placeholder</Text>
                    <Text style={styles.cardValue}>{user.sid || 'N/A'}</Text>
                </View>

                {/* <TouchableOpacity style={styles.rebindButton} onPress={handleRebindRequest}>
                    <Icon name="refresh-circle-outline" size={22} color="white" />
                    <Text style={styles.rebindText}>Request Device Rebind</Text>
                </TouchableOpacity> */}

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
    rebindButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4F46E5',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    rebindText: {
        color: '#fff',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 16,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DC2626',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    logoutText: {
        color: '#fff',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 16,
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
});