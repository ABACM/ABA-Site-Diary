import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ENTRIES: 'aba_diary_entries',
  SETTINGS: 'aba_diary_settings',
  PERSONNEL: 'aba_diary_personnel',
};

export async function getEntries() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ENTRIES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveEntry(entry) {
  try {
    const entries = await getEntries();
    const idx = entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) entries[idx] = entry;
    else entries.unshift(entry);
    await AsyncStorage.setItem(KEYS.ENTRIES, JSON.stringify(entries));
    return true;
  } catch { return false; }
}

export async function getEntry(id) {
  const entries = await getEntries();
  return entries.find(e => e.id === id) || null;
}

export async function updateEntry(id, updates) {
  const entries = await getEntries();
  const idx = entries.findIndex(e => e.id === id);
  if (idx < 0) return false;
  entries[idx] = { ...entries[idx], ...updates };
  await AsyncStorage.setItem(KEYS.ENTRIES, JSON.stringify(entries));
  return true;
}

export async function getSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : {
      companyName: 'ABA Construction Managers (Aust) Pty Ltd',
      companyAddress: 'Suite 7 Level One, 55 Heffernan St, Mitchell ACT 2911',
      companyPhone: '(02) 6242 3400',
      projectManager: { name: '', email: '' },
      qaRep: { name: '', email: '' },
      siteSupervisor: { name: '', email: '' },
      savedSubcontractors: [
        'Clarke Civil', 'Mitchell Electrical', 'ACT Plumbing', 'Apex Formwork', 'Total Concreting',
      ],
    };
  } catch { return {}; }
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch { return false; }
}
