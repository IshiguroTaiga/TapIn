# TapIn — University Geofencing Attendance & GPS Spoofing Detection System

**TapIn** is a geofencing-based, real-time attendance system designed for university assemblies and events. It features a standalone **GPS Spoofing-Detection Module** as its core research contribution.

---

## 🌟 Key System Features

### 1. Student Flow (Public Homepage `/`)
- **Zero Login Required**: Students log in by entering their official Student ID (verified against a master database seeded via CSV).
- **No Selfie / Biometrics**: Attendance is verified strictly through location geofencing and multi-signal spoofing checks.
- **Auto-Action Detection**: Intelligently determines whether `TIME_IN` or `TIME_OUT` applies.
- **Grace Period Countdown**: Real-time 15-minute countdown for students who step outside the primary geofence perimeter. If the student re-enters before the timer expires, the countdown resets; if expired, the log is flagged as borderline / grace exceeded without locking out time-outs.

### 2. Research Module: GPS Spoofing-Detection (`server/services/spoofDetection/`)
Built as an independent, testable service that evaluates location reports before trusting them:
- **Captured Signals**: GPS Coords `(lat, lng)`, reported accuracy `coords.accuracy`, timestamp, and device accelerometer motion data `DeviceMotionEvent`.
- **Detection Heuristics**:
  - *Implausible Speed*: Calculates movement speed between consecutive reports ($>15\text{ m/s}$ or instantaneous teleports).
  - *Accuracy Anomaly*: Detects static accuracy values repeated across reports or unrealistically exact values ($\le 0.2\text{m}$).
  - *Timestamp Irregularity*: Identifies out-of-order timestamps and synthetic integer-second cadences.
  - *Sensor Motion Mismatch*: Flags physical displacement reported while physical accelerometer sensors detect zero linear acceleration.
- **Swappable Strategies**:
  - **Rule-Based Weighted Scoring Strategy**: Computes a trust score ($0 - 100$) and produces triggered flag badges.
  - **Machine Learning Strategy**: Logistic Regression classifier derived from feature extraction vectors.
- **CLI Evaluation Harness (`server/scripts/evalSpoofDetector.js`)**:
  - Ingests labeled CSV dataset traces (`is_spoofed: true/false`).
  - Computes confusion matrix ($TP, FP, TN, FN$) and outputs **Accuracy, Precision, Recall, Specificity, False Positive Rate (FPR), and F1 Score**.

### 3. Real-Time Admin Dashboard
- **Socket.io Live Telemetry**: Live stream of students currently in-range, in grace countdown, or flagged for spoof anomalies.
- **Event & Geofence Manager**: Set center lat/lng coordinates, radius slider ($50\text{m} - 500\text{m}$), grace period minutes, and target college/course/year filters.
- **Multi-Window Scheduling**: Configurable multiple `TIME_IN` and `TIME_OUT` windows per event.

### 4. Penalty & Violation Engine (`server/services/penaltyEngine.js`)
- Evaluates registered students post-event and generates machine-labeled violation reasons:
  - `"No time-out recorded"`
  - `"No time-in recorded"`
  - `"Did not complete full event duration"`
  - `"Exceeded allowed time outside event radius"`
  - `"GPS Spoofing / Location Anomaly Detected"`
- Configurable violation types DB table allows adding or renaming reasons without code changes.

### 5. Historical Logs & Multi-Format Export
- Filter logs by Event, College, Course, Year Level, and Status (`Valid`, `Borderline`, `Rejected`).
- One-click export to **CSV**, **Excel (.xlsx)**, and **PDF Reports**.

### 6. Installable PWA & Background Boundary Note
- Includes Web App Manifest (`manifest.json`) and Service Worker (`sw.js`) for PWA installation on mobile home screens.
- **Platform Limitation Disclosure**: Standard web browsers restrict active GPS tracking once a tab is fully closed by the OS. Installing TapIn as a PWA and granting location + push notification permissions optimizes background tracking within OS boundaries.

---

### Live Interactive Lab UI:
Log in as Admin or Superadmin and navigate to the **Spoof Research Lab** tab to test custom telemetry inputs and view harness outputs interactively in the web app.

---

## 📁 Repository Directory Structure

```
TapIn/
├── package.json                   # Root package & npm scripts
├── README.md                      # Project documentation
├── server/
│   ├── index.js                   # Express + Socket.io server entry point
│   ├── db.js                      # SQLite database & table initialization
│   ├── seed.js                    # Database seed script
│   ├── middleware/
│   │   └── auth.js                # JWT & role verification middleware
│   ├── services/
│   │   ├── haversine.js           # Geofence distance math
│   │   ├── penaltyEngine.js       # Post-event violation evaluation engine
│   │   └── spoofDetection/        # Research module core
│   │       ├── index.js           # Spoof detector facade
│   │       ├── heuristics.js      # Speed, accuracy, timestamp, motion checks
│   │       ├── ruleBasedStrategy.js # Weighted scoring strategy
│   │       └── mlStrategy.js      # Logistic regression strategy
│   ├── routes/
│   │   ├── auth.js                # Login & admin account management
│   │   ├── students.js            # Student lookup & CSV import
│   │   ├── events.js              # Event & geofence CRUD
│   │   ├── attendance.js          # Student submission & live status
│   │   ├── penalties.js           # Violation evaluation endpoints
│   │   └── spoof.js              # Research module lab endpoints
│   └── scripts/
│       ├── evalSpoofDetector.js   # Research evaluation harness CLI tool
│       └── generateSampleDataset.js # Labeled dataset generator
└── client/
    ├── public/
    │   ├── manifest.json          # PWA Manifest
    │   └── sw.js                  # Service Worker for offline shell & notifications
    └── src/
        ├── index.css              # Glassmorphism & dark theme styles
        ├── App.jsx                # Main application container
        ├── pages/
        │   ├── StudentHome.jsx    # Public student landing page
        │   ├── AdminLogin.jsx     # Admin authentication modal
        │   ├── AdminDashboard.jsx # Real-time Socket.io live dashboard
        │   ├── EventManagement.jsx# Geofence & event manager
        │   ├── AttendanceLogs.jsx # Historical logs & export center
        │   ├── PenaltyEngineView.jsx# Penalty evaluation & config
        │   ├── SpoofResearchLab.jsx# Interactive research lab UI
        │   └── SuperadminAdmins.jsx# Admin account management
```

---

## 📄 NOTE:
Designed as a research prototype for university event attendance & location telemetry integrity verification.
Generated btw so dont expect this to not have a % of AI content aint no one not lazy enough to read and write all these in short period of time
