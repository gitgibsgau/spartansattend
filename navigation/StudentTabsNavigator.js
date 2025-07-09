import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ProfileScreen from '../screens/ProfileScreen';
import AttendanceStackNavigator from './AttendanceStackNavigator';
import EventsScreen from '../screens/EventsScreen';
import DummyLogoutScreen from '../screens/DummyLogoutScreen';
import AdminParikshanScreen from '../screens/AdminParikshanScreen';
import Icon from 'react-native-vector-icons/Ionicons';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const Tab = createBottomTabNavigator();

export default function StudentTabsNavigator() {
  const [isScorer, setIsScorer] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setIsScorer(userData.isScorer || false);
      }
    };
    fetchUserData();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Profile') iconName = 'person-circle-outline';
          else if (route.name === 'Attendance') iconName = 'calendar-outline';
          else if (route.name === 'Events') iconName = 'calendar-clear-outline';
          else if (route.name === 'Parikshan') iconName = 'school-outline';
          else if (route.name === 'Logout') iconName = 'log-out-outline';

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Attendance" component={AttendanceStackNavigator} />
      <Tab.Screen name="Events" component={EventsScreen} />
      {isScorer && (
        <Tab.Screen
          name="Parikshan"
          component={AdminParikshanScreen}
          options={{
            tabBarLabel: 'Parikshan',
          }}
        />
      )}
      <Tab.Screen name="Logout" component={DummyLogoutScreen} />
    </Tab.Navigator>
  );
}