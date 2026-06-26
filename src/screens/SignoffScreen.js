import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiary } from '../context/DiaryContext';
import { saveEntry } from '../utils/storage';
import { sharePdf, emailPdf } from '../utils/pdfExport';
import AppHeader from '../components/AppHeader';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/theme';

const SIGNATORIES = [
  { index: 0, role: 'Site Supervisor',    settingsKey: 'siteSupervisor' },
  { index: 1, role: 'Project Manager',    settingsKey: 'projectManager' },
  { index: 2, role: 'QA Representative',  settingsKey: 'qaRep' },
];

const SIG_HTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;overflow:hidden}canvas{display:block;touch-action:none;cursor:crosshair}
#btn{position:fixed;bottom:0;left:0;right:0;display:flex}
button{flex:1;padding:12px;font-size:14px;border:none;cursor:pointer}
#clr{background:#e5e7eb;color:#374151}#sav{background:#EA6C1A;color:#fff}</style></head>
<body><canvas id="c"></canvas><div id="btn"><button id="clr" onclick="clear()">Clear</button><button id="sav" onclick="save()">Save Signature</button></div>
<script>
var cv=document.getElementById('c'),ctx=cv.getContext('2d'),drawing=false,lx,ly;
cv.width=window.innerWidth;cv.height=window.innerHeight-44;
ctx.strokeStyle='#1C2026';ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
function pos(e){var r=cv.getBoundingClientRect(),src=e.touches?e.touches[0]:e;return[src.clientX-r.left,src.clientY-r.top]}
cv.addEventListener('mousedown',function(e){drawing=true;[lx,ly]=pos(e)});
cv.addEventListener('mousemove',function(e){if(!drawing)return;var[x,y]=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.stroke();[lx,ly]=[x,y]});
cv.addEventListener('mouseup',function(){drawing=false});
cv.addEventListener('touchstart',function(e){e.preventDefault();drawing=true;[lx,ly]=pos(e)},{passive:false});
cv.addEventListener('touchmove',function(e){e.preventDefault();if(!drawing)return;var[x,y]=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.stroke();[lx,ly]=[x,y]},{passive:false});
cv.addEventListener('touchend',function(){drawing=false});
function clear(){ctx.clearRect(0,0,cv.width,cv.height)}
function save(){var d=cv.toDataURL('image/png');window.ReactNativeWebView.postMessage(d)}
</script></body></html>`;

export default function SignoffScreen() {
  const { state, dispatch } = useDiary();
  const { entry, settings } = state;
  const insets = useSafeAreaInsets();
  const [activeSig, setActiveSig] = useState(null);
  const [loading, setLoading] = useState(false);

  const pmAndQaSigned = !!(entry.signatures?.[1] && entry.signatures?.[2]);
  const allSigned = SIGNATORIES.every((s) => entry.signatures?.[s.index]);

  function setSig(index, dataUrl) {
    dispatch({ type: 'SET_SIGNATURE', index, value: dataUrl });
    setActiveSig(null);
  }
  function clearSig(index) {
    dispatch({ type: 'SET_SIGNATURE', index, value: null });
  }

  async function handleComplete() {
    if (!pmAndQaSigned) {
      Alert.alert('Sign-off incomplete', 'Both the Project Manager and QA Representative must sign.');
      return;
    }
    setLoading(true);
    try {
      const updated = { ...entry, signoffStatus: 'complete', signoffCompletedAt: new Date().toISOString() };
      await saveEntry(updated);
      dispatch({ type: 'UPDATE_ENTRY', payload: { signoffStatus: 'complete', signoffCompletedAt: updated.signoffCompletedAt } });

      const recipients = [
        settings?.projectManager?.email,
        settings?.qaRep?.email,
        settings?.siteSupervisor?.email,
      ].filter(Boolean);

      Alert.alert(
        '✅ Sign-off complete',
        recipients.length
          ? `PDF will be emailed to:\n${recipients.join('\n')}`
          : 'No emails configured in Settings — use Share PDF to send manually.',
        [
          {
            text: recipients.length ? 'Send email & PDF' : 'Share PDF',
            onPress: async () => {
              try {
                if (recipients.length) await emailPdf(updated, settings, recipients);
                else await sharePdf(updated, settings);
              } catch (e) {
                Alert.alert('Email failed', e.message + '\n\nSharing PDF instead.');
                await sharePdf(updated, settings);
              }
            },
          },
          { text: 'Later', style: 'cancel' },
        ],
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  }

  async function handleShare() {
    setLoading(true);
    try { await sharePdf(entry, settings); }
    catch (e) { Alert.alert('Error', e.message); }
    setLoading(false);
  }

  return (
    <View style={s.container}>
      <AppHeader
        title="Sign off"
        subtitle={entry.signoffStatus === 'complete' ? '✅ Fully signed off' : pmAndQaSigned ? '⏳ PM & QA signed' : '⏳ Awaiting signatures'}
        rightAction={{ label: 'Share PDF', onPress: handleShare }}
      />

      {/* Signature pad overlay */}
      {activeSig !== null && (
        <View style={s.sigOverlay}>
          <View style={s.sigOverlayHeader}>
            <Text style={s.sigOverlayTitle}>Sign here — {SIGNATORIES[activeSig]?.role}</Text>
            <TouchableOpacity onPress={() => setActiveSig(null)} style={s.sigOverlayClose}>
              <Text style={{ color: COLORS.white, fontSize: 16 }}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>
          <WebView
            originWhitelist={['*']}
            source={{ html: SIG_HTML }}
            style={{ flex: 1 }}
            scrollEnabled={false}
            onMessage={(e) => setSig(activeSig, e.nativeEvent.data)}
          />
        </View>
      )}

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}>
        <Text style={s.hint}>Tap a box to open the signature pad. PM and QA signatures unlock the final sign-off and PDF email.</Text>

        {SIGNATORIES.map((sig) => {
          const person = settings?.[sig.settingsKey];
          const signed = !!entry.signatures?.[sig.index];
          return (
            <View key={sig.index} style={[s.sigCard, signed && s.sigCardSigned]}>
              <View style={s.sigCardTop}>
                <View>
                  <Text style={s.sigRole}>{sig.role}</Text>
                  {person?.name  && <Text style={s.sigName}>{person.name}</Text>}
                  {person?.email && <Text style={s.sigEmail}>{person.email}</Text>}
                </View>
                <View style={[s.badge, signed ? s.badgeSigned : s.badgePending]}>
                  <Text style={[s.badgeText, signed ? s.badgeSignedText : s.badgePendingText]}>
                    {signed ? '✓ Signed' : 'Pending'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[s.sigBox, signed && s.sigBoxSigned]}
                onPress={() => setActiveSig(sig.index)}
                activeOpacity={0.7}
              >
                <Text style={signed ? s.sigBoxSignedText : s.sigBoxEmptyText}>
                  {signed ? '✓ Signature captured — tap to re-sign' : 'Tap to sign'}
                </Text>
              </TouchableOpacity>

              {signed && (
                <TouchableOpacity style={s.clearBtn} onPress={() => clearSig(sig.index)}>
                  <Text style={s.clearBtnText}>🗑 Clear signature</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={s.card}>
          <Text style={s.fieldLabel}>Additional notes</Text>
          <TextInput
            style={[s.input, { minHeight: 72 }]}
            value={entry.addlNotes}
            onChangeText={(v) => dispatch({ type: 'UPDATE_ENTRY', payload: { addlNotes: v } })}
            placeholder="Any final notes before sign-off..."
            multiline
          />
        </View>

        {entry.signoffStatus === 'complete' && (
          <View style={s.completeBanner}>
            <Text style={s.completeBannerText}>✅ Fully signed off</Text>
            <Text style={s.completeBannerSub}>
              {entry.signoffCompletedAt
                ? new Date(entry.signoffCompletedAt).toLocaleString('en-AU')
                : ''}
            </Text>
          </View>
        )}
      </ScrollView>

      {entry.signoffStatus !== 'complete' && (
        <View style={[s.actionBar, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[s.completeBtn, !pmAndQaSigned && s.completeBtnDisabled]}
            onPress={handleComplete}
            disabled={!pmAndQaSigned || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.completeBtnText}>
                  {pmAndQaSigned ? '✅  Complete sign-off & email PDF' : '⏳  Awaiting PM & QA signatures'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.sm },
  hint: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  sigOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: COLORS.white },
  sigOverlayHeader: { backgroundColor: COLORS.orange, padding: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sigOverlayTitle: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  sigOverlayClose: { padding: 6 },
  sigCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.sm },
  sigCardSigned: { borderColor: COLORS.green },
  sigCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  sigRole: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  sigName: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  sigEmail: { fontSize: 11, color: COLORS.textHint, marginTop: 1 },
  badge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeSigned: { backgroundColor: COLORS.greenLight },
  badgePending: { backgroundColor: COLORS.background },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeSignedText: { color: COLORS.green },
  badgePendingText: { color: COLORS.textSecondary },
  sigBox: { height: 80, borderWidth: 0.5, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  sigBoxSigned: { borderStyle: 'solid', borderColor: COLORS.green, backgroundColor: COLORS.greenLight },
  sigBoxEmptyText: { fontSize: 14, color: COLORS.textHint },
  sigBoxSignedText: { fontSize: 13, color: COLORS.green, fontWeight: '500' },
  clearBtn: { marginTop: SPACING.sm, alignItems: 'center' },
  clearBtnText: { fontSize: 12, color: COLORS.textSecondary },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.border, padding: SPACING.md, ...SHADOW.sm },
  fieldLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  input: { fontSize: 13, color: COLORS.textPrimary, textAlignVertical: 'top' },
  completeBanner: { backgroundColor: COLORS.greenLight, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center' },
  completeBannerText: { fontSize: 15, fontWeight: '600', color: COLORS.green },
  completeBannerSub: { fontSize: 12, color: COLORS.green, marginTop: 4 },
  actionBar: { backgroundColor: COLORS.white, padding: SPACING.md, borderTopWidth: 0.5, borderTopColor: COLORS.border },
  completeBtn: { backgroundColor: COLORS.green, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  completeBtnDisabled: { backgroundColor: COLORS.textHint },
  completeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
