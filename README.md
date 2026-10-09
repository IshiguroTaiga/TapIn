# TapIn: Point-in-Polygon Geofence-Based Attendance Monitoring System with Real-Time Analytics

**Mariano Marcos State University (MMSU)**  
**College of Computing and Information Sciences**  
*In partial fulfillment of the requirements of the course CMPSC 200: Thesis Writing*

### 👥 Researchers (BSCS 4A):
- **Bagasani, Nythan Jan**
- **Bonifacio, Jonas Nathaniel**
- **Permison, Micko Gabriel**
- **Udani, Bryan Leo H.**

*Partner / Institutional Stakeholder:* **University Student Council (USC), Mariano Marcos State University**

---

## 📖 Executive Summary & Thesis Context

Attendance monitoring is a foundational administrative requirement during mandatory university events at higher education institutions such as Mariano Marcos State University (MMSU). Existing check-in mechanisms rely on queue-based physical registers, barcode scanner stations, or manual student ID encoding upon entry. As documented in the literature (Eweoya et al. [3], Perin [10], Fabro & Anuncio [8]), these traditional methods suffer from severe physical queue bottlenecks, buddy-punching (proxy attendance), and the **single-instance timestamp flaw**—where an entry scan fails to prove continuous physical presence throughout the event duration.

**TapIn** provides an automated, browser-based **Progressive Web Application (PWA)** that eliminates single-entry queues and enforces verifiable physical presence through:
1. **Jordan Curve Ray-Casting Point-in-Polygon (PIP) Geofencing**: Computes exact containment against irregular campus perimeters (Premitasari [4], Hormann & Agathos [12]).
2. **Operational Dwell-Time State Machine**: Tracks cumulative in-venue residency ($D = T_{in} / T_e \ge 0.90$, Babatunde et al. [2], Huang et al. [20]) with automated grace-period resets.
3. **Multi-Checkpoint Task Verification**: Requires physical navigation to nested stations ($10\text{m} - 50\text{m}$ catchments) with anti-collusion task assignment, pure-JS EXIF validation, and 64-bit perceptual difference hashing (`dHash` with Hamming distance $\le 5$, Zauner [26], Swaminathan et al. [27]).
4. **Multi-Sensor GPS Anti-Spoofing Engine**: Evaluates 5 sensor-fusion heuristics (speed, accuracy, timing, accelerometer DeviceMotion, and stationary signals, Wong & Yiu [15], Sarker et al. [17]) comparing a transparent **Rule-Based Weighted Scoring Strategy (Strategy A)** against a learned **Logistic Regression Classifier (Strategy B)** (Hosmer et al. [36]).
5. **Hardware-Bound Platform Authentication**: W3C WebAuthn platform biometrics (Touch ID / Face ID / Windows Hello, Fett et al. [24]) with institutional Email One-Time-Passcode (OTP) fallback and portable Ed25519 digital signature passes (Bernstein et al. [25]).
6. **Real-Time WebSocket Telemetry**: Live administrative oversight streaming coordinate breadcrumbs, grace countdowns, and anomaly alerts via bidirectional Socket.io transport (Anne et al. [28]).

---

## 🎯 Objectives of the Study & Methodological Alignment

