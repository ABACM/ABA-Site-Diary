import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useDiary } from '../context/DiaryContext';
import { sharePdf } from '../utils/pdfExport';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

export default function EntryDetailScreen({ navigation }) {
  const { state } = useDiary();
  const { entry, settings } = state;
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {entry.date ? format(new Date(entry.date + 'T12:00:00'), 'd MMM yyyy') : 'Entry'}
        </Text>
        <TouchableOpacity onPress={() => sharePdf(entry, settings)} style={styles.shareBtn}>
          <Text style={styles.shareText}>📄 PDF</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 20 }}>
        <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Load this entry in Today tab to view or edit.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: COLORS.orange, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  backText: { color: '#fff', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  shareBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  shareText: { color: '#fff', fontSize: 13 },
});
