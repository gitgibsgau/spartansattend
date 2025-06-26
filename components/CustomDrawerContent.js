import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function CustomDrawerContent(props) {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      }
    };
    loadUser();
  }, []);

  if (!fontsLoaded) return null;

  const filteredRoutes = props.state?.routes?.filter(
    (r) => !(r.name === 'Login' && auth.currentUser)
  );

  const filteredRouteNames = props.state?.routeNames?.filter(
    (name) => !(name === 'Login' && auth.currentUser)
  );

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.header}>
        <Ionicons name="person-circle-outline" size={64} color="#1e3a8a" />
        <Text style={styles.name}>{userData?.fullname || 'Spartan'}</Text>
        <Text style={styles.email}>{userData?.email || ''}</Text>
      </View>

      <View style={styles.body}>
        {props.state?.routes && (
          <DrawerItemList
            {...props}
            state={{
              ...props.state,
              routes: filteredRoutes,
              routeNames: filteredRouteNames,
            }}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Pressable onPress={() => alert('More features coming soon!')}>
          <Text style={styles.footerText}>About Us</Text>
        </Pressable>

        {auth.currentUser && (
          <Pressable
            onPress={async () => {
              await auth.signOut();
              props.navigation.reset({
                index: 0,
                routes: [{ name: 'Drawer', params: { screen: 'Home' } }],
              });
            }}
            style={{ marginTop: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="log-out-outline" size={18} color="#dc2626" />
              <Text style={[styles.footerText, { color: '#dc2626' }]}>Logout</Text>
            </View>
          </Pressable>
        )}
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  name: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#1e293b',
    marginTop: 8,
  },
  email: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12.5,
    color: '#64748b',
  },
  body: {
    flex: 1,
    paddingTop: 10,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#1e3a8a',
  },
});