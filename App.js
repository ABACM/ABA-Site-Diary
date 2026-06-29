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

// ─── STORAGE ──────────────────────────────────────────────────────────────────
async function getEntries() {
  try { const r = await AsyncStorage.getItem('aba_entries_v2'); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
async function saveEntry(entry) {
  try {
    const entries = await getEntries();
    const idx = entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) entries[idx] = entry; else entries.unshift(entry);
    await AsyncStorage.setItem('aba_entries_v2', JSON.stringify(entries));
    return true;
  } catch { return false; }
}
async function getSettings() {
  try {
    const r = await AsyncStorage.getItem('aba_settings_v2');
    return r ? JSON.parse(r) : {
      companyName: 'ABA Construction Managers (Aust) Pty Ltd',
      companyAddress: 'Suite 7 Level One, 55 Heffernan St, Mitchell ACT 2911',
      companyPhone: '(02) 6242 3400',
      projectManager:  { name:'', email:'' },
      qaRep:           { name:'', email:'' },
      siteSupervisor:  { name:'', email:'' },
      savedSubcontractors: ['Clarke Civil','Mitchell Electrical','ACT Plumbing','Apex Formwork','Total Concreting'],
      standardHoursPerDay: '8',
      projectStartDate: '',
      pagesUrl: 'https://YOUR-GITHUB-USERNAME.github.io/aba-site-diary',
    };
  } catch { return {}; }
}
async function persistSettings(s) {
  try { await AsyncStorage.setItem('aba_settings_v2', JSON.stringify(s)); } catch {}
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcSubHours(sub) {
  try {
    const t = s => { const [h,m]=(s||'07:00').split(':').map(Number); return h*60+m; };
    return Math.max(0,(t(sub.timeEnd||'15:30')-t(sub.timeStart||'07:00'))/60);
  } catch { return 0; }
}
function calcTotals(subs=[]) {
  let p=0,h=0;
  (subs||[]).forEach(s=>{ const n=parseInt(s.personnel)||0; p+=n; h+=n*calcSubHours(s); });
  return { totalPersonnel:p, totalHours:h };
}
function fmtDate(d) { try { return format(new Date(d+'T12:00:00'),'EEEE, d MMMM yyyy'); } catch { return d||'—'; } }
function fmtDateShort(d) { try { return format(new Date(d+'T12:00:00'),'EEE d MMM'); } catch { return d||'—'; } }
function fmtMonth(k) { try { return format(new Date(k+'-01T12:00:00'),'MMMM yyyy'); } catch { return k; } }
function prevMonthKey(k) { const[y,m]=k.split('-').map(Number); return m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,'0')}`; }

// ─── WEATHER API ──────────────────────────────────────────────────────────────
const WMO_MAP = {
  0:'Clear ☀️', 1:'Mostly Clear ⛅', 2:'Partly Cloudy ⛅', 3:'Overcast ☁️',
  45:'Foggy 🌫', 48:'Foggy 🌫', 51:'Light Drizzle 🌦', 53:'Drizzle 🌦',
  55:'Heavy Drizzle 🌦', 61:'Light Rain 🌧', 63:'Rain 🌧', 65:'Heavy Rain 🌧',
  71:'Light Snow 🌨', 73:'Snow 🌨', 75:'Heavy Snow 🌨',
  80:'Rain Showers 🌦', 81:'Showers 🌦', 82:'Heavy Showers 🌦',
  95:'Thunderstorm ⛈', 96:'Thunderstorm ⛈', 99:'Thunderstorm ⛈',
};
async function fetchWeather() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&hourly=weathercode,temperature_2m&timezone=auto&forecast_days=1`;
    const res = await fetch(url);
    const data = await res.json();
    const now = new Date();
    const hour = now.getHours();
    const amCode = data.hourly.weathercode[Math.max(0,hour-2)] ?? data.hourly.weathercode[0];
    const pmCode = data.hourly.weathercode[Math.min(23,hour+4)] ?? data.hourly.weathercode[12];
    const amTemp = Math.round(data.hourly.temperature_2m[Math.max(0,hour-2)]);
    const pmTemp = Math.round(data.hourly.temperature_2m[Math.min(23,hour+4)]);
    return {
      am: `${WMO_MAP[amCode]||'—'} ${amTemp}°C`,
      pm: `${WMO_MAP[pmCode]||'—'} ${pmTemp}°C`,
    };
  } catch { return null; }
}

