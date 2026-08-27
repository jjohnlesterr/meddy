import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Palette } from '@/constants/theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Palette.white}
      indicatorColor={Palette.lightPink}
      iconColor={{ default: Palette.textSecondary, selected: Palette.strongPink }}
      labelStyle={{ default: { color: Palette.textSecondary, fontSize: 12 }, selected: { color: Palette.strongPink, fontSize: 12, fontWeight: '700' } }}>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="medicines">
        <NativeTabs.Trigger.Label>Medicines</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'pills', selected: 'pills.fill' }} md="medication" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="care-circle">
        <NativeTabs.Trigger.Label>Care Circle</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
