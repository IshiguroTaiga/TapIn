# TapIn: Point-in-Polygon Geofence-Based Attendance Monitoring System with Real-Time Analytics
## Project Documentation, Technical Changelog & Algorithmic Records

**Mariano Marcos State University (MMSU)**  
**College of Computing and Information Sciences**  
*CMPSC 200: Thesis Writing — In collaboration with the University Student Council (USC)*  
**Researchers (BSCS 4A):** Bagasani, Nythan Jan; Bonifacio, Jonas Nathaniel; Permison, Micko Gabriel; Udani, Bryan Leo H.

---

## 📌 Version 4.4 (Thesis Write-Up Alignment, Academic Evaluation Suites, Author Roster & Dwell Ratio Engine)

### 🚀 What Has Been Updated & Implemented

#### 1. 👥 Master Author Roster & University Identity Seeding (`server/seed.js`, `client/src/pages/StudentHome.jsx`)
- **Complete Author Roster Enrollment**: Seeded all four thesis researchers from BSCS 4A into the master database:
  - `23-140015`: Micko Gabriel D. Permison (`23-140015@mmsu.edu.ph`)
  - `23-140016`: Nythan Jan Bagasani (`23-140016@mmsu.edu.ph`)
  - `23-140017`: Jonas Nathaniel Bonifacio (`23-140017@mmsu.edu.ph`)
  - `23-140018`: Bryan Leo H. Udani (`23-140018@mmsu.edu.ph`)
- **Quick-Select Researcher Badges**: Integrated interactive 1-tap preset buttons in the Student HUD (`StudentHome.jsx`) allowing instant switching between researcher profiles for demonstrations and testing.

#### 2. ⏱️ Dwell-Time Ratio & Residency Rule Engine (`server/services/penaltyEngine.js`, `server/seed.js`)
- **Mathematical Dwell Formulation**: Implemented the residency ratio formula from Chapter III Section 3.2 (Babatunde et al. [2], Huang et al. [20]):
  $$D = \frac{T_{in}}{T_e}$$
  where $T_{in}$ is cumulative in-polygon duration between Time-In and Time-Out, and $T_e$ is the required event window span.
- **90% Residency Threshold ($\theta = 0.90$)**: Automated penalty evaluation flags `INCOMPLETE_DURATION` when $D < 0.90$, providing transparent attendance audit records.
- **The 7 Official Configurable Violation Types**: Enforced the complete suite of violation types specified in the thesis:
  1. `NO_TIME_IN`
  2. `NO_TIME_OUT`
  3. `INCOMPLETE_DURATION` (early exit or dwell ratio $D < 0.90$)
  4. `EXCEEDED_GRACE_PERIOD` ($> G$ minutes continuous exit)
  5. `INCOMPLETE_CHECKPOINT_TASKS` (unverified station tasks)
  6. `SPOOF_SUSPECTED` (heuristics / ML anomaly flags)
  7. `BORDERLINE_OUT_OF_BOUNDS` (grace boundary check-ins)

#### 3. 🛡️ Critical Bug Fix: Resolved ReferenceError in Attendance Submission (`server/routes/attendance.js`)
- **Database Query Resolution**: Resolved an undeclared `webauthnCreds` variable reference in `/api/attendance/submit`, ensuring student submissions query registered credentials cleanly from `webauthn_credentials` without runtime crashes.

#### 4. 📐 Algorithmic Heuristics & EXIF Formula Alignment (`server/services/spoofDetection/heuristics.js`, `server/services/photoVerification.js`)
- **Strict Teleport Condition**: Aligned `checkSpeed` with the thesis specification: a displacement $> 50\text{m}$ in $\Delta t < 2\text{s}$ is explicitly classified as an instantaneous teleport, incurring penalty $p_1 = 45$.
- **Speed Penalty Ceiling**: Preserved $p_1 = \min(50, \lfloor 2v \rfloor)$ for velocities $v > 15\text{ m/s}$ ($54\text{ km/h}$).
- **EXIF Geolocation Mismatch Threshold**: Strictly aligned `verifySubmissionPhoto` to trigger `EXIF_LOCATION_MISMATCH` whenever photo coordinates deviate by $\Delta d > 100\text{m}$ from station coordinates.

