# 📘 TapIn System Handbook & Technical Knowledge Base (`IMPORTANT.md`)

> **TapIn** is a geofencing-based, real-time university attendance monitoring and analytics system with a standalone **GPS Spoofing-Detection Research Module** and exact **Ray-Casting Point-in-Polygon (PIP)** venue containment.

---

## 📑 Table of Contents
1. [Core System Overview & Architecture](#1-core-system-overview--architecture)
2. [Ray-Casting Point-in-Polygon (PIP) Algorithm](#2-ray-casting-point-in-polygon-pip-algorithm)
   - [The Jordan Curve Theorem & Parity Rule](#the-jordan-curve-theorem--the-parity-rule)
   - [Step-by-Step Mathematical Computation](#step-by-step-mathematical-computation)
   - [Why PIP Over Circular Geofences?](#why-pip-over-circular-geofences)
   - [Boundary & Vertex Collision Handling](#boundary--vertex-collision-handling)
   - [Multi-Tier Fast Pre-Filtering Optimization](#multi-tier-fast-pre-filtering-optimization)
3. [Student Attendance & Verification Lifecycle](#3-student-attendance--verification-lifecycle)
   - [Device Location Capture via Browser API](#device-location-capture-via-browser-api)
   - [Zero-Password Student ID Verification](#zero-password-student-id-verification)
   - [Smart Auto-Action (Time-In vs. Time-Out)](#smart-auto-action-time-in-vs-time-out)
   - [15-Minute Grace Period State Machine](#15-minute-grace-period-state-machine)
4. [Research Module: Dual GPS Spoofing Detection](#4-research-module-dual-gps-spoofing-detection)
   - [Multi-Sensor Telemetry Capture](#multi-sensor-telemetry-capture)
   - [The 4 Multi-Sensor Heuristics](#the-4-multi-sensor-heuristics)
   - [Strategy A: Rule-Based Weighted Scoring](#strategy-a-rule-based-weighted-scoring)
   - [Strategy B: Machine Learning Logistic Regression](#strategy-b-machine-learning-logistic-regression)
   - [Academic Evaluation Harness & Metrics](#academic-evaluation-harness--metrics)
5. [Admin Management & Polygon Map Tracing](#5-admin-management--polygon-map-tracing)
   - [Interactive Leaflet Polygon Editor](#interactive-leaflet-polygon-editor)
   - [Real-Time Telemetry (Socket.io + Polling)](#real-time-telemetry-socketio--polling)
   - [Penalty & Violation Engine](#penalty--violation-engine)
6. [Defense Cheat Sheet & Quick Q&A](#6-defense-cheat-sheet--quick-qa)

---

## 1. Core System Overview & Architecture

TapIn replaces slow, queue-heavy physical attendance sheets and easily fooled circular geofences with an exact, browser-based polygon verification system.

```
                               ┌────────────────────────┐
                               │  Student Device / PWA  │
                               │ (GPS + Accelerometer)  │
                               └───────────┬────────────┘
                                           │ HTTPS POST /api/attendance
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           TapIn Backend (Node.js/Express)                       │
│                                                                                 │
│   ┌─────────────────────────────────┐   ┌───────────────────────────────────┐   │
│   │   GPS Spoofing Detection Engine │   │   Geofencing Engine               │   │
│   │   - Rule-Based Weighted Scorer  │   │   - Tier 1: Haversine Sphere      │   │
│   │   - ML Logistic Regression      │   │   - Tier 2: AABB Bounding Box     │   │
│   │   (Outputs Trust Score 0-100)   │   │   - Tier 3: Ray-Casting PIP Exact │   │
│   └────────────────┬────────────────┘   └─────────────────┬─────────────────┘   │
│                    │                                      │                     │
│                    └──────────────────┬───────────────────┘                     │
│                                       ▼                                         │
│                      Attendance Evaluation & Verification                       │
│                                       │                                         │
│                                       ▼                                         │
│                           SQLite Database (WAL Mode)                            │
│                                       │                                         │
│                                       ▼                                         │
│                      Socket.io Real-Time Broadcast Event                        │
└───────────────────────────────────────┬─────────────────────────────────────────┘
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
The **Jordan Curve Theorem** states that any continuous, non-self-intersecting closed curve (a simple polygon) divides a 2D plane into two distinct regions: an **"inside"** interior and an **"outside"** exterior.

To determine if a user's coordinate point $P = (lat_p, lng_p)$ is inside the venue polygon:
1. An imaginary horizontal ray is cast eastward from the user point $P$ extending towards positive infinity: $(lng_p, lat_p) \to (+\infty, lat_p)$.
2. We count how many polygon boundary line segments this ray intersects (**crossings**).
3. **The Parity Rule**:
   - **ODD number of crossings (1, 3, 5...)** $\to$ **INSIDE** the geofence.
   - **EVEN number of crossings (0, 2, 4...)** $\to$ **OUTSIDE** the geofence.

```
       OUTSIDE (0 crossings)
          * -----------------------------------------------------> (No edge crossed: 0 = EVEN = OUTSIDE)
 
         ┌─────────────────────────┐
         │         INSIDE          │
         │           *─────────────┼─────────────────────────────> (1 edge crossed: 1 = ODD = INSIDE)
         │                         │
         │    ┌───────────────┐    │
         │    │ Concave Void  │    │
         │    │      *────────┼────┼─────────────────────────────> (2 edges crossed: 2 = EVEN = OUTSIDE)
         │    │               │    │
         └────┴───────────────┴────┘
```

---

### Step-by-Step Mathematical Computation

Given point $P = (lat_p, lng_p)$ and an ordered list of $N$ polygon vertices $V = [v_0, v_1, \dots, v_{N-1}]$ where $v_i = (lat_i, lng_i)$:

For each edge connecting vertex $v_i = (lat_1, lng_1)$ to vertex $v_j = (lat_2, lng_2)$ (where $j = (i + 1) \bmod N$):

#### Step 1: Vertical Straddle Test
Check if the horizontal ray at latitude $lat_p$ falls strictly between the latitudes of the edge vertices:
$$(lat_1 > lat_p) \neq (lat_2 > lat_p)$$
*If false, the ray cannot cross this segment; skip to the next edge.*

#### Step 2: Longitudinal Intersection ($x_{\text{int}}$)
Calculate the exact longitude where the line segment crosses the latitude $lat_p$:
$$x_{\text{int}} = lng_1 + \frac{(lat_p - lat_1) \cdot (lng_2 - lng_1)}{lat_2 - lat_1}$$

#### Step 3: Directional Ray Intersection Check
Because the ray is cast **eastward** ($+lng$), if the user is to the left of the intersection:
$$lng_p < x_{\text{int}}$$
Then the ray intersects the edge. Increment `crossings++` and toggle `inside = !inside`.

---

### Why PIP Over Circular Geofences?

| Feature | Circular Radius (Haversine Only) | Ray-Casting Polygon (TapIn PIP) |
| :--- | :--- | :--- |
| **Shape Support** | Fixed circle / radius around a single center point. | Arbitrary $N$-sided convex and concave polygons (L-shapes, U-shapes, quadrangles). |
| **Campus Accuracy** | **Poor**: Clips adjacent buildings across streets, cuts off asymmetric corners of stadiums. | **Exact**: Fits real building footprints, sunken gardens, and sports complexes. |
| **False Positives** | High (students on the highway or in dorms next to the venue get validated). | Near zero (strictly conforms to designated building/court perimeter). |
| **Computation Speed** | $O(1)$ | Multi-tier optimized to run in sub-milliseconds ($< 0.05\text{ ms}$). |

---

### Boundary & Vertex Collision Handling

If a student is standing exactly on the boundary edge or on a vertex pin:
1. **Collinearity Test**: The cross product between vectors $(P - v_1)$ and $(v_2 - v_1)$ is tested within an epsilon tolerance $\epsilon = 10^{-7}$:
   $$|(lat_p - lat_1)(lng_2 - lng_1) - (lng_p - lng_1)(lat_2 - lat_1)| \le 10^{-7}$$
2. **Bounding Interval**: $lat_p \in [\min(lat_1, lat_2), \max(lat_1, lat_2)]$ and $lng_p \in [\min(lng_1, lng_2), \max(lng_1, lng_2)]$.
3. **Classification**: Points on the line or vertex are immediately classified as **Inside Geofence** (`onBoundary: true`).

---

### Multi-Tier Fast Pre-Filtering Optimization

To eliminate unneeded computations for students far from campus, TapIn runs a **3-Tier Cascade Filter**:

1. **Tier 1 — Haversine Bounding Sphere ($O(1)$)**:
   - Computes polygon centroid $(\overline{lat}, \overline{lng})$ and max vertex radius $R_{\max}$.
   - If $\text{Haversine}(\text{User}, \text{Centroid}) > R_{\max} + 15\text{m}$, instantly reject (`preFiltered: 'HAVERSINE_SPHERE'`).
2. **Tier 2 — Axis-Aligned Bounding Box (AABB) ($O(1)$)**:
   - Computes $[minLat, maxLat] \times [minLng, maxLng]$ with a margin.
   - If coordinates fall outside the box, instantly reject (`preFiltered: 'AABB_BOUNDING_BOX'`).
3. **Tier 3 — Exact Ray-Casting PIP ($O(N)$)**:
   - Executed only on candidate points that passed Tier 1 and Tier 2.

---

## 3. Student Attendance & Verification Lifecycle

```
[Student Enters ID & Selects Active Event]
                 │
                 ▼
[Browser Requests Geolocation & Motion Sensors]
                 │
                 ├── Permission Denied ──► [Show Native Location Guide Modal]
                 │
                 ▼ (Permission Granted)
[Client-Side Real-Time PIP Preview on Radar Map]
                 │
                 ▼
[Click "Submit Time In" / "Submit Time Out"]
                 │
                 ▼
[Server: Tier-1 & 2 Pre-Filters -> Tier-3 Ray-Casting PIP]
                 │
                 ├── Outside Polygon ────► [Start 15-Min Grace Period Countdown]
                 │
                 ▼ (Inside Polygon)
[Server: GPS Anti-Spoofing Evaluator (Trust Score 0-100)]
                 │
                 ├── Spoofing Detected ──► [Flag Log as Rejected / Borderline + Anomaly Badges]
                 │
                 ▼ (Trust Score >= 60)
[Attendance Recorded in DB -> Broadcast Live to Admin via Socket.io]
```

### Key Rules:
- **Zero Login Friction**: Students do not need passwords or account registration; they type their official Student ID (validated against the institution's imported CSV roster).
- **Auto-Action Detection**: The system checks previous logs for the active event. If no `TIME_IN` exists, it initiates Time-In. If already timed in, it initiates `TIME_OUT`.
- **15-Minute Grace Period**:
  - If a student temporarily steps outside the venue polygon, a 15-minute grace period timer activates.
  - If the student returns inside before 15 minutes, the timer resets.
  - If the student fails to return, the violation engine flags `"Exceeded allowed time outside event polygon geofence"`.

---

## 4. Research Module: Dual GPS Spoofing Detection

TapIn incorporates a standalone research module located in `server/services/spoofDetection/` to detect mock location apps, fake GPS scripts, and automated emulator attacks.

### Multi-Sensor Telemetry Capture
When attendance is submitted, the browser sends:
1. `latitude`, `longitude` (WGS-84 coordinates)
2. `accuracy` (in meters, from browser `GeolocationCoordinates.accuracy`)
3. `timestamp` (millisecond UNIX epoch timestamp)
4. `accelerometer` (tri-axial linear acceleration magnitude $|a| = \sqrt{x^2 + y^2 + z^2}$ from `DeviceMotionEvent`)

---

### The 4 Multi-Sensor Heuristics

| Heuristic Check | Anomaly Condition | Triggered Flag |
| :--- | :--- | :--- |
| **1. Implausible Speed** | Speed $> 15\text{ m/s}$ ($54\text{ km/h}$) or teleport ($\Delta t \le 0\text{ s}, \Delta d > 5\text{ m}$) | `IMPLAUSIBLE_SPEED` |
| **2. Accuracy Anomaly** | Accuracy $\le 0.2\text{ m}$ (fake web precision) OR static identical accuracy across $\ge 3$ consecutive logs | `STATIC_ACCURACY_PATTERN`, `ACCURACY_TOO_LOW` |
| **3. Timestamp Irregularity** | Timestamp precedes previous log OR exact $1000\text{ ms}$ cadence | `TIMESTAMP_OUT_OF_ORDER` |
| **4. Sensor Motion Mismatch** | Position moves $> 3\text{ m/s}$ while accelerometer is stationary ($|a| \approx 9.81\text{ m/s}^2$ with variance $< 0.08$) | `SENSOR_MOTION_MISMATCH` |

---

### Strategy A: Rule-Based Weighted Scoring
- Starts at a baseline **100 Trust Score**.
- Deducts weighted penalty points per heuristic violation.
- If **Trust Score < 60** or critical flags fire $\to$ **Classified as Spoofed**.

### Strategy B: Machine Learning Logistic Regression
- Extracts a 5-dimensional normalized feature vector:
  $$\mathbf{x} = [f_{\text{speed}}, f_{\text{accLow}}, f_{\text{staticAcc}}, f_{\text{timestamp}}, f_{\text{motion}}]$$
- Computes logit $z$ using calibrated empirical weights:
  $$z = w_0 + \sum_{i=1}^5 w_i x_i = -2.85 + 0.42 x_1 + 2.80 x_2 + 2.15 x_3 + 2.65 x_4 + 2.40 x_5$$
- Computes spoof probability via Sigmoid activation:
  $$P(\text{spoof}) = \sigma(z) = \frac{1}{1 + e^{-z}}$$
- If $P(\text{spoof}) \ge 0.50 \to$ **Classified as Spoofed** (Trust Score $= \operatorname{round}((1 - P) \times 100)$).

---

### Academic Evaluation Harness & Metrics
TapIn includes an automated CLI evaluation tool (`server/scripts/evalSpoofDetector.js`) to test both strategies against labeled datasets:

```bash
# Run Rule-Based Evaluation
npm run eval:rule

# Run Machine Learning Evaluation
npm run eval:ml
```

**Calculated Academic Metrics**:
- **Accuracy**: $\frac{TP + TN}{TP + FP + TN + FN}$
- **Precision**: $\frac{TP}{TP + FP}$
- **Recall (Sensitivity)**: $\frac{TP}{TP + FN}$
- **Specificity (True Negative Rate)**: $\frac{TN}{TN + FP}$
- **False Positive Rate (FPR)**: $\frac{FP}{TN + FP}$
- **F1-Score**: $2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$

---

## 5. Admin Management & Polygon Map Tracing

### Interactive Leaflet Polygon Editor
- **Click to Place**: Admins click anywhere on the Leaflet satellite map to append polygon vertices.
- **Draggable Glowing Handles**: Each vertex (#1, #2, #3...) has an interactive handle that can be dragged in real time to reshape boundaries.
- **Preset Shapes**: 1-click apply presets for **MMSU Sunken Garden Quadrangle**, **Teatro Ilocandia Oval**, or a **Regular Hexagon**.
- **Undo & Clear**: Step-by-step vertex undo and total reset controls.

### Real-Time Telemetry & Scalability
- **Dual Live Sync**: Socket.io push events (`attendance_updated`) paired with a 5-second background polling fallback guarantee zero missed updates.
- **High Concurrency**: Database indexes on `(event_id, student_id)`, `(event_id, timestamp)`, and SQLite WAL mode enable concurrent reading during peak morning time-in rushes.

---

## 6. Quick Q&A

### ❓ Q1: How does the Ray-Casting algorithm determine if a student is inside the geofence?
> **Answer**: It is based on the **Jordan Curve Theorem**. An eastward horizontal ray is projected from the student's GPS coordinate $(lng, lat)$ to $(+\infty, lat)$. The algorithm iterates through every edge of the venue polygon and counts how many times the ray intersects an edge. If the intersection count is **ODD**, the student is **INSIDE**; if it is **EVEN**, the student is **OUTSIDE**.

### ❓ Q2: Why did you replace circular geofencing with polygon geofencing?
> **Answer**: Real university venues (quadrangles, sports ovals, auditoriums, academic halls) have irregular non-circular perimeters. A circular radius creates **false positives** (including students outside the venue across roads or in dorms) and **false negatives** (excluding corners of large halls). Polygons conform precisely to real building footprints.

### ❓ Q3: How do you prevent ray-casting from slowing down the server when hundreds of students tap in?
> **Answer**: We implemented a **Multi-Tier Cascade Filter**:
> 1. **Haversine Bounding Sphere ($O(1)$)** rejects distant coordinates immediately.
> 2. **Axis-Aligned Bounding Box ($O(1)$)** discards points outside latitude/longitude limits.
> 3. **Exact Ray-Casting ($O(N)$)** only runs on points near the boundary, completing in sub-milliseconds.

### ❓ Q4: How does the system detect fake GPS location apps?
> **Answer**: Through **multi-sensor cross-validation**. Fake GPS apps change coordinates without moving physical device sensors. TapIn cross-checks GPS speed ($>15\text{ m/s}$ teleportation), static/unrealistic accuracy ($0.1\text{ m}$ fake precision), timestamp sequencing, and device accelerometer readings ($|a| \approx 9.81\text{ m/s}^2$ with no motion while traveling $>3\text{ m/s}$).

### ❓ Q5: What is the 15-Minute Grace Period?
> **Answer**: If a verified student temporarily exits the venue polygon boundary (e.g., restroom break or brief errand), a 15-minute countdown starts. If they return within 15 minutes, the timer resets. If they exceed 15 minutes, their attendance record is flagged for an attendance penalty violation.
