/**
 * ABA Site Diary v2.0
 * Features: GPS weather, voice-to-text, photo attachments, PDF generation,
 * auto email on sign-off, monthly WHS stats report, green theme
 */
import React, {
  createContext, useContext, useReducer, useEffect,
  useCallback, useState, useRef,
} from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Image, Platform,
  PermissionsAndroid,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';

// ─── THEME (Navy + Green) ─────────────────────────────────────────────────────
const C = {
  primary:    '#0D1B3E',   // navy
  primaryMid: '#1A3260',
  accent:     '#4CAF50',   // green
  accentLight:'#E8F5E9',
  accentDark: '#2E7D32',
  white:      '#FFFFFF',
  background: '#F0F4F0',
  surface:    '#FFFFFF',
  border:     '#D0D9D0',
  textPrimary:'#0D1B3E',
  textSecondary:'#4A5568',
  textHint:   '#9CA3AF',
  danger:     '#DC2626',
  pending:    '#D97706',
  green:      '#4CAF50',
  greenLight: '#E8F5E9',
  blue:       '#1D6FC4',
  blueLight:  '#EBF3FD',
};
const SP = { xs:4, sm:8, md:12, lg:16, xl:24 };
const R  = { sm:6, md:10, lg:14, full:999 };
const SH = { shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.08, shadowRadius:4, elevation:3 };
}
async function saveEntry(entry) {
  try {
    const entries = await getEntries();
    const idx = entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) entries[idx] = entry; else entries.unshift(entry);
async function getEntries() {
  try { const r = await AsyncStorage.getItem('aba_entries_v2'); return r ? JSON.parse(r) : []; }
  catch { return []; }

    return r ? JSON.parse(r) : {
      companyName: 'ABA Construction Managers (Aust) Pty Ltd',
      companyAddress: 'Suite 7 Level One, 55 Heffernan St, Mitchell ACT 2911',
      companyPhone: '(02) 6242 3400',
    await AsyncStorage.setItem('aba_entries_v2', JSON.stringify(entries));
    return true;
  } catch { return false; }
}
async function getSettings() {
  try {
    const r = await AsyncStorage.getItem('aba_settings_v2');

// ─── STATE / CONTEXT ──────────────────────────────────────────────────────────
const DiaryContext = createContext(null);
function freshEntry() {
  let d = '';
  try { d = format(new Date(),'yyyy-MM-dd'); } catch { d = new Date().toISOString().slice(0,10); }
  return {
    id: Date.now().toString(), date:d, projectName:'', projectNo:'',
    weatherAM:'', weatherPM:'',
    sections:{ work:[''], delays:[''], oral:[''], drawings:[''] },
    sectionPhotos:{ work:[], delays:[], oral:[], drawings:[] },
    subs:[], checklist:{}, addlNotes:'',
    signoffStatus:'draft', signedBy:{},
    totalPersonnel:0, totalHours:0,
  };
}
function reducer(state, action) {
  switch(action.type) {
    case 'SET_SETTINGS':     return {...state, settings:action.payload, loading:false};
    case 'UPDATE_ENTRY':     return {...state, entry:{...state.entry,...action.payload}};
    case 'UPDATE_SECTION':   return {...state, entry:{...state.entry, sections:{...state.entry.sections,[action.key]:action.value}}};
    case 'UPDATE_PHOTOS':    return {...state, entry:{...state.entry, sectionPhotos:{...state.entry.sectionPhotos,[action.sid]:action.photos}}};
    case 'UPDATE_SUBS':      return {...state, entry:{...state.entry, subs:action.payload}};
    case 'UPDATE_CHECKLIST': return {...state, entry:{...state.entry, checklist:{...state.entry.checklist,[action.index]:action.value}}};
    case 'SET_SIGNED':       return {...state, entry:{...state.entry, signedBy:{...state.entry.signedBy,[action.role]:action.value}}};
    case 'NEW_ENTRY':        return {...state, entry:freshEntry()};
    case 'LOAD_ENTRY':       return {...state, entry:action.payload};
    default:                 return state;
  }
}
function DiaryProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { entry:freshEntry(), settings:null, loading:true });
  useEffect(() => {
    getSettings().then(s => dispatch({ type:'SET_SETTINGS', payload:s }));
  }, []);
  const updateSettings = useCallback(async upd => {
    const m = {...state.settings,...upd};
    await persistSettings(m);
    dispatch({ type:'SET_SETTINGS', payload:m });
  }, [state.settings]);
  return <DiaryContext.Provider value={{state, dispatch, updateSettings}}>{children}</DiaryContext.Provider>;
}
function useDiary() { return useContext(DiaryContext); }

  async function handleSave() {
    setSaving(true);
    try {
      const tot = calcTotals(entry.subs);
      const toSave = {...entry,...tot,signoffStatus:'pending',savedAt:new Date().toISOString()};
      await saveEntry(toSave);
      dispatch({type:'UPDATE_ENTRY',payload:{...tot,signoffStatus:'pending'}});
      // Build browser sign-off links for PM & QA
      const PAGES_BASE = settings?.pagesUrl || 'https://YOUR-GITHUB-USERNAME.github.io/aba-site-diary';
      const encodeEntry = (e) => {
        try { return btoa(encodeURIComponent(JSON.stringify(e))); } catch { return ''; }
      };
      const entryB64 = encodeEntry({...entry,...tot,signoffStatus:'pending',savedAt:new Date().toISOString()});
      const pmLink = `${PAGES_BASE}/?id=${entry.id}&role=pm&name=${encodeURIComponent(settings?.projectManager?.name||'Project Manager')}&data=${entryB64}`;
      const qaLink = `${PAGES_BASE}/?id=${entry.id}&role=qa&name=${encodeURIComponent(settings?.qaRep?.name||'QA Representative')}&data=${entryB64}`;

      const recips = [settings?.projectManager?.email,settings?.qaRep?.email].filter(Boolean);
      if(recips.length){
        const ok = await MailComposer.isAvailableAsync();
        if(ok){
          const pmBody = `You have a site diary entry awaiting your review and sign-off.\n\nProject: ${entry.projectName||'—'}\nDate: ${entry.date}\nPersonnel: ${tot.totalPersonnel}\nLabour hours: ${tot.totalHours.toFixed(1)} hrs\n\n── TAP THE LINK BELOW TO REVIEW & SIGN ──\n\nProject Manager sign-off:\n${pmLink}\n\nQA Representative sign-off:\n${qaLink}\n\nThe link opens a mobile-friendly page where you can review the full diary and confirm your signature.\n\nRegards,\n${settings.siteSupervisor?.name||'Site Supervisor'}\nABA Construction Managers`;
          await MailComposer.composeAsync({
            recipients:recips,
            subject:`[Action required] Site Diary sign-off – ${entry.projectName||'Project'} – ${entry.date}`,
            body:pmBody,
          });
        }
      }
      Alert.alert('✅ Entry saved',`${tot.totalPersonnel} personnel · ${tot.totalHours.toFixed(1)} labour hrs\n\nSign-off links emailed to PM & QA. They can review and sign in their browser, then return here for your supervisor signature.`);
    } catch(e) { Alert.alert('Error', e.message); }
    setSaving(false);
  }

  const tot = calcTotals(entry.subs);
  const savedSubs = settings?.savedSubcontractors || ['Clarke Civil','Mitchell Electrical','ACT Plumbing'];

  return (
    <View style={{flex:1,backgroundColor:C.background}}>
      <AppHeader title="Site Diary" subtitle="ABA Construction Managers"/>
      <ScrollView contentContainerStyle={{padding:SP.md,paddingBottom:ins.bottom+90}}>

        {/* Project info */}
        <View style={s.card}>
          <View style={s.cardBody}>
            <View style={s.row}>
              <View style={{flex:1.3}}><Text style={s.fl}>Date</Text><TextInput style={s.inp} value={entry.date} onChangeText={v=>upd({date:v})} placeholder="YYYY-MM-DD"/></View>
              <View style={{width:SP.sm}}/>
              <View style={{flex:1}}><Text style={s.fl}>Project No.</Text><TextInput style={s.inp} value={entry.projectNo} onChangeText={v=>upd({projectNo:v})} placeholder="2024-001"/></View>
            </View>
            <View style={{marginTop:SP.sm}}><Text style={s.fl}>Project name</Text><TextInput style={s.inp} value={entry.projectName} onChangeText={v=>upd({projectName:v})} placeholder="Enter project name"/></View>
            {settings?.projectManager?.name?<View style={[s.row,{marginTop:SP.sm}]}>
              <View style={s.pill}><Text style={s.pillL}>PM</Text><Text style={s.pillN}>{settings.projectManager.name}</Text></View>
              <View style={s.pill}><Text style={s.pillL}>QA</Text><Text style={s.pillN}>{settings.qaRep?.name||'Not set'}</Text></View>
            </View>:<Text style={{fontSize:11,color:C.textHint,marginTop:SP.sm}}>⚙️ Set PM & QA in Settings to enable email notifications</Text>}
          </View>
        </View>

        {/* Weather */}
        <View style={s.card}>
          <View style={s.cardBody}>
            <View style={[s.row,{alignItems:'center',marginBottom:SP.sm}]}>
              <Text style={[s.fl,{flex:1,marginBottom:0}]}>Weather</Text>
              <TouchableOpacity style={s.weatherBtn} onPress={handleFetchWeather} disabled={fetchingWeather}>
                {fetchingWeather?<ActivityIndicator size="small" color={C.accent}/>:<Text style={s.weatherBtnT}>📍 Auto-fetch</Text>}
              </TouchableOpacity>
            </View>
            <View style={s.row}>
              <View style={{flex:1}}><Text style={s.fl}>AM</Text><TextInput style={s.inp} value={entry.weatherAM} onChangeText={v=>upd({weatherAM:v})} placeholder="e.g. Sunny ☀️ 18°C"/></View>
              <View style={{width:SP.sm}}/>
              <View style={{flex:1}}><Text style={s.fl}>PM</Text><TextInput style={s.inp} value={entry.weatherPM} onChangeText={v=>upd({weatherPM:v})} placeholder="e.g. Cloudy ☁️ 22°C"/></View>
            </View>
          </View>
        </View>

        {/* Work sections */}
        {SECTIONS.map(sec=>(
          <View key={sec.id} style={s.card}>
            <TouchableOpacity style={s.cardHdr} onPress={()=>tog(sec.id)} activeOpacity={0.7}>
              <Text style={s.cardTitle}>{sec.label}</Text>
              <Text style={{color:C.textSecondary}}>{exp[sec.id]?'▲':'▼'}</Text>
            </TouchableOpacity>
            {exp[sec.id]&&<View style={s.cardBody}>
              {(entry.sections[sec.id]||['']).map((v,i)=>(
                <View key={i} style={[s.row,{marginBottom:SP.sm,alignItems:'flex-start'}]}>
                  <TextInput style={[s.inp,{flex:1}]} value={v} onChangeText={x=>updLine(sec.id,i,x)} placeholder={sec.placeholder} multiline/>
                  <VoiceButton onResult={t=>updLine(sec.id,i,(v?v+' ':'')+t)}/>
                  <TouchableOpacity onPress={()=>remLine(sec.id,i)} style={{width:30,alignItems:'center',justifyContent:'center',marginLeft:4}}><Text style={{color:C.textSecondary,fontSize:16}}>🗑</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addBtn} onPress={()=>addLine(sec.id)}><Text style={s.addBtnT}>＋ Add line</Text></TouchableOpacity>
              {/* Photos */}
              <View style={{marginTop:SP.md}}>
                <Text style={s.fl}>📷 Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:6}}>
                  {(entry.sectionPhotos[sec.id]||[]).map((src,i)=>(
                    <View key={i} style={s.thumb}>
                      <Image source={{uri:src}} style={s.thumbImg}/>
                      <TouchableOpacity onPress={()=>{const ph=(entry.sectionPhotos[sec.id]||[]).filter((_,x)=>x!==i);dispatch({type:'UPDATE_PHOTOS',sid:sec.id,photos:ph});}} style={s.thumbDel}><Text style={{color:'#fff',fontSize:11}}>✕</Text></TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={s.thumbAdd} onPress={()=>addPhoto(sec.id)}><Text style={{fontSize:22,color:C.textHint}}>📷</Text></TouchableOpacity>
                </ScrollView>
              </View>
            </View>}
            </View>}
          </View>
        ))}

        {/* Subcontractors */}
        <View style={s.card}>
          <TouchableOpacity style={s.cardHdr} onPress={()=>tog('subs')} activeOpacity={0.7}>
            <Text style={s.cardTitle}>Subcontractors on site</Text>
            <Text style={{color:C.textSecondary}}>{exp.subs?'▲':'▼'}</Text>
          </TouchableOpacity>
          {exp.subs&&<View style={s.cardBody}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:SP.sm}}>
              {savedSubs.map(n=><TouchableOpacity key={n} style={s.stag} onPress={()=>addSub(n)}><Text style={s.stagT}>{n}</Text></TouchableOpacity>)}
            </ScrollView>
            {entry.subs.length>0&&<View style={[s.row,{marginBottom:SP.md}]}>
              <View style={[s.totBox,{marginRight:SP.sm}]}><Text style={s.totNum}>{tot.totalPersonnel}</Text><Text style={s.totLbl}>Total personnel</Text></View>
              <View style={s.totBox}><Text style={s.totNum}>{tot.totalHours.toFixed(1)}</Text><Text style={s.totLbl}>Labour hours</Text></View>
            </View>}
            {entry.subs.map((sub,i)=>{
              const p=parseInt(sub.personnel)||0,h=calcSubHours(sub);
              return <View key={i} style={s.subCard}>
                <View style={s.row}>
                  <TextInput style={[s.inp,{flex:1,marginRight:SP.sm}]} value={sub.name} onChangeText={v=>updSub(i,{name:v})} placeholder="Subcontractor name"/>
                  <TouchableOpacity onPress={()=>remSub(i)} style={{width:28,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.danger,fontSize:18}}>✕</Text></TouchableOpacity>
                </View>
                <View style={[s.row,{marginTop:SP.sm}]}>
                  <View style={{flex:1}}><Text style={s.fl}>Personnel</Text><TextInput style={s.inp} value={sub.personnel} onChangeText={v=>updSub(i,{personnel:v})} placeholder="0" keyboardType="number-pad"/></View>
                  <View style={{width:SP.sm}}/>
                  <View style={{flex:1}}><Text style={s.fl}>Labour hrs</Text><View style={[s.inp,{backgroundColor:C.accentLight,borderColor:C.accent,justifyContent:'center',minHeight:36}]}><Text style={{color:C.accentDark,fontWeight:'600',fontSize:13}}>{(p*h).toFixed(1)} hrs</Text></View></View>
                </View>
                <View style={[s.row,{marginTop:SP.sm}]}>
                  <View style={{flex:1}}><Text style={s.fl}>Start</Text><TextInput style={s.inp} value={sub.timeStart} onChangeText={v=>updSub(i,{timeStart:v})} placeholder="07:00"/></View>
                  <View style={{width:SP.sm}}/>
                  <View style={{flex:1}}><Text style={s.fl}>Finish</Text><TextInput style={s.inp} value={sub.timeEnd} onChangeText={v=>updSub(i,{timeEnd:v})} placeholder="15:30"/></View>
                </View>
                <View style={{marginTop:SP.sm}}>
                  <Text style={s.fl}>Works carried out</Text>
                  <View style={s.row}>
                    <TextInput style={[s.inp,{flex:1,minHeight:50}]} value={sub.notes} onChangeText={v=>updSub(i,{notes:v})} placeholder="Describe activities..." multiline/>
                    <VoiceButton onResult={t=>updSub(i,{notes:(sub.notes?sub.notes+' ':'')+t})}/>
                  </View>
                </View>
              </View>;
            })}
                </View>
              </View>;
            })}
            <TouchableOpacity style={s.addBtn} onPress={()=>addSub()}><Text style={s.addBtnT}>＋ Add subcontractor</Text></TouchableOpacity>
          </View>}
        </View>

      </ScrollView>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving?<ActivityIndicator color="#fff"/>:<Text style={s.saveBtnT}>💾  Save & notify PM / QA</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── CHECKLIST SCREEN ─────────────────────────────────────────────────────────