The study follows a 4-phase Input-Process-Output methodology mapped to its specific objectives:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Problem Identification (Obj 1)                                                │
│ - Survey of manual bottlenecks & buddy-punching (N >= 200 MMSU students & organizers) │
│ - Queueing Theory & Bottleneck Analysis (Little's Law: L = λW)                         │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │ Ranked Problems & Workflow Baselines
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Procedural Model Formulation (Obj 2)                                          │
│ - Dwell-Time State Machine (Not Timed In, Present, Grace, Violation)                   │
│ - Automated Grace-Period Reset on Polygon Re-entry (Default G = 15 mins)               │
│ - 90% Dwell Residency Credit Rule (D = Tin / Te >= 0.90)                               │
│ - Physical Checkpoint Missions & Collision Window Task Distribution (W = 10 mins)      │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │ Operational Rules & State Transitions
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Digital Solutions Engineering (Obj 3)                                         │
│ - Agile Scrum Engineering (7 Two-Week Sprints)                                         │
│ - Fast Multi-Tier Ray-Casting PIP Engine (Haversine Centroid + AABB + Jordan Curve)    │
│ - Dual Anti-Spoofing Classifiers (Strategy A Heuristic Scoring vs Strategy B ML Logit) │
│ - Pure-JS EXIF Geolocation Extraction & 64-bit dHash Deduplication                     │
│ - WebAuthn Biometrics, Institutional Email OTP & Portable Ed25519 Passes               │
│ - Bidirectional Socket.io Real-Time Telemetry Dashboard                                │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │ Executable System Architecture
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 4: System Evaluation (Obj 4)                                                     │
│ - System Usability Scale (SUS) Acceptance Testing (Target Mean SUS >= 80 points)       │
│ - Empirical Spatial Engine Evaluation (Ray-Casting PIP vs Circular Geofence Baseline)  │
│ - Labeled Anti-Spoofing Trace Benchmark & McNemar's Paired Chi-Square Test             │
│ - Photo Deduplication Confusion Matrix (Hamming Distance <= 5)                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ System Architecture & Technology Stack

TapIn is structured as a three-tier Progressive Web Application compliant with ISO/IEC 25010 standards:

- **Client Tier**: React 18, Tailwind CSS, Vite, Lucide Icons, Leaflet.js, HTML5 Geolocation API, DeviceMotionEvent API, WebAuthn API (`@simplewebauthn/browser`), PWA Service Worker.
- **Application Tier**: Node.js & Express REST API, `@simplewebauthn/server`, Nodemailer (SMTP), Pure-JS Binary EXIF parser, dHash Perceptual Hashing Engine, Socket.io (WebSocket Transport).
- **Data Tier**: SQLite in Write-Ahead Logging (`WAL`) mode with foreign key enforcement (`better-sqlite3`).
- **Deployment**: Docker containerization on cloud PaaS.

```
                                ┌────────────────────────────────────────┐
                                │         Student Browser / PWA HUD      │
                                │  - GPS Telemetry + DeviceMotionEvent   │
                                │  - WebAuthn Biometrics / Email OTP     │
                                │  - Native Photo Capture / Upload       │
                                └───────────────────┬────────────────────┘
                                                    │ HTTPS POST / API Telemetry
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              TapIn Backend (Node.js/Express)                                │
│                                                                                             │
│   ┌────────────────────────────────┐   ┌─────────────────────────────┐   ┌──────────────┐   │
│   │   GPS Spoofing Detection       │   │   Venue Geofencing Engine   │   │  Auth Layer  │   │
│   │   - 5 Sensor-Fusion Heuristics │   │   - Haversine Sphere $O(1)$ │   │  - WebAuthn  │   │
│   │   - Strategy A: Trust Score    │   │   - AABB Bounding Box       │   │    Platform  │   │
│   │   - Strategy B: ML Logistic    │   │   - Ray-Casting PIP Exact   │   │  - Email OTP │   │
│   │     Regression Classifier      │   │     Containment             │   │  - Ed25519   │   │
│   └───────────────┬────────────────┘   └──────────────┬──────────────┘   └───────┬──────┘   │
│                   │                                   │                          │          │
│                   └───────────────────────────────────┼──────────────────────────┘          │
│                                                       ▼                                     │
│                           Attendance State Machine & Checkpoint Service                     │
│                           - Dwell Ratio: D = Tin / Te (90% Residency)                       │
│                           - Grace Countdown & Automated Reset                               │
│                           - EXIF Geotag Analysis & 64-bit dHash Deduplication               │
│                                                       │                                     │
│                                                       ▼                                     │
│                                          SQLite Database (WAL Mode)                         │
│                                                       │                                     │
│                                                       ▼                                     │
│                                       Socket.io Real-Time Broadcast                         │
└───────────────────────────────────────────────────────┬─────────────────────────────────────┘
                                                        │
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │   Admin Live Dashboard UI    │
                                         │   - Live Map & Telemetry     │
                                         │   - Tasks Review & Approval  │
                                         │   - Penalty Engine Violations│
                                         └──────────────────────────────┘
```

---

## 📐 Mathematical & Algorithmic Formulations

### 1. Great-Circle Distance (Haversine Formula) [13]
$$d = 2R \arcsin \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}, \quad R = 6,371,000\text{ m}$$