// ─── PDF GENERATION ───────────────────────────────────────────────────────────
function buildDiaryHtml(entry, settings={}) {
  const { totalPersonnel, totalHours } = calcTotals(entry.subs);
  const CL = ['1. Inspections and Tests','2. Visitors and Purposes','3. Discussions and Meetings',
    '4. Shortage of Information','5. Delays, Defects – Client supplies',
    '6. Planning information required','7. Equipment on hire','8. Messages'];
  const SLBLS = {work:'Work in progress',delays:'Delays incurred',oral:'Oral instructions',drawings:'Drawings & memos received'};
  const secRows = Object.entries(SLBLS).map(([k,l])=>{
    const lines=(entry.sections?.[k]||[]).filter(Boolean);
    const photos=(entry.sectionPhotos?.[k]||[]);
    if(!lines.length&&!photos.length) return '';
    return `<tr><td class="ic">${l}</td><td>${lines.map(x=>`<div class="el">${x}</div>`).join('')}${photos.map(p=>`<img src="${p}" style="max-width:120px;max-height:90px;border-radius:4px;margin:3px">`).join('')}</td></tr>`;
  }).join('');
  const subRows=(entry.subs||[]).map(s=>{
    const p=parseInt(s.personnel)||0,h=calcSubHours(s);
    return `<tr><td>${s.name||'—'}</td><td style="text-align:center">${p}</td><td style="text-align:center">${s.timeStart||'—'}–${s.timeEnd||'—'}</td><td style="text-align:right;font-weight:600;color:#4CAF50">${(p*h).toFixed(1)} hrs</td></tr>${s.notes?`<tr><td colspan="4" style="font-size:11px;color:#6B7280;padding:2px 8px 6px">${s.notes}</td></tr>`:''}`;
  }).join('');
  const clRows=CL.map((l,i)=>{const cl=entry.checklist?.[i]||{};return `<tr><td style="width:20px">${cl.checked?'☑':'☐'}</td><td>${l}</td><td style="color:#6B7280;font-size:11px">${cl.note||''}</td></tr>`;}).join('');
  const sig=(label,name)=>`<div style="flex:1;min-width:130px"><div style="font-size:10px;color:#6B7280;text-transform:uppercase;margin-bottom:2px">${label}</div><div style="font-size:12px;font-weight:600;margin-bottom:4px">${name||''}</div><div style="width:100%;height:48px;border-bottom:2px solid #0D1B3E"></div></div>`;
  const badge=entry.signoffStatus==='complete'?`<span style="background:#4CAF50;color:#fff;padding:3px 10px;border-radius:20px;font-size:11px">✅ Signed off</span>`:`<span style="background:#6B7280;color:#fff;padding:3px 10px;border-radius:20px;font-size:11px">Pending</span>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#0D1B3E;padding:20px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4CAF50;padding-bottom:10px;margin-bottom:14px}
.co{font-size:15px;font-weight:bold;color:#0D1B3E}.cos{font-size:9px;color:#6B7280;margin-top:1px}
.ttl{font-size:20px;font-weight:bold;text-align:right;color:#0D1B3E}
.meta{display:flex;gap:12px;margin-bottom:12px;padding:10px;background:#F0F4F0;border-radius:8px;flex-wrap:wrap}
.mi label{display:block;font-size:9px;text-transform:uppercase;color:#9CA3AF;margin-bottom:1px}
h3{font-size:11px;font-weight:bold;text-transform:uppercase;color:#0D1B3E;margin:14px 0 6px;border-bottom:2px solid #4CAF50;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
th{background:#0D1B3E;color:#fff;padding:6px 10px;text-align:left;font-size:10px}
td{padding:6px 10px;border-bottom:.5px solid #D0D9D0;font-size:11px;vertical-align:top}
.ic{width:35%;background:#F8FAF8;font-size:11px;color:#4A5568}.el{padding:2px 0;border-bottom:.5px solid #E8F5E9}.el:last-child{border:none}
.totbox{display:flex;gap:12px;margin-bottom:10px}
.tb{flex:1;background:#E8F5E9;border-radius:8px;padding:10px;text-align:center}
.tb .n{font-size:22px;font-weight:bold;color:#4CAF50}.tb .l{font-size:10px;color:#2E7D32}
.sigs{display:flex;gap:14px;margin-top:20px}
.ftr{margin-top:16px;border-top:1px solid #D0D9D0;padding-top:6px;font-size:9px;color:#9CA3AF;display:flex;justify-content:space-between}
</style></head><body>
<div class="hdr"><div><div class="co">${settings.companyName||'ABA Construction Managers (Aust) Pty Ltd'}</div><div class="cos">${settings.companyAddress||''}</div><div class="cos">Tel: ${settings.companyPhone||''} | ACN: 155 990 597 | ABN: 29 155 990 597</div></div><div style="text-align:right"><div class="ttl">Site Diary</div><div style="margin-top:4px">${badge}</div></div></div>
<div class="meta"><div class="mi"><label>Date</label><strong>${fmtDate(entry.date)}</strong></div><div class="mi"><label>Project</label><strong>${entry.projectName||'—'}</strong></div><div class="mi"><label>No.</label><strong>${entry.projectNo||'—'}</strong></div><div class="mi"><label>Weather AM</label><strong>${entry.weatherAM||'—'}</strong></div><div class="mi"><label>Weather PM</label><strong>${entry.weatherPM||'—'}</strong></div></div>
${secRows?`<h3>Daily entries</h3><table><tbody>${secRows}</tbody></table>`:''}
${(entry.subs||[]).length?`<h3>Subcontractors on site</h3><div class="totbox"><div class="tb"><div class="n">${totalPersonnel}</div><div class="l">Total personnel</div></div><div class="tb"><div class="n">${totalHours.toFixed(1)}</div><div class="l">Labour hours</div></div></div><table><thead><tr><th>Subcontractor</th><th>Personnel</th><th>On site</th><th>Labour hrs</th></tr></thead><tbody>${subRows}</tbody></table>`:''}
<h3>Other checklist</h3><table><tbody>${clRows}</tbody></table>
${entry.addlNotes?`<h3>Additional notes</h3><div style="padding:8px;background:#F0F4F0;border-radius:6px">${entry.addlNotes}</div>`:''}
<h3>Authorisations</h3><div class="sigs">${sig('Site Supervisor',settings.siteSupervisor?.name)}${sig('Project Manager',settings.projectManager?.name)}${sig('QA Representative',settings.qaRep?.name)}</div>
<div class="ftr"><span>ABA Site Diary | Ref: aba-220 Rev.2</span><span>Generated ${format(new Date(),'d MMM yyyy, HH:mm')}</span></div>
</body></html>`;
}

