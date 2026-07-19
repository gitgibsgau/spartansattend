import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { getDeviceId, isBoundDeviceId } from './utils/deviceId';
import AdminTabsNavigator from './navigation/AdminTabsNavigator';
import StudentTabsNavigator from './navigation/StudentTabsNavigator';
import * as Animatable from 'react-native-animatable';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';
import UnauthStackNavigator from './navigation/UnauthStackNavigator';
import { ViewModeProvider } from './contexts/ViewModeContext';

export default function AuthGate() {
  const [initializing, setInitializing] = useState(true);
  const [userRole, setUserRole] = useState(null);
  // Admins default to their admin tools; they can flip to the member experience.
  const [viewMode, setViewMode] = useState('admin');

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const uid = user.uid;
          const docSnap = await getDoc(doc(db, 'users', uid));

          if (!docSnap.exists()) {
            Toast.show({
              type: 'error',
              text1: 'Login Error',
              text2: 'User record not found.',
            });
            await auth.signOut();
            setInitializing(false);
            return;
          }

          const data = docSnap.data();
          const currentDeviceId = await getDeviceId();
          const boundId = data.deviceId;

          // Only a real (UUID) binding to a different device blocks. An empty
          // value or a legacy model-name (from an older app version) is treated
          // as unbound and self-heals via the rebind below — no lockout.
          if (isBoundDeviceId(boundId) && boundId !== currentDeviceId) {
            Toast.show({
              type: 'error',
              text1: 'Device Not Recognized',
              text2: 'You’ve been logged out.',
            });

            setTimeout(async () => {
              await auth.signOut();
              setUserRole(null);
              setInitializing(false);
            }, 2000);

            return;
          }

          // Bind / self-heal: empty or legacy (non-UUID) value → attach this
          // device. Covers new-season resets and accounts registered on the
          // old build during OTA rollout.
          if (!isBoundDeviceId(boundId)) {
            try {
              await updateDoc(doc(db, 'users', uid), { deviceId: currentDeviceId });
            } catch (bindErr) {
              console.warn('Failed to bind device id:', bindErr?.message);
            }
          }

          setUserRole(data.role);
        } catch (err) {
          console.error('AuthGate error:', err.message);
          Toast.show({
            type: 'error',
            text1: 'Auth Error',
            text2: err.message,
          });
        }
      } else {
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

  if (userRole === 'admin') {
    return (
      <ViewModeProvider role="admin" viewMode={viewMode} setViewMode={setViewMode}>
        {viewMode === 'member' ? <StudentTabsNavigator /> : <AdminTabsNavigator />}
      </ViewModeProvider>
    );
  }
  if (userRole === 'student') {
    return (
      <ViewModeProvider role="student" viewMode="member" setViewMode={() => {}}>
        <StudentTabsNavigator />
      </ViewModeProvider>
    );
  }
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
});