// screens/EventsScreen.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';

export default function EventsScreen() {
  return (
    <View style={styles.container}>
      <Animatable.View animation="fadeInDown" delay={200} style={styles.iconWrapper}>
        <Icon name="calendar-outline" size={60} color="#4F46E5" />
      </Animatable.View>
      <Animatable.Text animation="fadeInUp" delay={400} style={styles.title}>
        Events Coming Soon!
      </Animatable.Text>
      <Animatable.Text animation="fadeInUp" delay={600} style={styles.subtitle}>
        Stay tuned for upcoming Spartan events and announcements.
      </Animatable.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  iconWrapper: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 10,
    color: '#475569',
    textAlign: 'center',
  },
});