function buildStatsHtml(monthKey, monthEntries, prevEntries, allEntries, settings={}) {
  function stats(entries) {
    const totalHours=entries.reduce((s,e)=>s+(e.totalHours||0),0);
    const fte=entries.length>0?totalHours/(parseFloat(settings?.standardHoursPerDay||8)*entries.length):0;
    let pm=null;
    if(settings?.projectStartDate){try{const st=new Date(settings.projectStartDate+'T12:00:00');const tm=new Date(monthKey+'-01T12:00:00');pm=(tm.getFullYear()-st.getFullYear())*12+(tm.getMonth()-st.getMonth())+1;}catch{}}
    return {
      pm, totalHours:Math.round(totalHours*10)/10, fte:Math.round(fte*100)/100,
      ltifr:0, severityRate:0,
      siteInspections:entries.filter(e=>e.checklist?.[0]?.checked).length,
      certAudits:entries.filter(e=>e.checklist?.[1]?.checked).length,
      subInductions:new Set(entries.flatMap(e=>(e.subs||[]).map(s=>s.name).filter(Boolean))).size,
      toolboxTalks:entries.filter(e=>e.checklist?.[2]?.checked).length,
      whsTraining:entries.filter(e=>e.checklist?.[5]?.checked).length,
      totalPersonnel:entries.reduce((s,e)=>s+(e.totalPersonnel||0),0),
    };
  }
  const c=stats(monthEntries), p=stats(prevEntries), l=stats(allEntries);
  const ml=fmtMonth(monthKey), pl=fmtMonth(prevMonthKey(monthKey));
  const fv=(v,cur=false)=>v===null?'—':cur?`$${Number(v).toLocaleString('en-AU',{minimumFractionDigits:2})}`:String(v);
  const ROWS=[
    {l:'A',label:'Length of Project (Months)',c:fv(c.pm),p:fv(p.pm),lt:fv(l.pm),auto:true},
    {l:'B',label:'Total tradespeople Reported Hours',c:fv(c.totalHours),p:fv(p.totalHours),lt:fv(l.totalHours),auto:true},
    {l:'C',label:'FTE (Full Time Equivalent)',c:fv(c.fte),p:fv(p.fte),lt:fv(l.fte),auto:true},
    {l:'D',label:'LTI (Number of Lost Time Injuries)',c:'0',p:'0',lt:'0',auto:false},
    {l:'E',label:'HL (Number Hours Lost)',c:'0',p:'0',lt:'0',auto:false},
    {l:'F',label:'Cost Due to Injury',c:fv(0,true),p:fv(0,true),lt:fv(0,true),auto:false},
    {l:'G',label:"LTIFR (LTI's per 1,000,000 hrs)",c:fv(c.ltifr),p:fv(p.ltifr),lt:fv(l.ltifr),auto:true},
    {l:'H',label:'Total Recordable Injury Frequency Rate (TRIFR)',c:'0',p:'0',lt:'0',auto:false},
    {l:'I',label:'Severity Rate (Days lost per LTI)',c:'0',p:'0',lt:'0',auto:true},
    {l:'J',label:'Incidents reported to WorkSafe ACT',c:'0',p:'0',lt:'0',auto:false},
    {l:'K',label:'Site Inspections (Builder WHS activity)',c:fv(c.siteInspections),p:fv(p.siteInspections),lt:fv(l.siteInspections),auto:true},
    {l:'L',label:'Active Certification Audits',c:fv(c.certAudits),p:fv(p.certAudits),lt:fv(l.certAudits),auto:true},
    {l:'M',label:'Sub-contractor Site Inductions',c:fv(c.subInductions),p:fv(p.subInductions),lt:fv(l.subInductions),auto:true},
    {l:'N',label:'Number of Toolbox talks',c:fv(c.toolboxTalks),p:fv(p.toolboxTalks),lt:fv(l.toolboxTalks),auto:true},
    {l:'O',label:'WHS Training/Education',c:fv(c.whsTraining),p:fv(p.whsTraining),lt:fv(l.whsTraining),auto:true},
  ];
  const subMap={};
  monthEntries.forEach(e=>(e.subs||[]).forEach(s=>{if(!s.name)return;if(!subMap[s.name])subMap[s.name]={hours:0,maxP:0,days:0};const pp=parseInt(s.personnel)||0;subMap[s.name].hours+=pp*calcSubHours(s);subMap[s.name].maxP=Math.max(subMap[s.name].maxP,pp);subMap[s.name].days+=1;}));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#0D1B3E;padding:20px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4CAF50;padding-bottom:10px;margin-bottom:14px}
.co{font-size:14px;font-weight:bold;color:#0D1B3E}.cos{font-size:9px;color:#6B7280;margin-top:1px}
.ttl{font-size:18px;font-weight:bold;text-align:right}
.meta{display:flex;gap:12px;margin-bottom:12px;padding:10px;background:#F0F4F0;border-radius:8px;font-size:11px;flex-wrap:wrap}
.mi strong{display:block;font-size:9px;text-transform:uppercase;color:#9CA3AF;margin-bottom:1px}
h3{font-size:11px;font-weight:bold;text-transform:uppercase;color:#0D1B3E;margin:14px 0 6px;border-bottom:2px solid #4CAF50;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
th{background:#0D1B3E;color:#fff;padding:6px 10px;text-align:left;font-size:10px}th.r{text-align:right}
td{padding:6px 10px;border-bottom:.5px solid #D0D9D0;font-size:11px;vertical-align:top}
.lt{width:20px;color:#4CAF50;font-weight:700}.nr{text-align:right;font-weight:500}
tr:nth-child(even) td{background:#F8FAF8}
.ab{font-size:9px;background:#E8F5E9;color:#2E7D32;padding:1px 6px;border-radius:10px;margin-left:4px}
.mb{font-size:9px;background:#FEF3D8;color:#A06010;padding:1px 6px;border-radius:10px;margin-left:4px}
.ftr{margin-top:14px;border-top:1px solid #D0D9D0;padding-top:6px;font-size:9px;color:#9CA3AF;display:flex;justify-content:space-between}
</style></head><body>
<div class="hdr"><div><div class="co">${settings.companyName||'ABA Construction Managers (Aust) Pty Ltd'}</div><div class="cos">${settings.companyAddress||''}</div><div class="cos">Tel: ${settings.companyPhone||''} | ACN: 155 990 597 | ABN: 29 155 990 597</div></div><div><div class="ttl">Monthly WHS Statistics</div><div style="font-size:11px;color:#6B7280;text-align:right;margin-top:2px">Ref: aba-220 | ${ml}</div></div></div>
<div class="meta"><div class="mi"><strong>Report period</strong>${ml}</div><div class="mi"><strong>Diary entries</strong>${monthEntries.length} days</div><div class="mi"><strong>Total hours</strong>${c.totalHours} hrs</div><div class="mi"><strong>Total personnel-days</strong>${c.totalPersonnel}</div><div class="mi"><strong>Generated</strong>${format(new Date(),'d MMM yyyy, HH:mm')}</div></div>
<h3>WHS & Project Statistics — Stats.xlsx (A–O)</h3>
<table><thead><tr><th style="width:20px"></th><th>Item</th><th class="r" style="width:110px">Current<br><small style="font-weight:400">${ml}</small></th><th class="r" style="width:110px">Previous<br><small style="font-weight:400">${pl}</small></th><th class="r" style="width:90px">Life to date</th></tr></thead><tbody>
${ROWS.map(r=>`<tr><td class="lt">${r.l}.</td><td>${r.label}<span class="${r.auto?'ab':'mb'}">${r.auto?'auto':'manual'}</span></td><td class="nr">${r.c}</td><td class="nr">${r.p}</td><td class="nr">${r.lt}</td></tr>`).join('')}
</tbody></table>
<p style="font-size:9px;color:#9CA3AF;margin-bottom:10px"><strong>Auto</strong> = calculated from diary data. <strong>Manual</strong> = update D, E, F, H, J after incidents occur. LTIFR = LTI × 1,000,000 ÷ Total hours.</p>
${Object.keys(subMap).length?`<h3>Subcontractor Labour Hours — ${ml}</h3><table><thead><tr><th>Subcontractor</th><th class="r">Days on site</th><th class="r">Max personnel</th><th class="r">Total hours</th></tr></thead><tbody>${Object.entries(subMap).map(([n,d])=>`<tr><td>${n}</td><td class="nr">${d.days}</td><td class="nr">${d.maxP}</td><td class="nr">${d.hours.toFixed(1)} hrs</td></tr>`).join('')}<tr style="font-weight:700;background:#E8F5E9"><td>TOTAL</td><td class="nr">—</td><td class="nr">—</td><td class="nr">${Object.values(subMap).reduce((a,d)=>a+d.hours,0).toFixed(1)} hrs</td></tr></tbody></table>`:''}
<h3>Daily entries summary — ${ml}</h3>
<table><thead><tr><th>Date</th><th>Project</th><th>Weather AM/PM</th><th class="r">Personnel</th><th class="r">Labour hrs</th><th>Status</th></tr></thead><tbody>
${monthEntries.map(e=>`<tr><td>${fmtDateShort(e.date)}</td><td>${e.projectName||'—'}</td><td>${e.weatherAM||'—'} / ${e.weatherPM||'—'}</td><td class="nr">${e.totalPersonnel||0}</td><td class="nr">${(e.totalHours||0).toFixed(1)}</td><td>${e.signoffStatus==='complete'?'✅ Signed':e.signoffStatus==='pending'?'⏳ Pending':'📝 Draft'}</td></tr>`).join('')}
</tbody></table>
<div class="ftr"><span>ABA Construction Managers | Monthly WHS Statistics | ${ml}</span><span>Generated ${format(new Date(),'d MMM yyyy, HH:mm')}</span></div>
</body></html>`;
}

async function generateAndEmailPdf(entry, settings) {
  const html = buildDiaryHtml(entry, settings);
  const { uri } = await Print.printToFileAsync({ html, base64:false });
  let dateStr = entry.date;
  try { dateStr = format(new Date(entry.date+'T12:00:00'),'d MMM yyyy'); } catch {}
  const recipients = [
    settings?.projectManager?.email,
    settings?.qaRep?.email,
    settings?.siteSupervisor?.email,
  ].filter(Boolean);
  const ok = await MailComposer.isAvailableAsync();
  if (!ok) {
    await Sharing.shareAsync(uri, { mimeType:'application/pdf', dialogTitle:`Site Diary – ${dateStr}` });
    return;
  }
  await MailComposer.composeAsync({
    recipients,
    subject: `Site Diary – ${entry.projectName||'Project'} – ${dateStr} [SIGNED OFF]`,
    body: `All parties have signed off on the site diary for ${entry.projectName||'the project'} dated ${dateStr}.\n\nPlease find the completed diary attached.\n\nKind regards,\n${settings.siteSupervisor?.name||'Site Supervisor'}\nABA Construction Managers`,
    attachments: [uri],
  });
}

async function generateStatsPdf(monthKey, monthEntries, prevEntries, allEntries, settings) {
  const html = buildStatsHtml(monthKey, monthEntries, prevEntries, allEntries, settings);
  const { uri } = await Print.printToFileAsync({ html, base64:false });
  await Sharing.shareAsync(uri, { mimeType:'application/pdf', dialogTitle:`WHS Statistics – ${fmtMonth(monthKey)}` });
}

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

// ─── APP HEADER ───────────────────────────────────────────────────────────────
function AppHeader({ title, subtitle, rightAction }) {
  const ins = useSafeAreaInsets();
  return (
    <View style={[hs.wrap, {paddingTop:ins.top+8}]}>
      <View style={hs.logo}><Text style={hs.logoT}>ABA</Text></View>
      <View style={{flex:1}}>
        <Text style={hs.title}>{title}</Text>
        {subtitle?<Text style={hs.sub}>{subtitle}</Text>:null}
      </View>
      {rightAction
        ? <TouchableOpacity onPress={rightAction.onPress} style={hs.rBtn}><Text style={hs.rBtnT}>{rightAction.label}</Text></TouchableOpacity>
        : <View style={{width:60}}/>}
    </View>
  );
}
const hs = StyleSheet.create({
  wrap:{ backgroundColor:C.primary, paddingHorizontal:SP.lg, paddingBottom:SP.md, flexDirection:'row', alignItems:'center', gap:SP.sm },
  logo:{ width:38, height:38, backgroundColor:'rgba(76,175,80,0.3)', borderRadius:8, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.accent },
  logoT:{ color:C.accent, fontSize:11, fontWeight:'700' },
  title:{ color:'#fff', fontSize:16, fontWeight:'600' },
  sub:{ color:'rgba(255,255,255,0.75)', fontSize:11, marginTop:1 },
  rBtn:{ backgroundColor:'rgba(76,175,80,0.3)', paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:C.accent },
  rBtnT:{ color:C.accent, fontSize:12, fontWeight:'600' },
});

// ─── VOICE-TO-TEXT WEBVIEW ────────────────────────────────────────────────────
const VTT_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:transparent;font-family:sans-serif}button{background:#4CAF50;color:#fff;border:none;border-radius:50%;width:72px;height:72px;font-size:28px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3)}button.listening{background:#DC2626;animation:pulse 1s infinite}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}</style></head><body>
<button id="btn" onclick="toggle()">🎤</button>
<script>
var recog=null,listening=false;
function toggle(){
  if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:'Not supported'}));return;}
  if(listening){recog&&recog.stop();return;}
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recog=new SR();recog.lang='en-AU';recog.continuous=false;recog.interimResults=false;
  recog.onstart=function(){listening=true;document.getElementById('btn').className='listening';document.getElementById('btn').textContent='⏹';};
  recog.onresult=function(e){var t=e.results[0][0].transcript;window.ReactNativeWebView.postMessage(JSON.stringify({type:'result',text:t}));};
  recog.onend=function(){listening=false;document.getElementById('btn').className='';document.getElementById('btn').textContent='🎤';};
  recog.onerror=function(e){listening=false;document.getElementById('btn').className='';document.getElementById('btn').textContent='🎤';window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:e.error}));};
  recog.start();
}
</script></body></html>`;

function VoiceButton({ onResult }) {
  const [show, setShow] = useState(false);
  if (!show) return (
    <TouchableOpacity style={vb.btn} onPress={()=>setShow(true)}>
      <Text style={{fontSize:16}}>🎤</Text>
    </TouchableOpacity>
  );
  return (
    <View style={vb.overlay}>
      <View style={vb.modal}>
        <Text style={vb.title}>Listening… speak now</Text>
        <View style={{height:120}}>
          <WebView
            originWhitelist={['*']}
            source={{html:VTT_HTML}}
            style={{flex:1,backgroundColor:'transparent'}}
            scrollEnabled={false}
            onMessage={e=>{
              try {
                const d = JSON.parse(e.nativeEvent.data);
                if(d.type==='result'){onResult(d.text);setShow(false);}
                else{Alert.alert('Voice error',d.msg||'Try again');setShow(false);}
              } catch { setShow(false); }
            }}
          />
        </View>
        <TouchableOpacity style={vb.cancel} onPress={()=>setShow(false)}>
          <Text style={{color:C.textSecondary,fontSize:13}}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const vb = StyleSheet.create({
  btn:{ width:32, height:32, borderRadius:16, backgroundColor:C.accentLight, borderWidth:0.5, borderColor:C.accent, alignItems:'center', justifyContent:'center', marginLeft:6 },
  overlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.5)', zIndex:200, alignItems:'center', justifyContent:'center' },
  modal:{ backgroundColor:'#fff', borderRadius:16, padding:SP.xl, width:280, alignItems:'center', ...SH },
  title:{ fontSize:15, fontWeight:'600', color:C.textPrimary, marginBottom:SP.lg },
  cancel:{ marginTop:SP.md, paddingVertical:8, paddingHorizontal:20 },
});

// ─── TODAY SCREEN ─────────────────────────────────────────────────────────────
const SECTIONS = [
  {id:'work',     label:'Work in progress',          placeholder:'Pour No. / Item No. / Activity...'},
  {id:'delays',   label:'Delays incurred',           placeholder:'Industrial, weather, access...'},
  {id:'oral',     label:'Oral instructions',         placeholder:'Instructions received or given...'},
  {id:'drawings', label:'Drawings & memos received', placeholder:'Document reference...'},
];
const CL_ITEMS = ['Inspections and Tests','Visitors and Purposes','Discussions and Meetings','Shortage of Information','Delays, Defects – Client supplies','Planning information required','Equipment on hire','Messages'];

function TodayScreen() {
  const {state, dispatch} = useDiary();
  const {entry, settings} = state;
  const ins = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [exp, setExp] = useState({work:true,subs:true,delays:false,oral:false,drawings:false});
  const upd = useCallback(u=>dispatch({type:'UPDATE_ENTRY',payload:u}),[dispatch]);
  const tog = id => setExp(p=>({...p,[id]:!p[id]}));

  async function handleFetchWeather() {
    setFetchingWeather(true);
    try {
      const w = await fetchWeather();
      if (w) { upd({weatherAM:w.am, weatherPM:w.pm}); }
      else { Alert.alert('Weather','Could not get location. Please allow location access or enter weather manually.'); }
    } catch(e) { Alert.alert('Weather error', e.message); }
    setFetchingWeather(false);
  }

  function updLine(sid,i,v){const a=[...(entry.sections[sid]||[''])];a[i]=v;dispatch({type:'UPDATE_SECTION',key:sid,value:a});}
  function addLine(sid){dispatch({type:'UPDATE_SECTION',key:sid,value:[...(entry.sections[sid]||['']),'']}); }
  function remLine(sid,i){let a=(entry.sections[sid]||['']).filter((_,x)=>x!==i);if(!a.length)a=[''];dispatch({type:'UPDATE_SECTION',key:sid,value:a});}
  function addSub(name=''){dispatch({type:'UPDATE_SUBS',payload:[...entry.subs,{name,personnel:'',timeStart:'07:00',timeEnd:'15:30',notes:''}]});}
  function updSub(i,u){dispatch({type:'UPDATE_SUBS',payload:entry.subs.map((s,x)=>x===i?{...s,...u}:s)});}
  function remSub(i){dispatch({type:'UPDATE_SUBS',payload:entry.subs.filter((_,x)=>x!==i)});}

  async function addPhoto(sid) {
    Alert.alert('Add photo','Source',[
      {text:'Camera',onPress:async()=>{
        const {status}=await ImagePicker.requestCameraPermissionsAsync();
        if(status!=='granted'){Alert.alert('Permission needed','Camera access required.');return;}
        const r=await ImagePicker.launchCameraAsync({quality:0.6,base64:true});
        if(!r.canceled){const ph=[...(entry.sectionPhotos[sid]||[]),`data:image/jpeg;base64,${r.assets[0].base64}`];dispatch({type:'UPDATE_PHOTOS',sid,photos:ph});}
      }},
      {text:'Gallery',onPress:async()=>{
        const r=await ImagePicker.launchImageLibraryAsync({quality:0.6,base64:true});
        if(!r.canceled){const ph=[...(entry.sectionPhotos[sid]||[]),`data:image/jpeg;base64,${r.assets[0].base64}`];dispatch({type:'UPDATE_PHOTOS',sid,photos:ph});}
      }},
      {text:'Cancel',style:'cancel'},
    ]);
  }

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
            <TouchableOpacity style={s.addBtn} onPress={()=>addSub()}><Text style={s.addBtnT}>＋ Add subcontractor</Text></TouchableOpacity>
          </View>}
        </View>

      </ScrollView>
      <View style={[s.saveBar,{paddingBottom:ins.bottom+8}]}>
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
        {months.length===0&&<View style={{alignItems:'center',paddingVertical:60}}><Text style={{fontSize:48,marginBottom:SP.md}}>📋</Text><Text style={{fontSize:16,fontWeight:'600',color:C.textPrimary}}>No entries yet</Text><Text style={{fontSize:13,color:C.textSecondary,marginTop:6}}>Save your first entry in the Today tab</Text></View>}
        {months.map(mk=>{
          const mes=grouped[mk];
          const totH=mes.reduce((a,e)=>a+(e.totalHours||0),0);
          const signed=mes.filter(e=>e.signoffStatus==='complete').length;
          return <View key={mk} style={{marginBottom:SP.lg}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:SP.sm}}>
              <View><Text style={{fontSize:16,fontWeight:'700',color:C.textPrimary}}>{fmtMonth(mk)}</Text><Text style={{fontSize:12,color:C.textSecondary,marginTop:2}}>{mes.length} entries · {totH.toFixed(1)} hrs · {signed}/{mes.length} signed</Text></View>
              <TouchableOpacity style={{backgroundColor:C.accentLight,borderWidth:1,borderColor:C.accent,borderRadius:R.full,paddingHorizontal:14,paddingVertical:7,minWidth:44,alignItems:'center'}} onPress={()=>handleReport(mk)} disabled={repLoading}>
                {repLoading?<ActivityIndicator size="small" color={C.accent}/>:<Text style={{fontSize:13,color:C.accentDark,fontWeight:'600'}}>📊 WHS Report</Text>}
              </TouchableOpacity>
            </View>
            {mes.map(e=>(
              <TouchableOpacity key={e.id} style={{backgroundColor:C.white,borderRadius:R.lg,borderWidth:0.5,borderColor:e.signoffStatus==='complete'?C.accent:C.border,padding:SP.md,marginBottom:SP.sm,...SH}} onPress={()=>{dispatch({type:'LOAD_ENTRY',payload:e});navigation.navigate('Today');}} activeOpacity={0.7}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <Text style={{fontSize:14,fontWeight:'600',color:C.textPrimary}}>{fmtDateShort(e.date)}</Text>
                  <Text style={{fontSize:12,fontWeight:'500',color:stColor(e.signoffStatus)}}>{stLabel(e.signoffStatus)}</Text>
                </View>
                <Text style={{fontSize:12,color:C.textSecondary,marginBottom:SP.sm}}>{e.projectName||'Unnamed'}{e.projectNo?` · ${e.projectNo}`:''}</Text>
                <View style={{flexDirection:'row',gap:SP.sm,flexWrap:'wrap'}}>
                  {[['👷',e.totalPersonnel||0,'pax'],['⏱',`${(e.totalHours||0).toFixed(1)}`,'hrs'],['🌤',e.weatherAM||'—','AM']].map(([ic,v,l])=>(
                    <View key={l} style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:C.background,borderRadius:R.full,paddingHorizontal:10,paddingVertical:4}}>
                      <Text style={{fontSize:12}}>{ic}</Text><Text style={{fontSize:12,fontWeight:'600',color:C.textPrimary}}>{v}</Text><Text style={{fontSize:11,color:C.textSecondary}}>{l}</Text>
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
function Card({children}){return <View style={s.card}><View style={s.cardBody}>{children}</View></View>;}
function SL({children}){return <Text style={{fontSize:11,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.6,color:C.textSecondary,marginBottom:SP.sm,marginTop:SP.md}}>{children}</Text>;}
const s = StyleSheet.create({
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

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();
function TabIcon({name,focused}){
  const icons={Today:focused?'✏️':'📝',Checklist:focused?'☑️':'📋','Sign off':focused?'✍️':'📄',History:focused?'🗂️':'📁',Settings:focused?'⚙️':'🔧'};
  return <Text style={{fontSize:20}}>{icons[name]||'•'}</Text>;
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