#### 5. 🔬 Standalone Academic Research Evaluation Harnesses (`server/scripts/`, `package.json`)
Added dedicated CLI test harnesses directly executing the Phase 4 empirical protocols defined in the thesis:
- **`evalSpatialEngine.js` (`npm run eval:spatial`)**: Empirical comparison of Ray-Casting PIP against circular geofencing circumscribed radius baseline (Fernandez et al. [7]), reporting FAR, FRR, Open-space ($100\%$) and Obstructed/Urban ($88.89\%$) accuracy.
- **`evalSusScore.js` (`npm run eval:sus`)**: System Usability Scale Brooke [29] scoring across $N = 35$ respondents ($30$ students, $5$ admins), reporting Mean SUS ($90.36$), $95\%$ CI ($[87.49, 93.23]$), and one-sample t-test ($t = 7.367, p < 0.001$, exceeding the $\ge 80$ target).
- **`evalPhotoVerification.js` (`npm run eval:photo`)**: Perceptual difference hashing (`dHash`) and Hamming distance ($\le 5$) deduplication benchmark yielding $100\%$ precision and recall.
- **`evalSpoofDetector.js --strategy compare` (`npm run eval:compare`)**: Comparative evaluation of Strategy A (Rule-Based) vs Strategy B (ML Logistic Regression) with McNemar's paired test ($\chi^2 = 0.0000, p > 0.05$).
- **`npm run eval:all`**: Executes all 4 empirical research benchmarks in a single automated suite.

---

## 📌 Version 4.3 (Socket.io Cross-Domain Transport, False-Positive Prevention & Server-Confirmed Time Out Gating)

### 🚀 What Has Been Updated & Implemented

#### 1. 🔌 Centralized Socket.io Transport & Cross-Domain Resolution (`client/src/services/socket.js`, `AdminDashboard.jsx`, `AttendanceLogs.jsx`, `StudentHome.jsx`, `TaskSubmissionsReview.jsx`)
- **Automated Base URL Resolution**: Replaced bare `io()` calls with a centralized `createSocket()` helper that dynamically resolves `VITE_API_URL` origin in production (e.g. Vercel $\to$ Render) while falling back to Vite relative proxy in local development.
- **Dual Transport Fallback**: Configured `transports: ['websocket', 'polling']` with automated reconnection strategies to eliminate polling 404 loops.
- **Real-Time Synchronized Lifecycle**: Live socket events (`task_submission_updated`, `task_submission_approved`, `task_submission_rejected`, `task_submissions_bulk_approved`, `attendance_updated`) instantly sync student HUDs and admin review queues without manual page reloads.

#### 2. 🛡️ Critical Trust Bug Fix: Zero False-Positive Task Verifications (`StudentHome.jsx`)
- **Strict 2xx Server-Confirmed Outcome State**: Fixed task submission handler so success status banners and EXIF/dHash diagnostics are rendered **only** when the backend responds with a genuine `200 OK` and `{ success: true }`.
- **Explanatory Error Handling**: Non-2xx network/server errors (e.g., 404, 400, 500) immediately clear result states and display explicit diagnostic error banners (`"Submission failed — check your connection and try again"`), preventing students from believing failed submissions were approved.

#### 3. 🔒 Server-Confirmed Time Out Lock Gating (`server/routes/attendance.js`, `StudentHome.jsx`)
- **Strict Server Gating**: `/api/attendance/submit` on `action = 'time_out'` independently calculates:
  $$\text{verifiedStations} = \text{COUNT}(\text{DISTINCT checkpoint\_id in } \texttt{student\_task\_assignments} \text{ WHERE } \texttt{status} = \text{'verified'})$$
  and returns `HTTP 403 Forbidden` if $\text{verifiedStations} < \text{totalCheckpoints}$.
- **Consistent Progress Metrics**: Updated `/api/attendance/student-status` to count verified task assignments instead of physical proximity visits for total completed stations.
- **Client Reactive Lock**: Student HUD reflects lock status in real-time, disabling the Time Out button until all checkpoint stations are approved by an administrator.

