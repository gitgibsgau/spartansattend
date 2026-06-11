import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import AuthGate from './AuthGate';
import { SeasonProvider } from './contexts/SeasonContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { colors } from './theme';

enableScreens(); // <-- Add this at the top

// Show notifications as a banner even when the app is in the foreground.
// Loaded via guarded require so the app still runs in environments where the
// expo-notifications native module isn't present (e.g. Expo Go / a build made
// before the module was added). Push is a no-op there; the inbox still works.
try {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.log('expo-notifications unavailable; push disabled:', e?.message);
}


export default function App() {
  // Load all Poppins weights once, globally, so every screen + UI primitive
  // can reference them without re-declaring useFonts.
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SeasonProvider>
        <NotificationsProvider>
          <NavigationContainer>
            <AuthGate />
          </NavigationContainer>
        </NotificationsProvider>
      </SeasonProvider>
      <StatusBar style="dark" backgroundColor={colors.background} translucent />
    </SafeAreaProvider>
  );
}
