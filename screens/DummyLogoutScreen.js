import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { auth } from '../firebase';
import { useFocusEffect } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { colors, spacing, radius, fonts, shadows } from '../theme';

export default function DummyLogoutScreen({ navigation }) {
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setVisible(true);
    }, [])
  );

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setVisible(false);
    } catch (err) {
      console.error('Logout failed:', err.message);
    }
  };

  return (
    <AppBackgroundWrapper>
      <View style={styles.wrapper}>
        <Modal transparent={true} animationType="fade" visible={visible}>
          <View style={styles.modalBackground}>
            <Animatable.View
              animation="zoomIn"
              duration={400}
              style={styles.modalContainer}
            >
              <View style={styles.iconBadge}>
                <Ionicons name="log-out-outline" size={32} color={colors.danger} />
              </View>
              <Text style={styles.title}>Confirm Logout</Text>
              <Text style={styles.message}>Are you sure you want to log out?</Text>
              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setVisible(false);
                    navigation.goBack();
                  }}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.logoutButton} onPress={handleLogout}>
                  <Text style={styles.logoutText}>Logout</Text>
                </Pressable>
              </View>
            </Animatable.View>
          </View>
        </Modal>
      </View>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    ...shadows.lg,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.bold,
    textAlign: 'center',
    color: colors.text,
    marginBottom: 6,
  },
  message: {
    fontSize: 14.5,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text,
    fontFamily: fonts.semibold,
  },
  logoutButton: {
    flex: 1,
    backgroundColor: colors.danger,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  logoutText: {
    color: '#ffffff',
    fontFamily: fonts.semibold,
  },
});