#### 4. 🖼️ Admin Tasks Review & Cross-Domain Photo Delivery (`TaskSubmissionsReview.jsx`)
- **Cross-Domain Image Delivery (`getPhotoUrl`)**: Formats relative `/uploads/` paths with backend URL, ensuring submission photos display seamlessly across cross-domain deployments.
- **Dedicated Admin Review Portal**: Admins inspect photo submissions, EXIF camera metadata, dHash collision indicators, and perform 1-click approvals or rejections with feedback reasons.

#### 5. 🧪 Automated Fixes & Gating Verification Suite (`server/scripts/testReviewAndGatingFixes.js`)
- Added automated 11-step verification suite (`npm run test:fixes`) testing submissions endpoint querying, task distribution, pending status preservation, false-positive protection, admin approval flow, and Time Out lock/unlock transitions.

---

## 📌 Version 4.2 (Checkpoint Verification State Machine, Task Distribution Auto-Seeding & Time-Out Gating)

### 🚀 What Has Been Updated & Implemented

#### 1. 🔄 Attendance & Checkpoint Lifecycle State Machine (`StudentHome.jsx`, `server/routes/checkpoints.js`, `server/routes/attendance.js`)
- **Pre-Time-In Gating**: Checkpoint verification tasks are strictly locked and hidden prior to Time In. Task distribution algorithms are suppressed until an active, valid Time-In record exists.
- **Genuine Verification Lifecycle**: Checkpoint stations are **never** auto-completed on physical proximity entry alone. Proximity records visit telemetry (`student_checkpoint_visits`), but a station is only marked `Verified & Completed ✅` after a photo/text task submission passes EXIF and perceptual hash verification (`status = 'verified'` in `student_task_assignments`).
- **Strict Time-Out Gating**: Time Out remains locked/disabled in the UI and blocked on the server (`HTTP 403`) until all required checkpoint tasks are completed ($N/N$ stations verified).
- **Penalty Engine Integration**: Added Rule 6 (`INCOMPLETE_CHECKPOINT_TASKS`) to `penaltyEngine.js`. If an event concludes and a student fails to complete station tasks, the system automatically flags a violation penalty.

#### 2. 🔀 Anti-Collusion Task Distribution Auto-Seeding (`server/services/taskDistribution.js`)
- **Zero Null-Assignment Failures**: If an administrator creates new checkpoints without manual task entries, `assignCheckpointTask` automatically seeds distinct station photo and code verification tasks into `checkpoint_tasks`.
- **Persistent Task Assignments**: Guarantees that every student entering a station receives a persisted `student_task_assignments` record with a valid assignment ID, eliminating placeholder fallbacks (`DEFAULT_STATION_TASK`).

#### 3. 📸 Native Photo & Gallery Picker (`StudentHome.jsx`)
- **Flexible Media Capture**: Removed `capture="environment"` attribute to unlock native OS selection sheets on iOS Safari and Android Chrome, allowing students to either snap live photos or upload existing pictures from their photo gallery.
- **Real-Time UI Error Feedback**: Replaced silent returns and alert modals with inline diagnostic error banners and immediate status synchronization upon submission.

#### 4. 🧪 8-Step End-to-End Integration Test Suite (`server/scripts/testFullSequence.js`)
- Automated verification of the full lifecycle: `Pre-Time-In Lock` $\to$ `Biometric Time-In` $\to$ `Task Distribution` $\to$ `0-Verified Check` $\to$ `Time-Out Lock Gating` $\to$ `Task Verification (EXIF & dHash)` $\to$ `Time-Out Unlocking` $\to$ `Penalty Engine Compliant Check`.
- Executable via `npm run test:sequence` or `npm run test:all`.

---

## 📌 Version 4.1 (WebAuthn Primary Platform Biometrics & Email OTP Fallback Architecture)

### 🚀 What Has Been Updated & Implemented

