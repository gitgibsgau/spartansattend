import React, { useState } from 'react';
import {
  TextInput,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  View,
  ActivityIndicator,
} from 'react-native';
import { getFirestore, where, updateDoc, getDocs, query, collection, writeBatch } from 'firebase/firestore';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { LinearGradient } from '../components/ui/Gradient';
import { colors, spacing, radius, fonts, shadows } from '../theme';

export default function ResetDevice() {
  const [email, setEmail] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
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

  const doResetAll = async () => {
    setBulkLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const docs = snap.docs;
      let count = 0;
      // writeBatch caps at 500 ops; chunk so it scales past that.
      for (let i = 0; i < docs.length; i += 450) {
        const batch = writeBatch(db);
        docs.slice(i, i + 450).forEach((d) => {
          batch.update(d.ref, { deviceId: null });
          count += 1;
        });
        await batch.commit();
      }
      Alert.alert("✅ Done", `Reset device binding for ${count} user(s). Everyone re-binds on their next login.`);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleResetAll = () => {
    Alert.alert(
      "Reset ALL device bindings?",
      "This unbinds every user (students and admins) from their device. Each person re-binds to whatever device they next log in on. Do this once at the start of a season — and only after the new app version is live.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset all", style: "destructive", onPress: doResetAll },
      ]
    );
  };

  return (
    <AppBackgroundWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <StatusBar backgroundColor={colors.background} barStyle="dark-content" />

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
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TouchableOpacity
            style={styles.buttonShadow}
            onPress={handleReset}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <Icon name="refresh-circle" size={20} color={colors.textOnPrimary} />
              <Text style={styles.buttonText}>Reset Device ID</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.bulkLabel}>New season</Text>
          <Text style={styles.bulkHelp}>
            Unbind every user at once. Run this once at season start, after the new app version is live.
          </Text>
          <TouchableOpacity
            style={[styles.bulkButton, bulkLoading && { opacity: 0.6 }]}
            onPress={handleResetAll}
            activeOpacity={0.9}
            disabled={bulkLoading}
          >
            {bulkLoading ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Icon name="warning-outline" size={18} color={colors.danger} />
                <Text style={styles.bulkButtonText}>Reset ALL devices</Text>
              </>
            )}
          </TouchableOpacity>
        </Animatable.View>
      </KeyboardAvoidingView>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', // balance single-content screen instead of jamming to top
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  header: {
    fontSize: 23,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: radius.md,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    fontFamily: fonts.regular,
  },
  buttonShadow: {
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  button: {
    paddingVertical: 14,
    borderRadius: radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
  },
  bulkLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bulkHelp: {
    fontSize: 12.5,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  bulkButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  bulkButtonText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
});