### 2. Multi-Tier Pre-Filtering & Exact Ray-Casting PIP [11], [12], [14]
- **Tier 1 (Bounding Sphere)**: Rejects point $P$ if $\operatorname{Haversine}(\text{Centroid}, P) > R_{\max} + 15\text{m}$ in $O(1)$ time.
- **Tier 2 (Axis-Aligned Bounding Box)**: Rejects point if $\phi_p \notin [\phi_{\min}, \phi_{\max}]$ or $\lambda_p \notin [\lambda_{\min}, \lambda_{\max}]$.
- **Tier 3 (Jordan Curve Parity Ray-Casting)**: Casts an eastward ray from $(\lambda_p, \phi_p) \to (+\infty, \phi_p)$:
  $$x_{\text{int}} = \lambda_i + \frac{(\phi_p - \phi_i)(\lambda_{i+1} - \lambda_i)}{\phi_{i+1} - \phi_i}, \quad \text{inside} = (c_P \bmod 2 \equiv 1)$$

### 3. Dwell Ratio & Residency Credit Rule [2], [20]
$$D = \frac{T_{in}}{T_e} \ge 0.90 \quad (90\% \text{ required in-polygon residency for full credit})$$

### 4. Sensor-Fusion Anti-Spoofing Heuristics (Strategy A) [5], [15], [17]
- **$p_1$ (Implausible Speed)**: If $v > 15\text{ m/s}$ ($54\text{ km/h}$), penalty $p_1 = \min(50, \lfloor 2v \rfloor)$; displacement $> 50\text{m}$ in $< 2\text{s}$ (teleport) incurs $p_1 = 45$.
- **$p_2$ (Accuracy Anomaly)**: Accuracy $\le 0.2\text{m}$ incurs $p_2 = 35$; static accuracy repeated $\ge 3$ consecutive times incurs $p_2 = 30$.
- **$p_3$ (Timestamp Irregularity)**: Retrograde timestamp ($\Delta t < 0$) incurs $p_3 = 40$; synthetic cadence (integer second $< 5\text{s}$) incurs $p_3 = 20$.
- **$p_4$ (Sensor-Motion Mismatch)**: Speed $> 3\text{m/s}$ in $< 10\text{s}$ with linear acceleration $< 0.08\text{ m/s}^2$ incurs $p_4 = 35$.
- **$p_5$ (Stationary Anomaly)**: Displacement $\le 1.0\text{m}$ across $\ge 5\text{ minutes}$ during active event incurs $p_5 = 35$.
- **Trust Score**: $S = \max(0, 100 - \sum_{k=1}^5 p_k)$. Classification: $\text{Valid} \ge 70$, $\text{Borderline} \in [50, 69]$, $\text{Rejected} < 50$. Flagged spoofed if $S < \tau$ (default $\tau = 60$).

### 5. Machine Learning Logistic Regression Classifier (Strategy B) [36]
$$P(\text{spoofed} \mid \mathbf{f}) = \sigma(z) = \frac{1}{1 + e^{-z}}, \quad z = w_0 + \sum_{i=1}^6 w_i f_i, \quad P \ge 0.5 \implies \text{Spoofed}$$

### 6. Perceptual Difference Hashing (dHash) & Hamming Distance [26], [27]
$$b_{r,c} = \begin{cases} 1 & g_{r,c} > g_{r,c+1} \\ 0 & \text{otherwise} \end{cases}, \quad H(h_a, h_b) = \operatorname{popcount}(h_a \oplus h_b) \le 5 \implies \text{Duplicate } (\ge 92.2\%)$$

### 7. Brooke's System Usability Scale (SUS) Score [29]
$$\text{SUS}_r = 2.5 \left( \sum_{i \in \{1,3,5,7,9\}} (x_i - 1) + \sum_{i \in \{2,4,6,8,10\}} (5 - x_i) \right), \quad \text{Target: Mean SUS} \ge 80$$

---

## 🚀 Quick Start & CLI Execution Commands

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+)

### Installation & Initialization
```bash
# 1. Install root & client dependencies
npm install
cd client && npm install && cd ..

# 2. Seed database with MMSU events, checkpoints, violation matrix, and BSCS 4A authors
npm run seed

# 3. Start development servers
npm start                 # Backend API & Socket.io server on http://localhost:5000
cd client && npm run dev  # Vite Client PWA on http://localhost:5173
```

---

## 🧪 Comprehensive Automated Test Suites

TapIn includes 4 automated test suites validating 47 discrete test assertions:

