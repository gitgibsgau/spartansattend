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
import { LinearGradient } from '../components/ui/Gradient';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius, fonts, shadows } from '../theme';
import { Card } from '../components/ui';

export default function HomeScreen() {
  const navigation = useNavigation();

  const handleOpenURL = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.headerRow}>
        <Image source={require('../assets/icon.png')} style={styles.logo} />
        <Pressable
          style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.85 }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginText}>Login</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerBox}
        >
          <Text style={styles.heading}>MMBA Spartans</Text>
          <Text style={styles.subHeading}>Dhol Tasha Dhwaj Pathak - Bay Area</Text>
        </LinearGradient>

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

        <Text style={styles.followTitle}>Follow Us</Text>
        <View style={styles.socialRow}>
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
            onPress={() => handleOpenURL('https://www.facebook.com/mmbaspartans')}
          >
            <FontAwesome name="facebook-square" size={34} color="#1877F2" />
            <Text style={styles.socialText}>Facebook</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
            onPress={() => handleOpenURL('https://www.instagram.com/mmbaspartans')}
          >
            <FontAwesome name="instagram" size={34} color="#E4405F" />
            <Text style={styles.socialText}>Instagram</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
  },
  logo: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
  },
  loginBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    ...shadows.primary,
  },
  loginText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontFamily: fonts.semibold,
  },
  container: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: spacing['4xl'] + 20,
  },
  headerBox: {
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
    ...shadows.primary,
  },
  heading: {
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.textOnPrimary,
    textAlign: 'center',
  },
  subHeading: {
    fontSize: 13.5,
    fontFamily: fonts.regular,
    color: '#E0E7FF',
    textAlign: 'center',
    marginTop: 6,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  followTitle: {
    fontSize: 16.5,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
  },
  iconButton: {
    alignItems: 'center',
  },
  socialText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 4,
    fontFamily: fonts.regular,
  },
});
