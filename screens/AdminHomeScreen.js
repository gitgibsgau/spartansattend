import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import * as Animatable from 'react-native-animatable';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';

export default function AdminHomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({
    students: 0,
    sessions: 0,
    rebinds: 0,
  });
  const [status, setStatus] = useState({ show: false, type: '', text: '' });

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  useEffect(() => {
    const fetchUserData = async () => {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUser(userSnap.data());
      }
    };

    const fetchCounts = async () => {
      const usersSnap = await getDocs(collection(db, 'users'));
      const sessionsSnap = await getDocs(collection(db, 'sessions'));
      const rebindsSnap = await getDocs(collection(db, 'users'));
      const rebindCount = rebindsSnap.docs.filter(
        (doc) => doc.data().rebindRequest === true
      ).length;

      setCounts({
        students: usersSnap.size,
        sessions: sessionsSnap.size,
        rebinds: rebindCount,
      });
    };

    fetchUserData();
    fetchCounts();
  }, []);

  const showBanner = (type, text) => {
    setStatus({ show: true, type, text });
    setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
  };
  
  if (!fontsLoaded || !user) return null;

  return (
    <AppBackgroundWrapper>
      <View style={styles.container}>
        <Text style={styles.greeting}>Welcome, {user.fullname?.split(' ')[0]}</Text>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Icon name="people" size={28} color="#6366F1" />
            <Text style={styles.metricValue}>{counts.students}</Text>
            <Text style={styles.metricLabel}>Students</Text>
          </View>
          <View style={styles.metricCard}>
            <Icon name="qr-code" size={28} color="#6366F1" />
            <Text style={styles.metricValue}>{counts.sessions}</Text>
            <Text style={styles.metricLabel}>Sessions</Text>
          </View>
          <View style={styles.metricCard}>
            <Icon name="help-circle" size={28} color="#6366F1" />
            <Text style={styles.metricValue}>{counts.rebinds}</Text>
            <Text style={styles.metricLabel}>Rebind Requests</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user.email}</Text>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>{user.role}</Text>
        </View>

        {status.show && (
          <Animatable.View
            animation="slideInUp"
            style={[
              styles.banner,
              status.type === 'error' ? styles.error : styles.success,
            ]}
          >
            <Text style={styles.bannerText}>{status.text}</Text>
          </Animatable.View>
        )}
      </View>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 140,
  },
  greeting: {
    fontSize: 22,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
    color: '#1e3a8a',
    marginBottom: 16, // was 24
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16, // tighter spacing
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 14, // reduced from 16
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 6, // better spacing
  },
  metricValue: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    color: '#0f172a',
    marginTop: 6,
  },
  metricLabel: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
    marginTop: 10, // added slight spacing
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#475569',
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#0f172a',
    marginBottom: 12,
  },
  banner: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 6,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  success: {
    backgroundColor: '#d1fae5',
    borderLeftColor: '#059669',
  },
  error: {
    backgroundColor: '#fee2e2',
    borderLeftColor: '#dc2626',
  },
  bannerText: {
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: '#1e293b',
  },
});