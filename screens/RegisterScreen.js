import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Text,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Animatable from 'react-native-animatable';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';

export default function RegisterScreen({ navigation }) {
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [showStatus, setShowStatus] = useState(false);
  const [loading, setLoading] = useState(false);

  const role = 'student';

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  if (!fontsLoaded) return null;

  const showBanner = (type, text) => {
    setStatusMessage({ type, text });
    setShowStatus(true);
    setTimeout(() => setShowStatus(false), 3000);
  };

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

  const handleRegister = async () => {
    if (!fullname || !email || !password) {
      showBanner('error', 'Please fill out all fields.');
      return;
    }
    if (password.length < 6) {
      showBanner('error', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const deviceId = Device.modelName || Device.deviceName || 'unknown';

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        fullname: fullname.trim(),
        email: email.trim(),
        role,
        deviceId,
        createdAt: new Date().toISOString(),
      });

      await SecureStore.setItemAsync('bound_device_id', deviceId);

      showBanner('success', 'Registered successfully. Please login.');
      setTimeout(() => navigation.navigate('Login'), 1000);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        showBanner('error', 'Email already registered.');
      } else if (err.code === 'auth/invalid-email') {
        showBanner('error', 'Invalid email address.');
      } else {
        showBanner('error', err.message);
      }
    }
    setLoading(false);
  };

  return (
    <AppBackgroundWrapper>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.wrapper}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Animatable.View animation="fadeInUp" duration={800} style={styles.card}>
              <Ionicons name="person-add-outline" size={80} color="#2563eb" style={styles.icon} />
              <Text style={styles.title}>Create Account</Text>

              <TextInput
                placeholder="Full name"
                value={fullname}
                onChangeText={setFullname}
                autoCapitalize="words"
                style={styles.input}
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.inputWrapper}>
                <TextInput
                  placeholder="Password"
                  value={password}
                  secureTextEntry={!showPassword}
                  onChangeText={setPassword}
                  style={styles.inputField}
                  placeholderTextColor="#94a3b8"
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#64748b"
                  />
                </Pressable>
              </View>

              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Pressable
                  style={[styles.button, loading && { opacity: 0.6 }]}
                  onPress={() => triggerFeedback(handleRegister)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Register</Text>
                  )}
                </Pressable>
              </Animated.View>

              <Text style={styles.switchText}>
                Already have an account?{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
                  Login
                </Text>
              </Text>
            </Animatable.View>
          </ScrollView>

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
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 250,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
    color: '#1e293b',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 12,
    color: '#1e293b',
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  inputField: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    paddingRight: 40,
    borderRadius: 8,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: '#1f2937',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 4,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
  },
  switchText: {
    marginTop: 18,
    textAlign: 'center',
    color: '#64748b',
    fontFamily: 'Poppins_400Regular',
    fontSize: 13.5,
  },
  link: {
    color: '#2563eb',
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