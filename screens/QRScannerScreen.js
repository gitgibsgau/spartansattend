import React, { useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Camera, BarCodeScanner } from 'expo-camera';
import { addDoc, collection, Timestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useSeason } from '../contexts/SeasonContext';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import { colors, spacing, radius, fonts, shadows } from '../theme';

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const { currentSeason } = useSeason();

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);
    setLoading(true);

    try {
      // Validate sessionId exists in 'sessions' collection and belongs to current season
      const sessionRef = collection(db, 'sessions');
      const sessionSnapshot = await getDocs(query(
        sessionRef,
        where('__name__', '==', data),
        where('season', '==', currentSeason)
      ));

      if (sessionSnapshot.empty) {
        Alert.alert('Invalid QR Code', 'This session does not exist or is not for the current season.');
        setLoading(false);
        return;
      }

      // Check if attendance already marked for current season
      const attendanceRef = collection(db, 'attendance');
      const attendanceSnapshot = await getDocs(query(
        attendanceRef,
        where('sessionId', '==', data),
        where('studentId', '==', auth.currentUser.uid),
        where('season', '==', currentSeason)
      ));

      if (!attendanceSnapshot.empty) {
        Alert.alert('Already Marked', 'You have already marked attendance for this session.');
      } else {
        await addDoc(attendanceRef, {
          sessionId: data,
          studentId: auth.currentUser.uid,
          season: currentSeason,
          markedAt: Timestamp.now()
        });
        Alert.alert('Success', 'Attendance marked successfully!');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) return <Text>Requesting camera permission...</Text>;
  if (hasPermission === false) return <Text>No access to camera</Text>;

  return (
    <AppBackgroundWrapper>
      <View style={styles.container}>
        <Camera
          style={styles.camera}
          type={Camera.Constants.Type.back}
          barCodeScannerSettings={{
            barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
          }}
          onBarCodeScanned={handleBarCodeScanned}
        />

        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>Scan Session QR</Text>
          <Text style={styles.instructionSubtitle}>Point your camera at the QR code to mark attendance.</Text>
        </View>

        {loading && <ActivityIndicator size="large" color="#ffffff" style={styles.loader} />}
        {scanned && !loading && (
          <TouchableOpacity style={styles.scanAgainButton} onPress={() => setScanned(false)}>
            <Text style={styles.scanAgainText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 20,
  },
  scanAgainButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 13,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.full,
    ...shadows.primary,
  },
  scanAgainText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  instructionBox: {
    position: 'absolute',
    top: 24,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  instructionTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: 4,
  },
  instructionSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  loader: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
  },
});
