// components/AppBackgroundWrapper.js
import React from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { colors } from '../theme';

export default function AppBackgroundWrapper({ children }) {
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
});