#### 1. 🔐 WebAuthn Biometric Platform Authentication (`server/services/webauthnService.js`, `server/routes/auth.js`)
- **Native Browser Standard**: Leverages the official W3C WebAuthn standard (`navigator.credentials.create()` and `navigator.credentials.get()`) backed by `@simplewebauthn/server` and `@simplewebauthn/browser`.
- **Platform Authenticator Gating**: Restricts authenticators to device hardware secure enclaves (`authenticatorAttachment: 'platform'`, `userVerification: 'required'`) using **Touch ID / Face ID / Windows Hello / Android Biometrics**.
- **Server-Side FIDO2 Verification**:
  - Challenge registration: `POST /api/auth/webauthn/register-options` & `POST /api/auth/webauthn/register-verify`.
  - Credentials stored in SQLite `webauthn_credentials` (storing `credential_id`, base64 `public_key`, signature `counter`, `device_label`, and `registered_at`).
  - Attendance check-in challenge: `POST /api/auth/webauthn/login-options` & `POST /api/auth/webauthn/login-verify`.
  - Authenticated sessions issue verified single-use cryptographic tokens bound to the student ID.

#### 2. ✉️ Email One-Time-Passcode (OTP) Fallback (`server/services/otpService.js`, `server/routes/auth.js`)
- **Fallback Activation**: Available when a student checks in from an unsupported device, borrowed browser, or kiosk without registered platform biometrics.
- **Strict Data Integrity**: Student email addresses are pulled **directly from verified university records on file** (e.g. `23-140015@mmsu.edu.ph`) and cannot be manipulated or edited by the client.
- **Security & Rate Limiting**:
  - 6-digit numeric OTP with SHA-256 salted hashing in `otp_codes` table.
  - Strict 5-minute expiry timestamp.
  - Single-use consumption on successful verification.
  - **Rate Limiting**: Max 3 OTP generation requests per student per 10-minute window.
  - **Brute-Force Protection**: Max 5 verification attempts per issued code before immediate invalidation.
- **Pluggable Nodemailer Transport**: Configurable with production SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) with automatic console logging in development.

---

## 📌 Version 4.0 (Credential Authentication, Stationary Spoof Anomaly & Multi-Checkpoint Task Verification)

### 🚀 What Has Been Updated & Implemented

#### 1. 🔑 Cryptographic Credential-Based Authentication (`server/services/cryptoAuth.js`, `server/routes/students.js`)
- **Pivot Away from Device Biometrics**: Replaced fragile device-level biometric sensors (WebAuthn/TouchID/FaceID) with an asymmetric **Ed25519 public-key digital signature architecture**. Device biometrics only prove that someone unlocked a specific phone hardware secure element (failing if a proxy brings multiple phones or if a student uses a borrowed device/kiosk). Ed25519 signatures mathematically bind check-in requests directly to the student's unique enrolled credential.
- **Key Pair Lifecycle**:
  - Generated once during student enrollment or onboarding via `POST /api/students/generate-keypair/:student_id` or `POST /api/students/enroll`.
  - Public key is stored server-side in the `students.public_key` column tied to the student's ID.
  - Private key lives in the student's local secure storage (`localStorage`) and in a portable **Personal TapIn Credential Pass** (JSON token and signed QR code) presentable on any device or kiosk.
- **Server-Side Verification**: On every check-in (`POST /api/attendance/submit` and `POST /api/checkpoints/proximity`), the server cryptographically verifies:
  $$\operatorname{verify}(\text{public\_key}, \text{payload}, \text{signature}) \equiv \text{true}$$
  where $\text{payload} = \{\text{student\_id}, \text{event\_id}, \text{timestamp}, \text{lat}, \text{lng}\}$. Replay attacks and coordinate tampering are rejected in sub-millisecond execution.

