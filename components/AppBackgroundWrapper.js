// components/AppBackgroundWrapper.js
import React from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';

export default function AppBackgroundWrapper({ children }) {
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={styles.container.backgroundColor}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
});