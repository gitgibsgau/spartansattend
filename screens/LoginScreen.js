import React, { useState } from 'react';
import {
  View,
  TextInput,
  Alert,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Text,
  Pressable,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Animatable from 'react-native-animatable';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper'; // 🔁 Using the wrapper

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [scaleAnim] = useState(new Animated.Value(1));

  const triggerFeedback = async (action) => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start(() => {
      action();
    });
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter both email and password.");
      return;
    }

    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);
      await res.user.getIdToken(true);

      const uid = res.user.uid;
      const userDocSnap = await getDoc(doc(db, 'users', uid));

      if (!userDocSnap.exists()) {
        Alert.alert("Error", "User data not found in database.");
        return;
      }

      const userData = userDocSnap.data();
      const role = userData.role;
      const registeredDeviceId = userData.deviceId;
      const currentDeviceId = Device.modelName || Device.deviceName || 'unknown';

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
    <AppBackgroundWrapper>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.wrapper}>
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <Animatable.View animation="fadeInUp" duration={800} style={styles.card}>
              <Ionicons name="person-circle-outline" size={80} color="#2563eb" style={styles.icon} />
              <Text style={styles.title}>Welcome Spartan!</Text>

              <TextInput
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                placeholder="Enter your password"
                value={password}
                secureTextEntry
                onChangeText={setPassword}
                style={styles.input}
                placeholderTextColor="#94a3b8"
              />

              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Pressable style={styles.button} onPress={() => triggerFeedback(handleLogin)}>
                  <Text style={styles.buttonText}>Login</Text>
                </Pressable>
              </Animated.View>

              <Text style={styles.switchText}>
                Don’t have an account?{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
                  Register
                </Text>
              </Text>
            </Animatable.View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 300,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    color: '#1f2937',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  switchText: {
    marginTop: 20,
    textAlign: 'center',
    color: '#475569',
  },
  link: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
