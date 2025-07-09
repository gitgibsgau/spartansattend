// navigation/UnauthStackNavigator.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AdminTabsNavigator from './AdminTabsNavigator';
import StudentTabsNavigator from './StudentTabsNavigator';

const Stack = createNativeStackNavigator();

export default function UnauthStackNavigator() {
    return (
        <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminTabsNavigator} />
            <Stack.Screen name="StudentDashboard" component={StudentTabsNavigator} />
        </Stack.Navigator>
    );
}