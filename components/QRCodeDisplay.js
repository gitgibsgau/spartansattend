import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function QRCodeDisplay({ data }) {
  return (
    <View style={styles.qrContainer}>
      <QRCode value={data} size={200} backgroundColor="white" />
    </View>
  );
}

const styles = StyleSheet.create({
  qrContainer: { marginTop: 20, alignItems: 'center' },
});
