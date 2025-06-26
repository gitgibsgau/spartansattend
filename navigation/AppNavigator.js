import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AdminDashboard from '../screens/AdminDashboard';
import StudentDashboard from '../screens/StudentDashboard';
import QRGeneratorScreen from '../screens/QRGeneratorScreen';
import ManualEntryScreen from '../screens/ManualEntryScreen';
import AttendanceViewScreen from '../screens/AttendanceViewScreen';
import ResetDevice from '../screens/ResetDevice';
import RebindRequests from '../screens/RebindRequests';
import SessionDataScreen from '../screens/SessionDataScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ headerShown: false }} />
        <Stack.Screen name="StudentDashboard" component={StudentDashboard} options={{ headerShown: false }} />
        <Stack.Screen name="QRGenerator" component={QRGeneratorScreen} />
        <Stack.Screen name="ManualEntry" component={ManualEntryScreen} />
        <Stack.Screen name="AttendanceView" component={AttendanceViewScreen} />
        <Stack.Screen name="ResetDevice" component={ResetDevice} />
        <Stack.Screen name="RebindRequests" component={RebindRequests} />
        <Stack.Screen name="SessionDataScreen" component={SessionDataScreen} />
    </Stack.Navigator>

  );
}
