# ABA Site Diary — Android App

Mobile site diary app for ABA Construction Managers. Built with React Native + Expo.

---

## Features

### Daily Diary Entry
- Project details (name, number, date)
- AM/PM weather selection
- Work in progress (with pour/item numbers)
- Delays incurred
- Oral instructions
- Drawings & memos received
- Photo attachments (camera or gallery) per section
- Voice-to-text on every field (Australian English)

### Subcontractors on Site
- Per-subcontractor: name, personnel count, start/finish times
- Auto-calculates labour hours per sub (personnel × hours on site)
- Live totals bar: total personnel + total labour hours
- Quick-add tags for saved/recurring subcontractors

### Other Checklist
- All 8 items from the ABA form
- Tap to check/uncheck with notes per item

### Sign-off Workflow
- Three signature pads: Site Supervisor, Project Manager, QA Representative
- Assigned in Settings with name + email per role
- Once PM and QA sign: one-tap "Complete sign-off & email PDF"
- Auto-generates PDF and opens email with all three as recipients
- Entry locked as "Signed off" in history

### Monthly Statistics Report (Stats.xlsx equivalent)
- Tap "📊 Report" on any month in History
- Generates a PDF with all 15 statistics rows (A–O) matching your Stats.xlsx:
  - Auto-populated from diary data: A (project months), B (hours), C (FTE),
    G (LTIFR), I (severity rate), K (inspections), L (audits), M (sub inductions),
    N (toolbox talks), O (WHS training)
  - Manual fields flagged: D (LTI), E (hours lost), F (cost), H (TRIFR), J (WorkSafe incidents)
- Three columns: Current month / Previous month / Life to date
- Subcontractor labour hours breakdown table
- Daily entries summary for the month
- Shareable as PDF

### Offline First
- Works without network — all data stored locally on device
- Entries auto-sync when connectivity returns

---

## Building the APK

### Prerequisites
```
Node.js 18+
npm or yarn
Expo CLI + EAS CLI
Android Studio (for local builds) or an Expo account (for cloud builds)
```

### Step 1 — Install dependencies
```bash
cd SiteDiaryApp
npm install
```

### Step 2 — Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Step 3 — Configure your project
```bash
eas init   # creates a project in your Expo account and sets projectId in app.json
```

### Step 4 — Build APK (cloud build — recommended, no Android Studio needed)
```bash
eas build --platform android --profile preview
```
This builds in Expo's cloud. When done, you get a download link for the `.apk` file.
Send the `.apk` to any Android phone — install by opening it (enable "Install unknown apps" in Android settings first).

### Step 5 — Build for Google Play (AAB bundle)
```bash
eas build --platform android --profile production
```

### Local build (requires Android Studio)
```bash
npm run android
# or
npx expo run:android
```

---

## Project structure

```
SiteDiaryApp/
├── App.js                          # Navigation + providers
├── app.json                        # Expo config
├── eas.json                        # EAS Build profiles
├── src/
│   ├── context/
│   │   └── DiaryContext.js         # Global state (useReducer)
│   ├── screens/
│   │   ├── TodayScreen.js          # Main diary entry
│   │   ├── ChecklistScreen.js      # Other checklist (8 items)
│   │   ├── SignoffScreen.js        # Signatures + email PDF
│   │   ├── HistoryScreen.js        # Past entries + monthly report
│   │   ├── SettingsScreen.js       # Personnel assignment
│   │   └── EntryDetailScreen.js
│   ├── components/
│   │   └── AppHeader.js
│   └── utils/
│       ├── theme.js                # Colours, spacing, shadows
│       ├── storage.js              # AsyncStorage helpers
│       ├── pdfExport.js            # HTML → PDF + email
│       └── monthlyReport.js        # Monthly stats PDF (Stats.xlsx equivalent)
```

---

## Monthly statistics — how fields are calculated

| Row | Field | Source |
|-----|-------|--------|
| A | Length of Project (Months) | Settings → Project start date vs report month |
| B | Total tradespeople reported hours | Sum of all daily subcontractor labour hours |
| C | FTE | Total hours ÷ (std hours/day × working days) |
| D | LTI | **Enter manually** after any incident |
| E | Hours lost | **Enter manually** |
| F | Cost due to injury | **Enter manually** |
| G | LTIFR | LTI × 1,000,000 ÷ Total hours |
| H | TRIFR | **Enter manually** |
| I | Severity rate | Hours lost ÷ LTI count |
| J | WorkSafe incidents | **Enter manually** |
| K | Site inspections | Count of days with Checklist item 1 ticked |
| L | Certification audits | Count of days with Checklist item 2 ticked |
| M | Sub-contractor inductions | Count of unique subcontractors across month |
| N | Toolbox talks | Count of days with Checklist item 3 ticked |
| O | WHS training | Count of days with Checklist item 6 ticked |

Fields D, E, F, H, J are flagged "enter manually" in the report — they require specific WHS incident inputs that go beyond what a daily diary captures automatically. A future version can add a dedicated WHS Incident screen to populate these automatically.

---

## Email setup notes

The app uses the device's default email client (Expo MailComposer). On Android this opens Gmail/Outlook etc. with the PDF pre-attached and recipients pre-filled.

For automated background email (without the user needing to tap send), you would need a backend API (e.g. SendGrid, AWS SES). This can be added as a Phase 2 enhancement.

---

## Permissions used

- `CAMERA` — photo attachments
- `READ/WRITE_EXTERNAL_STORAGE` — save/share PDFs
- `RECORD_AUDIO` — voice-to-text
- `INTERNET` — future sync / email API
- `RECEIVE_BOOT_COMPLETED` — background notifications
- `VIBRATE` — notification feedback
