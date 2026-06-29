import React from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiary } from '../context/DiaryContext';
import AppHeader from '../components/AppHeader';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/theme';

const CHECKLIST_ITEMS = [
  { id: 0, label: 'Inspections and Tests' },
  { id: 1, label: 'Visitors and Purposes' },
  { id: 2, label: 'Discussions and Meetings' },
  { id: 3, label: 'Shortage of Information' },
  { id: 4, label: 'Delays, Defects – Client supplies' },
  { id: 5, label: 'Planning information required' },
  { id: 6, label: 'Equipment on hire' },
  { id: 7, label: 'Messages' },
];

export default function ChecklistScreen() {
  const { state, dispatch } = useDiary();
  const { entry } = state;
  const insets = useSafeAreaInsets();

  function update(index, updates) {
    const current = entry.checklist[index] || { checked: false, note: '' };
    dispatch({ type: 'UPDATE_CHECKLIST', index, value: { ...current, ...updates } });
  }

  const checked = CHECKLIST_ITEMS.filter(i => entry.checklist[i.id]?.checked).length;

  return (
    <View style={styles.container}>
      <AppHeader title="Other Checklist" subtitle={`${checked} of ${CHECKLIST_ITEMS.length} items marked`} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.card}>
          {CHECKLIST_ITEMS.map((item, idx) => {
            const cl = entry.checklist[item.id] || { checked: false, note: '' };
            return (
              <View key={item.id} style={[styles.row, idx < CHECKLIST_ITEMS.length - 1 && styles.rowBorder]}>
                <TouchableOpacity
                  style={[styles.circle, cl.checked && styles.circleChecked]}
                  onPress={() => update(item.id, { checked: !cl.checked })}
                  activeOpacity={0.7}
                >
                  {cl.checked && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
                <View style={styles.rowBody}>
                  <Text style={[styles.itemLabel, cl.checked && styles.itemLabelChecked]}>
                    {idx + 1}. {item.label}
                  </Text>
                  <TextInput
                    style={styles.noteInput}
                    value={cl.note}
                    onChangeText={v => update(item.id, { note: v })}
                    placeholder="Add notes..."
                    placeholderTextColor={COLORS.textHint}
                    multiline
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.border, ...SHADOW.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, gap: SPACING.md },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  circle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  circleChecked: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rowBody: { flex: 1 },
  itemLabel: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 20 },
  itemLabelChecked: { color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  noteInput: { marginTop: 6, fontSize: 12, color: COLORS.textPrimary, borderWidth: 0.5, borderColor: 'transparent', borderRadius: RADIUS.sm, padding: 6, backgroundColor: COLORS.background },
});
