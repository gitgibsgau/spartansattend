import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AdminHomeStackNavigator from './AdminHomeStackNavigator';
import QRGeneratorScreen from '../screens/QRGeneratorScreen';
import EventsScreen from '../screens/EventsScreen';
import AttendanceStackNavigator from './AttendanceStackNavigator';
import ResetDevice from '../screens/ResetDevice';
import RebindRequests from '../screens/RebindRequests';
import Icon from 'react-native-vector-icons/Ionicons';
import DummyLogoutScreen from '../screens/DummyLogoutScreen';
import AdminParikshanScreen from '../screens/AdminParikshanScreen';
import { colors, fonts } from '../theme';
import CustomTabBar from '../components/ui/CustomTabBar';

const Tab = createBottomTabNavigator();

export default function AdminTabsNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = 'grid-outline';
          else if (route.name === 'Events') iconName = 'calendar-clear-outline';
          else if (route.name === 'QR Generator') iconName = 'qr-code-outline';
          else if (route.name === 'Attendance') iconName = 'calendar-outline';
          else if (route.name === 'Reset') iconName = 'refresh-outline';
          else if (route.name === 'Rebind') iconName = 'help-circle-outline';

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 11,
        },
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: colors.surface, shadowOpacity: 0, elevation: 0 },
        headerTitleStyle: {
          fontFamily: fonts.semibold,
          fontSize: 18,
          color: colors.text,
        },
        headerTintColor: colors.primary,
        headerShown: true, // ✅ FIX: ensure headers are shown
      })}
    >
      <Tab.Screen
        name="Home"
        component={AdminHomeStackNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="QR Generator"
        component={QRGeneratorScreen}
        options={{ tabBarLabel: 'QR' }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceStackNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Parikshan"
        component={AdminParikshanScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="create-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen name="Events" component={EventsScreen} />
      {/* <Tab.Screen name="Reset" component={ResetDevice} />
      <Tab.Screen name="Rebind" component={RebindRequests} /> */}
      <Tab.Screen
        name="Logout"
        component={DummyLogoutScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="log-out-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}