```bash
npm run test:geofence   # 15 tests: Ray-Casting PIP algorithm, Jordan curve parity, AABB & boundary collisions
npm run test:features   # 13 tests: WebAuthn registration, Email OTP rate limiting, stationary spoofing, Ed25519
npm run test:sequence   # 8 tests: End-to-end Time-In -> Checkpoint Task Distribution -> Time-Out Gating Lifecycle
npm run test:fixes      # 11 tests: Admin review queue, false-positive protection, server-side Time-Out gating
npm run test:all        # Runs all 47 automated tests consecutively
```

---

## 📊 Academic Research Evaluation Harnesses (Phase 4)

To support empirical thesis evaluation, the repository contains standalone CLI evaluation harnesses:

```bash
# 1. Generate Labeled Multi-Sensor Benchmark Traces
npm run generate-dataset

# 2. Anti-Spoofing Empirical Evaluation & McNemar's Paired Test (Section 3.4.3)
npm run eval:rule       # Strategy A (Rule-Based Weighted Scoring)
npm run eval:ml         # Strategy B (Machine Learning Logistic Regression)
npm run eval:compare    # Paired McNemar Chi-Square test comparing Strategy A vs B

# 3. Spatial Geofencing Empirical Evaluation (Section 3.4.2)
npm run eval:spatial    # Compares Ray-Casting PIP vs Fernandez et al. Circular Geofence baseline (FAR, FRR, Open vs Obstructed)

# 4. System Usability Scale (SUS) Evaluation (Section 3.4.1)
npm run eval:sus        # Calculates Brooke SUS across N=35 respondents, 95% CI, and t-test (Target >= 80)

# 5. Photo Deduplication dHash Evaluation (Section 3.4.4)
npm run eval:photo      # Tests 64-bit dHash and Hamming distance duplicate detection confusion matrix

# 6. Execute All Empirical Evaluation Suites
npm run eval:all
```

---

## 📁 Repository Directory Structure

```
TapIn/
├── package.json                   # Root dependencies, test scripts & academic evaluation harnesses
├── README.md                      # Comprehensive thesis documentation & quick start
├── documentation.md               # Version changelogs & technical architecture records
├── IMPORTANT.md                   # Thesis defense handbook & algorithmic knowledge base
├── server/
│   ├── index.js                   # Express REST API & Socket.io server entry point
│   ├── db.js                      # SQLite database initialization & WAL mode configuration
│   ├── seed.js                    # Database seed (MMSU events, checkpoints, violation rules, author roster)
│   ├── middleware/
│   │   └── auth.js                # JWT token & admin role authorization middleware
│   ├── services/
│   │   ├── geofence.js            # Ray-Casting PIP engine, AABB & Haversine pre-filters
│   │   ├── haversine.js           # Great-circle spherical distance calculations
│   │   ├── checkpointEngine.js    # Multi-checkpoint geofencing & nested containment checks
│   │   ├── taskDistribution.js   # Anti-collusion task assignment algorithm & collision window
│   │   ├── photoVerification.js   # Pure-JS EXIF metadata parsing & 64-bit dHash perceptual hashing
│   │   ├── penaltyEngine.js       # Post-event violation evaluation & 90% dwell residency analysis
│   │   ├── webauthnService.js     # W3C WebAuthn platform biometrics service
│   │   ├── otpService.js          # Institutional Email OTP fallback with rate limiting
│   │   ├── cryptoAuth.js          # Asymmetric Ed25519 digital signature signing & verification
│   │   └── spoofDetection/        # Multi-sensor anti-spoofing research module
│   │       ├── index.js           # Spoof detector facade
│   │       ├── heuristics.js      # 5 sensor-fusion heuristics (Speed, Accuracy, Timing, Sensor, Stationary)
│   │       ├── ruleBasedStrategy.js # Strategy A: Weighted heuristic scoring & trust score
│   │       └── mlStrategy.js      # Strategy B: Calibrated Logistic Regression classifier
│   ├── routes/
│   │   ├── auth.js                # Admin auth, WebAuthn options & Email OTP endpoints
│   │   ├── students.js            # Student master database roster & Ed25519 pass issuance
│   │   ├── events.js              # Event management, polygon coordinates & time windows
│   │   ├── checkpoints.js         # Checkpoint placement, task assignments & photo upload review
│   │   ├── attendance.js          # Time-in/time-out submission, dwell logging & live telemetry
│   │   ├── penalties.js           # Automated violation evaluation & penalty configuration
│   │   └── spoof.js               # Anomaly threshold configuration & lab telemetry
│   └── scripts/
│       ├── testGeofence.js        # Automated PIP test suite (15 tests)
│       ├── testNewFeatures.js     # Automated WebAuthn, OTP & Checkpoint suite (13 tests)
│       ├── testFullSequence.js    # Automated 8-step full lifecycle sequence suite
│       ├── testReviewAndGatingFixes.js # Automated 11-step admin review & gating suite
│       ├── generateSampleDataset.js # Benchmark multi-sensor trace dataset generator
│       ├── evalSpoofDetector.js   # Anti-spoofing research evaluation & McNemar test
│       ├── evalSpatialEngine.js   # Spatial PIP vs circular geofence empirical comparison
│       ├── evalSusScore.js        # System Usability Scale (SUS) Brooke calculation & t-test
│       └── evalPhotoVerification.js # Photo deduplication dHash confusion matrix evaluation
└── client/
    ├── package.json               # Client dependencies & Vite scripts
    ├── vite.config.js             # Vite configuration with proxy
    └── src/
        ├── App.jsx                # Client application router & role layout
        ├── services/
        │   └── socket.js          # Centralized Socket.io client with origin resolution
        ├── components/
        │   ├── LiveGeofenceMap.jsx     # Leaflet live telemetry map with venue polygon
        │   ├── GeofenceMapPicker.jsx   # Interactive polygon editor with draggable vertices
        │   ├── CheckpointMapPicker.jsx # Interactive click-to-place checkpoint canvas
        │   └── Navbar.jsx              # Navigation header, student quick switch & PWA indicator
        └── pages/
            ├── StudentHome.jsx         # Student PWA HUD: Geofence, WebAuthn, OTP, Checkpoints & Time-In/Out
            ├── AdminDashboard.jsx      # Live event monitor with real-time attendee stream
            ├── TaskSubmissionsReview.jsx # Admin checkpoint photo review & 1-click verification queue
            ├── EventManagement.jsx     # Event polygon designer & checkpoint task configurator
            ├── AttendanceLogs.jsx      # Historical audit logs, filters, CSV / XLSX export
            ├── PenaltyEngineView.jsx   # Automated violation audit & dwell residency inspector
            ├── SpoofResearchLab.jsx    # Anomaly sensitivity tuning & empirical classifier lab
            └── SuperadminAdmins.jsx    # System administrator account management
```

