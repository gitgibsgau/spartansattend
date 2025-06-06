import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
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

export default function ManualEntryScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const buttonRef = useRef(null);

  const handleSubmit = async () => {
    if (!code.trim()) {
      Alert.alert('Missing', 'Enter the session code.');
      return;
    }

    if (buttonRef.current) buttonRef.current.pulse(300);

    setLoading(true);

    const withinRadius = await checkLocationAccessAndProximity();
    if (!withinRadius) {
        setLoading(false);
        return;
    }

    try {
      const sessionQuery = query(
        collection(db, 'sessions'),
        where('code', '==', code.trim().toUpperCase())
      );
      const sessionSnapshot = await getDocs(sessionQuery);

      if (sessionSnapshot.empty) {
        Alert.alert('Invalid Code', 'No session found for this code.');
        return;
      }

      const session = sessionSnapshot.docs[0];
      const sessionId = session.id;

      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('sessionId', '==', sessionId),
        where('studentId', '==', auth.currentUser.uid)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      if (!attendanceSnapshot.empty) {
        Alert.alert('Already Marked', 'You already marked attendance.');
      } else {
        await addDoc(collection(db, 'attendance'), {
          sessionId,
          studentId: auth.currentUser.uid,
          markedAt: Timestamp.now()
        });
        Alert.alert('Success', 'Attendance marked successfully!');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="e.g. A72KQ9"
            style={styles.input}
            maxLength={6}
            onFocus={() => inputRef.current?.bounce()}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
    wrapper: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: '#1e3a8a', // Spartan blue
      padding: 20,
    },
    card: {
      backgroundColor: '#f1f5f9', // soft card color
      borderRadius: 15,
      padding: 25,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 5,
      alignItems: 'center',
    },
    label: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
      color: '#1e293b', // deep gray-blue
    },
    animatedInputWrapper: {
      width: '100%',
      marginBottom: 20,
    },
    input: {
      width: '100%',
      borderWidth: 1,
      borderColor: '#cbd5e1', // slate border
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      textAlign: 'center',
      textTransform: 'uppercase',
      backgroundColor: '#e2e8f0', // subtle light blue
      color: '#0f172a', // strong dark text
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
      fontWeight: '600',
      fontSize: 16,
    },
  });
  
