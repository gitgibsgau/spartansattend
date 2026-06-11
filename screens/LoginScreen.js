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
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Animatable from 'react-native-animatable';
import * as Device from 'expo-device';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../components/ui/Gradient';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { colors, spacing, radius, fonts, shadows } from '../theme';
import { ActivityIndicator } from 'react-native';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [loading, setLoading] = useState(false);

  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [showStatus, setShowStatus] = useState(false);

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

  const handleLogin = async () => {
    if (!email || !password) {
      showBanner('error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      await auth.signOut();
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);
      await res.user.getIdToken(true);

      const uid = res.user.uid;
      const userDocSnap = await getDoc(doc(db, 'users', uid));

      if (!userDocSnap.exists()) {
        showBanner('error', 'User data not found in database.');
        setLoading(false);
        return;
      }

      const userData = userDocSnap.data();
      const role = userData.role;
      const registeredDeviceId = userData.deviceId;
      const currentDeviceId = Device.modelName || Device.deviceName || 'unknown';

      if (registeredDeviceId && registeredDeviceId !== currentDeviceId) {
        showBanner('error', 'You can only log in from your registered device.');
        setLoading(false);
        return;
      }

      // await SecureStore.setItemAsync('bound_device_id', currentDeviceId);

      if (role === 'admin') {
        navigation.replace('AdminDashboard');
      } else if (role === 'student') {
        navigation.replace('StudentDashboard');
      } else {
        showBanner('error', 'Unknown role assigned to user.');
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        showBanner('error', 'No account found with this email.');
      } else if (err.code === 'auth/wrong-password') {
        showBanner('error', 'Incorrect password.');
      } else if (err.code === 'auth/invalid-email') {
        showBanner('error', 'Invalid email format.');
      } else if (err.code === 'auth/invalid-credential') {
        showBanner('error', 'Invalid credentials. Try resetting your password.');
      } else {
        showBanner('error', err.message || 'Login error occurred.');
      }
    }

    setLoading(false);
  };

  const handleForgotPassword = (emailInput) => {
    if (!emailInput) {
      showBanner('error', 'Please enter your email above to reset password.');
      return;
    }

    sendPasswordResetEmail(auth, emailInput.trim())
      .then(() => {
        showBanner('success', 'Password reset email sent.');
      })
      .catch((error) => {
        if (error.code === 'auth/invalid-email') {
          showBanner('error', 'Please enter a valid email address.');
        } else if (error.code === 'auth/user-not-found') {
          showBanner('error', 'No account found with this email.');
        } else {
          showBanner('error', error.message);
        }
      });
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
                <Ionicons name="person-outline" size={40} color={colors.textOnPrimary} />
              </LinearGradient>
              <Text style={styles.title}>Welcome Spartan!</Text>
              <Text style={styles.subtitle}>Sign in to continue</Text>

              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.inputWrapper}>
                <TextInput
                  placeholder="Enter your password"
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
                  onPress={() => triggerFeedback(handleLogin)}
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
                      <Text style={styles.buttonText}>Login</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              <Text
                style={styles.forgotText}
                onPress={() => handleForgotPassword(email)}
              >
                Forgot your password?
              </Text>
              <Text style={styles.switchText}>
                Don’t have an account?{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
                  Register
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
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: 250,
    justifyContent: 'center',
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
  forgotText: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.primary,
    fontSize: 13.5,
    fontFamily: fonts.medium,
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
    bottom: 30,
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