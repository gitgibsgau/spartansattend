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
  Easing
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

export default function RegisterScreen({ navigation }) {
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [scaleAnim] = useState(new Animated.Value(1));

  const role = 'student';

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
      Alert.alert("Missing fields", "Please fill out all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

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
                placeholder="Fullname"
                value={fullname}
                onChangeText={setFullname}
                autoCapitalize="none"
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
              <TextInput
                placeholder="Password"
                value={password}
                secureTextEntry
                onChangeText={setPassword}
                style={styles.input}
                placeholderTextColor="#94a3b8"
              />
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Pressable style={styles.button} onPress={() => triggerFeedback(handleRegister)}>
                  <Text style={styles.buttonText}>Register</Text>
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
    paddingBottom: 300,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 24,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1e293b',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
    color: '#1e293b',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  switchText: {
    textAlign: 'center',
    color: '#475569',
    marginTop: 8,
  },
  link: {
    color: '#2563eb',
    fontWeight: '600',
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
});