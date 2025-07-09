import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { auth } from '../firebase';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';

export default function DummyLogoutScreen({ navigation }) {
  const [visible, setVisible] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

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

  if (!fontsLoaded) return null;

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
              <Ionicons name="log-out-outline" size={40} color="#ef4444" style={styles.icon} />
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
    color: '#1e293b',
    marginBottom: 6,
  },
  message: {
    fontSize: 14.5,
    fontFamily: 'Poppins_400Regular',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cancelButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelText: {
    color: '#1e293b',
    fontFamily: 'Poppins_600SemiBold',
  },
  logoutButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  logoutText: {
    color: '#ffffff',
    fontFamily: 'Poppins_600SemiBold',
  },
});