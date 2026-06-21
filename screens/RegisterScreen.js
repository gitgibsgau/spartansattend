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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getDeviceId } from '../utils/deviceId';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../components/ui/Gradient';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, shadows } from '../theme';

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [showStatus, setShowStatus] = useState(false);
  const [loading, setLoading] = useState(false);

  const role = 'student';

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
      const deviceId = await getDeviceId();

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        fullname: fullname.trim(),
        email: email.trim(),
        role,
        deviceId,
        createdAt: new Date().toISOString(),
      });

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
              <LinearGradient
                colors={colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconBadge}
              >
                <Ionicons name="person-add-outline" size={38} color={colors.textOnPrimary} />
              </LinearGradient>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join the Spartans</Text>

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
                  style={[styles.buttonShadow, loading && { opacity: 0.6 }]}
                  onPress={() => triggerFeedback(handleRegister)}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={colors.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.button}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Register</Text>
                    )}
                  </LinearGradient>
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
              animation="slideInDown"
              duration={400}
              style={[
                styles.statusBanner,
                { top: insets.top + 12 },
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
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    paddingBottom: 250,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.primary,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    textAlign: 'center',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    fontFamily: fonts.regular,
    marginBottom: spacing.md,
    color: colors.text,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  inputField: {
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    paddingRight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 4,
  },
  buttonShadow: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  button: {
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
  switchText: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  link: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  statusBanner: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderLeftWidth: 6,
    ...shadows.md,
    zIndex: 100,
  },
  statusText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderLeftColor: colors.danger,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderLeftColor: colors.success,
  },
});