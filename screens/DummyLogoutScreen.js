import React, { useEffect } from 'react';
import { auth } from '../firebase';

export default function DummyLogoutScreen({ navigation }) {
  useEffect(() => {
    const logout = async () => {
      try {
        await auth.signOut();
        navigation.navigate('Drawer', { screen: 'Home' }); // or wherever your login logic starts
      } catch (err) {
        console.error('Logout failed:', err.message);
      }
    };

    logout();
  }, []);

  return null;
}