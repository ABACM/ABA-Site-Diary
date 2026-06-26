import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  orange:'#EA6C1A', orangeLight:'#FEF0E6', orangeDark:'#B34E0E',
  blue:'#1D6FC4', blueLight:'#EBF3FD',
  green:'#3A7D1F', greenLight:'#EAF4E3',
  white:'#FFFFFF', background:'#F5F4F2',
  border:'#E0DDD8', textPrimary:'#1C2026', textSecondary:'#6B7280',
  textHint:'#9CA3AF', danger:'#DC2626', pending:'#D97706',
};
const SP = { xs:4, sm:8, md:12, lg:16, xl:24 };
const R  = { sm:6, md:10, lg:14, full:999 };
const SH = { shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:3, elevation:2 };

// ─── STORAGE ──────────────────────────────────────────────────────────────────
async function getEntries() {
  try { const r = await AsyncStorage.getItem('aba_entries'); return r ? JSON.parse(r) : []; }
  catch(e) { console.log('getEntries error', e); return []; }
}
async function saveEntry(entry) {
  try {
    const entries = await getEntries();
    const idx = entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) entries[idx] = entry; else entries.unshift(entry);
    await AsyncStorage.setItem('aba_entries', JSON.stringify(entries));
    return true;
  } catch(e) { console.log('saveEntry error', e); return false; }
}
async function getSettings() {
  try {
    const r = await AsyncStorage.getItem('aba_settings');
    return r ? JSON.parse(r) : {
      companyName: 'ABA Construction Managers (Aust) Pty Ltd',
      companyAddress: 'Suite 7 Level One, 55 Heffernan St, Mitchell ACT 2911',
      companyPhone: '(02) 6242 3400',
      projectManager: { name:'', email:'' },
      qaRep: { name:'', email:'' },
      siteSupervisor: { name:'', email:'' },
      savedSubcontractors: ['Clarke Civil','Mitchell Electrical','ACT Plumbing','Apex Formwork','Total Concreting'],
      standardHoursPerDay: '8',
      projectStartDate: '',
    };
  } catch(e) { console.log('getSettings error', e); return {}; }
}
async function persistSettings(s) {
  try { await AsyncStorage.setItem('aba_settings', JSON.stringify(s)); return true; }
  catch(e) { console.log('persistSettings error', e); return false; }
}

// ─── CALCULATIONS ─────────────────────────────────────────────────────────────
function calcSubHours(sub) {
  try {
    const toM = t => { const [h,m]=(t||'07:00').split(':').map(Number); return h*60+m; };
    return Math.max(0, (toM(sub.timeEnd||'15:30') - toM(sub.timeStart||'07:00')) / 60);
  } catch { return 0; }
}
function calcTotals(subs=[]) {
  let p=0, h=0;
  (subs||[]).forEach(s => { const n=parseInt(s.personnel)||0; p+=n; h+=n*calcSubHours(s); });
  return { totalPersonnel:p, totalHours:h };
}

// ─── STATE / CONTEXT ──────────────────────────────────────────────────────────
const DiaryContext = createContext(null);
function freshEntry() {
  let dateStr = '';
  try { dateStr = format(new Date(), 'yyyy-MM-dd'); } catch { dateStr = new Date().toISOString().slice(0,10); }
  return {
    id: Date.now().toString(),
    date: dateStr,
    projectName:'', projectNo:'', weatherAM:'', weatherPM:'',
    sections:{ work:[''], delays:[''], oral:[''], drawings:[''] },
    subs:[], checklist:{}, signatures:{}, addlNotes:'',
    signoffStatus:'draft', totalPersonnel:0, totalHours:0,
  };
}
function reducer(state, action) {
  switch(action.type) {
    case 'SET_SETTINGS':   return { ...state, settings:action.payload, loading:false };
    case 'UPDATE_ENTRY':   return { ...state, entry:{ ...state.entry, ...action.payload } };
    case 'UPDATE_SECTION': return { ...state, entry:{ ...state.entry, sections:{ ...state.entry.sections, [action.key]:action.value } } };
    case 'UPDATE_SUBS':    return { ...state, entry:{ ...state.entry, subs:action.payload } };
    case 'UPDATE_CHECKLIST': return { ...state, entry:{ ...state.entry, checklist:{ ...state.entry.checklist, [action.index]:action.value } } };
    case 'SET_SIGNATURE':  return { ...state, entry:{ ...state.entry, signatures:{ ...state.entry.signatures, [action.index]:action.value } } };
    case 'NEW_ENTRY':      return { ...state, entry:freshEntry() };
    case 'LOAD_ENTRY':     return { ...state, entry:action.payload };
    default:               return state;
  }
}
function DiaryProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { entry:freshEntry(), settings:null, loading:true });
  useEffect(() => {
    getSettings().then(s => dispatch({ type:'SET_SETTINGS', payload:s }));
  }, []);
  const updateSettings = useCallback(async (upd) => {
    const merged = { ...state.settings, ...upd };
    await persistSettings(merged);
    dispatch({ type:'SET_SETTINGS', payload:merged });
  }, [state.settings]);
  return (
    <DiaryContext.Provider value={{ state, dispatch, updateSettings }}>
      {children}
    </DiaryContext.Provider>
  );
}
function useDiary() { return useContext(DiaryContext); }

