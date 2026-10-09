# 📘 TapIn Defense Handbook & Technical Knowledge Base (`IMPORTANT.md`)

> **TapIn: Point-in-Polygon Geofence-Based Attendance Monitoring System with Real-Time Analytics**  
> **Course:** CMPSC 200: Thesis Writing  
> **Institution:** Mariano Marcos State University (MMSU), College of Computing and Information Sciences  
> **Authors (BSCS 4A):** Bagasani, Nythan Jan; Bonifacio, Jonas Nathaniel; Permison, Micko Gabriel; Udani, Bryan Leo H.  
> **Stakeholder:** University Student Council (USC), Mariano Marcos State University

---

## 📑 Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Procedural & Administrative Model (Phase 2)](#2-procedural--administrative-model-phase-2)
   - [Dwell-Time State Machine (Table 3.3)](#dwell-time-state-machine-table-33)
   - [Automated Grace-Period Reset Rule](#automated-grace-period-reset-rule)
   - [90% Dwell Ratio Residency Rule ($D = T_{in}/T_e$)](#90-dwell-ratio-residency-rule-d--t_inte)
   - [The 7 Official Configurable Violation Types](#the-7-official-configurable-violation-types)
3. [Ray-Casting Point-in-Polygon (PIP) Algorithm](#3-ray-casting-point-in-polygon-pip-algorithm)
   - [Jordan Curve Theorem & Edge Parity Rule](#jordan-curve-theorem--edge-parity-rule)
   - [Boundary & Degenerate Collision Handling](#boundary--degenerate-collision-handling)
   - [Multi-Tier Fast Pre-Filtering Optimization](#multi-tier-fast-pre-filtering-optimization)
4. [Multi-Checkpoint Task Verification System](#4-multi-checkpoint-task-verification-system)
   - [Spatial Hierarchy & Containment Validation](#spatial-hierarchy--containment-validation)
   - [Anti-Collusion Task Distribution Algorithm](#anti-collusion-task-distribution-algorithm)
   - [Photo Verification: Pure-JS EXIF Geolocation & 64-Bit dHash Deduplication](#photo-verification-pure-js-exif-geolocation--64-bit-dhash-deduplication)
5. [GPS Anti-Spoofing Research Module](#5-gps-anti-spoofing-research-module)
   - [The 5 Multi-Sensor Fusion Heuristics ($p_1$ to $p_5$)](#the-5-multi-sensor-fusion-heuristics-p_1-to-p_5)
   - [Strategy A: Rule-Based Weighted Scoring Strategy](#strategy-a-rule-based-weighted-scoring-strategy)
   - [Strategy B: Machine Learning Logistic Regression Classifier](#strategy-b-machine-learning-logistic-regression-classifier)
   - [Comparative Benchmark Harness & McNemar's Test](#comparative-benchmark-harness--mcnemars-test)
6. [Authentication & Identity Binding Architecture](#6-authentication--identity-binding-architecture)
   - [Primary: W3C WebAuthn Platform Biometrics](#primary-w3c-webauthn-platform-biometrics)
   - [Fallback: University Email One-Time-Passcode (OTP)](#fallback-university-email-one-time-passcode-otp)
   - [Portable Asymmetric Ed25519 Passes](#portable-asymmetric-ed25519-passes)
7. [System Evaluation Protocols (Phase 4)](#7-system-evaluation-protocols-phase-4)
   - [System Usability Scale (SUS) Acceptance Testing ($\text{SUS} \ge 80$)](#system-usability-scale-sus-acceptance-testing-textsus-ge-80)
   - [Empirical Spatial Engine Classification (PIP vs Circular Baseline)](#empirical-spatial-engine-classification-pip-vs-circular-baseline)
   - [Empirical Anti-Spoofing Performance & Metrics](#empirical-anti-spoofing-performance--metrics)
   - [Photo Deduplication Verification (Hamming Distance $\le 5$)](#photo-deduplication-verification-hamming-distance-le-5)
8. [Comprehensive Defense Q&A Sheet](#8-comprehensive-defense-qa-sheet)

---

## 1. Executive Summary & Problem Statement

Current attendance practices at MMSU mandatory university events (General Assemblies, University Convocations, Intramural Openings) require students to queue at entrance gates to scan barcode IDs, type ID numbers, or sign paper registers.

As documented in the study:
1. **Queue Bottlenecks**: Arrival rates exceed station service capacity ($\lambda > \mu$), creating long waiting lines analyzed via Little's Law ($L = \lambda W$).
2. **Proxy Attendance (Buddy Punching)**: Physical IDs or barcodes are handed to peers, authenticating credentials rather than physical presence.
3. **Single-Timestamp Flaw**: A timestamp recorded at entry provides zero evidence that the student remained at the venue throughout the event.
4. **Administrative Consolidation Burden**: Event organizers spend hours reconciling paper lists and resolving attendance disputes.

**TapIn** resolves all four problems through browser-based Progressive Web Application (PWA) technologies, exact computational geometry, continuous dwell residency tracking, and nested physical task checkpoints.

---

## 2. Procedural & Administrative Model (Phase 2)

### Dwell-Time State Machine (Table 3.3)
At each report time $t_k$, a student's attendance state is governed by a deterministic four-state machine:

| Current State | Condition | Next State | System Action |
| :--- | :--- | :--- | :--- |
| **Not Timed In** | Valid time-in inside window & within polygon | **Present** | Record `time_in`; unlock checkpoint tasks |
| **Present** | Report falls inside venue polygon | **Present** | Accumulate interval to inside time $T_{in}$ |
| **Present** | Report falls outside venue polygon | **Grace** | Start countdown timer of $G$ minutes (default 15m) |
| **Grace** | Report falls inside venue polygon | **Present** | **Automated Grace Reset**: Restore countdown to $G$ and log exit event |
| **Grace** | Grace countdown reaches 0 | **Violation** | Raise `EXCEEDED_GRACE_PERIOD` violation |
| **Violation** | Report falls inside venue polygon | **Present** | Retain violation record; resume dwell accumulation $T_{in}$ |
| **Present / Grace** | Valid time-out with 100% verified tasks | **Not Timed In (Closed)** | Record `time_out`; complete attendance lifecycle |

### Automated Grace-Period Reset Rule
To account for natural GPS multi-path inaccuracies and temporary permissible exits (e.g., restroom breaks, water stations), a student stepping outside the polygon enters **Grace** state.
- If the student re-enters before the timer reaches 0, the countdown restores to the full configurable value $G$ ($15\text{ minutes}$ default).
- Earlier brief exits do not penalize the student.
- If a student remains outside continuously $> G$, an immutable `EXCEEDED_GRACE_PERIOD` violation is logged in SQLite.

### 90% Dwell Ratio Residency Rule ($D = T_{in}/T_e$)
Adopted from Babatunde et al. [2] and Huang et al. [20]:
$$D = \frac{T_{in}}{T_e}$$
- $T_{in}$: Total cumulative time student's reports fall inside the venue polygon between Time-In and Time-Out.
- $T_e$: Required duration of the event window.
- **Residency Threshold**: Full attendance credit requires $D \ge \theta$, where $\theta = 0.90$ ($90\%$ residency).
- Students falling between a lower threshold and $0.90$ are classified as partial attendance and flagged for `INCOMPLETE_DURATION`.

### The 7 Official Configurable Violation Types
TapIn detects and logs the following violation codes:
1. `NO_TIME_IN`: Student failed to record a Time-In during any scheduled window.
2. `NO_TIME_OUT`: Student timed in but failed to log Time-Out when the event concluded.
3. `INCOMPLETE_DURATION`: Student timed out early or accumulated a dwell ratio $D < 0.90$.
4. `EXCEEDED_GRACE_PERIOD`: Student spent more than $G$ continuous minutes outside the venue polygon.
5. `INCOMPLETE_CHECKPOINT_TASKS`: Student attempted to leave without completing all station tasks.
6. `SPOOF_SUSPECTED`: Location reports triggered multi-sensor GPS spoofing flags.
7. `BORDERLINE_OUT_OF_BOUNDS`: Student checked in within grace tolerance slightly outside the polygon perimeter.

---

## 3. Ray-Casting Point-in-Polygon (PIP) Algorithm

### Jordan Curve Theorem & Edge Parity Rule
The Jordan Curve Theorem guarantees that a simple closed curve separates the 2D plane into an interior and exterior.

For coordinate point $P = (\phi_p, \lambda_p)$ where $\phi = \text{latitude}$, $\lambda = \text{longitude}$:
1. Cast an eastward horizontal ray from $(\lambda_p, \phi_p) \to (+\infty, \phi_p)$.
2. For each edge connecting vertex $v_i = (\phi_i, \lambda_i)$ and $v_{i+1} = (\phi_{i+1}, \lambda_{i+1})$:
   - **Straddle Test**: $(\phi_i > \phi_p) \neq (\phi_{i+1} > \phi_p)$
   - **Intersection Longitude**:
     $$x_{\text{int}} = \lambda_i + \frac{(\phi_p - \phi_i)(\lambda_{i+1} - \lambda_i)}{\phi_{i+1} - \phi_i}$$
   - If $\lambda_p < x_{\text{int}}$, increment crossing counter $c_P$.
3. **Parity Decision**:
   $$\text{inside}(P) = \begin{cases} 1 & c_P \equiv 1 \pmod 2 \quad (\text{ODD crossings} \implies \text{INSIDE}) \\ 0 & c_P \equiv 0 \pmod 2 \quad (\text{EVEN crossings} \implies \text{OUTSIDE}) \end{cases}$$

### Boundary & Degenerate Collision Handling
Points collinear to an edge segment within tolerance $\epsilon = 10^{-7}$ are classified as inside (`onBoundary: true`), resolving degenerate vertex and edge intersections (Hormann & Agathos [12]).

### Multi-Tier Fast Pre-Filtering Optimization
1. **Tier 1 — Haversine Bounding Sphere**: Rejects coordinates where $\operatorname{Haversine}(\text{Centroid}, P) > R_{\max} + 15\text{m}$ in $O(1)$ time.
2. **Tier 2 — Axis-Aligned Bounding Box (AABB)**: Rejects coordinates falling outside $[\phi_{\min}, \phi_{\max}] \times [\lambda_{\min}, \lambda_{\max}]$ (Guttman [14]).
3. **Tier 3 — Exact Ray-Casting PIP**: Executed only on points passing Tiers 1 & 2.

---

## 4. Multi-Checkpoint Task Verification System

### Spatial Hierarchy & Containment Validation
- Administrators place up to 3 checkpoints ($C_1, C_2, C_3$) nested inside the outer venue polygon.
- Catchment zones are configurable between $10\text{m}$ and $50\text{m}$ radius.
- When an administrator places or moves a checkpoint on the map, the backend mathematically tests that the station coordinates lie strictly inside the venue polygon (`validateCheckpointsInsideEvent`).

### Anti-Collusion Task Distribution Algorithm
When a student enters a checkpoint catchment zone, the server assigns a task from that station's pool:
1. Queries `student_task_assignments` within the configurable `task_collision_window_minutes` ($W = 10\text{ minutes}$ default).
2. Excludes tasks recently given to other students at that station to prevent queue congestion and group collusion.
3. If all tasks are within the collision window, assigns the least recently assigned task.
4. Auto-seeds distinct verification tasks if an admin creates an empty checkpoint.
5. Admin toggles: `allow_duplicate_tasks` and `randomize_tasks` (uniform random vs. balanced round-robin).

### Photo Verification: Pure-JS EXIF Geolocation & 64-Bit dHash Deduplication
1. **Pure-JS EXIF Extraction**: Parses JPEG APP1 (`0xFFE1`) binary tags without native binaries.
   - Extracts camera capture timestamp and GPS coordinates.
   - Cross-checks against checkpoint coordinates: $\Delta d > 100\text{m} \implies \text{EXIF\_LOCATION\_MISMATCH}$.
   - Stale timestamp check: $\Delta t > 24\text{h} \implies \text{EXIF\_STALE\_PHOTO}$.
2. **64-Bit Perceptual Difference Hash (`dHash`)**:
   - Converts image to $9 \times 8$ grayscale matrix ($72$ sample buckets).
   - Compares horizontally adjacent pixels: $b_{r,c} = 1$ if $g_{r,c} > g_{r,c+1}$ else $0$.
   - Computes **Hamming Distance** $H(h_a, h_b) = \operatorname{popcount}(h_a \oplus h_b)$ against all prior submissions for that event.
   - If $H \le 5$ (similarity $\ge 1 - 5/64 \approx 92.2\%$), flags `DUPLICATE_PHOTO_DETECTED` and links `duplicate_source_id`.

---

## 5. GPS Anti-Spoofing Research Module

### The 5 Multi-Sensor Fusion Heuristics ($p_1$ to $p_5$)
1. **$p_1$ (Implausible Speed)**:
   - Calculates velocity $v = d / \Delta t$ between consecutive reports.
   - If $v > 15\text{ m/s}$ ($54\text{ km/h}$), penalty $p_1 = \min(50, \lfloor 2v \rfloor)$.
   - Teleport condition: Displacement $> 50\text{m}$ in $\Delta t < 2\text{s}$ incurs $p_1 = 45$.
2. **$p_2$ (Accuracy Anomaly)**:
   - Reported accuracy $\le 0.2\text{m}$ (synthetic precision) incurs $p_2 = 35$.
   - Identical accuracy value repeated $\ge 3$ consecutive readings incurs $p_2 = 30$.
3. **$p_3$ (Timestamp Irregularity)**:
   - Retrograde timestamp ($\Delta t < 0$) incurs $p_3 = 40$.
   - Exactly regular synthetic cadence (whole-second interval $< 5\text{s}$) incurs $p_3 = 20$.
4. **$p_4$ (Sensor-Motion Mismatch)**:
   - Displacement implying speed $> 3\text{m/s}$ within $10\text{s}$ while accelerometer linear acceleration magnitude is $< 0.08\text{ m/s}^2$ incurs $p_4 = 35$.
5. **$p_5$ (Stationary Anomaly Signal)**:
   - Maximum displacement $\le 1.0\text{m}$ across a window of $\ge 5\text{ minutes}$ during an active event incurs $p_5 = 35$ (catches desktop emulators and static mock location apps).

### Strategy A: Rule-Based Weighted Scoring Strategy
$$\text{Trust Score } S = \max\left(0, 100 - \sum_{k=1}^5 p_k\right)$$
- **Classification**: $\text{Valid } (S \ge 70)$, $\text{Borderline } (50 \le S \le 69)$, $\text{Rejected } (S < 50)$.
- **Spoof Decision**: Flagged as spoofed if $S < \tau$ (default decision threshold $\tau = 60$).

### Strategy B: Machine Learning Logistic Regression Classifier
Extracts a 6-dimensional feature vector $\mathbf{f} = [f_1, f_2, f_3, f_4, f_5, f_6]^T$:
1. $f_1$: Calculated speed ($\text{m/s}$)
2. $f_2$: Low-accuracy indicator ($\text{accuracy} \le 0.2\text{m}$)
3. $f_3$: Static accuracy pattern indicator
4. $f_4$: Timestamp anomaly indicator
5. $f_5$: Sensor-motion mismatch indicator
6. $f_6$: Stationary anomaly indicator

Logit function and Sigmoid probability:
$$z = w_0 + \sum_{i=1}^6 w_i f_i, \quad P(\text{spoofed} \mid \mathbf{f}) = \sigma(z) = \frac{1}{1 + e^{-z}}$$
Classified as spoofed if $P \ge 0.50$. L2-regularized cross-entropy loss:
$$\mathcal{L}(\mathbf{w}) = -\frac{1}{N} \sum_{j=1}^N \left[ y_j \ln p_j + (1 - y_j)\ln(1 - p_j) \right] + \frac{\lambda}{2} \|\mathbf{w}\|^2$$

### Comparative Benchmark Harness & McNemar's Test
Evaluates Strategy A and Strategy B over the same labeled dataset using McNemar's test at $\alpha = 0.05$:
$$\chi^2 = \frac{(|b - c| - 1)^2}{b + c}$$
where $b$ is reports correct by Strategy A but incorrect by Strategy B, and $c$ is reports correct by Strategy B but incorrect by Strategy A.

---

## 6. Authentication & Identity Binding Architecture

### Primary: W3C WebAuthn Platform Biometrics
- Implements official W3C WebAuthn standard (`navigator.credentials.create()` and `navigator.credentials.get()`).
- Restricts authenticators to platform hardware enclaves (`authenticatorAttachment: 'platform'`, `userVerification: 'required'`) using Touch ID, Face ID, Windows Hello, and Android Biometrics.
- **Privacy Compliance**: Raw biometric data never leaves the hardware secure element. The server receives and verifies only cryptographic digital signatures.

### Fallback: University Email One-Time-Passcode (OTP)
- Activated when platform biometrics are unavailable (borrowed device or kiosk).
- Pulls non-editable student email directly from university records (e.g. `23-140015@mmsu.edu.ph`).
- Generates 6-digit cryptographic code hashed with SHA-256 in SQLite `otp_codes`.
- **Abuse Protections**:
  - 5-minute single-use expiry.
  - Rate limiting: Maximum 3 OTP requests per 10 minutes.
  - Brute-force lockout: Maximum 5 incorrect verification attempts before invalidation.

### Portable Asymmetric Ed25519 Passes
- Generates portable Ed25519 keypairs during onboarding.
- Allows students to export offline verifiable QR passes and JSON tokens.

---

## 7. System Evaluation Protocols (Phase 4)

### System Usability Scale (SUS) Acceptance Testing ($\text{SUS} \ge 80$)
- Conducted with $N = 35$ participants ($30$ students across 5 MMSU colleges, $5$ event administrators).
- Participants execute scenarios S1 - S6 (Table 3.6).
- Computes Brooke's formula: $\text{SUS}_r = 2.5 \left( \sum_{\text{odd}} (x_i - 1) + \sum_{\text{even}} (5 - x_i) \right)$.
- **Empirical Result**: Mean $\text{SUS} = 90.36$ ($95\%\text{ CI: } [87.49, 93.23]$, $t = 7.367, p < 0.001$), earning Bangor et al. [30] rating of **"Excellent / Best Imaginable"** and exceeding the target threshold of $80$.

### Empirical Spatial Engine Classification (PIP vs Circular Baseline)
- Compares Ray-Casting PIP against circular circumscribed geofence baseline (Fernandez et al. [7]).
- Evaluates test points well inside, well outside, irregular corner pockets, and boundary proximities ($5\text{m}, 10\text{m}, 20\text{m}$) across Open and Obstructed/Urban environments.
- **Empirical Result**: Ray-Casting PIP achieves **$94.44\%$ overall accuracy** ($100\%$ open-space, $88.89\%$ obstructed), while circular baseline drops to $77.78\%$ with a high False Acceptance Rate of $36.36\%$ in non-convex corners.

### Empirical Anti-Spoofing Performance & Metrics
- Evaluates Strategy A and Strategy B across teleportation, static fake GPS, synthetic timing, and stationary anomalies.
- Reports Accuracy, Precision, Recall, Specificity, FPR, and F1 score.
- **Empirical Result**: Strategy B achieves $77.78\%$ accuracy with $96.00\%$ specificity ($4.00\%$ FPR), while Strategy A achieves $75.00\%$ accuracy with $92.00\%$ specificity ($8.00\%$ FPR). McNemar's paired test yields $\chi^2 = 0.0000$ ($p > 0.05$), demonstrating both strategies are statistically robust.

### Photo Deduplication Verification (Hamming Distance $\le 5$)
- Evaluates 64-bit dHash against exact duplicates, re-compressed variations, brightness shifts, and distinct station photos.
- **Empirical Result**: Achieves **$100.00\%$ Accuracy, Precision, Recall, and F1 score** at Hamming distance threshold $\le 5$ ($\ge 92.2\%$ visual match).

---

## 8. Comprehensive Defense Q&A Sheet

### Q1: How does TapIn resolve the single-timestamp flaw of conventional QR/barcode systems?
> **Answer**: "Conventional QR and barcode systems record a single transaction at the entry door. Once scanned, a student can leave immediately. TapIn implements an operational dwell-time state machine: attendance credit is governed by continuous in-polygon residency ($D = T_{in} / T_e \ge 0.90$, Babatunde et al.), supported by automated grace-period resets ($G = 15\text{ mins}$) and physical multi-station checkpoint missions. Time Out remains locked until all checkpoint tasks are verified by an administrator."

### Q2: Why did you choose Ray-Casting Point-in-Polygon over standard circular Haversine geofences?
> **Answer**: "University campuses, quadrangles, and lecture halls are non-circular, irregular polygons. As demonstrated by Premitasari [4] and our empirical spatial evaluation (`npm run eval:spatial`), circular geofences suffer a $36.36\%$ False Acceptance Rate in corner pockets, mistakenly crediting students who are outside irregular boundaries. Ray-Casting PIP leverages the Jordan Curve Theorem to evaluate exact topological containment with sub-millisecond execution."

### Q3: How do you address GPS drift and indoor attenuation near campus buildings?
> **Answer**: "We employ a three-tier mitigation strategy: First, boundary segments incorporate a mathematical epsilon tolerance ($10^{-7}$). Second, an automated grace-period reset allows temporary fluctuations up to 15 minutes without penalty upon re-entry. Third, borderline readings slightly outside the perimeter are logged as `BORDERLINE_OUT_OF_BOUNDS` for administrative review rather than being arbitrarily rejected."

### Q4: How does WebAuthn prevent proxy attendance while complying with the Data Privacy Act (RA 10173)?
> **Answer**: "WebAuthn uses asymmetric public-key cryptography bound to device hardware secure enclaves (Touch ID, Face ID, Windows Hello). In compliance with the Data Privacy Act of 2012, raw biometric templates never leave the student's personal device. The server only receives a cryptographic signature verifying that the registered student unlocked their hardware authenticator."

### Q5: What happens if a student uses a borrowed device or lacks biometric hardware?
> **Answer**: "TapIn provides an institutional Email One-Time-Passcode (OTP) fallback. The student enters their Student ID, and the system looks up their official university email on file (e.g. `23-140015@mmsu.edu.ph`, non-editable by the client). The server generates a 6-digit code valid for 5 minutes with strict rate limiting (max 3 per 10 mins) and brute-force lockout (max 5 attempts)."

### Q6: How does the system detect fake GPS location apps (Mock Locations)?
> **Answer**: "TapIn deploys a multi-sensor fusion engine evaluating five simultaneous heuristics: velocity checks ($> 15\text{ m/s}$ and instantaneous teleports $> 50\text{m}$ in $< 2\text{s}$), static accuracy repetition, timestamp continuity, accelerometer motion sensor correlation (`DeviceMotionEvent`), and stationary signal anomaly analysis detecting static software emulators holding coordinates with near-zero movement over 5+ minutes."

### Q7: Why maintain both a Rule-Based Strategy and a Machine Learning Strategy?
> **Answer**: "This directly addresses Specific Objective 3 and Phase 4 of our thesis: we maintain both strategies to compare a transparent, configurable rule-based scoring engine against a learned Logistic Regression classifier empirically on labeled trace datasets using confusion matrix metrics and McNemar's paired test."

### Q8: How does the Checkpoint Mechanic prevent students from sharing task photos?
> **Answer**: "Every checkpoint task submission undergoes dual-layer verification: pure-JS EXIF parsing extracts camera capture timestamps and GPS coordinates (flagging mismatches $> 100\text{m}$), and a 64-bit perceptual difference hash (`dHash`) compares Hamming distances against all prior event submissions, flagging near-duplicates ($\ge 92.2\%$ visual similarity) to catch image reuse and collusion."

### Q9: How is task distribution handled so students cannot copy adjacent peers?
> **Answer**: "Our task distribution engine enforces an anti-collusion collision window ($W = 10\text{ minutes}$). When a student enters a checkpoint catchment, tasks assigned to peers at that station within the past 10 minutes are excluded from selection, ensuring physical crowds receive distinct missions."

### Q10: How does the system prevent false-positive task completion on network errors?
> **Answer**: "The client enforces a strict 2xx server-confirmed outcome state: UI success banners are rendered only when the server returns HTTP 200 with `{ success: true }`. Time Out is independently gated on the server side in `/api/attendance/submit`, which counts distinct verified task records and returns HTTP 403 Forbidden if any stations remain unverified."

### Q11: What were the results of the System Usability Scale (SUS) evaluation?
> **Answer**: "Across 35 participants ($30$ students and $5$ event organizers) performing task scenarios S1 - S6, the system achieved a mean SUS score of $90.36$ ($SD = 8.32, 95\%\text{ CI: } [87.49, 93.23]$). A one-sample t-test confirmed statistical significance ($t = 7.367, p < 0.001$), decisively exceeding our thesis target of $80$ points and earning an adjective rating of 'Excellent / Best Imaginable' (Bangor et al. [30])."

### Q12: How are post-event penalties decided and enforced?
> **Answer**: "In accordance with our delimitation, the system does not impose disciplinary sanctions automatically. TapIn's Penalty Engine evaluates attendance logs against the 7 official violation rules, computes the student's dwell ratio ($D$), and presents an audit trail to the University Student Council (USC) to settle attendance compliance predictably."
