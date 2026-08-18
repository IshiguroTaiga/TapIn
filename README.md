# TapIn: Geofence-Based Attendance Monitoring System with Real-Time Analytics

**TapIn** is a geofencing-based, real-time university attendance monitoring and analytics system featuring a standalone **GPS Spoofing-Detection Research Module** with dual swappable classification strategies, an automated evaluation harness, **Ed25519 Asymmetric Cryptographic Authentication**, and a **Multi-Checkpoint Task Verification System**.

---

## 🌟 Key System Features

### 1. Student Flow (Public Homepage `/`)
- **Ed25519 Signed Credential Authentication**: Replaces fragile device biometrics with mathematically verifiable asymmetric signatures. Students enroll once to receive a portable TapIn Pass (JSON file & signed QR code).
- **Ray-Casting Point-in-Polygon Geofencing**: Computes exact venue containment against irregular campus venue polygons via Jordan Curve parity ray testing.
- **Multi-Tier Haversine Pre-Filtering**: Fast $O(1)$ Haversine bounding sphere and AABB filtering optimize coordinate checks before ray-casting.
- **Auto-Action Detection**: Intelligently determines whether `TIME_IN` or `TIME_OUT` applies.
- **Grace Period Countdown**: Real-time 15-minute countdown for students who step outside the venue polygon perimeter.

### 2. Multi-Checkpoint Task Verification System
- **Nested Checkpoint Engine**: Admins can place up to 3 checkpoints ($15\text{m} - 30\text{m}$ radius) nested inside the main event polygon.
- **Anti-Collusion Task Distribution**: Assigns tasks from checkpoint pools while filtering tasks recently assigned to other students within a collision window (default 10 mins).
- **Admin Toggles**: "Allow Duplicate Tasks", "Randomize Tasks", and adjustable collision windows.
- **Photo Verification Analytics**:
  - *Pure-JS EXIF Extraction*: Extracts photo capture timestamp and GPS coordinates, cross-checking against checkpoint coordinates.
  - *Perceptual Hashing Duplicate Detection*: Computes 64-bit Difference Hash (`dHash`) and measures **Hamming Distance** against prior submissions to flag duplicate photo reuse ($\ge 92\%$ visual match).

### 3. Research Module: GPS Spoofing Detection (`server/services/spoofDetection/`)
- **Multi-Sensor Telemetry**: GPS coordinates `(lat, lng)`, accuracy `coords.accuracy`, timestamps, and accelerometer motion data (`DeviceMotionEvent`).
- **Detection Heuristics**:
  - *Implausible Speed*: Detects speeds $>15\text{ m/s}$ ($54\text{ km/h}$) or instantaneous teleports.
  - *Accuracy Anomaly*: Detects static accuracy repetition or unrealistically exact values ($\le 0.2\text{m}$).
  - *Timestamp Irregularity*: Flags out-of-order timestamps and synthetic cadences.
  - *Sensor Motion Mismatch*: Flags physical movement when physical accelerometer sensors detect zero linear acceleration.
  - *Stationary Anomaly Signal*: Flags coordinates showing near-zero displacement over an active 5+ minute window during an event.
- **Swappable Strategies**:
  - **Rule-Based Weighted Scoring Strategy**: Computes trust score ($0 - 100$) and triggers heuristic flags.
  - **Machine Learning Strategy**: Logistic Regression classifier derived from extracted feature vectors.
- **CLI Evaluation Harness (`server/scripts/evalSpoofDetector.js`)**: Computes confusion matrix and academic metrics (Accuracy, Precision, Recall, Specificity, FPR, F1 Score).

### 4. Real-Time Admin Dashboard & Polygon Geofence Manager
- **Socket.io Live Telemetry**: Live stream of student coordinates, checkpoint visits, and spoof anomalies.
- **Interactive Polygon & Checkpoint Editor**: Admin traces venue polygons with draggable numbered vertex handles and places nested checkpoint stations.
- **Multi-Window Scheduling**: Configurable multiple `TIME_IN` and `TIME_OUT` windows per event.

### 5. Historical Logs & Multi-Format Export
- Filter logs by Event, College, Course, Year Level, and Status (`Valid`, `Borderline`, `Rejected`).
- View Ed25519 signature audit status and export to **CSV**, **Excel (.xlsx)**, and **PDF Reports**.

---

