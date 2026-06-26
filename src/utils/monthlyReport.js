import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';

function calcSubHours(sub) {
  const toMins = (t) => { const [h, m] = (t || '07:00').split(':').map(Number); return h * 60 + m; };
  return Math.max(0, (toMins(sub.timeEnd || '15:30') - toMins(sub.timeStart || '07:00')) / 60);
}

function getPrevKey(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function fmtMonth(key) {
  try { return format(new Date(key + '-01T12:00:00'), 'MMMM yyyy'); } catch { return key; }
}

function calcStats(entries, settings, monthKey) {
  const totalHours = entries.reduce((s, e) => s + (e.totalHours || 0), 0);
  const stdHrs = parseFloat(settings?.standardHoursPerDay || 8);
  const workingDays = entries.length;
  const fte = workingDays > 0 ? totalHours / (stdHrs * workingDays) : 0;

  let projectMonths = null;
  if (settings?.projectStartDate) {
    try {
      const start = new Date(settings.projectStartDate + 'T12:00:00');
      const thisMonth = new Date(monthKey + '-01T12:00:00');
      projectMonths = (thisMonth.getFullYear() - start.getFullYear()) * 12 + (thisMonth.getMonth() - start.getMonth()) + 1;
    } catch { /* ignore */ }
  }

  const lti = 0;
  const hoursLost = 0;
  const costInjury = 0;
  const ltifr = totalHours > 0 ? ((lti / totalHours) * 1000000) : 0;
  const trifr = 0;
  const severityRate = lti > 0 ? hoursLost / lti : 0;
  const workSafeIncidents = 0;

  const siteInspections = entries.filter((e) => e.checklist?.[0]?.checked).length;
  const certAudits      = entries.filter((e) => e.checklist?.[1]?.checked).length;
  const allSubNames = new Set();
  entries.forEach((e) => (e.subs || []).forEach((s) => s.name && allSubNames.add(s.name)));
  const subInductions = allSubNames.size;
  const toolboxTalks  = entries.filter((e) => e.checklist?.[2]?.checked).length;
  const whsTraining   = entries.filter((e) => e.checklist?.[5]?.checked).length;

  return { projectMonths, totalHours: Math.round(totalHours * 10) / 10, fte: Math.round(fte * 100) / 100,
    lti, hoursLost, costInjury, ltifr: Math.round(ltifr * 100) / 100, trifr, severityRate: Math.round(severityRate * 100) / 100,
    workSafeIncidents, siteInspections, certAudits, subInductions, toolboxTalks, whsTraining };
}

function fv(v, cur = false) {
  if (v === null || v === undefined) return '—';
  if (cur) return `$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
  return String(v);
}

export async function generateMonthlyReport({ monthKey, monthEntries, prevEntries, allEntries, settings }) {
  const curr = calcStats(monthEntries, settings, monthKey);
  const prev = calcStats(prevEntries,  settings, getPrevKey(monthKey));
  const ltd  = calcStats(allEntries,   settings, monthKey);

  const monthLabel = fmtMonth(monthKey);
  const prevLabel  = fmtMonth(getPrevKey(monthKey));

  const ROWS = [
    { l: 'A', label: 'Length of Project (Months)',                       curr: fv(curr.projectMonths),     prev: fv(prev.projectMonths),     ltd: fv(ltd.projectMonths),     auto: true  },
    { l: 'B', label: 'Total tradespeople Reported Hours',                curr: fv(curr.totalHours),         prev: fv(prev.totalHours),         ltd: fv(ltd.totalHours),         auto: true  },
    { l: 'C', label: 'FTE (Full Time Equivalent)',                       curr: fv(curr.fte),                prev: fv(prev.fte),                ltd: fv(ltd.fte),                auto: true  },
    { l: 'D', label: 'LTI (Number of Lost Time Injuries)',               curr: fv(curr.lti),                prev: fv(prev.lti),                ltd: fv(ltd.lti),                auto: false },
    { l: 'E', label: 'HL (Number Hours Lost)',                           curr: fv(curr.hoursLost),          prev: fv(prev.hoursLost),          ltd: fv(ltd.hoursLost),          auto: false },
    { l: 'F', label: 'Cost Due to Injury',                               curr: fv(curr.costInjury, true),   prev: fv(prev.costInjury, true),   ltd: fv(ltd.costInjury, true),   auto: false },
    { l: 'G', label: "LTIFR (LTI's per 1,000,000 hrs)",                 curr: fv(curr.ltifr),              prev: fv(prev.ltifr),              ltd: fv(ltd.ltifr),              auto: true  },
    { l: 'H', label: 'Total Recordable Injury Frequency Rate (TRIFR)',   curr: fv(curr.trifr),              prev: fv(prev.trifr),              ltd: fv(ltd.trifr),              auto: false },
    { l: 'I', label: 'Severity Rate (Days lost per LTI)',                curr: fv(curr.severityRate),       prev: fv(prev.severityRate),       ltd: fv(ltd.severityRate),       auto: true  },
    { l: 'J', label: 'Incidents reported to WorkSafe ACT',               curr: fv(curr.workSafeIncidents),  prev: fv(prev.workSafeIncidents),  ltd: fv(ltd.workSafeIncidents),  auto: false },
    { l: 'K', label: 'Site Inspections (Builder WHS activity)',          curr: fv(curr.siteInspections),    prev: fv(prev.siteInspections),    ltd: fv(ltd.siteInspections),    auto: true  },
    { l: 'L', label: 'Active Certification Audits',                      curr: fv(curr.certAudits),         prev: fv(prev.certAudits),         ltd: fv(ltd.certAudits),         auto: true  },
    { l: 'M', label: 'Sub-contractor Site Inductions',                   curr: fv(curr.subInductions),      prev: fv(prev.subInductions),      ltd: fv(ltd.subInductions),      auto: true  },
    { l: 'N', label: 'Number of Toolbox talks',                          curr: fv(curr.toolboxTalks),       prev: fv(prev.toolboxTalks),       ltd: fv(ltd.toolboxTalks),       auto: true  },
    { l: 'O', label: 'WHS Training/Education',                           curr: fv(curr.whsTraining),        prev: fv(prev.whsTraining),        ltd: fv(ltd.whsTraining),        auto: true  },
  ];

  /* sub breakdown */
  const subMap = {};
  monthEntries.forEach((e) => {
    (e.subs || []).forEach((s) => {
      if (!s.name) return;
      if (!subMap[s.name]) subMap[s.name] = { hours: 0, maxPersonnel: 0, days: 0 };
      const p = parseInt(s.personnel) || 0;
      subMap[s.name].hours += p * calcSubHours(s);
      subMap[s.name].maxPersonnel = Math.max(subMap[s.name].maxPersonnel, p);
      subMap[s.name].days += 1;
    });
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#1C2026;padding:20px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #EA6C1A;padding-bottom:10px;margin-bottom:14px}
.co{font-size:14px;font-weight:bold;color:#EA6C1A}.co-sub{font-size:9px;color:#6B7280;margin-top:1px}
.ttl{font-size:18px;font-weight:bold;text-align:right}.tsub{font-size:11px;color:#6B7280;text-align:right;margin-top:2px}
.meta{display:flex;gap:14px;margin-bottom:12px;padding:10px;background:#F5F4F2;border-radius:8px;font-size:11px;flex-wrap:wrap}
.mi strong{display:block;font-size:9px;text-transform:uppercase;color:#9CA3AF;margin-bottom:1px}
h3{font-size:11px;font-weight:bold;text-transform:uppercase;color:#EA6C1A;margin:14px 0 6px;border-bottom:1px solid #E0DDD8;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
th{background:#EA6C1A;color:#fff;padding:6px 10px;text-align:left;font-size:10px}
th.r{text-align:right}td{padding:6px 10px;border-bottom:.5px solid #E0DDD8;font-size:11px;vertical-align:top}
.lt{width:20px;color:#EA6C1A;font-weight:700}.nr{text-align:right;font-weight:500}
tr:nth-child(even) td{background:#FAFAFA}
.ab{font-size:9px;background:#EAF4E3;color:#3A7D1F;padding:1px 6px;border-radius:10px;margin-left:4px}
.mb{font-size:9px;background:#FEF3D8;color:#A06010;padding:1px 6px;border-radius:10px;margin-left:4px}
.ftr{margin-top:14px;border-top:1px solid #E0DDD8;padding-top:6px;font-size:9px;color:#9CA3AF;display:flex;justify-content:space-between}
</style></head><body>

<div class="hdr">
  <div>
    <div class="co">${settings?.companyName || 'ABA Construction Managers (Aust) Pty Ltd'}</div>
    <div class="co-sub">${settings?.companyAddress || '55 Heffernan St, Mitchell ACT 2911'}</div>
    <div class="co-sub">Tel: ${settings?.companyPhone || '(02) 6242 3400'} | ACN: 155 990 597 | ABN: 29 155 990 597</div>
  </div>
  <div>
    <div class="ttl">Monthly Statistics Report</div>
    <div class="tsub">Ref: aba-220 | ${monthLabel}</div>
  </div>
</div>

<div class="meta">
  <div class="mi"><strong>Report period</strong>${monthLabel}</div>
  <div class="mi"><strong>Diary entries</strong>${monthEntries.length} days</div>
  <div class="mi"><strong>Total hours</strong>${curr.totalHours} hrs</div>
  <div class="mi"><strong>Personnel days</strong>${monthEntries.reduce((a, e) => a + (e.totalPersonnel || 0), 0)}</div>
  <div class="mi"><strong>Generated</strong>${format(new Date(), 'd MMM yyyy, HH:mm')}</div>
</div>

<h3>WHS & Project Statistics</h3>
<table>
  <thead><tr>
    <th style="width:20px"></th>
    <th>Item</th>
    <th class="r" style="width:110px">Current month<br><small style="font-weight:400">${monthLabel}</small></th>
    <th class="r" style="width:110px">Previous month<br><small style="font-weight:400">${prevLabel}</small></th>
    <th class="r" style="width:90px">Life to date</th>
  </tr></thead>
  <tbody>
    ${ROWS.map((r) => `<tr>
      <td class="lt">${r.l}.</td>
      <td>${r.label}<span class="${r.auto ? 'ab' : 'mb'}">${r.auto ? 'auto' : 'manual'}</span></td>
      <td class="nr">${r.curr}</td><td class="nr">${r.prev}</td><td class="nr">${r.ltd}</td>
    </tr>`).join('')}
  </tbody>
</table>
<p style="font-size:9px;color:#9CA3AF;margin-bottom:10px"><strong>Auto</strong> = populated from diary data. <strong>Manual</strong> = update fields D, E, F, H, J after any incidents. LTIFR = LTI × 1,000,000 ÷ Total hours.</p>

${Object.keys(subMap).length ? `
<h3>Subcontractor Labour Hours — ${monthLabel}</h3>
<table>
  <thead><tr><th>Subcontractor</th><th class="r">Days on site</th><th class="r">Max personnel</th><th class="r">Total labour hours</th></tr></thead>
  <tbody>
    ${Object.entries(subMap).map(([n, d]) => `<tr><td>${n}</td><td class="nr">${d.days}</td><td class="nr">${d.maxPersonnel}</td><td class="nr">${d.hours.toFixed(1)} hrs</td></tr>`).join('')}
    <tr style="font-weight:700;background:#FEF0E6">
      <td>TOTAL</td><td class="nr">—</td><td class="nr">—</td>
      <td class="nr">${Object.values(subMap).reduce((a, d) => a + d.hours, 0).toFixed(1)} hrs</td>
    </tr>
  </tbody>
</table>` : ''}

<h3>Daily entries — ${monthLabel}</h3>
<table>
  <thead><tr><th>Date</th><th>Project</th><th>Weather AM/PM</th><th class="r">Personnel</th><th class="r">Labour hrs</th><th>Status</th></tr></thead>
  <tbody>
    ${monthEntries.map((e) => {
      let d = '—';
      try { d = format(new Date(e.date + 'T12:00:00'), 'EEE d MMM'); } catch {}
      return `<tr>
        <td>${d}</td><td>${e.projectName || '—'}</td>
        <td>${e.weatherAM || '—'} / ${e.weatherPM || '—'}</td>
        <td class="nr">${e.totalPersonnel || 0}</td><td class="nr">${(e.totalHours || 0).toFixed(1)}</td>
        <td>${e.signoffStatus === 'complete' ? '✅ Signed' : e.signoffStatus === 'pending' ? '⏳ Pending' : '📝 Draft'}</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>

<div class="ftr">
  <span>ABA Construction Managers | Monthly Statistics | ${monthLabel}</span>
  <span>Generated ${format(new Date(), 'd MMM yyyy, HH:mm')}</span>
</div>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Monthly Statistics – ${monthLabel}`, UTI: 'com.adobe.pdf' });
  return uri;
}
