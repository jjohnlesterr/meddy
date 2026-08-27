import { TabList, TabSlot, Tabs, TabTrigger, TabTriggerSlotProps } from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';

const tabs = [
  { name: 'home', href: '/home' as const, label: 'Home', icon: '⌂' },
  { name: 'medicines', href: '/medicines' as const, label: 'Medicines', icon: '◇' },
  { name: 'care-circle', href: '/care-circle' as const, label: 'Care Circle', icon: '♡' },
  { name: 'profile', href: '/profile' as const, label: 'Profile', icon: '○' },
];

function TabButton({ isFocused, children, ...props }: TabTriggerSlotProps) {
  const content = String(children);
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      <Text style={[styles.icon, isFocused && styles.selectedText]}>{content.slice(0, 1)}</Text>
      <Text style={[styles.label, isFocused && styles.selectedText]}>{content.slice(1)}</Text>
    </Pressable>
  );
}

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href as Href} asChild>
              <TabButton>{`${tab.icon}${tab.label}`}</TabButton>
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  slot: { height: '100%' },
  tabBar: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', width: '92%', maxWidth: 620, padding: 8, borderRadius: 24, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border, boxShadow: '0 6px 16px rgba(110, 50, 68, 0.12)' },
  tab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 18 },
  icon: { color: Palette.textSecondary, fontSize: 21, lineHeight: 22 },
  label: { color: Palette.textSecondary, fontSize: 11, fontWeight: '600' },
  selectedText: { color: Palette.strongPink, fontWeight: '800' },
  pressed: { opacity: 0.65, backgroundColor: Palette.softPink },
});
