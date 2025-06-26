import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, StatusBar
} from 'react-native';
import { db } from '../firebase';
import {
  collection, getDocs, updateDoc, doc, query, where
} from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';

export default function RebindRequests({ navigation }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const q = query(collection(db, 'users'), where('rebindRequest', '==', true));
        const querySnapshot = await getDocs(q);
        const users = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRequests(users);
      } catch (err) {
        console.error("Error fetching requests:", err);
      }
    };

    fetchRequests();
  }, []);

  const handleApprove = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        deviceId: null,
        rebindRequest: false
      });
      Alert.alert("✅ Rebind Approved", "Student's device ID has been reset.");
      setRequests(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const renderItem = ({ item, index }) => (
    <Animatable.View
      animation="fadeInUp"
      delay={index * 100}
      useNativeDriver
      style={styles.card}
    >
      <View style={styles.cardContent}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.email}</Text>
          <Text style={styles.info}>User ID: {item.id}</Text>
        </View>
        <TouchableOpacity onPress={() => handleApprove(item.id)}>
          <Icon name="checkmark-circle" size={34} color="#10b981" />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  return (
    <AppBackgroundWrapper>
    <View style={styles.container}>
      <StatusBar backgroundColor="#0f172a" barStyle="light-content" />
      <Animatable.Text
        animation="fadeInDown"
        delay={100}
        style={styles.header}
      >
        Device Rebind Requests
      </Animatable.Text>

      {requests.length === 0 ? (
        <Animatable.Text
          animation="fadeIn"
          delay={300}
          style={styles.noRequests}
        >
          🎉 No pending requests.
        </Animatable.Text>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </View>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1e3a8a',
    marginBottom: 20,
  },
  noRequests: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  info: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
});
