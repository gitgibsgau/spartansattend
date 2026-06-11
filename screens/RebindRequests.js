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
import { colors, spacing, radius, fonts, shadows } from '../theme';

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
          <Icon name="checkmark-circle" size={34} color={colors.success} />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  return (
    <AppBackgroundWrapper>
    <View style={styles.container}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
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
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  header: {
    fontSize: 24,
    fontFamily: fonts.bold,
    textAlign: 'center',
    color: colors.text,
    marginBottom: spacing.xl,
  },
  noRequests: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing['4xl'],
    fontFamily: fonts.regular,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  info: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
