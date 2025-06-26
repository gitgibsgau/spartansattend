import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { collection, query, where, getDocs, getFirestore } from 'firebase/firestore';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { auth } from '../firebase';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';

const db = getFirestore();

export default function AdminDashboard({ navigation }) {
  const [pendingCount, setPendingCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const fetchPendingRebindRequests = async () => {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('rebindRequest', '==', true));
        const snapshot = await getDocs(q);
        setPendingCount(snapshot.size);
      };

      fetchPendingRebindRequests();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await auth.signOut();
            navigation.replace('Login');
          } catch (err) {
            Alert.alert("Logout Failed", err.message);
          }
        },
      },
    ]);
  };

  const Card = ({ title, iconName, delay, onPress }) => (
    <Animatable.View animation="fadeInUp" delay={delay}>
      <TouchableOpacity style={styles.card} onPress={onPress}>
        <View style={{ position: 'relative', alignItems: 'center' }}>
          <Icon name={iconName} size={30} color="#4f46e5" />
          {title === "Device Rebind Requests" && pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardText}>{title}</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <AppBackgroundWrapper>
      <View style={styles.container}>
        <Animatable.Text animation="fadeInDown" style={styles.title}>
          Admin Dashboard 🧑‍💼
        </Animatable.Text>

        <ScrollView contentContainerStyle={styles.cardContainer} showsVerticalScrollIndicator={false}>
          <Card
            title="Generate QR for Session"
            iconName="qr-code"
            delay={200}
            onPress={() => navigation.navigate('QRGenerator')}
          />
          <Card
            title="View Attendance Records"
            iconName="calendar"
            delay={400}
            onPress={() => navigation.navigate('AttendanceView')}
          />
          <Card
            title="Reset Student Device ID"
            iconName="refresh-circle"
            delay={600}
            onPress={() => navigation.navigate('ResetDevice')}
          />
          <Card
            title="Device Rebind Requests"
            iconName="help-circle"
            delay={800}
            onPress={() => navigation.navigate('RebindRequests')}
          />
        </ScrollView>

        {/* Bottom-fixed logout */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Icon name="log-out-outline" size={28} color="crimson" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 150,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 30,
    color: '#f8fafc',
  },
  cardContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  card: {
    width: 300,
    backgroundColor: '#f1f5f9',
    borderRadius: 15,
    padding: 20,
    marginVertical: 15,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  cardText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  logoutContainer: {
    alignItems: 'center',
    paddingBottom: 30,
    paddingTop: 10,
    backgroundColor: '#ffffff',
  },
  logoutButton: {
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 14,
    color: 'crimson',
    marginTop: 5,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