// ─── APP HEADER ───────────────────────────────────────────────────────────────
function AppHeader({ title, subtitle, rightAction }) {
  const ins = useSafeAreaInsets();
  return (
    <View style={[hdr.wrap, { paddingTop: ins.top + 8 }]}>
      <View style={hdr.logo}><Text style={hdr.logoT}>ABA</Text></View>
      <View style={{ flex:1 }}>
        <Text style={hdr.title}>{title}</Text>
        {subtitle ? <Text style={hdr.sub}>{subtitle}</Text> : null}
      </View>
      {rightAction
        ? <TouchableOpacity onPress={rightAction.onPress} style={hdr.rBtn}><Text style={hdr.rBtnT}>{rightAction.label}</Text></TouchableOpacity>
        : <View style={{ width:60 }}/>}
    </View>
  );
}
const hdr = StyleSheet.create({
  wrap:{ backgroundColor:C.orange, paddingHorizontal:SP.lg, paddingBottom:SP.md, flexDirection:'row', alignItems:'center', gap:SP.sm },
  logo:{ width:38, height:38, backgroundColor:'rgba(255,255,255,0.2)', borderRadius:8, alignItems:'center', justifyContent:'center' },
  logoT:{ color:'#fff', fontSize:11, fontWeight:'600' },
  title:{ color:'#fff', fontSize:16, fontWeight:'600' },
  sub:{ color:'rgba(255,255,255,0.8)', fontSize:11, marginTop:1 },
  rBtn:{ backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:12, paddingVertical:6, borderRadius:20 },
  rBtnT:{ color:'#fff', fontSize:12, fontWeight:'600' },
});

// ─── TODAY SCREEN ─────────────────────────────────────────────────────────────
const WEATHER = ['Sunny ☀️','Cloudy ☁️','Rain 🌧','Wind 💨','Hot 🌡','Cold 🥶'];
const SECTIONS = [
  { id:'work',     label:'Work in progress',          placeholder:'Pour No. / Item No. / Activity...' },
  { id:'delays',   label:'Delays incurred',           placeholder:'Industrial, weather, access...' },
  { id:'oral',     label:'Oral instructions',         placeholder:'Instructions received or given...' },
  { id:'drawings', label:'Drawings & memos received', placeholder:'Document reference...' },
];
const CL_ITEMS = [
  'Inspections and Tests','Visitors and Purposes','Discussions and Meetings',
  'Shortage of Information','Delays, Defects – Client supplies',
  'Planning information required','Equipment on hire','Messages',
];

