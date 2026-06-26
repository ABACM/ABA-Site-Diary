import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiary } from '../context/DiaryContext';
import AppHeader from '../components/AppHeader';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/theme';

const PEOPLE_FIELDS = [
  { key: 'siteSupervisor', label: 'Site Supervisor', icon: '🦺' },
  { key: 'projectManager', label: 'Project Manager', icon: '📋' },
  { key: 'qaRep', label: 'QA Representative', icon: '🔍' },
];

export default function SettingsScreen() {
  const { state, updateSettings } = useDiary();
  const { settings } = state;
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(settings || {});

  function updateLocal(path, value) {
    const parts = path.split('.');
    setLocal(prev => {
      const copy = { ...prev };
      if (parts.length === 2) {
        copy[parts[0]] = { ...copy[parts[0]], [parts[1]]: value };
      } else {
        copy[parts[0]] = value;
      }
      return copy;
    });
  }

  async function handleSave() {
    setSaving(true);
    await updateSettings(local);
    setSaving(false);
    Alert.alert('✅ Settings saved', 'Personnel assignments updated. Sign-off emails will be sent to the configured addresses.');
  }

  function addSavedSub() {
    Alert.prompt('Add subcontractor', 'Enter company name', (name) => {
      if (name?.trim()) {
        const subs = [...(local.savedSubcontractors || []), name.trim()];
        updateLocal('savedSubcontractors', subs);
      }
    });
  }

  function removeSub(idx) {
    const subs = (local.savedSubcontractors || []).filter((_, i) => i !== idx);
    updateLocal('savedSubcontractors', subs);
  }

  if (!settings) return (
    <View style={styles.container}>
      <AppHeader title="Settings" />
      <View style={styles.centered}><ActivityIndicator color={COLORS.orange} /></View>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Settings" subtitle="Project personnel & preferences" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>

        {/* Company info */}
        <SectionHeader title="Company details" />
        <View style={styles.card}>
          <Field label="Company name">
            <TextInput style={styles.input} value={local.companyName || ''} onChangeText={v => updateLocal('companyName', v)} placeholder="ABA Construction Managers" />
          </Field>
          <Field label="Address" style={{ marginTop: SPACING.sm }}>
            <TextInput style={styles.input} value={local.companyAddress || ''} onChangeText={v => updateLocal('companyAddress', v)} placeholder="55 Heffernan St, Mitchell ACT 2911" />
          </Field>
          <Field label="Phone" style={{ marginTop: SPACING.sm }}>
            <TextInput style={styles.input} value={local.companyPhone || ''} onChangeText={v => updateLocal('companyPhone', v)} placeholder="(02) 6242 3400" keyboardType="phone-pad" />
          </Field>
        </View>

        {/* Personnel assignment */}
        <SectionHeader title="Sign-off personnel" />
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>📧 When a diary entry is signed off by the PM and QA Rep, a PDF will automatically be emailed to all three people below.</Text>
        </View>

        {PEOPLE_FIELDS.map(p => (
          <View key={p.key} style={styles.card}>
            <View style={styles.personHeader}>
              <Text style={styles.personIcon}>{p.icon}</Text>
              <Text style={styles.personRole}>{p.label}</Text>
            </View>
            <Field label="Full name">
              <TextInput
                style={styles.input}
                value={local[p.key]?.name || ''}
                onChangeText={v => updateLocal(`${p.key}.name`, v)}
                placeholder={`${p.label} name`}
                autoCapitalize="words"
              />
            </Field>
            <Field label="Email address" style={{ marginTop: SPACING.sm }}>
              <TextInput
                style={styles.input}
                value={local[p.key]?.email || ''}
                onChangeText={v => updateLocal(`${p.key}.email`, v)}
                placeholder="email@company.com.au"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
          </View>
        ))}

        {/* Saved subcontractors */}
        <SectionHeader title="Saved subcontractors" />
        <View style={styles.card}>
          <Text style={styles.hint}>These appear as quick-add tags in the diary entry form.</Text>
          {(local.savedSubcontractors || []).map((sub, i) => (
            <View key={i} style={styles.subRow}>
              <Text style={styles.subName}>🏗 {sub}</Text>
              <TouchableOpacity onPress={() => removeSub(i)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addSubBtn} onPress={addSavedSub}>
            <Text style={styles.addSubBtnText}>＋ Add subcontractor</Text>
          </TouchableOpacity>
        </View>

        {/* WHS Stats config */}
        <SectionHeader title="WHS Statistics" />
        <View style={styles.card}>
          <Text style={styles.hint}>These values are used in the monthly statistics report.</Text>
          <Field label="Project start date (YYYY-MM-DD)" style={{ marginTop: SPACING.sm }}>
            <TextInput style={styles.input} value={local.projectStartDate || ''} onChangeText={v => updateLocal('projectStartDate', v)} placeholder="2024-01-01" />
          </Field>
          <Field label="Standard work hours per day" style={{ marginTop: SPACING.sm }}>
            <TextInput style={styles.input} value={local.standardHoursPerDay || ''} onChangeText={v => updateLocal('standardHoursPerDay', v)} placeholder="8" keyboardType="numeric" />
          </Field>
        </View>

      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Save settings</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Field({ label, children, style }) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm, marginTop: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.sm },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  personIcon: { fontSize: 22 },
  personRole: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  fieldLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  input: { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: 14, color: COLORS.textPrimary, backgroundColor: COLORS.white },
  infoBox: { backgroundColor: COLORS.blueLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  infoText: { fontSize: 13, color: COLORS.blue, lineHeight: 20 },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  subName: { fontSize: 14, color: COLORS.textPrimary },
  removeBtn: { fontSize: 16, color: COLORS.danger, padding: 4 },
  addSubBtn: { marginTop: SPACING.sm, padding: SPACING.sm, borderWidth: 0.5, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: RADIUS.md, alignItems: 'center' },
  addSubBtnText: { fontSize: 13, color: COLORS.textSecondary },
  saveBar: { backgroundColor: COLORS.white, padding: SPACING.md, borderTopWidth: 0.5, borderTopColor: COLORS.border },
  saveBtn: { backgroundColor: COLORS.orange, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
