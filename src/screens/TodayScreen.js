import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { useDiary } from '../context/DiaryContext';
import { saveEntry } from '../utils/storage';
import { calcSubHours, calcTotals } from '../utils/pdfExport';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/theme';
import AppHeader from '../components/AppHeader';

const WEATHER_OPTS = ['Sunny ☀️', 'Cloudy ☁️', 'Rain 🌧', 'Wind 💨', 'Hot 🌡', 'Cold 🥶'];

const SECTIONS = [
  { id: 'work',     label: 'Work in progress',          placeholder: 'Pour No. / Item No. / Activity...' },
  { id: 'delays',   label: 'Delays incurred',           placeholder: 'Industrial, weather, access, interference...' },
  { id: 'oral',     label: 'Oral instructions',         placeholder: 'Instructions received or given...' },
  { id: 'drawings', label: 'Drawings & memos received', placeholder: 'Document reference and description...' },
];

const DEFAULT_SUBS = ['Clarke Civil', 'Mitchell Electrical', 'ACT Plumbing', 'Apex Formwork', 'Total Concreting'];

export default function TodayScreen() {
  const { state, dispatch } = useDiary();
  const { entry, settings } = state;
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({ work: true, subs: true });

  const update = useCallback(
    (updates) => dispatch({ type: 'UPDATE_ENTRY', payload: updates }),
    [dispatch],
  );

  function toggleSection(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  /* ── section entries ── */
  function updateLine(sid, i, val) {
    const arr = [...(entry.sections[sid] || [''])];
    arr[i] = val;
    dispatch({ type: 'UPDATE_SECTION', key: sid, value: arr });
  }
  function addLine(sid) {
    const arr = [...(entry.sections[sid] || ['']), ''];
    dispatch({ type: 'UPDATE_SECTION', key: sid, value: arr });
  }
  function removeLine(sid, i) {
    let arr = (entry.sections[sid] || ['']).filter((_, idx) => idx !== i);
    if (!arr.length) arr = [''];
    dispatch({ type: 'UPDATE_SECTION', key: sid, value: arr });
  }

  /* ── subcontractors ── */
  function addSub(name = '') {
    dispatch({ type: 'UPDATE_SUBS', payload: [...entry.subs, { name, personnel: '', timeStart: '07:00', timeEnd: '15:30', notes: '' }] });
  }
  function updateSub(i, upd) {
    dispatch({ type: 'UPDATE_SUBS', payload: entry.subs.map((s, idx) => (idx === i ? { ...s, ...upd } : s)) });
  }
  function removeSub(i) {
    dispatch({ type: 'UPDATE_SUBS', payload: entry.subs.filter((_, idx) => idx !== i) });
  }

  /* ── photos ── */
  async function addPhoto(sid) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to add photos.');
      return;
    }
    Alert.alert('Add photo', 'Choose source', [
      {
        text: 'Camera', onPress: async () => {
          const res = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
          if (!res.canceled) pushPhoto(sid, `data:image/jpeg;base64,${res.assets[0].base64}`);
        },
      },
      {
        text: 'Gallery', onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true });
          if (!res.canceled) pushPhoto(sid, `data:image/jpeg;base64,${res.assets[0].base64}`);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  function pushPhoto(sid, uri) {
    dispatch({ type: 'UPDATE_PHOTOS', sectionId: sid, photos: [...(entry.photos[sid] || []), uri] });
  }
  function removePhoto(sid, i) {
    const photos = (entry.photos[sid] || []).filter((_, idx) => idx !== i);
    dispatch({ type: 'UPDATE_PHOTOS', sectionId: sid, photos });
  }

  /* ── save ── */
  async function handleSave() {
    setSaving(true);
    const { totalPersonnel, totalHours } = calcTotals(entry.subs);
    const toSave = { ...entry, totalPersonnel, totalHours, signoffStatus: 'pending', savedAt: new Date().toISOString() };
    await saveEntry(toSave);
    dispatch({ type: 'UPDATE_ENTRY', payload: { signoffStatus: 'pending', savedAt: toSave.savedAt, totalPersonnel, totalHours } });
    setSaving(false);
    Alert.alert(
      '✅ Entry saved',
      `${totalPersonnel} personnel · ${totalHours.toFixed(1)} total labour hours\n\nGo to the "Sign off" tab to complete sign-off and email the PDF.`,
    );
  }

  const { totalPersonnel, totalHours } = calcTotals(entry.subs);
  const savedSubs = settings?.savedSubcontractors || DEFAULT_SUBS;

  return (
    <View style={s.container}>
      <AppHeader title="Site Diary" subtitle="ABA Construction Managers" />

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 90 }]}>

        {/* ── Project info ── */}
        <Card>
          <Row>
            <Field label="Date" flex={1.2}>
              <TextInput style={s.input} value={entry.date} onChangeText={(v) => update({ date: v })} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="Project No." flex={1}>
              <TextInput style={s.input} value={entry.projectNo} onChangeText={(v) => update({ projectNo: v })} placeholder="2024-001" />
            </Field>
          </Row>
          <Field label="Project name" style={{ marginTop: SPACING.sm }}>
            <TextInput style={s.input} value={entry.projectName} onChangeText={(v) => update({ projectName: v })} placeholder="Enter project name" />
          </Field>
          {settings?.projectManager?.name ? (
            <Row style={{ marginTop: SPACING.sm }}>
              <View style={s.assignedPill}><Text style={s.pillLabel}>PM</Text><Text style={s.pillName}>{settings.projectManager.name}</Text></View>
              <View style={s.assignedPill}><Text style={s.pillLabel}>QA</Text><Text style={s.pillName}>{settings.qaRep?.name || 'Not set'}</Text></View>
            </Row>
          ) : (
            <Text style={s.hint}>⚙️ Set PM & QA Rep in Settings to enable sign-off emails</Text>
          )}
        </Card>

        {/* ── Weather ── */}
        <Card>
          <Text style={s.fieldLabel}>Weather — AM</Text>
          <WeatherPicker value={entry.weatherAM} onChange={(v) => update({ weatherAM: v })} opts={WEATHER_OPTS} />
          <Text style={[s.fieldLabel, { marginTop: SPACING.md }]}>Weather — PM</Text>
          <WeatherPicker value={entry.weatherPM} onChange={(v) => update({ weatherPM: v })} opts={WEATHER_OPTS} />
        </Card>

        {/* ── Work sections ── */}
        {SECTIONS.map((sec) => (
          <SectionCard key={sec.id} title={sec.label} expanded={!!expanded[sec.id]} onToggle={() => toggleSection(sec.id)}>
            {(entry.sections[sec.id] || ['']).map((val, i) => (
              <View key={i} style={s.entryRow}>
                <TextInput style={[s.input, { flex: 1 }]} value={val} onChangeText={(v) => updateLine(sec.id, i, v)} placeholder={sec.placeholder} multiline />
                <TouchableOpacity onPress={() => removeLine(sec.id, i)} style={s.iconBtn}>
                  <Text style={{ color: COLORS.textSecondary }}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={s.addBtn} onPress={() => addLine(sec.id)}>
              <Text style={s.addBtnText}>＋ Add line</Text>
            </TouchableOpacity>
            <PhotoRow sectionId={sec.id} photos={entry.photos[sec.id] || []} onAdd={() => addPhoto(sec.id)} onRemove={(i) => removePhoto(sec.id, i)} />
          </SectionCard>
        ))}

        {/* ── Subcontractors ── */}
        <SectionCard title="Subcontractors on site" expanded={!!expanded.subs} onToggle={() => toggleSection('subs')}>
          {/* Quick-add tags */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
            {savedSubs.map((name) => (
              <TouchableOpacity key={name} style={s.savedTag} onPress={() => addSub(name)}>
                <Text style={s.savedTagText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Totals */}
          {entry.subs.length > 0 && (
            <View style={s.totalsBar}>
              <View style={s.totalBox}><Text style={s.totalNum}>{totalPersonnel}</Text><Text style={s.totalLbl}>Total personnel</Text></View>
              <View style={s.totalBox}><Text style={s.totalNum}>{totalHours.toFixed(1)}</Text><Text style={s.totalLbl}>Labour hours</Text></View>
            </View>
          )}

          {/* Sub cards */}
          {entry.subs.map((sub, i) => {
            const p = parseInt(sub.personnel) || 0;
            const hrs = calcSubHours(sub);
            return (
              <View key={i} style={s.subCard}>
                <View style={s.subHeader}>
                  <Text style={{ fontSize: 18 }}>🏗</Text>
                  <TextInput style={[s.input, { flex: 1, marginHorizontal: 8 }]} value={sub.name} onChangeText={(v) => updateSub(i, { name: v })} placeholder="Subcontractor name" />
                  <TouchableOpacity onPress={() => removeSub(i)} style={s.iconBtn}><Text style={{ color: COLORS.danger }}>✕</Text></TouchableOpacity>
                </View>
                <Row>
                  <Field label="Personnel" flex={1}>
                    <TextInput style={s.input} value={sub.personnel} onChangeText={(v) => updateSub(i, { personnel: v })} placeholder="0" keyboardType="number-pad" />
                  </Field>
                  <Field label="Labour hrs" flex={1}>
                    <View style={[s.input, s.readOnly]}><Text style={s.readOnlyText}>{(p * hrs).toFixed(1)} hrs</Text></View>
                  </Field>
                </Row>
                <Row>
                  <Field label="Start" flex={1}>
                    <TextInput style={s.input} value={sub.timeStart} onChangeText={(v) => updateSub(i, { timeStart: v })} placeholder="07:00" />
                  </Field>
                  <Field label="Finish" flex={1}>
                    <TextInput style={s.input} value={sub.timeEnd} onChangeText={(v) => updateSub(i, { timeEnd: v })} placeholder="15:30" />
                  </Field>
                </Row>
                <Field label="Works carried out">
                  <TextInput style={[s.input, { minHeight: 50 }]} value={sub.notes} onChangeText={(v) => updateSub(i, { notes: v })} placeholder="Describe activities..." multiline />
                </Field>
              </View>
            );
          })}

          <TouchableOpacity style={s.addBtn} onPress={() => addSub()}>
            <Text style={s.addBtnText}>＋ Add subcontractor</Text>
          </TouchableOpacity>
          <PhotoRow sectionId="subs" photos={entry.photos.subs || []} onAdd={() => addPhoto('subs')} onRemove={(i) => removePhoto('subs', i)} />
        </SectionCard>

      </ScrollView>

      {/* ── Save bar ── */}
      <View style={[s.saveBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>💾  Save & send for sign-off</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── helpers ─── */

function WeatherPicker({ value, onChange, opts }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {opts.map((w) => (
        <TouchableOpacity key={w} style={[s.wPill, value === w && s.wPillActive]} onPress={() => onChange(value === w ? '' : w)}>
          <Text style={[s.wPillText, value === w && s.wPillTextActive]}>{w}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function PhotoRow({ sectionId, photos, onAdd, onRemove }) {
  return (
    <View style={{ marginTop: SPACING.md }}>
      <Text style={s.fieldLabel}>📷 Photos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
        {photos.map((src, i) => (
          <View key={i} style={s.thumb}>
            <Image source={{ uri: src }} style={s.thumbImg} />
            <TouchableOpacity onPress={() => onRemove(i)} style={s.thumbDel}><Text style={{ color: '#fff', fontSize: 11 }}>✕</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.thumbAdd} onPress={onAdd}><Text style={{ fontSize: 24, color: COLORS.textHint }}>📷</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SectionCard({ title, children, expanded, onToggle }) {
  return (
    <View style={s.card}>
      <TouchableOpacity style={s.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={{ color: COLORS.textSecondary }}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && <View style={s.cardBody}>{children}</View>}
    </View>
  );
}
function Card({ children }) { return <View style={s.card}><View style={s.cardBody}>{children}</View></View>; }
function Row({ children, style }) { return <View style={[s.row, style]}>{children}</View>; }
function Field({ label, children, flex, style }) {
  return (
    <View style={[{ flex: flex || 1 }, style]}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

/* ─── styles ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.sm },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.border, marginBottom: SPACING.sm, ...SHADOW.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  cardBody: { padding: SPACING.md, paddingTop: 0 },
  row: { flexDirection: 'row', gap: SPACING.sm },
  fieldLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  input: { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: 13, color: COLORS.textPrimary, backgroundColor: COLORS.white },
  readOnly: { backgroundColor: COLORS.orangeLight, borderColor: COLORS.orange, justifyContent: 'center' },
  readOnlyText: { color: COLORS.orangeDark, fontWeight: '600', fontSize: 13 },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  iconBtn: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  addBtn: { borderWidth: 0.5, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center', marginTop: SPACING.sm },
  addBtnText: { fontSize: 13, color: COLORS.textSecondary },
  wPill: { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  wPillActive: { backgroundColor: COLORS.orangeLight, borderColor: COLORS.orange },
  wPillText: { fontSize: 13, color: COLORS.textSecondary },
  wPillTextActive: { color: COLORS.orangeDark, fontWeight: '600' },
  savedTag: { backgroundColor: COLORS.background, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5, marginRight: 8 },
  savedTagText: { fontSize: 12, color: COLORS.textSecondary },
  subCard: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm },
  subHeader: { flexDirection: 'row', alignItems: 'center' },
  totalsBar: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  totalBox: { flex: 1, backgroundColor: COLORS.orangeLight, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  totalNum: { fontSize: 24, fontWeight: '700', color: COLORS.orange },
  totalLbl: { fontSize: 11, color: COLORS.orangeDark, marginTop: 2 },
  thumb: { width: 72, height: 72, borderRadius: RADIUS.md, marginRight: 8, position: 'relative' },
  thumbImg: { width: 72, height: 72, borderRadius: RADIUS.md },
  thumbDel: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  thumbAdd: { width: 72, height: 72, borderRadius: RADIUS.md, borderWidth: 0.5, borderStyle: 'dashed', borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  saveBar: { backgroundColor: COLORS.white, padding: SPACING.md, borderTopWidth: 0.5, borderTopColor: COLORS.border },
  saveBtn: { backgroundColor: COLORS.orange, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  assignedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.blueLight, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8 },
  pillLabel: { fontSize: 10, fontWeight: '700', color: COLORS.blue },
  pillName: { fontSize: 12, color: COLORS.blue },
  hint: { fontSize: 11, color: COLORS.textHint, marginTop: SPACING.sm },
});
