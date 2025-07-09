import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import AuthGate from './AuthGate';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
enableScreens(); // <-- Add this at the top


export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthGate />
      </NavigationContainer>
      <StatusBar style="auto" backgroundColor="#ffffff" translucent />
    </SafeAreaProvider>
  );
}
