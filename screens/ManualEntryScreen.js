import React, { useEffect, useState, useRef } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { checkLocationAccessAndProximity } from '../utils/locationUtils';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '../components/ui/Gradient';
import { colors, spacing, radius, fonts, shadows } from '../theme';
import { useSeason } from '../contexts/SeasonContext';

export default function ManualEntryScreen() {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const { currentSeason } = useSeason();
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const buttonRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [showStatus, setShowStatus] = useState(false);

  const showBanner = (type, text) => {
    setStatusMessage({ type, text });
    setShowStatus(true);
    setTimeout(() => setShowStatus(false), 3000);
  };

  useEffect(() => {
    const fetchLatestSession = async () => {
      try {
        if (!currentSeason) return;
        const now = Timestamp.now();
        const sessionQuery = query(
          collection(db, 'sessions'),
          where('expiresAt', '>', now),
          where('season', '==', currentSeason),
          orderBy('expiresAt', 'desc')
        );
        const snapshot = await getDocs(sessionQuery);
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          setCode(data.code?.toUpperCase() || '');
          setTitle(data.title?.toUpperCase() || 'Session');
          setSessionId(doc.id);
        } else {
          showBanner('error', 'No valid session available.');
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        showBanner('error', 'Failed to load session.');
      }
    };

    fetchLatestSession();
  }, [currentSeason]);

  const handleSubmit = async () => {
    if (loading || !sessionId || !code) return;

    buttonRef.current?.pulse(300);
    setLoading(true);

    try {
      const now = Timestamp.now();
      const sessionDoc = await getDocs(
        query(collection(db, 'sessions'), where('code', '==', code), where('season', '==', currentSeason))
      );

      if (sessionDoc.empty) {
        showBanner('error', 'Session not found.');
        return;
      }

      const sessionData = sessionDoc.docs[0].data();
      if (sessionData.expiresAt.toMillis() < now.toMillis()) {
        showBanner('error', 'This session has expired.');
        return;
      }

      const { withinRadius, distance } = await checkLocationAccessAndProximity(
        sessionData.latitude,
        sessionData.longitude
      );
      if (!withinRadius) {
        showBanner(
          'error',
          distance != null
            ? `You're ${Math.round(distance)}m away. Must be within 200m.`
            : 'Could not verify your location. Enable location and try again.'
        );
        return;
      }

      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('sessionId', '==', sessionId),
        where('studentId', '==', auth.currentUser.uid),
        where('season', '==', currentSeason)
      );
      const attendanceSnap = await getDocs(attendanceQuery);

      if (!attendanceSnap.empty) {
        showBanner('error', 'You already marked attendance.');
      } else {
        await addDoc(collection(db, 'attendance'), {
          sessionId,
          studentId: auth.currentUser.uid,
          season: currentSeason,
          markedAt: Timestamp.now(),
        });
        showBanner('success', 'Attendance marked successfully!');
      }
    } catch (err) {
      console.error(err);
      showBanner('error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackgroundWrapper>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.sessionTitle}>
          {title ? title.toUpperCase() : ''}
        </Text>
        <Animatable.View animation="fadeInUp" duration={700} style={styles.card}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <Icon name="qr-code-outline" size={32} color={colors.textOnPrimary} />
          </LinearGradient>
          <Text style={styles.label}>Session Code</Text>

          <Animatable.View
            ref={inputRef}
            animation="bounceIn"
            delay={300}
            style={styles.animatedInputWrapper}
          >

            <TextInput
              value={code}
              editable={false}
              style={[styles.input, { backgroundColor: colors.surfaceMuted }]}
              placeholderTextColor={colors.textMuted}
            />
          </Animatable.View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <Animatable.View ref={buttonRef} useNativeDriver style={styles.buttonShadow}>
              <TouchableOpacity onPress={handleSubmit} activeOpacity={0.9}>
                <LinearGradient
                  colors={colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.button}
                >
                  <Icon name="checkmark-circle-outline" size={22} color={colors.textOnPrimary} />
                  <Text style={styles.buttonText}>Mark Attendance</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animatable.View>
          )}
        </Animatable.View>

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
      </KeyboardAvoidingView>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : spacing.xl,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
    alignItems: 'center',
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.primary,
  },
  label: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    marginBottom: spacing.md,
    color: colors.text,
  },
  animatedInputWrapper: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: colors.text,
    fontFamily: fonts.semibold,
  },
  buttonShadow: {
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  button: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
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
    fontSize: 15,
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
  sessionTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
});