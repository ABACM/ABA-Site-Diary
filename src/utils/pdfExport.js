import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { format } from 'date-fns';

export function calcSubHours(sub) {
  const toMins = (t) => { const [h, m] = (t || '07:00').split(':').map(Number); return h * 60 + m; };
  return Math.max(0, (toMins(sub.timeEnd || '15:30') - toMins(sub.timeStart || '07:00')) / 60);
}

export function calcTotals(subs = []) {
  let personnel = 0, hours = 0;
  (subs || []).forEach((s) => {
    const p = parseInt(s.personnel) || 0;
    personnel += p;
    hours += p * calcSubHours(s);
  });
  return { totalPersonnel: personnel, totalHours: hours };
}

export function buildHtml(entry, settings = {}) {
  const { totalPersonnel, totalHours } = calcTotals(entry.subs);
  const dateStr = entry.date
    ? format(new Date(entry.date + 'T12:00:00'), 'EEEE, d MMMM yyyy')
    : '—';

  const CL = [
    '1. Inspections and Tests',
    '2. Visitors and Purposes',
    '3. Discussions and Meetings',
    '4. Shortage of Information',
    '5. Delays, Defects – Client supplies',
    '6. Planning information required',
    '7. Equipment on hire',
    '8. Messages',
  ];
  const SEC_LABELS = { work: 'Work in progress', delays: 'Delays incurred', oral: 'Oral instructions', drawings: 'Drawings & memos received' };

  const sectionRows = Object.entries(SEC_LABELS).map(([key, label]) => {
    const lines = (entry.sections?.[key] || []).filter(Boolean);
    if (!lines.length) return '';
    return `<tr><td class="ic">${label}</td><td>${lines.map((l) => `<div class="el">${l}</div>`).join('')}</td></tr>`;
  }).join('');

  const subsRows = (entry.subs || []).map((s) => {
    const p = parseInt(s.personnel) || 0;
    const hrs = calcSubHours(s);
    return `<tr>
      <td>${s.name || '—'}</td><td style="text-align:center">${p}</td>
      <td style="text-align:center">${s.timeStart || '—'} – ${s.timeEnd || '—'}</td>
      <td style="text-align:center">${hrs.toFixed(1)}</td>
      <td style="text-align:right;font-weight:600;color:#EA6C1A">${(p * hrs).toFixed(1)} hrs</td>
    </tr>${s.notes ? `<tr><td colspan="5" style="font-size:11px;color:#6B7280;padding:2px 8px 8px">${s.notes}</td></tr>` : ''}`;
  }).join('');

  const clRows = CL.map((label, i) => {
    const cl = entry.checklist?.[i] || {};
    return `<tr><td style="width:20px">${cl.checked ? '☑' : '☐'}</td><td>${label}</td><td style="color:#6B7280;font-size:11px">${cl.note || ''}</td></tr>`;
  }).join('');

  const sig = (label, data, name) => `
    <div style="flex:1;min-width:140px">
      <div style="font-size:10px;color:#6B7280;text-transform:uppercase;margin-bottom:2px">${label}</div>
      <div style="font-size:12px;font-weight:600;margin-bottom:6px">${name || ''}</div>
      <div style="width:100%;height:50px;border-bottom:1px solid #ccc">${data ? `<img src="${data}" style="height:50px;object-fit:contain">` : ''}</div>
    </div>`;

  const statusBadge = entry.signoffStatus === 'complete'
    ? `<span style="background:#16A34A;color:#fff;padding:3px 10px;border-radius:20px;font-size:11px">✅ Signed off</span>`
    : `<span style="background:#6B7280;color:#fff;padding:3px 10px;border-radius:20px;font-size:11px">Pending sign-off</span>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;color:#1C2026;padding:20px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #EA6C1A;padding-bottom:10px;margin-bottom:14px}
.co{font-size:15px;font-weight:bold;color:#EA6C1A}.co-sub{font-size:9px;color:#6B7280;margin-top:1px}
.ttl{font-size:20px;font-weight:bold;text-align:right}
.meta{display:flex;gap:14px;margin-bottom:12px;padding:10px;background:#F5F4F2;border-radius:8px}
.mi label{display:block;font-size:9px;text-transform:uppercase;color:#9CA3AF;margin-bottom:1px}
h3{font-size:11px;font-weight:bold;text-transform:uppercase;color:#EA6C1A;margin:14px 0 6px;border-bottom:1px solid #E0DDD8;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
th{background:#EA6C1A;color:#fff;padding:6px 10px;text-align:left;font-size:10px}
td{padding:6px 10px;border-bottom:.5px solid #E0DDD8;font-size:11px;vertical-align:top}
.ic{width:35%;background:#FAFAFA;font-size:11px;color:#4B5563}
.el{padding:2px 0;border-bottom:.5px solid #F0EDEA}.el:last-child{border:none}
.totbox{display:flex;gap:12px;margin-bottom:10px}
.tb{flex:1;background:#FEF0E6;border-radius:8px;padding:10px 12px;text-align:center}
.tb .n{font-size:22px;font-weight:bold;color:#EA6C1A}.tb .l{font-size:10px;color:#B34E0E}
.sigs{display:flex;gap:16px;margin-top:20px}
.ftr{margin-top:16px;border-top:1px solid #E0DDD8;padding-top:6px;font-size:9px;color:#9CA3AF;display:flex;justify-content:space-between}
</style></head><body>

<div class="hdr">
  <div>
    <div class="co">${settings.companyName || 'ABA Construction Managers (Aust) Pty Ltd'}</div>
    <div class="co-sub">${settings.companyAddress || '55 Heffernan St, Mitchell ACT 2911'}</div>
    <div class="co-sub">Tel: ${settings.companyPhone || '(02) 6242 3400'} | ACN: 155 990 597 | ABN: 29 155 990 597</div>
  </div>
  <div style="text-align:right">
    <div class="ttl">Site Diary</div>
    <div style="margin-top:4px">${statusBadge}</div>
  </div>
</div>

<div class="meta">
  <div class="mi"><label>Date</label><strong>${dateStr}</strong></div>
  <div class="mi"><label>Project</label><strong>${entry.projectName || '—'}</strong></div>
  <div class="mi"><label>Project No.</label><strong>${entry.projectNo || '—'}</strong></div>
  <div class="mi"><label>Weather AM</label><strong>${entry.weatherAM || '—'}</strong></div>
  <div class="mi"><label>Weather PM</label><strong>${entry.weatherPM || '—'}</strong></div>
</div>

${sectionRows ? `<h3>Daily entries</h3><table><tbody>${sectionRows}</tbody></table>` : ''}

${(entry.subs || []).length ? `
<h3>Subcontractors on site</h3>
<div class="totbox">
  <div class="tb"><div class="n">${totalPersonnel}</div><div class="l">Total personnel</div></div>
  <div class="tb"><div class="n">${totalHours.toFixed(1)}</div><div class="l">Labour hours</div></div>
</div>
<table><thead><tr><th>Subcontractor</th><th>Personnel</th><th>On site</th><th>Hrs/person</th><th>Labour hrs</th></tr></thead>
<tbody>${subsRows}</tbody></table>` : ''}

<h3>Other checklist</h3>
<table><tbody>${clRows}</tbody></table>

${entry.addlNotes ? `<h3>Additional notes</h3><div style="padding:8px;background:#F5F4F2;border-radius:6px">${entry.addlNotes}</div>` : ''}

<h3>Authorisations</h3>
<div class="sigs">
  ${sig('Site Supervisor',   entry.signatures?.[0], settings.siteSupervisor?.name)}
  ${sig('Project Manager',   entry.signatures?.[1], settings.projectManager?.name)}
  ${sig('QA Representative', entry.signatures?.[2], settings.qaRep?.name)}
</div>

<div class="ftr">
  <span>ABA Site Diary | Ref: aba-220 Rev.1</span>
  <span>Generated ${format(new Date(), 'd MMM yyyy, HH:mm')}</span>
</div>
</body></html>`;
}

export async function generatePdf(entry, settings) {
  const html = buildHtml(entry, settings);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function sharePdf(entry, settings) {
  const uri = await generatePdf(entry, settings);
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Site Diary – ${entry.date}`, UTI: 'com.adobe.pdf' });
  return uri;
}

export async function emailPdf(entry, settings, recipients = []) {
  const uri = await generatePdf(entry, settings);
  const dateStr = entry.date ? format(new Date(entry.date + 'T12:00:00'), 'd MMM yyyy') : entry.date;
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) throw new Error('No email client configured on this device.');
  await MailComposer.composeAsync({
    recipients,
    subject: `Site Diary – ${entry.projectName || 'Project'} – ${dateStr}`,
    body: `Please find attached the signed-off site diary for ${entry.projectName || 'the project'} dated ${dateStr}.\n\nThis diary has been signed off by all required parties.\n\nKind regards,\n${settings.siteSupervisor?.name || 'Site Supervisor'}\nABA Construction Managers`,
    attachments: [uri],
  });
  return uri;
}
