import React, { useState } from 'react';
import {
  View,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Pressable,
  Keyboard,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const role = 'student'; // Locked to 'student'

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please fill out all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const deviceId = Device.osInternalBuildId || Device.modelId || 'unknown';
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: email.trim(),
        role,
        deviceId,
        createdAt: new Date().toISOString(),
      });

      await SecureStore.setItemAsync('bound_device_id', deviceId);

      Alert.alert("Success", "Registered and bound to this device.");
      navigation.navigate('Login');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        Alert.alert("Email already registered");
      } else if (err.code === 'auth/invalid-email') {
        Alert.alert("Invalid email address");
      } else {
        Alert.alert("Error", err.message);
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.wrapper}
      >
        <Animatable.View animation="fadeInUp" duration={600} style={styles.card}>
          <Text style={styles.title}>Create a Student Account</Text>

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            value={password}
            secureTextEntry
            onChangeText={setPassword}
            style={styles.input}
          />

          <Pressable style={styles.button} onPress={handleRegister}>
              <Text style={styles.buttonText}>Register</Text>
          </Pressable>

          <Text style={styles.switchText}>
            Already have an account?{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
              Login
            </Text>
          </Text>
        </Animatable.View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1e293b',
    textAlign: 'center',
  },
  input: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchText: {
    marginTop: 20,
    textAlign: 'center',
    color: '#475569',
  },
  link: {
    color: '#2563eb',
    fontWeight: 'bold',
  },
});
