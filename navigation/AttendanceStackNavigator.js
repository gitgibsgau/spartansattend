import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AttendanceHome from '../screens/AttendanceHome';
import ManualEntryScreen from '../screens/ManualEntryScreen';
import AttendanceViewScreen from '../screens/AttendanceViewScreen';
import AdminAttendanceRequestsScreen from '../screens/AdminAttendanceRequestScreen';
import { Text, StyleSheet } from 'react-native';
import SessionDataScreen from '../screens/SessionDataScreen'; // ✅ Add this line
import { colors, fonts } from '../theme';

const Stack = createNativeStackNavigator();

const HeaderTitle = ({ title }) => {
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
          backgroundColor: colors.surface,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTintColor: colors.primary,
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
          headerTitle: () => <HeaderTitle title="Mark Your Attendance" />,
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
      <Stack.Screen
        name="AdminAttendanceRequests"
        component={AdminAttendanceRequestsScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Attendance Requests" />,
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="SessionDataScreen"
        component={SessionDataScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Session Data" />,
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
});