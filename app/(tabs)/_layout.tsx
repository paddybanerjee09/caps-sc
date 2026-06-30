import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const doNothingYet = () => {};

  return (
    <SafeAreaView edges={['top']} style={styles.appShell}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={() => setSidebarOpen(true)}
          style={styles.menuButton}>
          <Text style={styles.menuButtonText}>☰</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={doNothingYet} style={styles.aiButton}>
          <Text style={styles.aiButtonText}>CAPS AI</Text>
        </Pressable>
      </View>

      {sidebarOpen ? (
        <View style={styles.sidebarLayer}>
          <Pressable style={styles.sidebarBackdrop} onPress={() => setSidebarOpen(false)} />
          <View style={styles.sidebar}>
            <Pressable onPress={doNothingYet} style={styles.sidebarButton}>
              <Text style={styles.sidebarButtonText}>Accounts</Text>
            </Pressable>
            <Pressable onPress={doNothingYet} style={styles.sidebarButton}>
              <Text style={styles.sidebarButtonText}>Settings</Text>
            </Pressable>
            <Pressable onPress={doNothingYet} style={styles.sidebarButton}>
              <Text style={styles.sidebarButtonText}>Athlete Info</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Tabs
        initialRouteName="index"
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="nutrition"
          options={{
            title: 'Nutrition',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="fork.knife" color={color} />,
          }}
        />
        <Tabs.Screen
          name="sport-training"
          options={{
            title: 'Sport Training',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="figure.boxing" color={color} />,
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="strength-conditioning"
          options={{
            title: 'S&C',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="dumbbell.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.line.uptrend.xyaxis" color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#16181D',
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#16181D',
    borderBottomColor: '#2D313A',
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  menuButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 44,
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
  },
  aiButton: {
    borderColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sidebarLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 48,
    zIndex: 10,
  },
  sidebarBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sidebar: {
    backgroundColor: '#FFFFFF',
    borderRightColor: '#D7DAE0',
    borderRightWidth: 1,
    height: '100%',
    padding: 16,
    width: 220,
  },
  sidebarButton: {
    borderBottomColor: '#ECEEF2',
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  sidebarButtonText: {
    color: '#16181D',
    fontSize: 16,
    fontWeight: '600',
  },
});
