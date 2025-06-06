import React, { useState } from 'react';
import {
  View,
  TextInput,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Text,
  Pressable,
  ImageBackground,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Ionicons } from '@expo/vector-icons'; // Login icon

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter both email and password.");
      return;
    }

    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);

      // 🔥 Force token refresh to ensure latest custom claims (needed for Firestore rules)
      await res.user.getIdToken(true);

      const uid = res.user.uid;
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        Alert.alert("Error", "User data not found in database.");
        return;
      }

      const userData = userDocSnap.data();
      const role = userData.role;
      const registeredDeviceId = userData.deviceId;
      const currentDeviceId = Device.osInternalBuildId || Device.modelId || 'unknown';

      if (registeredDeviceId && registeredDeviceId !== currentDeviceId) {
        Alert.alert("Access Denied", "You can only log in from your registered device.");
        return;
      }

      await SecureStore.setItemAsync('bound_device_id', currentDeviceId);

      if (role === 'admin') {
        navigation.replace('AdminDashboard');
      } else if (role === 'student') {
        navigation.replace('StudentDashboard');
      } else {
        Alert.alert("Error", "Unknown role assigned to user.");
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        Alert.alert("Error", "No account found with this email.");
      } else if (err.code === 'auth/wrong-password') {
        Alert.alert("Error", "Incorrect password.");
      } else if (err.code === 'auth/invalid-email') {
        Alert.alert("Error", "Invalid email format.");
      } else {
        Alert.alert("Login Error", err.message);
      }
    }
  };

  return (
    <ImageBackground
      style={styles.background}
      resizeMode="cover"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.wrapper}
        >
          <Animatable.View animation="fadeInUp" duration={800} style={styles.card}>
            <Ionicons name="person-circle-outline" size={80} color="#2563eb" style={styles.icon} />
            <Text style={styles.title}>Welcome Spartan!</Text>

            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              placeholder="Password"
              value={password}
              secureTextEntry
              onChangeText={setPassword}
              style={styles.input}
              placeholderTextColor="#94a3b8"
            />

            <Pressable style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>Login</Text>
            </Pressable>

            <Text style={styles.switchText}>
              Don't have an account?{' '}
              <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
                Register
              </Text>
            </Text>
          </Animatable.View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
  },
  wrapper: {
    flex: 1,
    backgroundColor: '#1e3a8a', // solid deep blue
    justifyContent: 'center',
    padding: 20,
  },  
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 10,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1e293b',
    textAlign: 'center',
  },
  input: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    fontSize: 16,
    color: '#0f172a',
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
    marginTop: 24,
    textAlign: 'center',
    color: '#475569',
    fontSize: 14,
  },
  link: {
    color: '#2563eb',
    fontWeight: 'bold',
  },
});
