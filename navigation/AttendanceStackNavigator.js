import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AttendanceHome from '../screens/AttendanceHome';
import ManualEntryScreen from '../screens/ManualEntryScreen';
import AttendanceViewScreen from '../screens/AttendanceViewScreen';
import { Text, StyleSheet } from 'react-native';
import { useFonts, Poppins_600SemiBold } from '@expo-google-fonts/poppins';

const Stack = createNativeStackNavigator();

const HeaderTitle = ({ title }) => {
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold });
  if (!fontsLoaded) return null;

  return (
    <Text style={styles.headerTitle}>{title}</Text>
  );
};

export default function AttendanceStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="AttendanceHome"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen
        name="AttendanceHome"
        component={AttendanceHome}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManualEntry"
        component={ManualEntryScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Enter Session Code" />,
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="AttendanceView"
        component={AttendanceViewScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Your Attendance" />,
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1e293b',
  },
});