import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFonts, Poppins_600SemiBold, Poppins_400Regular } from '@expo-google-fonts/poppins';

export default function HomeScreen() {
  const navigation = useNavigation();

  const handleOpenURL = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  let [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.headerRow}>
        <Image source={require('../assets/icon.png')} style={styles.logo} />
        <Pressable style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginText}>Login</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBox}>
          <Text style={styles.heading}>MMBA Spartans</Text>
          <Text style={styles.subHeading}>Dhol Tasha Dhwaj Pathak - Bay Area</Text>
        </View>

        <Section title="About Us">
          The first Dhol Tasha Pathak in the Bay Area founded by SJSU
          students, alumni & Hindu Yuva SJSU. Operated under Maharashtra Mandal
          Bay Area (MMBA).
        </Section>

        <Section title="Activities">
          • Teach Dhol, Tasha, and Dhwaj
        </Section>

        <Section title="Practice Information">
          • Starts in June every year{"\n"}
          • Schedule posted on Facebook and Instagram{"\n"}
          • Location: SJSU Event Center
        </Section>

        <Section title="Events We Perform at:">
          • MMBA Ganpati{"\n"}
          • Radio Zindagi Ganpati{"\n"}
          • Mission Pointe, Golden Gate
        </Section>

        <Section title="Contact">
          📧 spartanpathak@gmail.com
        </Section>

        <Text style={styles.sectionTitle}>Follow Us</Text>
        <View style={styles.socialRow}>
          <Pressable
            style={styles.iconButton}
            onPress={() => handleOpenURL('https://www.facebook.com/mmbaspartans')}
          >
            <FontAwesome name="facebook-square" size={36} color="#1877F2" />
            <Text style={styles.socialText}>Facebook</Text>
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={() => handleOpenURL('https://www.instagram.com/mmbaspartans')}
          >
            <FontAwesome name="instagram" size={36} color="#E4405F" />
            <Text style={styles.socialText}>Instagram</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  logo: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
  },
  loginBtn: {
    backgroundColor: '#0F52BA',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  loginText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 60,
  },
  headerBox: {
    backgroundColor: '#0F52BA',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heading: {
    fontSize: 24,
    fontFamily: 'Poppins_600SemiBold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subHeading: {
    fontSize: 13.5,
    fontFamily: 'Poppins_400Regular',
    color: '#dbeafe',
    textAlign: 'center',
    marginTop: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1e293b',
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 21,
    color: '#374151',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  iconButton: {
    alignItems: 'center',
  },
  socialText: {
    fontSize: 12.5,
    color: '#374151',
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
  },
});