function TodayScreen() {
  const { state, dispatch } = useDiary();
  const { entry, settings } = state;
  const ins = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [exp, setExp] = useState({ work:true, subs:true });

  const upd = useCallback(u => dispatch({ type:'UPDATE_ENTRY', payload:u }), [dispatch]);
  const tog = id => setExp(p => ({ ...p, [id]:!p[id] }));

  function updLine(sid, i, v) {
    const a = [...(entry.sections[sid]||[''])]; a[i]=v;
    dispatch({ type:'UPDATE_SECTION', key:sid, value:a });
  }
  function addLine(sid) { dispatch({ type:'UPDATE_SECTION', key:sid, value:[...(entry.sections[sid]||['']), ''] }); }
  function remLine(sid, i) {
    let a = (entry.sections[sid]||['']).filter((_,x)=>x!==i);
    if (!a.length) a=[''];
    dispatch({ type:'UPDATE_SECTION', key:sid, value:a });
  }
  function addSub(name='') { dispatch({ type:'UPDATE_SUBS', payload:[...entry.subs,{name,personnel:'',timeStart:'07:00',timeEnd:'15:30',notes:''}] }); }
  function updSub(i, u) { dispatch({ type:'UPDATE_SUBS', payload:entry.subs.map((s,x)=>x===i?{...s,...u}:s) }); }
  function remSub(i) { dispatch({ type:'UPDATE_SUBS', payload:entry.subs.filter((_,x)=>x!==i) }); }

  async function handleSave() {
    setSaving(true);
    try {
      const tot = calcTotals(entry.subs);
      const toSave = { ...entry, ...tot, signoffStatus:'pending', savedAt:new Date().toISOString() };
      await saveEntry(toSave);
      dispatch({ type:'UPDATE_ENTRY', payload:{ ...tot, signoffStatus:'pending' } });
      Alert.alert('✅ Entry saved', `${tot.totalPersonnel} personnel · ${tot.totalHours.toFixed(1)} labour hours\n\nGo to Sign off tab to complete.`);
    } catch(e) {
      Alert.alert('Error saving', e.message);
    }
    setSaving(false);
  }

  const tot = calcTotals(entry.subs);
  const savedSubs = settings?.savedSubcontractors || ['Clarke Civil','Mitchell Electrical','ACT Plumbing'];

  return (
    <View style={{ flex:1, backgroundColor:C.background }}>
      <AppHeader title="Site Diary" subtitle="ABA Construction Managers"/>
      <ScrollView contentContainerStyle={{ padding:SP.md, paddingBottom:ins.bottom+90 }}>

        {/* Project info */}
        <Card>
          <Row>
            <Field label="Date" flex={1.2}><TextInput style={s.inp} value={entry.date} onChangeText={v=>upd({date:v})} placeholder="YYYY-MM-DD"/></Field>
            <View style={{ width:SP.sm }}/>
            <Field label="Project No." flex={1}><TextInput style={s.inp} value={entry.projectNo} onChangeText={v=>upd({projectNo:v})} placeholder="2024-001"/></Field>
          </Row>
          <View style={{ marginTop:SP.sm }}>
            <Text style={s.fl}>Project name</Text>
            <TextInput style={s.inp} value={entry.projectName} onChangeText={v=>upd({projectName:v})} placeholder="Enter project name"/>
          </View>
          {settings?.projectManager?.name
            ? <Row style={{ marginTop:SP.sm }}>
                <View style={s.pill}><Text style={s.pillL}>PM</Text><Text style={s.pillN}>{settings.projectManager.name}</Text></View>
                <View style={s.pill}><Text style={s.pillL}>QA</Text><Text style={s.pillN}>{settings.qaRep?.name||'Not set'}</Text></View>
              </Row>
            : <Text style={{ fontSize:11, color:C.textHint, marginTop:SP.sm }}>⚙️ Set PM & QA in Settings to enable email sign-off</Text>}
        </Card>

        {/* Weather */}
        <Card>
          <Text style={s.fl}>Weather — AM</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:SP.md }}>
            {WEATHER.map(w=><TouchableOpacity key={w} style={[s.wp, entry.weatherAM===w&&s.wpa]} onPress={()=>upd({weatherAM:entry.weatherAM===w?'':w})}><Text style={[s.wpt, entry.weatherAM===w&&s.wpta]}>{w}</Text></TouchableOpacity>)}
          </ScrollView>
          <Text style={s.fl}>Weather — PM</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {WEATHER.map(w=><TouchableOpacity key={w} style={[s.wp, entry.weatherPM===w&&s.wpa]} onPress={()=>upd({weatherPM:entry.weatherPM===w?'':w})}><Text style={[s.wpt, entry.weatherPM===w&&s.wpta]}>{w}</Text></TouchableOpacity>)}
          </ScrollView>
        </Card>

        {/* Work sections */}
        {SECTIONS.map(sec=>(
          <View key={sec.id} style={s.card}>
            <TouchableOpacity style={s.cardHdr} onPress={()=>tog(sec.id)} activeOpacity={0.7}>
              <Text style={s.cardTitle}>{sec.label}</Text>
              <Text style={{ color:C.textSecondary }}>{exp[sec.id]?'▲':'▼'}</Text>
            </TouchableOpacity>
            {exp[sec.id] && <View style={s.cardBody}>
              {(entry.sections[sec.id]||['']).map((v,i)=>(
                <View key={i} style={[s.row, { marginBottom:SP.sm }]}>
                  <TextInput style={[s.inp,{flex:1}]} value={v} onChangeText={x=>updLine(sec.id,i,x)} placeholder={sec.placeholder} multiline/>
                  <TouchableOpacity onPress={()=>remLine(sec.id,i)} style={{ width:32, alignItems:'center', justifyContent:'center' }}><Text style={{ color:C.textSecondary, fontSize:18 }}>🗑</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addBtn} onPress={()=>addLine(sec.id)}><Text style={s.addBtnT}>＋ Add line</Text></TouchableOpacity>
            </View>}
          </View>
        ))}

        {/* Subcontractors */}
        <View style={s.card}>
          <TouchableOpacity style={s.cardHdr} onPress={()=>tog('subs')} activeOpacity={0.7}>
            <Text style={s.cardTitle}>Subcontractors on site</Text>
            <Text style={{ color:C.textSecondary }}>{exp.subs?'▲':'▼'}</Text>
          </TouchableOpacity>
          {exp.subs && <View style={s.cardBody}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:SP.sm }}>
              {savedSubs.map(n=><TouchableOpacity key={n} style={s.stag} onPress={()=>addSub(n)}><Text style={s.stagT}>{n}</Text></TouchableOpacity>)}
            </ScrollView>
            {entry.subs.length > 0 && (
              <View style={[s.row, { marginBottom:SP.md }]}>
                <View style={[s.totBox,{marginRight:SP.sm}]}><Text style={s.totNum}>{tot.totalPersonnel}</Text><Text style={s.totLbl}>Total personnel</Text></View>
                <View style={s.totBox}><Text style={s.totNum}>{tot.totalHours.toFixed(1)}</Text><Text style={s.totLbl}>Labour hours</Text></View>
              </View>
            )}
            {entry.subs.map((sub,i)=>{
              const p=parseInt(sub.personnel)||0, h=calcSubHours(sub);
              return <View key={i} style={s.subCard}>
                <View style={s.row}>
                  <TextInput style={[s.inp,{flex:1,marginRight:SP.sm}]} value={sub.name} onChangeText={v=>updSub(i,{name:v})} placeholder="Subcontractor name"/>
                  <TouchableOpacity onPress={()=>remSub(i)} style={{ width:28, alignItems:'center', justifyContent:'center' }}><Text style={{ color:C.danger, fontSize:18 }}>✕</Text></TouchableOpacity>
                </View>
                <View style={[s.row,{marginTop:SP.sm}]}>
                  <Field label="Personnel" flex={1}><TextInput style={s.inp} value={sub.personnel} onChangeText={v=>updSub(i,{personnel:v})} placeholder="0" keyboardType="number-pad"/></Field>
                  <View style={{ width:SP.sm }}/>
                  <Field label="Labour hrs" flex={1}><View style={[s.inp,{backgroundColor:C.orangeLight,borderColor:C.orange,justifyContent:'center',minHeight:36}]}><Text style={{ color:C.orangeDark, fontWeight:'600', fontSize:13 }}>{(p*h).toFixed(1)} hrs</Text></View></Field>
                </View>
                <View style={[s.row,{marginTop:SP.sm}]}>
                  <Field label="Start" flex={1}><TextInput style={s.inp} value={sub.timeStart} onChangeText={v=>updSub(i,{timeStart:v})} placeholder="07:00"/></Field>
                  <View style={{ width:SP.sm }}/>
                  <Field label="Finish" flex={1}><TextInput style={s.inp} value={sub.timeEnd} onChangeText={v=>updSub(i,{timeEnd:v})} placeholder="15:30"/></Field>
                </View>
                <View style={{ marginTop:SP.sm }}>
                  <Text style={s.fl}>Works carried out</Text>
                  <TextInput style={[s.inp,{minHeight:50}]} value={sub.notes} onChangeText={v=>updSub(i,{notes:v})} placeholder="Describe activities..." multiline/>
                </View>
              </View>;
            })}
            <TouchableOpacity style={s.addBtn} onPress={()=>addSub()}><Text style={s.addBtnT}>＋ Add subcontractor</Text></TouchableOpacity>
          </View>}
        </View>

      </ScrollView>
      <View style={[s.saveBar, { paddingBottom:ins.bottom+8 }]}>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff"/> : <Text style={s.saveBtnT}>💾  Save & send for sign-off</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── CHECKLIST SCREEN ─────────────────────────────────────────────────────────
