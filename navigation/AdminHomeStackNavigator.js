import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminHomeScreen from '../screens/AdminHomeScreen';
import AdminSendNotificationScreen from '../screens/AdminSendNotificationScreen';
import { colors, fonts } from '../theme';

const Stack = createNativeStackNavigator();

export default function AdminHomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface, shadowOpacity: 0, elevation: 0 },
        headerTintColor: colors.primary,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
      }}
    >
      <Stack.Screen
        name="AdminHomeMain"
        component={AdminHomeScreen}
        options={{ title: 'Home' }}
      />
      <Stack.Screen
        name="SendNotification"
        component={AdminSendNotificationScreen}
        options={{ title: 'Send Notification', headerBackTitleVisible: false }}
      />
    </Stack.Navigator>
  );
}
