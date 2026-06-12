import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import { colors, fonts } from '../theme';

const Stack = createNativeStackNavigator();

export default function ProfileStackNavigator() {
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
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile', headerBackTitleVisible: false }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications', headerBackTitleVisible: false }}
      />
      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{ title: 'Achievements', headerBackTitleVisible: false }}
      />
    </Stack.Navigator>
  );
}
