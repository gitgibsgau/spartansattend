import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import QRCodeDisplay from '../components/QRCodeDisplay';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';

const generateCode = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export default function QRGeneratorScreen() {
  const [title, setTitle] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);

  const createSession = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a session title.');
      return;
    }

    setLoading(true);
    const code = generateCode();

    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        title: title.trim(),
        createdBy: auth.currentUser.uid,
        code,
        timestamp: Timestamp.now()
      });
      setSessionId(docRef.id);
      setSessionCode(code);
      Alert.alert('Success', 'Session created!');
    } catch (err) {
      console.error('Error creating session:', err);
      Alert.alert('Error', 'Could not create session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animatable.Text animation="fadeInDown" style={styles.heading}>
        Create New Attendance Session
      </Animatable.Text>

      <Animatable.View animation="fadeInUp" delay={100} style={styles.card}>
        <Text style={styles.label}>Session Title</Text>
        <TextInput
          placeholder="e.g. Math Lecture 101"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />

        <TouchableOpacity style={styles.button} onPress={createSession} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="qr-code-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Generate QR</Text>
            </>
          )}
        </TouchableOpacity>
      </Animatable.View>

      {sessionId && (
        <Animatable.View animation="fadeInUp" delay={300} style={styles.resultCard}>
          <Text style={styles.resultTitle}>QR Code</Text>
          <QRCodeDisplay data={sessionId} />
          <Text style={styles.codeText}>
            Manual Code: <Text style={styles.codeValue}>{sessionCode}</Text>
          </Text>
        </Animatable.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#f1f5f9',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  button: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#4f46e5',
    padding: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  resultCard: {
    marginTop: 30,
    backgroundColor: '#f8fafc',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#0f172a',
  },
  codeText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  codeValue: {
    fontWeight: 'bold',
    color: '#2563eb',
    fontSize: 18,
  },
});
