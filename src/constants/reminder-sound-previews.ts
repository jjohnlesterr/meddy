import type { AudioSource } from 'expo-audio';

import type { ReminderSound } from '@/types/medicine';

// In-app preview sources for the Add/Edit Medicine sound picker. These are the
// same three WAV files that expo-notifications bundles as Android raw resources
// (see the `sounds` array in app.json) and that the notification channels use,
// so the preview a user hears matches the reminder that will actually fire.
export const reminderSoundPreviewSources: Partial<Record<ReminderSound, AudioSource>> = {
  gentle_chime: require('../../assets/sounds/gentle_chime.wav'),
  soft_bell: require('../../assets/sounds/soft_bell.wav'),
  morning_tone: require('../../assets/sounds/morning_tone.wav'),
};