---

## 📜 References Cited

- **[1]** S. Nagothu, O. P. Kumar, and A. Ganesan, "GPS aided autonomous monitoring and attendance system," *Procedia Computer Science*, vol. 87, pp. 99–104, 2016.
- **[2]** A. N. Babatunde, A. A. Oke, R. S. Babatunde, O. Ibitoye, and E. R. Jimoh, "Mobile based student attendance system using geo-fencing with timing and face recognition," *Journal of Advances in Mathematical & Computational Sciences*, vol. 10, no. 1, pp. 75–90, 2022.
- **[3]** I. Eweoya et al., "Design and implementation of a university attendance management system using geo-fencing," *Asian J. Comput. Sci. Technol.*, vol. 14, no. 1, pp. 28–46, 2025.
- **[4]** M. Premitasari, "Dynamic polygon geofencing for spatial validation in campus attendance monitoring," *J. Eng. & Technol. Advances*, vol. 10, no. 2, pp. 184–204, 2025.
- **[5]** P. Jiang, H. Wu, and C. Xin, "DeepPOSE: Detecting GPS spoofing attack via deep recurrent neural network," *Digital Communications and Networks*, vol. 8, no. 5, pp. 791–803, 2022.
- **[6]** B. J. D. Fidelino et al., "Student attendance monitoring GPS application using Android mobile platform," *CLOUD*, vol. 2, no. 1, 2014.
- **[7]** J. R. Fernandez et al., "Facial and geofencing-based attendance tracking system for deployed personnel," *Mindanao J. Sci. Technol.*, vol. 23, no. 2, pp. 133–148, 2025.
- **[8]** B. C. Fabro and H. F. Anuncio, "Decryption of attendance monitoring of senior high school students at ACTEC using Zebra Crossing algorithm," *Mindanao J. Sci. Technol.*, vol. 22, no. S1, pp. 79–99, 2024.
- **[9]** J. D. Ebin et al., "Utilizing QR codes for smart and low-cost student attendance acquisition and monitoring system in Eastern Visayas State University, Philippines," in *Proc. IEEE HNICEM*, 2022.
- **[10]** M. A. D. Perin, "Technology-assisted attendance monitoring: A case study on QR code system usability and performance," *J. Technol.-Assisted Learning*, vol. 1, no. 2, pp. 115–123, 2025.
- **[11]** M. Shimrat, "Algorithm 112: Position of point relative to polygon," *Commun. ACM*, vol. 5, no. 8, p. 434, 1962.
- **[12]** K. Hormann and A. Agathos, "The point in polygon problem for arbitrary polygons," *Computational Geometry: Theory and Applications*, vol. 20, no. 3, pp. 131–144, 2001.
- **[13]** R. W. Sinnott, "Virtues of the Haversine," *Sky and Telescope*, vol. 68, no. 2, p. 159, 1984.
- **[14]** A. Guttman, "R-trees: A dynamic index structure for spatial searching," in *Proc. ACM SIGMOD*, 1984, pp. 47–57.
- **[15]** S. K. Wong and S. M. Yiu, "Location spoofing attack detection with pre-installed sensors in mobile devices," *JoWUA*, vol. 11, no. 4, pp. 16–30, 2020.
- **[17]** M. R. Sarker, M. A. Hoque, and S. Tarkoma, "Smartphone-based location spoofing detection using accelerometer and gyroscope sensor fusion," *IEEE Access*, vol. 9, pp. 88320–88334, 2021.
- **[20]** H. Huang, G. Gartner, and M. Krisp, "Analysing human mobility patterns using spatial geofencing and dwell time analysis," *Comput., Environ. Urban Syst.*, vol. 85, p. 101569, 2021.
- **[23]** A. Biørn-Hansen, T. A. Majchrzak, and T. M. Grønli, "Progressive Web Apps: The definitive guide to next-gen web technology," *IEEE Software*, vol. 37, no. 6, pp. 44–51, 2020.
- **[24]** D. Fett, P. Hosseyni, and R. Küsters, "A comprehensive formal security analysis of FIDO 2.0," in *Proc. ACM CCS*, 2021, pp. 1823–1837.
- **[25]** D. J. Bernstein, N. Duif, T. Lange, P. Schwabe, and B. Y. Yang, "High-speed high-security signatures," *J. Cryptographic Eng.*, vol. 2, no. 2, pp. 77–89, 2012.
- **[26]** C. Zauner, "Implementation and benchmarking of perceptual image hash functions," M.S. thesis, Upper Austria Univ. Appl. Sci., 2010.
- **[27]** A. Swaminathan, Y. Mao, and M. Wu, "Robust and secure image hashing," *IEEE Trans. Inf. Forensics Security*, vol. 1, no. 2, pp. 215–230, 2006.
- **[28]** V. P. K. Anne, M. D. G. Martinez, and R. S. Cruz, "Evaluating WebSocket and HTTP push performance for real-time telemetry streaming in web applications," *IJATCSE*, vol. 10, no. 3, pp. 1650–1658, 2021.
- **[29]** J. Brooke, "SUS: A 'quick and dirty' usability scale," in *Usability Evaluation in Industry*, Taylor & Francis, 1996, pp. 189–194.
- **[30]** A. Bangor, P. T. Kortum, and J. T. Miller, "An empirical evaluation of the System Usability Scale," *Int. J. Hum.-Comput. Interact.*, vol. 24, no. 6, pp. 574–594, 2008.
- **[31]** J. Sauro and J. R. Lewis, *Quantifying the User Experience: Practical Statistics for User Research*, 2nd ed. Morgan Kaufmann, 2016.
- **[32]** D. M. W. Powers, "Evaluation: From precision, recall and F-measure to ROC, informedness, markedness and correlation," *J. Mach. Learn. Technol.*, vol. 2, no. 1, pp. 37–63, 2011.
- **[33]** T. Fawcett, "An introduction to ROC analysis," *Pattern Recognit. Lett.*, vol. 27, no. 8, pp. 861–874, 2006.
- **[36]** D. W. Hosmer, S. Lemeshow, and R. X. Sturdivant, *Applied Logistic Regression*, 3rd ed. Wiley, 2013.
- **[37]** *Data Privacy Act of 2012*, Republic Act No. 10173, Republic of the Philippines, 2012.
- **[38]** *Systems and software engineering — SQuaRE — System and software quality models*, ISO/IEC 25010:2011, 2011.
