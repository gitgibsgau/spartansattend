import React, { useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Camera, CameraType, BarCodeScanner } from 'expo-camera';
import { addDoc, collection, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

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
      // Validate sessionId exists in 'sessions' collection
      const sessionRef = collection(db, 'sessions');
      const sessionSnapshot = await getDocs(query(sessionRef, where('__name__', '==', data)));

      if (sessionSnapshot.empty) {
        Alert.alert('Invalid QR Code', 'This session does not exist.');
        setLoading(false);
        return;
      }

      // Check if attendance already marked
      const attendanceRef = collection(db, 'attendance');
      const attendanceSnapshot = await getDocs(query(
        attendanceRef,
        where('sessionId', '==', data),
        where('studentId', '==', auth.currentUser.uid)
      ));

      if (!attendanceSnapshot.empty) {
        Alert.alert('Already Marked', 'You have already marked attendance for this session.');
      } else {
        await addDoc(attendanceRef, {
          sessionId: data,
          studentId: auth.currentUser.uid,
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
    <View style={styles.container}>
      <Camera
        style={{ flex: 1 }}
        type={CameraType.back}
        barCodeScannerSettings={{
          barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
        }}
        onBarCodeScanned={handleBarCodeScanned}
      />

      {loading && <ActivityIndicator size="large" color="white" style={styles.loader} />}
      {scanned && !loading && (
        <TouchableOpacity onPress={() => setScanned(false)}>
          <Text style={styles.scanAgain}>Tap to Scan Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scanAgain: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    color: 'white',
    fontSize: 18,
    backgroundColor: '#00000080',
    padding: 10,
    borderRadius: 8,
  },
  loader: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
  },
});
