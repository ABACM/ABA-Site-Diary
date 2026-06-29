import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { getEntries } from '../utils/storage';
import { useDiary } from '../context/DiaryContext';
import { sharePdf } from '../utils/pdfExport';
import { generateMonthlyReport } from '../utils/monthlyReport';
import AppHeader from '../components/AppHeader';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/theme';

export default function HistoryScreen({ navigation }) {
  const { state, dispatch } = useDiary();
  const { settings } = state;
  const insets = useSafeAreaInsets();
  const [entries, setEntries]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  async function load() {
    const all = await getEntries();
    setEntries(all);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  /* group by YYYY-MM */
  const grouped = entries.reduce((acc, e) => {
    const key = (e.date || 'unknown').slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
  const months = Object.keys(grouped).sort().reverse();

  function loadEntry(e) {
    dispatch({ type: 'LOAD_ENTRY', payload: e });
    navigation.navigate('Today');
  }

  function fmtMonth(key) {
    try { return format(parseISO(key + '-01'), 'MMMM yyyy'); } catch { return key; }
  }
  function fmtDate(d) {
    try { return format(parseISO(d), 'EEE d MMM'); } catch { return d || '—'; }
  }
  function getPrevKey(key) {
    const [y, m] = key.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  }

  function statusColor(st) {
    return st === 'complete' ? COLORS.green : st === 'pending' ? COLORS.pending : COLORS.textHint;
  }
  function statusLabel(st) {
    return st === 'complete' ? '✅ Signed off' : st === 'pending' ? '⏳ Pending' : '📝 Draft';
  }

  async function handleReport(monthKey) {
    setReportLoading(true);
    try {
      const prevKey = getPrevKey(monthKey);
      await generateMonthlyReport({
        monthKey,
        monthEntries: grouped[monthKey] || [],
        prevEntries:  grouped[prevKey]  || [],
        allEntries:   entries,
        settings,
      });
    } catch (e) {
      Alert.alert('Report error', e.message);
    }
    setReportLoading(false);
  }

  if (loading) return (
    <View style={s.container}>
      <AppHeader title="History" subtitle="All diary entries" />
      <View style={s.centered}><ActivityIndicator color={COLORS.orange} size="large" /></View>
    </View>
  );

  return (
    <View style={s.container}>
      <AppHeader title="History" subtitle={`${entries.length} entries`} />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.orange} />}
      >
        {months.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyTitle}>No diary entries yet</Text>
            <Text style={s.emptyHint}>Entries you save will appear here</Text>
          </View>
        )}

        {months.map((mk) => {
          const mes = grouped[mk];
          const totalHrs = mes.reduce((a, e) => a + (e.totalHours || 0), 0);
          const signed   = mes.filter((e) => e.signoffStatus === 'complete').length;

          return (
            <View key={mk} style={s.monthGroup}>
              <View style={s.monthHeader}>
                <View>
                  <Text style={s.monthTitle}>{fmtMonth(mk)}</Text>
                  <Text style={s.monthMeta}>{mes.length} entries · {totalHrs.toFixed(1)} hrs · {signed}/{mes.length} signed</Text>
                </View>
                <TouchableOpacity style={s.reportBtn} onPress={() => handleReport(mk)} disabled={reportLoading}>
                  {reportLoading
                    ? <ActivityIndicator size="small" color={COLORS.orange} />
                    : <Text style={s.reportBtnText}>📊 Report</Text>}
                </TouchableOpacity>
              </View>

              {mes.map((e) => (
                <TouchableOpacity key={e.id} style={s.entryCard} onPress={() => loadEntry(e)} activeOpacity={0.7}>
                  <View style={s.entryTop}>
                    <Text style={s.entryDate}>{fmtDate(e.date)}</Text>
                    <Text style={[s.entryStatus, { color: statusColor(e.signoffStatus) }]}>{statusLabel(e.signoffStatus)}</Text>
                  </View>
                  <Text style={s.entryProj}>{e.projectName || 'Unnamed project'}{e.projectNo ? ` · ${e.projectNo}` : ''}</Text>
                  <View style={s.statRow}>
                    <Pill icon="👷" val={e.totalPersonnel || 0}        lbl="people" />
                    <Pill icon="⏱"  val={`${(e.totalHours||0).toFixed(1)}`} lbl="hrs" />
                    <Pill icon="🌤" val={e.weatherAM || '—'}           lbl="AM" />
                  </View>
                  <TouchableOpacity style={s.pdfBtn} onPress={async () => { try { await sharePdf(e, settings); } catch (err) { Alert.alert('Error', err.message); } }}>
                    <Text style={s.pdfBtnText}>📄 Share PDF</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Pill({ icon, val, lbl }) {
  return (
    <View style={s.pill}>
      <Text style={s.pillIcon}>{icon}</Text>
      <Text style={s.pillVal}>{val}</Text>
      <Text style={s.pillLbl}>{lbl}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  emptyHint: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  monthGroup: { marginBottom: SPACING.lg },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  monthTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  monthMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  reportBtn: { backgroundColor: COLORS.orangeLight, borderWidth: 0.5, borderColor: COLORS.orange, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7, minWidth: 44, alignItems: 'center' },
  reportBtnText: { fontSize: 13, color: COLORS.orangeDark, fontWeight: '600' },
  entryCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.sm },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  entryDate: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  entryStatus: { fontSize: 12, fontWeight: '500' },
  entryProj: { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  statRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.background, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  pillIcon: { fontSize: 12 },
  pillVal: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  pillLbl: { fontSize: 11, color: COLORS.textSecondary },
  pdfBtn: { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  pdfBtnText: { fontSize: 12, color: COLORS.textSecondary },
});