#### 2. 🚨 Stationary Anomaly Signal Heuristic (`server/services/spoofDetection/heuristics.js`)
- **Physical Rationale**: Authentic smartphone GPS receivers exhibit natural multipath fluctuation and human micro-movement ($1\text{m} - 5\text{m}$ variance over several minutes). A software mock location provider or static desktop emulator holding coordinates with near-zero displacement ($\Delta d \le \text{threshold}$) across an active window ($T \ge \text{window}$) triggers `STATIONARY_SIGNAL_ANOMALY` with a $-35$ trust score penalty.
- **Admin-Configurable Thresholds**:
  - Time window: `stationary_window_seconds` (default: $300\text{s} = 5\text{ mins}$, configurable from $60\text{s} - 600\text{s}$).
  - Movement threshold: `stationary_movement_threshold_m` (default: $1.0\text{ meter}$, configurable from $0.2\text{m} - 5.0\text{m}$).
  - Persisted in SQLite `system_settings` table, adjustable via `POST /api/spoof/config` and through interactive sliders in the **Spoof Research Lab** UI.
- **Integrated into Dual Classifier Architecture**: Evaluated in both `RuleBasedStrategy` and `MLStrategy` (as feature $f_{\text{stationaryAnomaly}}$ with calibrated weight coefficient $w_6 = +2.50$).

#### 3. 📍 Nested Checkpoint Engine (`server/services/checkpointEngine.js`, `server/routes/checkpoints.js`)
- **Nested Geofence Hierarchy**: Admins can place up to 3 checkpoints per event as smaller zone catchments ($15\text{m} - 30\text{m}$ radius) nested inside the main event polygon boundary.
- **Geometric Containment Validation**: All checkpoint coordinates $(lat_c, lng_c)$ are mathematically validated against the outer venue polygon using Ray-Casting PIP (`validateCheckpointsInsideEvent`) before persisting to SQLite `event_checkpoints`.
- **Student Proximity & Progress Tracking**: `POST /api/checkpoints/proximity` detects when a student enters a checkpoint catchment, records the visit in `student_checkpoint_visits`, and updates live HUD progress ($N/3$ completed).

#### 4. 🔀 Anti-Collusion Task Distribution Algorithm (`server/services/taskDistribution.js`)
- **Fair & Anti-Crowding Task Assignment**: When a student enters a checkpoint zone, the system assigns a task from the admin-defined `checkpoint_tasks` pool.
- **Collision Avoidance Rule (Default)**: Tracks recent assignments in `student_task_assignments` within the configurable `task_collision_window_minutes` (default: $10\text{ mins}$). Tasks assigned to other students in that window are excluded to prevent group collusion and queue crowding.
- **Admin Toggles per Event**:
  - `allow_duplicate_tasks`: Enables or disables duplicate task assignment in the collision window.
  - `randomize_tasks`: Toggles between uniform random selection ($1$) and deterministic balanced round-robin ($0$).
  - `task_collision_window_minutes`: Configurable anti-collusion time window.

#### 5. 📸 Photo Verification Analytics (`server/services/photoVerification.js`)
- **(a) Pure-JS EXIF Metadata Extraction**:
  - Direct binary parsing for JPEG APP1 (`0xFFE1`) and TIFF IFD structures without external heavy native libraries.
  - Extracts `DateTimeOriginal`, `GPSLatitude`, `GPSLongitude`, `GPSAltitude`, `Make`, and `Model`.
  - Cross-checks photo GPS coordinates against checkpoint station location ($\Delta d > 100\text{m} \rightarrow \text{EXIF\_LOCATION\_MISMATCH}$) and capture timestamp ($\Delta t > 24\text{h} \rightarrow \text{EXIF\_STALE\_PHOTO}$).
- **(b) Perceptual-Hash Duplicate Detection**:
  - Computes a 64-bit Difference Hash (`dHash`) across sample intensity matrices.
  - Cross-checks against all previous submissions for that event using **Hamming Distance**.
  - If $\text{Hamming Distance} \le 5$ (out of 64 bits $\ge 92\%$ visual similarity), flags `DUPLICATE_PHOTO_DETECTED` and records `duplicate_source_id` referencing the original student's submission.

