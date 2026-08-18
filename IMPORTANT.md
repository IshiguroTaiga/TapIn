# 📘 TapIn System Handbook & Technical Knowledge Base (`IMPORTANT.md`)

> **TapIn** is a geofencing-based, real-time university attendance monitoring and analytics system with a standalone **GPS Spoofing-Detection Research Module**, exact **Ray-Casting Point-in-Polygon (PIP)** venue containment, **Ed25519 Asymmetric Cryptographic Authentication**, and a **Multi-Checkpoint Task Verification System**.

---

## 📑 Table of Contents
1. [Core System Overview & Architecture](#1-core-system-overview--architecture)
2. [Ray-Casting Point-in-Polygon (PIP) Algorithm](#2-ray-casting-point-in-polygon-pip-algorithm)
   - [The Jordan Curve Theorem & Parity Rule](#the-jordan-curve-theorem--the-parity-rule)
   - [Step-by-Step Mathematical Computation](#step-by-step-mathematical-computation)
   - [Multi-Tier Fast Pre-Filtering Optimization](#multi-tier-fast-pre-filtering-optimization)
3. [Cryptographic Credential Authentication (Ed25519)](#3-cryptographic-credential-authentication-ed25519)
   - [Why Signed Credentials Over Device Biometrics?](#why-signed-credentials-over-device-biometrics)
   - [Asymmetric Key Pair Generation & Enrollment](#asymmetric-key-pair-generation--enrollment)
   - [Server-Side Signature Audit Lifecycle](#server-side-signature-audit-lifecycle)
4. [Research Module: Multi-Sensor GPS Spoofing Detection](#4-research-module-multi-sensor-gps-spoofing-detection)
   - [The 5 Multi-Sensor Heuristics](#the-5-multi-sensor-heuristics)
   - [Stationary Anomaly Signal Heuristic](#stationary-anomaly-signal-heuristic)
   - [Strategy A: Rule-Based Weighted Scoring](#strategy-a-rule-based-weighted-scoring)
   - [Strategy B: Machine Learning Logistic Regression](#strategy-b-machine-learning-logistic-regression)
   - [Academic Evaluation Harness & Metrics](#academic-evaluation-harness--metrics)
5. [Multi-Checkpoint Task Verification System](#5-multi-checkpoint-task-verification-system)
   - [Spatial Hierarchy & Containment Validation](#spatial-hierarchy--containment-validation)
   - [Anti-Collusion Task Distribution Algorithm](#anti-collusion-task-distribution-algorithm)
   - [Photo Verification Analytics: EXIF & Perceptual Hashing](#photo-verification-analytics-exif--perceptual-hashing)
6. [Defense Cheat Sheet & Quick Q&A](#6-defense-cheat-sheet--quick-qa)

---

## 1. Core System Overview & Architecture

TapIn replaces queue-heavy paper sign-in sheets and easily fooled circular geofences with an exact, browser-based polygon verification and multi-station checkpoint system.

```
                                ┌────────────────────────────────────────┐
                                │          Student Device / Pass         │
                                │  - GPS Telemetry + Accelerometer       │
                                │  - Ed25519 Private Key / Signed Token  │
                                └───────────────────┬────────────────────┘
                                                    │ HTTPS POST /api/attendance / proximity
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              TapIn Backend (Node.js/Express)                                │
│                                                                                             │
│   ┌────────────────────────────────┐   ┌─────────────────────────────┐   ┌──────────────┐   │
│   │   GPS Spoofing Detection       │   │   Venue Geofencing Engine   │   │  Crypto Auth │   │
│   │   - Speed & Accuracy Checks    │   │   - Haversine Sphere $O(1)$ │   │  - Ed25519   │   │
│   │   - Accelerometer Motion Mismatch│ │   - AABB Bounding Box       │   │    Public Key│   │
│   │   - Stationary Anomaly Signal  │   │   - Ray-Casting PIP Exact   │   │    Signature │   │
│   │   (Trust Score 0-100)          │   │     Containment             │   │    Audit     │   │
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

## 3. Cryptographic Credential Authentication (Ed25519)

### Why Signed Credentials Over Device Biometrics?
1. **No Hardware Lock-In**: Biometrics on consumer phones (TouchID/FaceID) only authenticate that *some* registered finger unlocked *that* physical device. It fails when one student carries multiple devices (proxy attendance) or when using kiosks/borrowed phones.
2. **Mathematical Non-Repudiation**: Ed25519 asymmetric cryptography binds the check-in to the student's registered credential.
3. **High Performance**: 32-byte public keys and 64-byte signatures execute in $<0.1\text{ms}$ with zero native binary bloat.

### Key Lifecycle & Verification
- **Enrollment**: Student generates an Ed25519 keypair during one-time onboarding. The public key is saved in SQLite `students.public_key`.
- **Portability**: The private key is saved in local browser storage and exported as a **Personal TapIn Credential Pass** (signed QR token and JSON file).
- **Audit**: Every attendance submission presents a signature over $\{student\_id, event\_id, timestamp, lat, lng\}$ verified via `crypto.verify()`.

---

## 4. Research Module: Multi-Sensor GPS Spoofing Detection

### The 5 Multi-Sensor Heuristics
1. **Implausible Speed**: Speed $> 15\text{ m/s}$ ($54\text{ km/h}$) or teleportation ($\Delta t \le 0\text{s}$ with $\Delta d > 5\text{m}$). Penalty: up to $-50$.
2. **Accuracy Anomaly**: Precision $\le 0.2\text{m}$ (unrealistically exact) or identical static accuracy across $\ge 3$ consecutive traces. Penalty: $-30$ to $-35$.
3. **Timestamp Irregularity**: Out-of-order timestamps or synthetic $1000\text{ms}$ cadence. Penalty: $-20$ to $-40$.
4. **Sensor Motion Mismatch**: Reported position changes $>3\text{ m/s}$ while device accelerometer detects zero linear acceleration ($|\sqrt{x^2+y^2+z^2} - 9.81| < 0.08\text{ m/s}^2$). Penalty: $-35$.
5. **Stationary Anomaly Signal**: Consecutive GPS updates showing near-zero displacement ($\Delta d \le \text{threshold}$) over an active window ($T \ge \text{window}$, default 5 mins). Penalty: $-35$.

### Academic Evaluation Harness
Run CLI benchmarks across labeled traces:
```bash
npm run eval:rule    # Rule-Based Weighted Scoring Strategy
npm run eval:ml      # Machine Learning Logistic Regression Strategy
```
Computes complete thesis metrics: Accuracy, Precision, Recall, Specificity, FPR, and F1 Score.

---

## 5. Multi-Checkpoint Task Verification System

### Spatial Hierarchy & Containment
- Admins configure up to 3 checkpoints per event (e.g., *Registration Booth*, *Plenary Hall*, *Exhibit Area*).
- Checkpoint centers $(lat_c, lng_c)$ are validated inside the venue polygon via Ray-Casting PIP before saving.
- Checkpoint catchments use spherical circular radii ($15\text{m} - 30\text{m}$) for $O(1)$ stability.

### Anti-Collusion Task Distribution Algorithm
- When a student enters a checkpoint radius, the engine queries the active task pool.
- **Collision Window Filter**: Excludes tasks assigned to other students in the last $N$ minutes (`task_collision_window_minutes`, default: 10 mins).
- **Admin Toggles**:
  - `allow_duplicate_tasks`: Permits duplicates if enabled.
  - `randomize_tasks`: Uniform random pick ($1$) vs deterministic balanced round-robin ($0$).

### Photo Verification Analytics
- **EXIF Extraction**: Pure JS binary parser extracts capture timestamp and GPS metadata; cross-checks against station coordinates ($\Delta d > 100\text{m} \rightarrow \text{FLAG}$) and time ($\Delta t > 24\text{h} \rightarrow \text{FLAG}$).
- **Perceptual Hash Duplicate Detection**: Computes a 64-bit Difference Hash (`dHash`) and measures **Hamming Distance** against all prior student submissions. If $\text{Hamming Distance} \le 5$ ($\ge 92\%$ visual match), flags `DUPLICATE_PHOTO_DETECTED`.

---

## 6. Defense Cheat Sheet & Quick Q&A

### Q1: Why did you replace device biometrics with signed credentials?
> "Device biometrics only prove that someone unlocked a specific phone hardware secure element; it does not solve proxy attendance where a student carries three phones to class. Ed25519 signed credentials mathematically bind attendance payloads to the student's unique enrolled public key. It works portably across personal devices, borrowed phones, and scanning kiosks without hardware dependency."

### Q2: Why use circular radius checks for checkpoints if the event venue uses Ray-Casting PIP?
> "The outer event venue spans hundreds of meters with complex, non-convex boundaries (quadrangles, amphitheaters, sports complexes) where circular geofences bleed across streets or omit corners. Checkpoints, however, are small physical stations ($15\text{m} - 30\text{m}$) where a spherical Haversine radius executes in $O(1)$ constant time with zero vertex-straddle edge cases."

### Q3: What is the purpose of the Stationary Anomaly Signal?
> "Genuine phone GPS receivers exhibit natural multipath fluctuations of 1–5 meters due to atmospheric noise and micro-movements. Emulators and static fake GPS scripts inject identical fixed coordinates. The stationary anomaly signal flags updates with near-zero displacement over an active 5+ minute window during an event."

### Q4: How does the system prevent students from sharing task photos?
> "When a student submits a task photo, TapIn extracts EXIF geolocation metadata to verify it was captured at the checkpoint station, and computes a 64-bit Perceptual Hash (dHash) to measure Hamming Distance against all prior event submissions. Identical or near-identical photos ($\ge 92\%$ similarity) are flagged as duplicate submissions."