## 🚀 Quick Start & CLI Test Suites

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Seed database with sample event, checkpoints, and task pools
npm run seed

# Run Test Suites
npm test               # Run 15-test Ray-Casting PIP Geofence suite
npm run test:features  # Run 10-test Cryptographic Auth & Checkpoint suite
npm run test:all       # Run all backend test suites

# Run Research Evaluation Harnesses
npm run generate-dataset  # Generate benchmark trace dataset
npm run eval:rule         # Run Rule-Based evaluation benchmark
npm run eval:ml           # Run ML Logistic Regression benchmark

# Start Backend Server & Vite Client
npm start                 # Server runs on http://localhost:5000
cd client && npm run dev  # Client runs on http://localhost:5173
```

---

## 📁 Repository Directory Structure

```
TapIn/
├── package.json                   # Root package & npm scripts
├── README.md                      # Project overview & quick start
├── documentation.md               # Technical changelog & algorithmic details
├── IMPORTANT.md                   # Defense handbook & technical knowledge base
├── server/
│   ├── index.js                   # Express + Socket.io server entry point
│   ├── db.js                      # SQLite database & table initialization
│   ├── seed.js                    # Database seed script
│   ├── middleware/
│   │   └── auth.js                # JWT & role verification middleware
│   ├── services/
│   │   ├── cryptoAuth.js          # Ed25519 cryptographic credential signing & verification
│   │   ├── geofence.js            # Ray-Casting PIP algorithm & Haversine pre-filter
│   │   ├── haversine.js           # Great-circle spherical distance calculations
│   │   ├── checkpointEngine.js    # Multi-checkpoint geofencing & containment checks
│   │   ├── taskDistribution.js   # Anti-collusion task assignment algorithm
│   │   ├── photoVerification.js   # Pure-JS EXIF parsing & perceptual hashing (dHash)
│   │   ├── penaltyEngine.js       # Post-event violation evaluation engine
│   │   └── spoofDetection/        # Research module core
│   │       ├── index.js           # Spoof detector facade
│   │       ├── heuristics.js      # Speed, accuracy, timestamp, motion, stationary checks
│   │       ├── ruleBasedStrategy.js # Weighted scoring strategy
│   │       └── mlStrategy.js      # Logistic regression strategy
│   ├── routes/
│   │   ├── auth.js                # Login & admin account management
│   │   ├── students.js            # Student lookup, key enrollment & CSV import
│   │   ├── events.js              # Event & polygon geofence CRUD
│   │   ├── attendance.js          # Student submission & PIP verification
│   │   ├── checkpoints.js         # Checkpoint management & task verification
│   │   ├── penalties.js           # Violation evaluation endpoints
│   │   └── spoof.js              # Research module lab endpoints
│   └── scripts/
│       ├── testGeofence.js        # Ray-Casting PIP 15-test unit suite
│       ├── testNewFeatures.js     # Crypto auth & checkpoint 10-test suite
│       ├── evalSpoofDetector.js   # Research evaluation harness CLI tool
│       └── generateSampleDataset.js # Labeled dataset generator
└── client/
    ├── public/
    │   ├── manifest.json          # PWA Manifest
    │   └── sw.js                  # Service Worker for offline shell & notifications
    └── src/
        ├── index.css              # Glassmorphism & dark theme styles
        ├── App.jsx                # Main application container
        ├── components/
        │   ├── GeofenceMapPicker.jsx # Interactive Polygon Drawing & Vertex Editor
        │   ├── LiveGeofenceMap.jsx   # Live campus map with polygon & checkpoint overlay
        │   └── Navbar.jsx            # Responsive navigation
        └── pages/
            ├── StudentHome.jsx    # Student landing, Ed25519 pass HUD & checkpoint missions
            ├── AdminLogin.jsx     # Admin authentication modal
            ├── AdminDashboard.jsx # Real-time Socket.io live dashboard
            ├── EventManagement.jsx# Event, Checkpoint, and Task Pool manager
            ├── AttendanceLogs.jsx # Historical logs & export center with signature audit
            ├── PenaltyEngineView.jsx# Penalty evaluation & config
            ├── SpoofResearchLab.jsx# Interactive research lab UI & stationary anomaly tuner
            └── SuperadminAdmins.jsx# Admin account management
```

---

## 📄 NOTE:
Designed as a research prototype for university event attendance, cryptographic credential verification, and location telemetry integrity.
Built by ur boi Ishi :3
