import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../utils/theme';

export default function AppHeader({ title, subtitle, rightAction }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.logoBox}>
        <Text style={styles.logoText}>ABA</Text>
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ? (
        <TouchableOpacity onPress={rightAction.onPress} style={styles.rightBtn}>
          <Text style={styles.rightBtnText}>{rightAction.label}</Text>
        </TouchableOpacity>
      ) : <View style={{ width: 60 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  logoBox: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  titleBlock: { flex: 1 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 },
  rightBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rightBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
