import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AdminTabsNavigator from './AdminTabsNavigator';
import StudentTabsNavigator from './StudentTabsNavigator';
import CustomDrawerContent from '../components/CustomDrawerContent'; // 👈 import

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        drawerActiveTintColor: '#1e3a8a',
        drawerLabelStyle: {
          fontFamily: 'Poppins_600SemiBold',
          fontSize: 14,
        },
      }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="Login" component={LoginScreen} />
      <Drawer.Screen
        name="Register"
        component={RegisterScreen}
        options={{ drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen
        name="AdminDashboard"
        component={AdminTabsNavigator}
        options={{ drawerItemStyle: { display: 'none' } }}
      />

      <Drawer.Screen
        name="StudentDashboard"
        component={StudentTabsNavigator}
        options={{ drawerItemStyle: { display: 'none' } }}
      />
    </Drawer.Navigator>
  );
}