function ChecklistScreen() {
  const { state, dispatch } = useDiary();
  const { entry } = state;
  const ins = useSafeAreaInsets();
  function upd(i, u) {
    const cur = entry.checklist[i] || { checked:false, note:'' };
    dispatch({ type:'UPDATE_CHECKLIST', index:i, value:{ ...cur, ...u } });
  }
  const checked = CL_ITEMS.filter((_,i)=>entry.checklist[i]?.checked).length;
  return (
    <View style={{ flex:1, backgroundColor:C.background }}>
      <AppHeader title="Other Checklist" subtitle={`${checked} of ${CL_ITEMS.length} items marked`}/>
      <ScrollView contentContainerStyle={{ padding:SP.md, paddingBottom:ins.bottom+20 }}>
        <View style={{ backgroundColor:C.white, borderRadius:R.lg, borderWidth:0.5, borderColor:C.border, ...SH }}>
          {CL_ITEMS.map((item,i)=>{
            const cl = entry.checklist[i] || { checked:false, note:'' };
            return <View key={i} style={{ flexDirection:'row', alignItems:'flex-start', padding:SP.md, borderBottomWidth:i<CL_ITEMS.length-1?0.5:0, borderBottomColor:C.border }}>
              <TouchableOpacity
                style={{ width:24, height:24, borderRadius:12, borderWidth:1.5, borderColor:cl.checked?C.orange:C.border, backgroundColor:cl.checked?C.orange:'transparent', alignItems:'center', justifyContent:'center', marginTop:2, flexShrink:0 }}
                onPress={()=>upd(i,{checked:!cl.checked})}>
                {cl.checked && <Text style={{ color:'#fff', fontSize:13, fontWeight:'700' }}>✓</Text>}
              </TouchableOpacity>
              <View style={{ flex:1, marginLeft:SP.md }}>
                <Text style={{ fontSize:13, color:cl.checked?C.textSecondary:C.textPrimary, textDecorationLine:cl.checked?'line-through':'none' }}>{i+1}. {item}</Text>
                <TextInput
                  style={{ marginTop:6, fontSize:12, color:C.textPrimary, borderWidth:0.5, borderColor:'transparent', borderRadius:R.sm, padding:6, backgroundColor:C.background }}
                  value={cl.note} onChangeText={v=>upd(i,{note:v})} placeholder="Notes..."/>
              </View>
            </View>;
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── SIGNOFF SCREEN ───────────────────────────────────────────────────────────
const SIGS = [
  { index:0, role:'Site Supervisor',   key:'siteSupervisor' },
  { index:1, role:'Project Manager',   key:'projectManager' },
  { index:2, role:'QA Representative', key:'qaRep' },
];
function SignoffScreen() {
  const { state, dispatch } = useDiary();
  const { entry, settings } = state;
  const ins = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const pmQaSigned = !!(entry.signatures?.[1] && entry.signatures?.[2]);

  function toggleSign(idx) {
    const already = !!entry.signatures?.[idx];
    if (already) {
      dispatch({ type:'SET_SIGNATURE', index:idx, value:null });
    } else {
      Alert.alert(
        `Sign as ${SIGS[idx].role}`,
        'Tap "Confirm signature" to sign this diary entry.',
        [
          { text:'Confirm signature', onPress:()=>dispatch({ type:'SET_SIGNATURE', index:idx, value:'signed_' + Date.now() }) },
          { text:'Cancel', style:'cancel' },
        ]
      );
    }
  }

  async function handleComplete() {
    if (!pmQaSigned) { Alert.alert('Incomplete','Both PM and QA must sign.'); return; }
    setLoading(true);
    try {
      const updated = { ...entry, signoffStatus:'complete', signoffCompletedAt:new Date().toISOString() };
      await saveEntry(updated);
      dispatch({ type:'UPDATE_ENTRY', payload:{ signoffStatus:'complete', signoffCompletedAt:updated.signoffCompletedAt } });
      const recips = [settings?.projectManager?.email, settings?.qaRep?.email, settings?.siteSupervisor?.email].filter(Boolean);
      Alert.alert('✅ Sign-off complete', recips.length ? `Signed off. Email notifications configured for:\n${recips.join('\n')}\n\nUse "Share PDF" to send the PDF manually.` : 'Signed off. Configure emails in Settings, then use Share PDF to distribute.');
    } catch(e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  }

  return (
    <View style={{ flex:1, backgroundColor:C.background }}>
      <AppHeader title="Sign off" subtitle={entry.signoffStatus==='complete'?'✅ Fully signed off':pmQaSigned?'⏳ PM & QA signed':'⏳ Awaiting signatures'}/>
      <ScrollView contentContainerStyle={{ padding:SP.md, paddingBottom:ins.bottom+100 }}>
        <Text style={{ fontSize:13, color:C.textSecondary, lineHeight:20, marginBottom:SP.sm }}>
          Tap each role to confirm signature. PM and QA signatures unlock the final sign-off.
        </Text>
        {SIGS.map(sig=>{
          const person = settings?.[sig.key];
          const signed = !!entry.signatures?.[sig.index];
          return <View key={sig.index} style={{ backgroundColor:C.white, borderRadius:R.lg, borderWidth:0.5, borderColor:signed?C.green:C.border, padding:SP.md, marginBottom:SP.sm, ...SH }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:SP.md }}>
              <View>
                <Text style={{ fontSize:14, fontWeight:'600', color:C.textPrimary }}>{sig.role}</Text>
                {person?.name  && <Text style={{ fontSize:13, color:C.textSecondary, marginTop:2 }}>{person.name}</Text>}
                {person?.email && <Text style={{ fontSize:11, color:C.textHint, marginTop:1 }}>{person.email}</Text>}
              </View>
              <View style={{ backgroundColor:signed?C.greenLight:C.background, borderRadius:R.full, paddingHorizontal:10, paddingVertical:4 }}>
                <Text style={{ fontSize:12, fontWeight:'600', color:signed?C.green:C.textSecondary }}>{signed?'✓ Signed':'Pending'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ height:72, borderWidth:0.5, borderStyle:signed?'solid':'dashed', borderColor:signed?C.green:C.border, borderRadius:R.md, alignItems:'center', justifyContent:'center', backgroundColor:signed?C.greenLight:C.background }}
              onPress={()=>toggleSign(sig.index)} activeOpacity={0.7}>
              <Text style={{ fontSize:13, color:signed?C.green:C.textHint, fontWeight:signed?'500':'400' }}>
                {signed ? '✓ Signed — tap to clear' : 'Tap to sign'}
              </Text>
            </TouchableOpacity>
          </View>;
        })}

        <View style={{ backgroundColor:C.white, borderRadius:R.lg, borderWidth:0.5, borderColor:C.border, padding:SP.md, ...SH }}>
          <Text style={{ fontSize:12, color:C.textSecondary, marginBottom:6 }}>Additional notes</Text>
          <TextInput style={{ fontSize:13, color:C.textPrimary, minHeight:72, textAlignVertical:'top' }} value={entry.addlNotes} onChangeText={v=>dispatch({type:'UPDATE_ENTRY',payload:{addlNotes:v}})} placeholder="Any final notes..." multiline/>
        </View>

        {entry.signoffStatus==='complete' && (
          <View style={{ backgroundColor:C.greenLight, borderRadius:R.lg, padding:SP.lg, alignItems:'center', marginTop:SP.sm }}>
            <Text style={{ fontSize:15, fontWeight:'600', color:C.green }}>✅ Fully signed off</Text>
            <Text style={{ fontSize:12, color:C.green, marginTop:4 }}>{entry.signoffCompletedAt ? new Date(entry.signoffCompletedAt).toLocaleString('en-AU') : ''}</Text>
          </View>
        )}
      </ScrollView>

      {entry.signoffStatus !== 'complete' && (
        <View style={{ backgroundColor:C.white, padding:SP.md, borderTopWidth:0.5, borderTopColor:C.border, paddingBottom:ins.bottom+8 }}>
          <TouchableOpacity
            style={{ backgroundColor:pmQaSigned?C.green:C.textHint, borderRadius:R.md, padding:SP.md, alignItems:'center' }}
            onPress={handleComplete} disabled={!pmQaSigned||loading}>
            {loading ? <ActivityIndicator color="#fff"/>
              : <Text style={{ color:'#fff', fontSize:14, fontWeight:'600' }}>
                  {pmQaSigned ? '✅  Complete sign-off' : '⏳  Awaiting PM & QA signatures'}
                </Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── HISTORY SCREEN ───────────────────────────────────────────────────────────
function HistoryScreen({ navigation }) {
  const { state, dispatch } = useDiary();
  const ins = useSafeAreaInsets();
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try { const all = await getEntries(); setEntries(all); }
    catch(e) { console.log('load error', e); }
    setLoading(false); setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const grouped = entries.reduce((acc,e)=>{ const k=(e.date||'unknown').slice(0,7); if(!acc[k])acc[k]=[]; acc[k].push(e); return acc; }, {});
  const months  = Object.keys(grouped).sort().reverse();

  function fmtMonth(k) { try { return format(new Date(k+'-01T12:00:00'),'MMMM yyyy'); } catch { return k; } }
  function fmtDate(d)  { try { return format(new Date(d+'T12:00:00'),'EEE d MMM'); } catch { return d||'—'; } }
  function stColor(st) { return st==='complete'?C.green : st==='pending'?C.pending : C.textHint; }
  function stLabel(st) { return st==='complete'?'✅ Signed' : st==='pending'?'⏳ Pending' : '📝 Draft'; }

  if (loading) return (
    <View style={{ flex:1, backgroundColor:C.background }}>
      <AppHeader title="History" subtitle="All entries"/>
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color={C.orange} size="large"/>
      </View>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.background }}>
      <AppHeader title="History" subtitle={`${entries.length} entries`}/>
      <ScrollView
        contentContainerStyle={{ padding:SP.md, paddingBottom:ins.bottom+20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={C.orange}/>}>
        {months.length===0 && (
          <View style={{ alignItems:'center', paddingVertical:60 }}>
            <Text style={{ fontSize:48, marginBottom:SP.md }}>📋</Text>
            <Text style={{ fontSize:16, fontWeight:'600', color:C.textPrimary }}>No diary entries yet</Text>
            <Text style={{ fontSize:13, color:C.textSecondary, marginTop:6 }}>Save your first entry in the Today tab</Text>
          </View>
        )}
        {months.map(mk=>{
          const mes = grouped[mk];
          const totH = mes.reduce((a,e)=>a+(e.totalHours||0),0);
          const signed = mes.filter(e=>e.signoffStatus==='complete').length;
          return <View key={mk} style={{ marginBottom:SP.lg }}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:SP.sm }}>
              <View>
                <Text style={{ fontSize:16, fontWeight:'700', color:C.textPrimary }}>{fmtMonth(mk)}</Text>
                <Text style={{ fontSize:12, color:C.textSecondary, marginTop:2 }}>{mes.length} entries · {totH.toFixed(1)} hrs · {signed}/{mes.length} signed</Text>
              </View>
            </View>
            {mes.map(e=>(
              <TouchableOpacity key={e.id}
                style={{ backgroundColor:C.white, borderRadius:R.lg, borderWidth:0.5, borderColor:C.border, padding:SP.md, marginBottom:SP.sm, ...SH }}
                onPress={()=>{ dispatch({type:'LOAD_ENTRY',payload:e}); navigation.navigate('Today'); }}
                activeOpacity={0.7}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <Text style={{ fontSize:14, fontWeight:'600', color:C.textPrimary }}>{fmtDate(e.date)}</Text>
                  <Text style={{ fontSize:12, fontWeight:'500', color:stColor(e.signoffStatus) }}>{stLabel(e.signoffStatus)}</Text>
                </View>
                <Text style={{ fontSize:12, color:C.textSecondary, marginBottom:SP.sm }}>{e.projectName||'Unnamed project'}{e.projectNo?` · ${e.projectNo}`:''}</Text>
                <View style={{ flexDirection:'row', gap:SP.sm }}>
                  {[['👷',e.totalPersonnel||0,'pax'],['⏱',`${(e.totalHours||0).toFixed(1)}`,'hrs'],['🌤',e.weatherAM||'—','AM']].map(([ic,v,l])=>(
                    <View key={l} style={{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:C.background, borderRadius:R.full, paddingHorizontal:10, paddingVertical:4 }}>
                      <Text style={{ fontSize:12 }}>{ic}</Text>
                      <Text style={{ fontSize:12, fontWeight:'600', color:C.textPrimary }}>{v}</Text>
                      <Text style={{ fontSize:11, color:C.textSecondary }}>{l}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>;
        })}
      </ScrollView>
    </View>
  );
}

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────
const PEOPLE = [
  { key:'siteSupervisor', label:'Site Supervisor',   icon:'🦺' },
  { key:'projectManager', label:'Project Manager',   icon:'📋' },
  { key:'qaRep',          label:'QA Representative', icon:'🔍' },
];
function SettingsScreen() {
  const { state, updateSettings } = useDiary();
  const { settings } = state;
  const ins = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [loc, setLoc] = useState(null);

  useEffect(() => { if (settings && !loc) setLoc(settings); }, [settings]);

  function updL(path, val) {
    const parts = path.split('.');
    setLoc(prev => {
      const c = { ...prev };
      if (parts.length === 2) c[parts[0]] = { ...c[parts[0]], [parts[1]]:val };
      else c[parts[0]] = val;
      return c;
    });
  }

  async function handleSave() {
    setSaving(true);
    await updateSettings(loc);
    setSaving(false);
    Alert.alert('✅ Settings saved');
  }

  if (!loc) return (
    <View style={{ flex:1, backgroundColor:C.background }}>
      <AppHeader title="Settings"/>
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator color={C.orange}/></View>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.background }}>
      <AppHeader title="Settings" subtitle="Project personnel & preferences"/>
      <ScrollView contentContainerStyle={{ padding:SP.md, paddingBottom:ins.bottom+100 }}>
        <SectionLabel>Company details</SectionLabel>
        <Card>
          {[['Company name','companyName','ABA Construction Managers'],['Address','companyAddress','55 Heffernan St, Mitchell ACT 2911'],['Phone','companyPhone','(02) 6242 3400']].map(([l,k,ph])=>(
            <View key={k} style={{ marginBottom:SP.sm }}>
              <Text style={s.fl}>{l}</Text>
              <TextInput style={s.inp} value={loc[k]||''} onChangeText={v=>updL(k,v)} placeholder={ph}/>
            </View>
          ))}
        </Card>

        <SectionLabel>Sign-off personnel</SectionLabel>
        <View style={{ backgroundColor:C.blueLight, borderRadius:R.md, padding:SP.md, marginBottom:SP.sm }}>
          <Text style={{ fontSize:13, color:C.blue, lineHeight:20 }}>📧 Configure email addresses so PDFs can be sent after sign-off.</Text>
        </View>
        {PEOPLE.map(p=>(
          <Card key={p.key}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:SP.sm, marginBottom:SP.md }}>
              <Text style={{ fontSize:22 }}>{p.icon}</Text>
              <Text style={{ fontSize:15, fontWeight:'600', color:C.textPrimary }}>{p.label}</Text>
            </View>
            <Text style={s.fl}>Full name</Text>
            <TextInput style={[s.inp,{marginBottom:SP.sm}]} value={loc[p.key]?.name||''} onChangeText={v=>updL(`${p.key}.name`,v)} placeholder={`${p.label} name`} autoCapitalize="words"/>
            <Text style={s.fl}>Email address</Text>
            <TextInput style={s.inp} value={loc[p.key]?.email||''} onChangeText={v=>updL(`${p.key}.email`,v)} placeholder="email@company.com.au" keyboardType="email-address" autoCapitalize="none"/>
          </Card>
        ))}

        <SectionLabel>WHS Statistics</SectionLabel>
        <Card>
          <Text style={s.fl}>Project start date (YYYY-MM-DD)</Text>
          <TextInput style={[s.inp,{marginBottom:SP.sm}]} value={loc.projectStartDate||''} onChangeText={v=>updL('projectStartDate',v)} placeholder="2024-01-01"/>
          <Text style={s.fl}>Standard work hours per day</Text>
          <TextInput style={s.inp} value={loc.standardHoursPerDay||''} onChangeText={v=>updL('standardHoursPerDay',v)} placeholder="8" keyboardType="numeric"/>
        </Card>

        <SectionLabel>Saved subcontractors</SectionLabel>
        <Card>
          {(loc.savedSubcontractors||[]).map((sub,i)=>(
            <View key={i} style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:SP.sm, borderBottomWidth:0.5, borderBottomColor:C.border }}>
              <Text style={{ fontSize:14, color:C.textPrimary }}>🏗 {sub}</Text>
              <TouchableOpacity onPress={()=>updL('savedSubcontractors',(loc.savedSubcontractors||[]).filter((_,x)=>x!==i))}>
                <Text style={{ fontSize:18, color:C.danger, padding:4 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[s.addBtn,{marginTop:SP.sm}]} onPress={()=>Alert.prompt('Add subcontractor','Company name',name=>{if(name?.trim())updL('savedSubcontractors',[...(loc.savedSubcontractors||[]),name.trim()]);})}><Text style={s.addBtnT}>＋ Add subcontractor</Text></TouchableOpacity>
        </Card>
      </ScrollView>

      <View style={{ backgroundColor:C.white, padding:SP.md, borderTopWidth:0.5, borderTopColor:C.border, paddingBottom:ins.bottom+8 }}>
        <TouchableOpacity style={{ backgroundColor:C.orange, borderRadius:R.md, padding:SP.md, alignItems:'center' }} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff"/> : <Text style={{ color:'#fff', fontSize:15, fontWeight:'600' }}>💾 Save settings</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SHARED COMPONENTS & STYLES ───────────────────────────────────────────────
function Card({ children }) { return <View style={s.card}><View style={s.cardBody}>{children}</View></View>; }
function Row({ children, style }) { return <View style={[s.row, style]}>{children}</View>; }
function Field({ label, children, flex }) { return <View style={{ flex:flex||1 }}><Text style={s.fl}>{label}</Text>{children}</View>; }
function SectionLabel({ children }) { return <Text style={{ fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.6, color:C.textSecondary, marginBottom:SP.sm, marginTop:SP.md }}>{children}</Text>; }

const s = StyleSheet.create({
  card:    { backgroundColor:C.white, borderRadius:R.lg, borderWidth:0.5, borderColor:C.border, marginBottom:SP.sm, ...SH },
  cardHdr: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:SP.md },
  cardTitle:{ fontSize:14, fontWeight:'600', color:C.textPrimary },
  cardBody:{ padding:SP.md, paddingTop:0 },
  row:     { flexDirection:'row', alignItems:'flex-start' },
  fl:      { fontSize:11, color:C.textSecondary, marginBottom:4 },
  inp:     { borderWidth:0.5, borderColor:C.border, borderRadius:R.md, padding:SP.sm, fontSize:13, color:C.textPrimary, backgroundColor:C.white },
  addBtn:  { borderWidth:0.5, borderStyle:'dashed', borderColor:C.border, borderRadius:R.md, padding:SP.sm, alignItems:'center', marginTop:SP.sm },
  addBtnT: { fontSize:13, color:C.textSecondary },
  wp:      { borderWidth:0.5, borderColor:C.border, borderRadius:R.full, paddingHorizontal:12, paddingVertical:6, marginRight:8 },
  wpa:     { backgroundColor:C.orangeLight, borderColor:C.orange },
  wpt:     { fontSize:12, color:C.textSecondary },
  wpta:    { color:C.orangeDark, fontWeight:'600' },
  stag:    { backgroundColor:C.background, borderWidth:0.5, borderColor:C.border, borderRadius:R.full, paddingHorizontal:12, paddingVertical:5, marginRight:8 },
  stagT:   { fontSize:12, color:C.textSecondary },
  subCard: { backgroundColor:C.background, borderRadius:R.md, padding:SP.md, marginBottom:SP.sm },
  totBox:  { flex:1, backgroundColor:C.orangeLight, borderRadius:R.md, padding:SP.md, alignItems:'center' },
  totNum:  { fontSize:24, fontWeight:'700', color:C.orange },
  totLbl:  { fontSize:11, color:C.orangeDark, marginTop:2 },
  saveBar: { backgroundColor:C.white, padding:SP.md, borderTopWidth:0.5, borderTopColor:C.border },
  saveBtn: { backgroundColor:C.orange, borderRadius:R.md, padding:SP.md, alignItems:'center' },
  saveBtnT:{ color:'#fff', fontSize:15, fontWeight:'600' },
  pill:    { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:C.blueLight, borderRadius:R.full, paddingHorizontal:10, paddingVertical:4, marginRight:8 },
  pillL:   { fontSize:10, fontWeight:'700', color:C.blue },
  pillN:   { fontSize:12, color:C.blue },
});

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();
function TabIcon({ name, focused }) {
  const icons = { Today:focused?'✏️':'📝', Checklist:focused?'☑️':'📋', 'Sign off':focused?'✍️':'📄', History:focused?'🗂️':'📁', Settings:focused?'⚙️':'🔧' };
  return <Text style={{ fontSize:20 }}>{icons[name]||'•'}</Text>;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex:1 }}>
      <SafeAreaProvider>
        <DiaryProvider>
          <NavigationContainer>
            <StatusBar style="light" backgroundColor={C.orange}/>
            <Tab.Navigator
              screenOptions={({ route })=>({
                tabBarIcon:({ focused })=><TabIcon name={route.name} focused={focused}/>,
                tabBarActiveTintColor:C.orange,
                tabBarInactiveTintColor:C.textSecondary,
                tabBarStyle:{ backgroundColor:C.white, borderTopColor:C.border, borderTopWidth:0.5, height:60, paddingBottom:8 },
                tabBarLabelStyle:{ fontSize:11 },
                headerShown:false,
              })}>
              <Tab.Screen name="Today"     component={TodayScreen}/>
              <Tab.Screen name="Checklist" component={ChecklistScreen}/>
              <Tab.Screen name="Sign off"  component={SignoffScreen}/>
              <Tab.Screen name="History"   component={HistoryScreen}/>
              <Tab.Screen name="Settings"  component={SettingsScreen}/>
            </Tab.Navigator>
          </NavigationContainer>
        </DiaryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
