import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';

export default function StudentDashboard({ navigation }) {
  const [name, setName] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const email = userSnap.data().email;
          setName(email.split('@')[0]);
        }
      } catch (err) {
        console.log("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, []);

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

  const handleRebindRequest = async () => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.rebindRequest) {
          return Alert.alert("Already Requested", "Your request is already pending.");
        }
        await updateDoc(userRef, { rebindRequest: true });
        Alert.alert("Request Sent", "Your rebind request has been submitted.");
      } else {
        Alert.alert("Error", "User not found.");
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };
  

  const Card = ({ title, iconName, onPress }) => (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <Icon name={iconName} size={28} color="#4F46E5" />
      <Text style={styles.cardText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Main centered content */}
      <View style={styles.contentWrapper}>
        <Animatable.Text animation="fadeInDown" style={styles.title}>
          Welcome, {name.charAt(0).toUpperCase() + name.slice(1)} 👋
        </Animatable.Text>

        <ScrollView contentContainerStyle={styles.cardContainer} showsVerticalScrollIndicator={false}>
          <Animatable.View animation="fadeInUp" delay={200}>
            <Card
              title="Enter Session Code"
              iconName="qr-code-outline"
              onPress={() => navigation.navigate('ManualEntry')}
            />
          </Animatable.View>

          <Animatable.View animation="fadeInUp" delay={400}>
            <Card
              title="View Attendance"
              iconName="calendar-outline"
              onPress={() => navigation.navigate('AttendanceView')}
            />
          </Animatable.View>
          <Animatable.View animation="fadeInUp" delay={600}>
            <Card
              title="Request Device Rebind"
              iconName="refresh-circle-outline"
              onPress={handleRebindRequest}
            />
          </Animatable.View>
        </ScrollView>
      </View>

      {/* Bottom fixed logout */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Icon name="log-out-outline" size={28} color="crimson" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a', // Spartan blue
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 30,
    color: '#f8fafc', // light on dark
  },
  cardContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  card: {
    width: 300,
    backgroundColor: '#f1f5f9', // soft light card
    borderRadius: 15,
    padding: 24,
    marginVertical: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  cardText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b', // dark readable text
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
});

