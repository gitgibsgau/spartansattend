import React, { useEffect, useState, useRef } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
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
  const [title, setTitle] = useState('');
  const [sessionId, setSessionId] = useState(null);
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

  useEffect(() => {
    const fetchLatestSession = async () => {
      try {
        const now = Timestamp.now();
        const sessionQuery = query(
          collection(db, 'sessions'),
          where('expiresAt', '>', now),
          orderBy('expiresAt', 'desc')
        );
        const snapshot = await getDocs(sessionQuery);
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          setCode(data.code?.toUpperCase() || '');
          setTitle(data.title?.toUpperCase() || 'Session');
          setSessionId(doc.id);
        } else {
          showBanner('error', 'No valid session available.');
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        showBanner('error', 'Failed to load session.');
      }
    };

    fetchLatestSession();
  }, []);

  const handleSubmit = async () => {
    if (loading || !sessionId || !code) return;

    buttonRef.current?.pulse(300);
    setLoading(true);

    try {
      const now = Timestamp.now();
      const sessionDoc = await getDocs(
        query(collection(db, 'sessions'), where('code', '==', code))
      );

      if (sessionDoc.empty) {
        showBanner('error', 'Session not found.');
        return;
      }

      const sessionData = sessionDoc.docs[0].data();
      if (sessionData.expiresAt.toMillis() < now.toMillis()) {
        showBanner('error', 'This session has expired.');
        return;
      }

      const { withinRadius, distance } = await checkLocationAccessAndProximity();
      if (!withinRadius) {
        showBanner(
          'error',
          `You're ${Math.round(distance)}m away. Must be within 200m.`
        );
        return;
      }

      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('sessionId', '==', sessionId),
        where('studentId', '==', auth.currentUser.uid)
      );
      const attendanceSnap = await getDocs(attendanceQuery);

      if (!attendanceSnap.empty) {
        showBanner('error', 'You already marked attendance.');
      } else {
        await addDoc(collection(db, 'attendance'), {
          sessionId,
          studentId: auth.currentUser.uid,
          markedAt: Timestamp.now(),
        });
        showBanner('success', 'Attendance marked successfully!');
      }
    } catch (err) {
      console.error(err);
      showBanner('error', 'Something went wrong.');
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
        <Text style={styles.sessionTitle}>
          {title ? title.toUpperCase() : ''}
        </Text>
        <Animatable.View animation="fadeInUp" duration={700} style={styles.card}>
          <Icon name="qr-code-outline" size={40} color="#4F46E5" style={{ marginBottom: 10 }} />
          <Text style={styles.label}>Session Code</Text>

          <Animatable.View
            ref={inputRef}
            animation="bounceIn"
            delay={300}
            style={styles.animatedInputWrapper}
          >

            <TextInput
              value={code}
              editable={false}
              style={[styles.input, { backgroundColor: '#e2e8f0' }]}
              placeholderTextColor="#94a3b8"
            />
          </Animatable.View>

          {loading ? (
            <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 20 }} />
          ) : (
            <Animatable.View ref={buttonRef} useNativeDriver>
              <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                <Icon name="checkmark-circle-outline" size={22} color="white" />
                <Text style={styles.buttonText}>Mark Attendance</Text>
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
  sessionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
});