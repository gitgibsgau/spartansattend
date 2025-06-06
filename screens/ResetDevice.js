import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { getFirestore, where, updateDoc, getDocs, query, collection } from 'firebase/firestore';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';

export default function ResetDevice() {
  const [email, setEmail] = useState('');
  const db = getFirestore();

  const handleReset = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
  
      if (querySnapshot.empty) {
        return Alert.alert("🚫 Not Found", "No user with that email.");
      }
  
      const userDoc = querySnapshot.docs[0];
      await updateDoc(userDoc.ref, { deviceId: null });
  
      Alert.alert("✅ Success", "Device ID has been reset.");
      setEmail('');
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar backgroundColor="#0f172a" barStyle="light-content" />

      <Animatable.View animation="fadeInDown" delay={200}>
        <Text style={styles.header}>Reset Student Device</Text>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={400} style={styles.card}>
        <Text style={styles.label}>Enter Student Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="student@example.com"
          style={styles.input}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleReset}
          activeOpacity={0.8}
        >
          <Icon name="refresh-circle" size={20} color="#fff" />
          <Text style={styles.buttonText}>Reset Device ID</Text>
        </TouchableOpacity>
      </Animatable.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 22,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 18,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