function ChecklistScreen() {
  const {state, dispatch} = useDiary();
  const {entry} = state;
  const ins = useSafeAreaInsets();
  function upd(i,u){const cur=entry.checklist[i]||{checked:false,note:''};dispatch({type:'UPDATE_CHECKLIST',index:i,value:{...cur,...u}});} 
  const checked = CL_ITEMS.filter((_,i)=>entry.checklist[i]?.checked).length;
  return (
    <View style={{flex:1,backgroundColor:C.background}}>
      <AppHeader title="Other Checklist" subtitle={`${checked} of ${CL_ITEMS.length} items marked`}/>
      <ScrollView contentContainerStyle={{padding:SP.md,paddingBottom:ins.bottom+20}}>
        <View style={{backgroundColor:C.white,borderRadius:R.lg,borderWidth:0.5,borderColor:C.border,...SH}}>
          {CL_ITEMS.map((item,i)=>{
            const cl=entry.checklist[i]||{checked:false,note:''};
            return <View key={i} style={{flexDirection:'row',alignItems:'flex-start',padding:SP.md,borderBottomWidth:i<CL_ITEMS.length-1?0.5:0,borderBottomColor:C.border}}>
              <TouchableOpacity style={{width:24,height:24,borderRadius:12,borderWidth:1.5,borderColor:cl.checked?C.accent:C.border,backgroundColor:cl.checked?C.accent:'transparent',alignItems:'center',justifyContent:'center',marginTop:2,flexShrink:0}} onPress={()=>upd(i,{checked:!cl.checked})}>
                {cl.checked&&<Text style={{color:'#fff',fontSize:13,fontWeight:'700'}}>✓</Text>}
              </TouchableOpacity>
              <View style={{flex:1,marginLeft:SP.md}}>
                <Text style={{fontSize:13,color:cl.checked?C.textSecondary:C.textPrimary,textDecorationLine:cl.checked?'line-through':'none'}}>{i+1}. {item}</Text>
                <View style={{flexDirection:'row',alignItems:'center',marginTop:6}}>
                  <TextInput style={[{flex:1,fontSize:12,color:C.textPrimary,borderWidth:0.5,borderColor:'transparent',borderRadius:R.sm,padding:6,backgroundColor:C.background}]} value={cl.note} onChangeText={v=>upd(i,{note:v})} placeholder="Notes..."/>
                  <VoiceButton onResult={t=>upd(i,{note:(cl.note?cl.note+' ':'')+t})}/>
                </View>
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
  {index:'supervisor', role:'Site Supervisor',   key:'siteSupervisor'},
  {index:'pm',         role:'Project Manager',   key:'projectManager'},
  {index:'qa',         role:'QA Representative', key:'qaRep'},
];
function SignoffScreen() {
  const {state, dispatch} = useDiary();
  const {entry, settings} = state;
  const ins = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const signedBy = entry.signedBy || {};
  const allSigned = SIGS.every(s=>!!signedBy[s.index]);
  const pmQaSigned = !!signedBy.pm && !!signedBy.qa;

  function toggleSign(idx, role) {
    const already = !!signedBy[idx];
    if (already) {
      Alert.alert('Clear signature', `Remove ${role}'s signature?`,[
        {text:'Yes, clear', style:'destructive', onPress:()=>dispatch({type:'SET_SIGNED',role:idx,value:null})},
        {text:'Cancel',style:'cancel'},
      ]);
    } else {
      Alert.alert(`Sign as ${role}`, `Confirm that ${role} approves this site diary entry.`,[
        {text:'Confirm & sign', onPress:()=>dispatch({type:'SET_SIGNED',role:idx,value:{name:settings?.[SIGS.find(s=>s.index===idx)?.key]?.name||role,at:new Date().toISOString()}})},
        {text:'Cancel',style:'cancel'},
      ]);
    }
  }

  async function handleComplete() {
    if(!allSigned){Alert.alert('Incomplete','All three parties must sign before completing.');return;}
    setLoading(true);
    try {
      const updated={...entry,signoffStatus:'complete',signoffCompletedAt:new Date().toISOString()};
      await saveEntry(updated);
      dispatch({type:'UPDATE_ENTRY',payload:{signoffStatus:'complete',signoffCompletedAt:updated.signoffCompletedAt}});
      await generateAndEmailPdf(updated, settings);
    } catch(e) { Alert.alert('Error',e.message); }
    setLoading(false);
  }

  return (
    <View style={{flex:1,backgroundColor:C.background}}>
      <AppHeader title="Sign off" subtitle={entry.signoffStatus==='complete'?'✅ Complete — PDF emailed':allSigned?'All signed — tap Complete':pmQaSigned?'⏳ Supervisor signature needed':'⏳ Awaiting signatures'}/>
      <ScrollView contentContainerStyle={{padding:SP.md,paddingBottom:ins.bottom+100}}>
        <View style={{backgroundColor:C.blueLight,borderRadius:R.md,padding:SP.md,marginBottom:SP.md}}>
          <Text style={{fontSize:13,color:C.blue,lineHeight:20}}>📋 All three parties must sign. Once complete, the diary PDF is automatically generated and emailed to all signatories.</Text>
        </View>
        {SIGS.map(sig=>{
          const person=settings?.[sig.key];
          const signed=!!signedBy[sig.index];
          const sigData=signedBy[sig.index];
          return <View key={sig.index} style={{backgroundColor:C.white,borderRadius:R.lg,borderWidth:1,borderColor:signed?C.accent:C.border,padding:SP.md,marginBottom:SP.sm,...SH}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:SP.md}}>
              <View>
                <Text style={{fontSize:14,fontWeight:'600',color:C.textPrimary}}>{sig.role}</Text>
                {person?.name&&<Text style={{fontSize:13,color:C.textSecondary,marginTop:2}}>{person.name}</Text>}
                {person?.email&&<Text style={{fontSize:11,color:C.textHint,marginTop:1}}>{person.email}</Text>}
                {signed&&sigData?.at&&<Text style={{fontSize:11,color:C.accent,marginTop:3}}>Signed {new Date(sigData.at).toLocaleString('en-AU')}</Text>}
              </View>
              <View style={{backgroundColor:signed?C.accentLight:C.background,borderRadius:R.full,paddingHorizontal:10,paddingVertical:4,borderWidth:0.5,borderColor:signed?C.accent:C.border}}>
                <Text style={{fontSize:12,fontWeight:'600',color:signed?C.accentDark:C.textSecondary}}>{signed?'✓ Signed':'Pending'}</Text>
              </View>
            </View>
            <TouchableOpacity style={{height:72,borderWidth:1,borderStyle:signed?'solid':'dashed',borderColor:signed?C.accent:C.border,borderRadius:R.md,alignItems:'center',justifyContent:'center',backgroundColor:signed?C.accentLight:C.background}} onPress={()=>toggleSign(sig.index,sig.role)} activeOpacity={0.7}>
              <Text style={{fontSize:13,color:signed?C.accentDark:C.textHint,fontWeight:signed?'600':'400'}}>{signed?`✓ ${sigData?.name||sig.role} signed — tap to clear`:'Tap to confirm signature'}</Text>
            </TouchableOpacity>
          </View>;
        })}
        <View style={{backgroundColor:C.white,borderRadius:R.lg,borderWidth:0.5,borderColor:C.border,padding:SP.md,...SH,marginTop:SP.sm}}>
          <Text style={{fontSize:12,color:C.textSecondary,marginBottom:6}}>Additional notes</Text>
          <TextInput style={{fontSize:13,color:C.textPrimary,minHeight:72,textAlignVertical:'top'}} value={entry.addlNotes} onChangeText={v=>dispatch({type:'UPDATE_ENTRY',payload:{addlNotes:v}})} placeholder="Any final notes..." multiline/>
        </View>
        {entry.signoffStatus==='complete'&&<View style={{backgroundColor:C.accentLight,borderRadius:R.lg,padding:SP.lg,alignItems:'center',marginTop:SP.sm,borderWidth:1,borderColor:C.accent}}>
          <Text style={{fontSize:15,fontWeight:'700',color:C.accentDark}}>✅ Fully signed off</Text>
          <Text style={{fontSize:12,color:C.accentDark,marginTop:4}}>{entry.signoffCompletedAt?new Date(entry.signoffCompletedAt).toLocaleString('en-AU'):''}</Text>
          <Text style={{fontSize:12,color:C.accentDark,marginTop:2}}>PDF emailed to all signatories</Text>
        </View>}
      </ScrollView>
      {entry.signoffStatus!=='complete'&&<View style={{backgroundColor:C.white,padding:SP.md,borderTopWidth:0.5,borderTopColor:C.border,paddingBottom:ins.bottom+8}}>
        <TouchableOpacity style={{backgroundColor:allSigned?C.accent:C.border,borderRadius:R.md,padding:SP.md,alignItems:'center'}} onPress={handleComplete} disabled={!allSigned||loading}>
          {loading?<ActivityIndicator color="#fff"/>:<Text style={{color:'#fff',fontSize:14,fontWeight:'600'}}>{allSigned?'✅  Complete sign-off & email PDF':'⏳  All three parties must sign'}</Text>}
        </TouchableOpacity>
      </View>}

    </View>
  );
}

// ─── HISTORY SCREEN ───────────────────────────────────────────────────────────
function HistoryScreen({navigation}) {
  const {state, dispatch} = useDiary();
  const {settings} = state;
  const ins = useSafeAreaInsets();
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [repLoading, setRepLoading] = useState(false);

  async function load(){try{const all=await getEntries();setEntries(all);}catch{}setLoading(false);setRefreshing(false);}
  useEffect(()=>{load();},[]);

  const grouped=entries.reduce((acc,e)=>{const k=(e.date||'unknown').slice(0,7);if(!acc[k])acc[k]=[];acc[k].push(e);return acc;},{});
  const months=Object.keys(grouped).sort().reverse();
  function stColor(st){return st==='complete'?C.accent:st==='pending'?C.pending:C.textHint;}
  function stLabel(st){return st==='complete'?'✅ Signed':st==='pending'?'⏳ Pending':'📝 Draft';}

  async function handleReport(mk){
    setRepLoading(true);
    try{
      const pk=prevMonthKey(mk);
      await generateStatsPdf(mk, grouped[mk]||[], grouped[pk]||[], entries, settings);
    }catch(e){Alert.alert('Report error',e.message);}    
    setRepLoading(false);
  }

  if(loading)return<View style={{flex:1,backgroundColor:C.background}}><AppHeader title="History"/><View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={C.accent} size="large"/></View></View>;
  return(
    <View style={{flex:1,backgroundColor:C.background}}>
      <AppHeader title="History" subtitle={`${entries.length} entries`}/>
      <ScrollView contentContainerStyle={{padding:SP.md,paddingBottom:ins.bottom+20}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={C.accent}/>}>
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
const PEOPLE=[{key:'siteSupervisor',label:'Site Supervisor',icon:'🦺'},{key:'projectManager',label:'Project Manager',icon:'📋'},{key:'qaRep',label:'QA Representative',icon:'🔍'}];
function SettingsScreen() {
  const {state, updateSettings} = useDiary();
  const {settings} = state;
  const ins = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [loc, setLoc] = useState(null);
  useEffect(()=>{if(settings&&!loc)setLoc(settings);},[settings]);
  function updL(path,val){const parts=path.split('.');setLoc(prev=>{const c={...prev};if(parts.length===2)c[parts[0]]={...c[parts[0]],[parts[1]]:val};else c[parts[0]]=val;return c;});}
  async function handleSave(){setSaving(true);await updateSettings(loc);setSaving(false);Alert.alert('✅ Settings saved');}
  if(!loc)return<View style={{flex:1,backgroundColor:C.background}}><AppHeader title="Settings"/><View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={C.accent}/></View></View>;
  return(
    <View style={{flex:1,backgroundColor:C.background}}>
      <AppHeader title="Settings" subtitle="Personnel & preferences"/>
      <ScrollView contentContainerStyle={{padding:SP.md,paddingBottom:ins.bottom+100}}>
        <SL>Company details</SL>
        <Card>{[['Company name','companyName','ABA Construction Managers'],['Address','companyAddress','55 Heffernan St, Mitchell ACT 2911'],['Phone','companyPhone','(02) 6242 3400']].map(([l,k,ph])=><View key={k} style={{marginBottom:SP.sm}}><Text style={s.fl}>{l}</Text><TextInput style={s.inp} value={loc[k]||''} onChangeText={v=>updL(k,v)} placeholder={ph}/></View>)}</Card>
        <SL>Sign-off personnel</SL>
        <View style={{backgroundColor:C.accentLight,borderRadius:R.md,padding:SP.md,marginBottom:SP.sm,borderWidth:0.5,borderColor:C.accent}}><Text style={{fontSize:13,color:C.accentDark,lineHeight:20}}>📧 When saved, PM & QA are notified by email. When all three sign off, the PDF is automatically emailed to everyone below.</Text></View>
        {PEOPLE.map(p=><Card key={p.key}>
          <View style={{flexDirection:'row',alignItems:'center',gap:SP.sm,marginBottom:SP.md}}><Text style={{fontSize:22}}>{p.icon}</Text><Text style={{fontSize:15,fontWeight:'600',color:C.textPrimary}}>{p.label}</Text></View>
          <Text style={s.fl}>Full name</Text><TextInput style={[s.inp,{marginBottom:SP.sm}]} value={loc[p.key]?.name||''} onChangeText={v=>updL(`${p.key}.name`,v)} placeholder={`${p.label} name`} autoCapitalize="words"/>
          <Text style={s.fl}>Email address</Text><TextInput style={s.inp} value={loc[p.key]?.email||''} onChangeText={v=>updL(`${p.key}.email`,v)} placeholder="email@company.com.au" keyboardType="email-address" autoCapitalize="none"/>
        </Card>)}
        <SL>Sign-off web page URL</SL>
        <Card>
          <Text style={{fontSize:13,color:C.textSecondary,lineHeight:20,marginBottom:SP.md}}>
            📋 PM & QA tap a link in their email to review and sign in a browser. Set your GitHub Pages URL below — see README for setup instructions.
          </Text>
          <Text style={s.fl}>GitHub Pages URL</Text>
          <TextInput style={[s.inp,{marginBottom:4}]} value={loc.pagesUrl||''} onChangeText={v=>updL('pagesUrl',v)} placeholder="https://username.github.io/aba-site-diary" autoCapitalize="none" keyboardType="url"/>
          <Text style={{fontSize:11,color:C.textHint}}>Replace "username" with your GitHub username</Text>
        </Card>
        <SL>WHS Statistics</SL>
        <Card>
          <Text style={s.fl}>Project start date (YYYY-MM-DD)</Text><TextInput style={[s.inp,{marginBottom:SP.sm}]} value={loc.projectStartDate||''} onChangeText={v=>updL('projectStartDate',v)} placeholder="2024-01-01"/>
          <Text style={s.fl}>Standard work hours per day</Text><TextInput style={s.inp} value={loc.standardHoursPerDay||''} onChangeText={v=>updL('standardHoursPerDay',v)} placeholder="8" keyboardType="numeric"/>
        </Card>
        <SL>Saved subcontractors</SL>
        <Card>
          {(loc.savedSubcontractors||[]).map((sub,i)=><View key={i} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:SP.sm,borderBottomWidth:0.5,borderBottomColor:C.border}}><Text style={{fontSize:14,color:C.textPrimary}}>🏗 {sub}</Text><TouchableOpacity onPress={()=>updL('savedSubcontractors',(loc.savedSubcontractors||[]).filter((_,x)=>x!==i))}><Text style={{fontSize:18,color:C.danger,padding:4}}>✕</Text></TouchableOpacity></View>)}
          <TouchableOpacity style={[s.addBtn,{marginTop:SP.sm}]} onPress={()=>Alert.prompt('Add subcontractor','Company name',n=>{if(n?.trim())updL('savedSubcontractors',[...(loc.savedSubcontractors||[]),n.trim()]);})}><Text style={s.addBtnT}>＋ Add subcontractor</Text></TouchableOpacity>
        </Card>
      </ScrollView>
      <View style={{backgroundColor:C.white,padding:SP.md,borderTopWidth:0.5,borderTopColor:C.border,paddingBottom:ins.bottom+8}}>
        <TouchableOpacity style={{backgroundColor:C.accent,borderRadius:R.md,padding:SP.md,alignItems:'center'}} onPress={handleSave} disabled={saving}>
          {saving?<ActivityIndicator color="#fff"/>:<Text style={{color:'#fff',fontSize:15,fontWeight:'600'}}>💾 Save settings</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SHARED COMPONENTS & STYLES ───────────────────────────────────────────────
function Card({children}){return <View style={s.card}><View style={s.cardBody}>{children}</View></View>;}function SL({children}){return <Text style={{fontSize:11,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.6,color:C.textSecondary,marginBottom:SP.sm,marginTop:SP.md}}>{children}</Text>;}const s = StyleSheet.create({
  card:{backgroundColor:C.white,borderRadius:R.lg,borderWidth:0.5,borderColor:C.border,marginBottom:SP.sm,...SH},
  cardHdr:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:SP.md},
  cardTitle:{fontSize:14,fontWeight:'600',color:C.textPrimary},
  cardBody:{padding:SP.md,paddingTop:0},
  row:{flexDirection:'row',alignItems:'flex-start'},
  fl:{fontSize:11,color:C.textSecondary,marginBottom:4},
  inp:{borderWidth:0.5,borderColor:C.border,borderRadius:R.md,padding:SP.sm,fontSize:13,color:C.textPrimary,backgroundColor:C.white},
  addBtn:{borderWidth:0.5,borderStyle:'dashed',borderColor:C.border,borderRadius:R.md,padding:SP.sm,alignItems:'center',marginTop:SP.sm},
  addBtnT:{fontSize:13,color:C.textSecondary},
  stag:{backgroundColor:C.background,borderWidth:0.5,borderColor:C.accent,borderRadius:R.full,paddingHorizontal:12,paddingVertical:5,marginRight:8},
  stagT:{fontSize:12,color:C.accentDark},
  subCard:{backgroundColor:C.background,borderRadius:R.md,padding:SP.md,marginBottom:SP.sm,borderWidth:0.5,borderColor:C.border},
  totBox:{flex:1,backgroundColor:C.accentLight,borderRadius:R.md,padding:SP.md,alignItems:'center',borderWidth:0.5,borderColor:C.accent},
  totNum:{fontSize:24,fontWeight:'700',color:C.accent},
  totLbl:{fontSize:11,color:C.accentDark,marginTop:2},
  thumb:{width:72,height:72,borderRadius:R.md,marginRight:8,position:'relative'},
  thumbImg:{width:72,height:72,borderRadius:R.md},
  thumbDel:{position:'absolute',top:3,right:3,backgroundColor:'rgba(0,0,0,0.6)',borderRadius:10,width:18,height:18,alignItems:'center',justifyContent:'center'},
  thumbAdd:{width:72,height:72,borderRadius:R.md,borderWidth:1,borderStyle:'dashed',borderColor:C.accent,alignItems:'center',justifyContent:'center'},
  saveBar:{backgroundColor:C.white,padding:SP.md,borderTopWidth:0.5,borderTopColor:C.border},
  saveBtn:{backgroundColor:C.primary,borderRadius:R.md,padding:SP.md,alignItems:'center'},
  saveBtnT:{color:'#fff',fontSize:15,fontWeight:'600'},
  pill:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.accentLight,borderRadius:R.full,paddingHorizontal:10,paddingVertical:4,marginRight:8,borderWidth:0.5,borderColor:C.accent},
  pillL:{fontSize:10,fontWeight:'700',color:C.accentDark},
  pillN:{fontSize:12,color:C.accentDark},
  weatherBtn:{flexDirection:'row',alignItems:'center',backgroundColor:C.accentLight,borderRadius:R.full,paddingHorizontal:12,paddingVertical:6,borderWidth:0.5,borderColor:C.accent},
  weatherBtnT:{fontSize:12,color:C.accentDark,fontWeight:'600'},
});
});

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();
function TabIcon({ name, focused }) {
  const icons = { Today:focused?'✏️':'📝', Checklist:focused?'☑️':'📋', 'Sign off':focused?'✍️':'📄', History:focused?'🗂️':'📁', Settings:focused?'⚙️':'🔧' };
  return <Text style={{ fontSize:20 }}>{icons[name]||'•'}</Text>;
}
}

export default function App() {
  return (
    <GestureHandlerRootView style={{flex:1}}>
      <SafeAreaProvider>
        <DiaryProvider>
          <NavigationContainer>
            <StatusBar style="light" backgroundColor={C.primary}/>
            <Tab.Navigator
              screenOptions={({route})=>({
                tabBarIcon:({focused})=><TabIcon name={route.name} focused={focused}/>,
                tabBarActiveTintColor:C.accent,
                tabBarInactiveTintColor:C.textSecondary,
                tabBarStyle:{backgroundColor:C.white,borderTopColor:C.border,borderTopWidth:0.5,height:60,paddingBottom:8},
                tabBarLabelStyle:{fontSize:11},
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
