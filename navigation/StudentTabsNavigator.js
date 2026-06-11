import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ProfileStackNavigator from './ProfileStackNavigator';
import AttendanceStackNavigator from './AttendanceStackNavigator';
import EventsScreen from '../screens/EventsScreen';
import DummyLogoutScreen from '../screens/DummyLogoutScreen';
import AdminParikshanScreen from '../screens/AdminParikshanScreen';
import Icon from 'react-native-vector-icons/Ionicons';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { colors, fonts } from '../theme';
import CustomTabBar from '../components/ui/CustomTabBar';

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
      tabBar={(props) => <CustomTabBar {...props} />}
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
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
        headerTintColor: colors.primary,
      })}
    >
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceStackNavigator}
        options={{ headerShown: false }}
      />
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