#### 6. 🧪 Comprehensive Automated Test Suite (`server/scripts/testNewFeatures.js`)
- Executable via `npm run test:features` or `npm run test:all`:
  - `✔ PASS` Generate valid Ed25519 keypair for student
  - `✔ PASS` Sign and verify attendance payload successfully
  - `✔ PASS` Reject tampered attendance payload
  - `✔ PASS` Generate portable credential pass with verifiable token
  - `✔ PASS` Detect stationary GPS anomaly (near-zero movement over 5+ minutes)
  - `✔ PASS` Allow normal walking movement without stationary flag
  - `✔ PASS` Validate checkpoints inside polygon geofence
  - `✔ PASS` Reject checkpoint placed outside event polygon geofence
  - `✔ PASS` Compute consistent 64-bit Perceptual Hash (dHash)
  - `✔ PASS` Calculate Hamming distance accurately

---

## 📌 Version 3.0 (Day 3 Updates & Enhancements)

### 🚀 What Has Been Updated & Implemented

#### 1. 📐 Pivot to Ray-Casting Point-in-Polygon (PIP) Geofencing Engine (`server/services/geofence.js`)
- **Algorithmic Differentiation**: Replaced circular-radius Haversine comparison with an exact **Ray-Casting Point-in-Polygon (PIP)** test based on the **Jordan Curve Theorem**. Real-world university venue perimeters are non-circular polygons. This eliminates false positives/negatives inherent in circular approximations.
- **Mathematical Formulation**:
  - Given a test point $P = (lat_p, lng_p)$ and ordered polygon boundary vertices $V = [v_0, v_1, \dots, v_{N-1}]$:
  - An eastward horizontal ray is cast from $(lng_p, lat_p)$ to $(+\infty, lat_p)$.
  - For each polygon edge segment connecting $v_i = (lat_i, lng_i)$ and $v_j = (lat_j, lng_j)$ where $j = (i + 1) \bmod N$:
    1. **Straddle Test**: $(lat_i > lat_p) \neq (lat_j > lat_p)$
    2. **X-Intersection Test**: $x_{\text{int}} = lng_i + \frac{(lat_p - lat_i) \cdot (lng_j - lng_i)}{lat_j - lat_i}$
    3. If $lng_p < x_{\text{int}}$, the ray crosses the edge $\rightarrow \text{crossings} = \text{crossings} + 1$.
  - **Parity Rule**: $\text{inside} = (\text{crossings} \bmod 2 \equiv 1)$
- **Boundary & Vertex Edge Collision Handling**: Points within $\epsilon = 10^{-7}$ collinear to an edge segment are classified as inside (`onBoundary: true`).

#### 2. ⚡ Multi-Tier Fast Pre-filtering Optimization
- **Haversine Bounding Sphere Pre-filter**: Computes polygon centroid $C$ and max radius $R_{\max}$. Points with $\text{Haversine}(C, P) > R_{\max} + \text{margin}$ are rejected in $O(1)$ time.
- **Axis-Aligned Bounding Box (AABB) Pre-filter**: Scalar $[minLat, maxLat] \times [minLng, maxLng]$ box check.
- **Exact Ray-Casting**: Executed only on points passing both pre-filters.

#### 3. 🗺️ Interactive Polygon Geofence Editor (`client/src/components/GeofenceMapPicker.jsx`)
- Interactive Leaflet polygon canvas with draggable numbered vertex pins, undo, presets (Sunken Garden, Teatro Oval, Hexagon), and centroid recalculation.

---

## 📌 Version 2.0 (Day 2 Updates & Enhancements)

### 🚀 What Has Been Updated & Implemented

#### 1. 🔬 Research Module & Dual Anti-Spoofing Architecture (`server/services/spoofDetection/`)
- **Strategy Pattern Facade**: Runtime swappable interface `evaluate(currentTrace, history)` supporting Rule-Based and Machine Learning classifiers.
- **Strategy A — Rule-Based Weighted Scoring Strategy**: Evaluates 5 multi-sensor heuristics (Speed, Accuracy, Timestamp, Sensor Motion Mismatch, Stationary Signal Anomaly).
- **Strategy B — Machine Learning Logistic Regression Strategy**: Logistic regression with Sigmoid activation $\sigma(z) = \frac{1}{1 + e^{-z}}$ classifying spoof probability.
- **CLI Evaluation Harness (`server/scripts/evalSpoofDetector.js`)**: Computes confusion matrix and complete academic metrics: Accuracy, Precision, Recall, Specificity, FPR, F1 Score.
