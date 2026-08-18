# TapIn: Geofence-Based Attendance Monitoring System with Real-Time Analytics

**TapIn** is a geofencing-based, real-time university attendance monitoring and analytics system featuring a standalone **GPS Spoofing-Detection Research Module** with dual swappable classification strategies, **WebAuthn Primary Platform Biometrics**, **Email One-Time-Passcode (OTP) Fallback**, exact **Ray-Casting Point-in-Polygon (PIP)** venue containment, and a **Multi-Checkpoint Task Verification System**.

---

## 🌟 Key System Features

### 1. Student Flow (Public Homepage `/`)
- **WebAuthn Platform Biometrics (Primary)**: W3C standard platform authenticator gating (`navigator.credentials.create()` and `navigator.credentials.get()`) utilizing Touch ID, Face ID, Windows Hello, and Android Biometrics with server-side FIDO2 verification.
- **Email One-Time-Passcode (OTP) Fallback**: Secondary authentication path pulling the student's non-editable official university email on file with 5-minute single-use expiry, request rate limiting (max 3 per 10 mins), and brute-force protection (max 5 attempts).
- **Portable Ed25519 Signed Passes**: Backwards-compatible asymmetric digital signature tokens and QR passes for kiosk presentation.
- **Ray-Casting Point-in-Polygon Geofencing**: Computes exact venue containment against irregular campus venue polygons via Jordan Curve parity ray testing.
- **Multi-Tier Haversine Pre-Filtering**: Fast $O(1)$ Haversine bounding sphere and AABB filtering optimize coordinate checks before ray-casting.
- **Auto-Action Detection**: Intelligently determines whether `TIME_IN` or `TIME_OUT` applies.
- **Grace Period Countdown**: Real-time 15-minute countdown for students who step outside the venue polygon perimeter.

### 2. Multi-Checkpoint Task Verification System
- **Interactive Click-to-Place Checkpoint Canvas**: Admins click anywhere inside the venue polygon on the map to drop station pins (`C1`, `C2`, `C3`, up to 3 max), drag them live to reposition, and click nodes to configure their task pools.
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
  - *Stationary Anomaly Signal*: Flags coordinates showing near-zero displacement over an active 5+ minute window during an ongoing event.
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
- View WebAuthn / OTP auth verification status and export to **CSV**, **Excel (.xlsx)**, and **PDF Reports**.

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
npm run test:features  # Run 13-test WebAuthn, OTP & Checkpoint suite
npm run test:all       # Run all 28 automated backend test suites

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
│   │   ├── webauthnService.js     # WebAuthn FIDO2 platform biometrics (Face ID/Touch ID)
│   │   ├── otpService.js          # Email OTP fallback with rate limiting & hashing
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
│   │       ├── mlStrategy.js      # Logistic regression strategy
│   │       └── featureExtractor.js # Multi-sensor feature pipeline
│   ├── routes/
│   │   ├── auth.js                # Admin auth, WebAuthn & Email OTP endpoints
│   │   ├── students.js            # Student roster, public keys & CSV/XLSX import
│   │   ├── events.js              # Event CRUD, polygon persistence & windows
│   │   ├── checkpoints.js         # Checkpoint placement, tasks & photo uploads
│   │   ├── attendance.js          # Time in/out submission & telemetry audit
│   │   ├── penalties.js           # Violation recording & penalty evaluation
│   │   └── spoof.js               # Spoof detection evaluation & configuration
│   └── scripts/
│       ├── testGeofence.js        # Automated PIP test suite (15 tests)
│       ├── testNewFeatures.js     # Automated WebAuthn, OTP & Checkpoint suite (13 tests)
│       ├── generateSampleDataset.js # Benchmark trace generator
│       └── evalSpoofDetector.js   # Research evaluation harness
└── client/
    ├── package.json               # Client dependencies
    ├── vite.config.js             # Vite configuration
    └── src/
        ├── App.jsx                # Router & navigation layout
        ├── components/
        │   ├── LiveGeofenceMap.jsx     # Leaflet live telemetry map
        │   ├── GeofenceMapPicker.jsx   # Interactive polygon perimeter editor
        │   ├── CheckpointMapPicker.jsx # Interactive click-to-place checkpoint canvas
        │   └── Navbar.jsx              # Navigation header & PWA status
        └── pages/
            ├── StudentHome.jsx         # Student telemetry, WebAuthn & check-in HUD
            ├── AdminDashboard.jsx      # Admin live attendance monitor
            ├── EventManagement.jsx     # Event polygon & checkpoint manager
            ├── AttendanceLogs.jsx      # Historical audit logs & multi-format export
            ├── SpoofResearchLab.jsx    # Research lab & threshold configurator
            ├── StudentList.jsx         # Master student roster & credential enrollment
            └── SystemConfig.jsx        # Penalty matrix & university settings
```
