import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';

export default function AttendanceHome({ navigation, route }) {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  const [showBanner, setShowBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');

  useEffect(() => {
    if (route?.params?.fromScreen) {
      setBannerMessage(`Returned to Attendance`);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    }
  }, [route]);

  const Card = ({ title, iconName, onPress, delay }) => (
    <Animatable.View animation="fadeInUp" delay={delay}>
      <TouchableOpacity onPress={onPress} style={styles.card}>
        <Icon name={iconName} size={32} color="#2563eb" />
        <Text style={styles.cardText}>{title}</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  if (!fontsLoaded) return null;

  return (
    <AppBackgroundWrapper>
      <View style={styles.container}>
        <Card
          title="Mark Your Attendance"
          iconName="qr-code-outline"
          onPress={() => navigation.navigate('ManualEntry')}
          delay={200}
        />
        <Card
          title="View Attendance"
          iconName="calendar-outline"
          onPress={() => navigation.navigate('AttendanceView')}
          delay={400}
        />

        {showBanner && (
          <Animatable.View
            animation="slideInUp"
            duration={400}
            style={[styles.statusBanner, styles.success]}
          >
            <Text style={styles.statusText}>{bannerMessage}</Text>
          </Animatable.View>
        )}
      </View>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: 300,
    backgroundColor: '#e2e8f0',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  cardText: {
    marginTop: 12,
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1e293b',
  },
  statusBanner: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    zIndex: 100,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  success: {
    backgroundColor: '#d1fae5',
    borderLeftColor: '#059669',
  },
});