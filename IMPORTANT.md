# 📘 TapIn System Handbook & Technical Knowledge Base (`IMPORTANT.md`)

> **TapIn** is a geofencing-based, real-time university attendance monitoring and analytics system with a standalone **GPS Spoofing-Detection Research Module**, exact **Ray-Casting Point-in-Polygon (PIP)** venue containment, **WebAuthn Primary Platform Biometrics**, **Email One-Time-Passcode (OTP) Fallback**, and a **Multi-Checkpoint Task Verification System**.

---

## 📑 Table of Contents
1. [Core System Overview & Architecture](#1-core-system-overview--architecture)
2. [Ray-Casting Point-in-Polygon (PIP) Algorithm](#2-ray-casting-point-in-polygon-pip-algorithm)
   - [The Jordan Curve Theorem & Parity Rule](#the-jordan-curve-theorem--the-parity-rule)
   - [Step-by-Step Mathematical Computation](#step-by-step-mathematical-computation)
   - [Multi-Tier Fast Pre-Filtering Optimization](#multi-tier-fast-pre-filtering-optimization)
3. [Authentication Architecture: WebAuthn Platform Biometrics & Email OTP Fallback](#3-authentication-architecture-webauthn-platform-biometrics--email-otp-fallback)
   - [Primary: WebAuthn Native Platform Biometrics](#primary-webauthn-native-platform-biometrics)
   - [Fallback: University Email OTP with Abuse Protection](#fallback-university-email-otp-with-abuse-protection)
   - [Backwards-Compatibility: Portable Ed25519 Signed QR Passes](#backwards-compatibility-portable-ed25519-signed-qr-passes)
4. [Research Module: Multi-Sensor GPS Spoofing Detection](#4-research-module-multi-sensor-gps-spoofing-detection)
   - [The 5 Multi-Sensor Heuristics](#the-5-multi-sensor-heuristics)
   - [Stationary Anomaly Signal Heuristic](#stationary-anomaly-signal-heuristic)
   - [Strategy A: Rule-Based Weighted Scoring](#strategy-a-rule-based-weighted-scoring)
   - [Strategy B: Machine Learning Logistic Regression](#strategy-b-machine-learning-logistic-regression)
   - [Academic Evaluation Harness & Metrics](#academic-evaluation-harness--metrics)
5. [Multi-Checkpoint Task Verification System](#5-multi-checkpoint-task-verification-system)
   - [Interactive Click-to-Place Checkpoint Canvas](#interactive-click-to-place-checkpoint-canvas)
   - [Spatial Hierarchy & Containment Validation](#spatial-hierarchy--containment-validation)
   - [Anti-Collusion Task Distribution Algorithm](#anti-collusion-task-distribution-algorithm)
   - [Photo Verification Analytics: EXIF & Perceptual Hashing](#photo-verification-analytics-exif--perceptual-hashing)
6. [Defense Cheat Sheet & Quick Q&A](#6-defense-cheat-sheet--quick-qa)

---

## 1. Core System Overview & Architecture

TapIn replaces queue-heavy paper sign-in sheets and easily fooled circular geofences with an exact, browser-based polygon verification and multi-station checkpoint system.

```
                                ┌────────────────────────────────────────┐
                                │         Student Browser / Device       │
                                │  - GPS Telemetry + Accelerometer       │
                                │  - WebAuthn Biometrics / Email OTP     │
                                └───────────────────┬────────────────────┘
                                                    │ HTTPS POST /api/attendance / proximity
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              TapIn Backend (Node.js/Express)                                │
│                                                                                             │
│   ┌────────────────────────────────┐   ┌─────────────────────────────┐   ┌──────────────┐   │
│   │   GPS Spoofing Detection       │   │   Venue Geofencing Engine   │   │  Auth Layer  │   │
│   │   - Speed & Accuracy Checks    │   │   - Haversine Sphere $O(1)$ │   │  - WebAuthn  │   │
│   │   - Accelerometer Motion Checks│   │   - AABB Bounding Box       │   │    Platform  │   │
│   │   - Stationary Anomaly Signal  │   │   - Ray-Casting PIP Exact   │   │  - Email OTP │   │
│   │   (Trust Score 0-100)          │   │     Containment             │   │  - Ed25519   │   │
│   └───────────────┬────────────────┘   └──────────────┬──────────────┘   └───────┬──────┘   │
│                   │                                   │                          │          │
│                   └───────────────────────────────────┼──────────────────────────┘          │
│                                                       ▼                                     │
│                                  Attendance & Checkpoint Evaluation                         │
│                                                       │                                     │
│                                                       ▼                                     │
│                                          SQLite Database (WAL Mode)                         │
│                                                       │                                     │
│                                                       ▼                                     │
│                                       Socket.io Real-Time Broadcast                         │
└───────────────────────────────────────────────────────┬─────────────────────────────────────┘
                                                        │
                                                        ▼
                                         ┌─────────────────────────────┐
                                         │   Admin Live Telemetry UI   │
                                         │   (Leaflet Polygons & Feed) │
                                         └─────────────────────────────┘
```

---

## 2. Ray-Casting Point-in-Polygon (PIP) Algorithm

### The Jordan Curve Theorem & The Parity Rule
The **Jordan Curve Theorem** states that any continuous, non-self-intersecting closed curve (a simple polygon) divides a 2D plane into an **"inside"** interior and an **"outside"** exterior.

To evaluate coordinate point $P = (lat_p, lng_p)$:
1. Cast an eastward horizontal ray from $(lng_p, lat_p) \to (+\infty, lat_p)$.
2. For each edge connecting $v_i = (lat_i, lng_i)$ and $v_j = (lat_j, lng_j)$:
   - **Straddle Condition**: $(lat_i > lat_p) \neq (lat_j > lat_p)$
   - **X-Intersection Longitude**: $x_{\text{int}} = lng_i + \frac{(lat_p - lat_i)(lng_j - lng_i)}{lat_j - lat_i}$
   - If $lng_p < x_{\text{int}}$, increment `crossings`.
3. **Parity Rule**:
   - **ODD crossings (1, 3, 5...)** $\to$ **INSIDE**.
   - **EVEN crossings (0, 2, 4...)** $\to$ **OUTSIDE**.

### Multi-Tier Fast Pre-Filtering Optimization
- **Tier 1 — Haversine Bounding Sphere**: Rejects points with $\text{Haversine}(\text{Centroid}, P) > R_{\max} + 15\text{m}$ in $O(1)$ time.
- **Tier 2 — Axis-Aligned Bounding Box (AABB)**: Discards coordinates outside $[minLat, maxLat] \times [minLng, maxLng]$.
- **Tier 3 — Exact Ray-Casting PIP**: Executed only on points passing Tier 1 & 2.

---

## 3. Authentication Architecture: WebAuthn Platform Biometrics & Email OTP Fallback

### Primary: WebAuthn Native Platform Biometrics
- **Browser-Native Standard**: Leverages the W3C WebAuthn API (`navigator.credentials.create()` and `navigator.credentials.get()`) backed by `@simplewebauthn/server` and `@simplewebauthn/browser`.
- **Platform Enclave Gating**: Configured with `authenticatorAttachment: 'platform'` and `userVerification: 'required'`, tapping directly into **Touch ID, Face ID, Windows Hello, and Android Fingerprint hardware security modules**.
- **Server-Side FIDO2 Flow**:
  1. Student requests enrollment challenge (`POST /api/auth/webauthn/register-options`).
  2. Browser prompts biometric scan, creating a hardware key pair.
  3. Server validates attestation (`POST /api/auth/webauthn/register-verify`), saving the public key, credential ID, and signature counter to `webauthn_credentials`.
  4. On attendance check-in, the student is challenged (`POST /api/auth/webauthn/login-options` $\to$ `navigator.credentials.get()`), and the server verifies signature validity before granting `TIME_IN` or `TIME_OUT`.

### Fallback: University Email OTP with Abuse Protection
- **Automatic Fallback**: Shown when WebAuthn is unavailable (unsupported browser, device without biometric hardware, or kiosk usage).
- **Strict Institutional Email Record**: Destination email is pulled exclusively from the student's verified institutional record (`students.email`, defaulting to `<student_id>@mmsu.edu.ph`) — **non-editable at check-in time**.
- **Abuse & Rate-Limiting Protection**:
  - **Salted SHA-256 Hashing**: 6-digit numeric OTP is stored hashed in SQLite `otp_codes`.
  - **Expiry**: Strict **5-minute time window**.
  - **Single-Use**: Invalidation immediately upon successful attendance recording.
  - **Rate Limiting**: Maximum **3 OTP requests per 10-minute sliding window** per student ID (`HTTP 429`).
  - **Brute-Force Lockout**: Maximum **5 failed verification attempts** per issued code before immediate invalidation.

### Backwards-Compatibility: Portable Ed25519 Signed QR Passes
- For offline checkpoint scans or paper pass presentations, students can generate an asymmetric **Ed25519 key pair** and download/print their **Personal TapIn Credential Pass** containing a verifiable digital signature.

---

## 4. Research Module: Multi-Sensor GPS Spoofing Detection

### The 5 Multi-Sensor Heuristics
1. **Speed Anomaly**: Flags velocities $>15\text{ m/s}$ ($54\text{ km/h}$) between consecutive location updates.
2. **Accuracy Anomaly**: Flags static accuracy values repeated consecutively ($\ge 3$ times) or synthetic precision ($\le 0.2\text{m}$).
3. **Timestamp Irregularity**: Detects retrograded timestamps ($\Delta t < 0$) or synthetic exact intervals.
4. **Sensor Motion Mismatch**: Detects physical displacement ($\Delta d > 15\text{m}$) when phone accelerometer sensors (`DeviceMotionEvent`) report zero linear acceleration.
5. **Stationary Anomaly Signal**: Flags coordinates showing near-zero displacement ($\Delta d \le 1.0\text{m}$) over an active 5+ minute window during an ongoing event.

### Strategy A: Rule-Based Weighted Scoring
$$\text{Trust Score} = \max(0, 100 - \sum \text{penalties})$$
Classification: $\text{Valid} \ge 70$, $\text{Borderline} \in [50, 69]$, $\text{Rejected} < 50$.

### Strategy B: Machine Learning Logistic Regression
Calculates spoofing probability $P(\text{Spoofed})$ using sigmoid function:
$$P(\text{Spoofed}) = \sigma(z) = \frac{1}{1 + e^{-z}}, \quad z = w_0 + \sum_{i=1}^{n} w_i f_i$$
Classification: $P \ge 0.5 \implies \text{Spoofed}$.

---

## 5. Multi-Checkpoint Task Verification System

### Interactive Click-to-Place Checkpoint Canvas
- **Visual Station Placement**: Admins simply click anywhere on the interactive map canvas inside the purple venue polygon to drop Checkpoint Station Pins (`C1`, `C2`, `C3`, up to 3 max).
- **Draggable Catchment Zones**: Station pins can be dragged live to reposition their location and adjust catchment radius ($10\text{m} - 50\text{m}$).
- **Click Node to Configure Tasks**: Clicking any station node directly opens its task pool manager to append photo and text tasks with instant visual feedback.

### Anti-Collusion Task Distribution Algorithm
When a student enters a checkpoint catchment, the server assigns a task from that station's pool:
1. Queries `student_task_assignments` within the configurable `task_collision_window_minutes` (default 10 mins).
2. Excludes tasks recently given to other students to prevent queue crowding and group collusion.
3. Supports admin toggles: `allow_duplicate_tasks` and `randomize_tasks` (uniform random vs. balanced round-robin).

### Photo Verification Analytics: EXIF & Perceptual Hashing
1. **Pure-JS EXIF Extraction**: Parses JPEG APP1 metadata to extract camera capture timestamp and GPS coordinates, cross-checking against checkpoint coordinates ($\Delta d > 100\text{m} \implies \text{EXIF\_LOCATION\_MISMATCH}$).
2. **Perceptual-Hash Duplicate Detection**: Computes a 64-bit Difference Hash (`dHash`) and measures **Hamming Distance** against prior submissions. If $\text{Hamming Distance} \le 5$ ($\ge 92\%$ visual similarity), flags `DUPLICATE_PHOTO_DETECTED` and logs the duplicate source.

---

## 6. Defense Cheat Sheet & Quick Q&A

### Q1: Why did you implement WebAuthn instead of custom biometric handling?
> **Answer**: "WebAuthn is the official W3C and FIDO2 standard supported natively by all modern browsers. It gates authentication behind hardware secure enclaves (Touch ID, Face ID, Windows Hello) using public-key cryptography. Because biometric raw data never leaves the device's hardware chip, it is cryptographically secure and compliant with data privacy laws."

### Q2: What happens if a student uses a device without biometric hardware?
> **Answer**: "TapIn provides an automatic Email One-Time-Passcode (OTP) fallback path. The student enters their Student ID, and the system looks up their official university email on file (non-editable by the client). The server generates a 6-digit cryptographic code valid for 5 minutes. Abuse protection is enforced with strict rate limiting (maximum 3 requests per 10 minutes) and brute-force lockout (maximum 5 attempts)."

### Q3: How do you guarantee the custom polygon geofence does not drift or corrupt?
> **Answer**: "The exact ordered array of `[lat, lng]` coordinate vertices is stored as the single source of truth in SQLite (`events.polygon_coordinates`). The editor, admin live feed, and student view read this exact array and render it directly via Leaflet without any shape regeneration or polygon approximation."

### Q4: How does the system detect fake GPS location apps?
> **Answer**: "TapIn uses a multi-sensor cross-validation engine that evaluates five simultaneous heuristics: velocity limits ($>15\text{ m/s}$), static accuracy repetition, timestamp continuity, accelerometer motion mismatch, and stationary GPS anomaly signals (detecting static software emulators holding coordinates with near-zero movement over 5+ minutes)."
