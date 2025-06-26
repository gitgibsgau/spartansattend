import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { checkLocationAccessAndProximity } from '../utils/locationUtils';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';

export default function ManualEntryScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const buttonRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [showStatus, setShowStatus] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  const showBanner = (type, text) => {
    setStatusMessage({ type, text });
    setShowStatus(true);
    setTimeout(() => setShowStatus(false), 3000);
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (showStatus) setShowStatus(false);
    if (!code.trim()) {
      showBanner('error', 'Enter the session code.');
      return;
    }

    buttonRef.current?.pulse(300);
    setLoading(true);

    try {
      // Step 1: Validate session
      const sessionQuery = query(
        collection(db, 'sessions'),
        where('code', '==', code.trim().toUpperCase())
      );
      const sessionSnapshot = await getDocs(sessionQuery);

      if (sessionSnapshot.empty) {
        showBanner('error', 'No session found for this code.');
        return;
      }

      const session = sessionSnapshot.docs[0];
      const sessionData = session.data();
      const sessionId = session.id;

      if (sessionData.code.toUpperCase() !== code.trim().toUpperCase()) {
        showBanner('error', 'Entered code does not match the session.');
        setLoading(false);
        return;
      }

      const now = Timestamp.now();
      if (sessionData.expiresAt && sessionData.expiresAt.toMillis() < now.toMillis()) {
        showBanner('error', 'This session code has expired.');
        setLoading(false);
        return;
      }

      // ✅ Step 2: Now check location
      const { withinRadius, distance } = await checkLocationAccessAndProximity();
      if (!withinRadius) {
        showBanner(
          'error',
          `You're ${Math.round(distance)}meter/s away. Must be within 100 meters.`
        );
        setLoading(false);
        return;
      }

      // Step 3: Check if already marked
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('sessionId', '==', sessionId),
        where('studentId', '==', auth.currentUser.uid)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      if (!attendanceSnapshot.empty) {
        showBanner('error', 'You already marked attendance.');
      } else {
        await addDoc(collection(db, 'attendance'), {
          sessionId,
          studentId: auth.currentUser.uid,
          markedAt: Timestamp.now(),
        });
        showBanner('success', 'Attendance marked successfully!');
        setCode('');
      }

    } catch (error) {
      console.error(error);
      showBanner('error', error?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <AppBackgroundWrapper>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animatable.View animation="fadeInUp" duration={700} style={styles.card}>
          <Icon name="qr-code-outline" size={40} color="#4F46E5" style={{ marginBottom: 10 }} />
          <Text style={styles.label}>Enter Session Code</Text>

          <Animatable.View
            ref={inputRef}
            animation="bounceIn"
            delay={300}
            style={styles.animatedInputWrapper}
          >
            <TextInput
              value={code}
              onChangeText={(text) => {
                setCode(text);
                if (showStatus) setShowStatus(false);
              }}
              autoCapitalize="characters"
              placeholder="e.g. A72KQ9"
              style={styles.input}
              maxLength={6}
              onFocus={() => inputRef.current?.bounce()}
              placeholderTextColor="#94a3b8"
            />
          </Animatable.View>

          {loading ? (
            <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 20 }} />
          ) : (
            <Animatable.View ref={buttonRef} useNativeDriver>
              <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                <Icon name="checkmark-circle-outline" size={22} color="white" />
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </Animatable.View>
          )}
        </Animatable.View>

        {showStatus && (
          <Animatable.View
            animation="slideInUp"
            duration={400}
            style={[
              styles.statusBanner,
              statusMessage.type === 'error' ? styles.error : styles.success,
            ]}
          >
            <Text style={styles.statusText}>{statusMessage.text}</Text>
          </Animatable.View>
        )}
      </KeyboardAvoidingView>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
    alignItems: 'center',
  },
  label: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 12,
    color: '#1e293b',
  },
  animatedInputWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
    backgroundColor: '#f8fafc',
    color: '#1f2937',
    fontFamily: 'Poppins_400Regular',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
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