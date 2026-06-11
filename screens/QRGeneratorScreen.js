import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import QRCodeDisplay from '../components/QRCodeDisplay';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { LinearGradient } from '../components/ui/Gradient';
import { colors, spacing, radius, fonts, shadows } from '../theme';
import { useSeason } from '../contexts/SeasonContext';

const generateCode = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export default function QRGeneratorScreen() {
  const { currentSeason } = useSeason();
  const [title, setTitle] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);

  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [showStatus, setShowStatus] = useState(false);

  const showBanner = (type, text) => {
    setStatusMessage({ type, text });
    setShowStatus(true);
    setTimeout(() => setShowStatus(false), 3000);
  };

  const createSession = async () => {
    if (loading) return;

    if (!title.trim()) {
      showBanner('error', 'Please enter a session title.');
      return;
    }

    setLoading(true);
    const code = generateCode();

    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        title: title.trim(),
        createdBy: auth.currentUser.uid,
        code,
        season: currentSeason,
        timestamp: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)) // 30 minutes
      });

      setSessionId(docRef.id);
      setSessionCode(code);
      setTitle('');
      showBanner('success', 'Session created successfully!');
    } catch (err) {
      console.error('Error creating session:', err);
      showBanner('error', err?.message || 'Could not create session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackgroundWrapper>
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
            placeholderTextColor={colors.textMuted}
          />

          <TouchableOpacity
            style={styles.buttonShadow}
            onPress={createSession}
            disabled={loading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Icon name="qr-code-outline" size={20} color={colors.textOnPrimary} />
                  <Text style={styles.buttonText}>Generate QR</Text>
                </>
              )}
            </LinearGradient>
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
      </ScrollView>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  heading: {
    fontSize: 23,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 13,
    marginBottom: spacing.lg,
    fontSize: 16,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontFamily: fonts.regular,
  },
  buttonShadow: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  button: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  resultCard: {
    marginTop: spacing['2xl'],
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    marginBottom: spacing.md,
    color: colors.text,
  },
  codeText: {
    marginTop: spacing.lg,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  codeValue: {
    fontFamily: fonts.bold,
    color: colors.primary,
    fontSize: 18,
    letterSpacing: 1,
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
    backgroundColor: colors.surface,
  },
  statusText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    textAlign: 'center',
    color: colors.text,
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