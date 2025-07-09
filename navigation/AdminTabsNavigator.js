import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AdminHomeScreen from '../screens/AdminHomeScreen';
import QRGeneratorScreen from '../screens/QRGeneratorScreen';
import EventsScreen from '../screens/EventsScreen';
import AttendanceViewScreen from '../screens/AttendanceViewScreen';
import ResetDevice from '../screens/ResetDevice';
import RebindRequests from '../screens/RebindRequests';
import Icon from 'react-native-vector-icons/Ionicons';
import DummyLogoutScreen from '../screens/DummyLogoutScreen';
import AdminParikshanScreen from '../screens/AdminParikshanScreen';

const Tab = createBottomTabNavigator();

export default function AdminTabsNavigator() {
  return (
    <Tab.Navigator
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
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: 'gray',
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: 'Poppins_600SemiBold',
          fontSize: 18,
          color: '#1e3a8a',
        },
        headerShown: true, // ✅ FIX: ensure headers are shown
      })}
    >
      <Tab.Screen name="Home" component={AdminHomeScreen} />
      <Tab.Screen name="QR Generator" component={QRGeneratorScreen} />
      <Tab.Screen name="Attendance" component={AttendanceViewScreen} />
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