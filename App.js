import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

import { DiaryProvider } from './src/context/DiaryContext';
import { COLORS } from './src/utils/theme';

import TodayScreen from './src/screens/TodayScreen';
import ChecklistScreen from './src/screens/ChecklistScreen';
import SignoffScreen from './src/screens/SignoffScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EntryDetailScreen from './src/screens/EntryDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabIcon({ name, focused }) {
  const icons = {
    Today: focused ? '✏️' : '📝',
    Checklist: focused ? '☑️' : '📋',
    'Sign off': focused ? '✍️' : '📄',
    History: focused ? '🗂️' : '📁',
    Settings: focused ? '⚙️' : '🔧',
  };
  return <Text style={{ fontSize: 20 }}>{icons[name] || '•'}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: COLORS.orange,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 0.5,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Checklist" component={ChecklistScreen} />
      <Tab.Screen name="Sign off" component={SignoffScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DiaryProvider>
          <NavigationContainer>
            <StatusBar style="light" backgroundColor={COLORS.orange} />
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </DiaryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
