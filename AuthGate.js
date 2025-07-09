import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import * as Device from 'expo-device';
import { auth, db } from './firebase';
import AdminTabsNavigator from './navigation/AdminTabsNavigator';
import StudentTabsNavigator from './navigation/StudentTabsNavigator';
import * as Animatable from 'react-native-animatable';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';
import UnauthStackNavigator from './navigation/UnauthStackNavigator';

export default function AuthGate({ navigation }) {
  const [initializing, setInitializing] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [isAllowed, setIsAllowed] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        try {
          const uid = user.uid;
          const docSnap = await getDoc(doc(db, 'users', uid));
          if (!docSnap.exists()) {
            setUserRole(null);
            setStatusMessage('User record not found.');
            return;
          }

          const data = docSnap.data();
          const currentDeviceId = Device.modelName || Device.deviceName || 'unknown';

          if (data.deviceId && data.deviceId !== currentDeviceId) {
            setIsAllowed(false);
            setStatusMessage('This device is not registered to your account.');
            return;
          }

          setUserRole(data.role);
        } catch (err) {
          console.error('AuthGate error:', err.message);
          setStatusMessage('Error loading user data.');
        }
      } else {
        setIsLoggedIn(false);
        setUserRole(null);
      }

      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  if (!fontsLoaded) return null;

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <Animatable.Image
          animation="fadeIn"
          iterationCount={1}
          duration={1200}
          delay={200}
          source={require('./assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Animatable.Text
          animation="pulse"
          easing="ease-out"
          iterationCount="infinite"
          style={styles.loadingText}
        >
          Loading...
        </Animatable.Text>
      </View>
    );
  }

  if (!isAllowed) {
    return (
      <Animatable.View
        animation="slideInUp"
        duration={400}
        style={[styles.statusBanner, styles.error]}
      >
        <Text style={styles.statusText}>{statusMessage}</Text>
      </Animatable.View>
    );
  }

  if (userRole === 'admin') return <AdminTabsNavigator />;
  if (userRole === 'student') return <StudentTabsNavigator />;

  // Not logged in
  return <UnauthStackNavigator />;
}

const styles = StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#ffffff',
    },
    logo: {
      width: 180,
      height: 180,
      marginBottom: 20,
    },
    loadingText: {
      fontSize: 16,
      color: '#4f46e5',
      fontFamily: 'Poppins_600SemiBold',
    },
    statusBanner: {
      position: 'absolute',
      bottom: 30,
      left: 20,
      right: 20,
      padding: 12,
      borderRadius: 10,
      borderLeftWidth: 6,
      backgroundColor: '#fee2e2',
      borderLeftColor: '#dc2626',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
      elevation: 3,
      zIndex: 100,
    },
    statusText: {
      fontSize: 14,
      fontFamily: 'Poppins_400Regular',
      textAlign: 'center',
      color: '#991b1b',
    },
    error: {
      backgroundColor: '#fee2e2',
      borderLeftColor: '#dc2626',
    },
  });
  