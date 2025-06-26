import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ProfileScreen from '../screens/ProfileScreen';
import AttendanceStackNavigator from './AttendanceStackNavigator';
import EventsScreen from '../screens/EventsScreen';
import Icon from 'react-native-vector-icons/Ionicons';
import DummyLogoutScreen from '../screens/DummyLogoutScreen';

const Tab = createBottomTabNavigator();

export default function StudentTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Profile') iconName = 'person-circle-outline';
          else if (route.name === 'Attendance') iconName = 'calendar-outline';
          else if (route.name === 'Events') iconName = 'calendar-clear-outline';

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Attendance" component={AttendanceStackNavigator} />
      <Tab.Screen name="Events" component={EventsScreen} />
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