import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.neutral.accent,
        tabBarInactiveTintColor: theme.neutral.textMuted,
        tabBarStyle: { backgroundColor: theme.neutral.surface, borderTopColor: theme.neutral.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Focus', tabBarIcon: ({ color, size }) => <Feather name="target" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="rituals/index"
        options={{
          title: 'Rituals',
          tabBarIcon: ({ color, size }) => <Feather name="repeat" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <Feather name="check-square" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history/index"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
