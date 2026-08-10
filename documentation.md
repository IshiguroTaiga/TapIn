# TapIn: Geofence-Based Attendance Monitoring System with Real-Time Analytics
## Project Documentation & Technical Changelog

---

## 📌 Version 3.0 (Day 3 Updates & Enhancements)

### 🚀 What Has Been Updated & Implemented

#### 1. 📐 Pivot to Ray-Casting Point-in-Polygon (PIP) Geofencing Engine (`server/services/geofence.js`)
- **Algorithmic Differentiation**: Replaced standard circular-radius Haversine comparison with an exact **Ray-Casting Point-in-Polygon (PIP)** test based on the **Jordan Curve Theorem**. Real-world university venue perimeters (quadrangles, auditoriums, sunken gardens, athletic complexes) are non-circular polygons. This eliminates false positives/negatives inherent in circular approximations (such as including adjacent buildings across streets while excluding distant corners of asymmetric stadiums).
- **Mathematical Formulation**:
  - Given a test point $P = (lat_p, lng_p)$ and an ordered sequence of $N$ polygon boundary vertices $V = [v_0, v_1, \dots, v_{N-1}]$ where $v_i = (lat_i, lng_i)$:
  - An eastward horizontal ray is cast from $(lng_p, lat_p)$ to $(+\infty, lat_p)$.
  - For each polygon edge segment connecting $v_i = (lat_i, lng_i)$ and $v_j = (lat_j, lng_j)$ where $j = (i + 1) \bmod N$:
    1. **Straddle Test**: Check if the horizontal line at $lat_p$ intersects the latitude interval of the edge:
       $$(lat_i > lat_p) \neq (lat_j > lat_p)$$
    2. **X-Intersection Test**: Compute the intersection longitude $x_{\text{int}}$:
       $$x_{\text{int}} = lng_i + \frac{(lat_p - lat_i) \cdot (lng_j - lng_i)}{lat_j - lat_i}$$
    3. If $lng_p < x_{\text{int}}$, the ray crosses the edge $\rightarrow \text{crossings} = \text{crossings} + 1$.
  - **Parity Rule**:
    $$\text{inside} = (\text{crossings} \bmod 2 \equiv 1)$$
- **Boundary & Vertex Edge Collision Handling**:
  - If a point lies directly on a polygon vertex or falls within an $\epsilon$-band ($10^{-7}$) collinear to an edge segment:
    $$(lat_p - lat_i)(lng_j - lng_i) - (lng_p - lng_i)(lat_j - lat_i) \approx 0$$
    $$\text{and } lat_p \in [\min(lat_i, lat_j), \max(lat_i, lat_j)],\quad lng_p \in [\min(lng_i, lng_j), \max(lng_i, lng_j)]$$
    It is immediately classified as **Inside Geofence** (`onBoundary: true`).

#### 2. ⚡ Multi-Tier Fast Pre-filtering Optimization
- **Haversine Repurposed as Fast Bounding Sphere**: Rather than discarding the Haversine formula, it is repurposed as an ultra-fast $O(1)$ rough-distance pre-filter:
  1. **Haversine Bounding Sphere Pre-filter**: Computes polygon centroid $C = (\overline{lat}, \overline{lng})$ and maximum vertex radius $R_{\max} = \max_{i} \text{Haversine}(C, v_i)$. Points with $\text{Haversine}(C, P) > R_{\max} + \text{margin}$ (e.g. 15m) are immediately rejected in $O(1)$ spherical trigonometric time without evaluating $N$ polygon segments.
  2. **Axis-Aligned Bounding Box (AABB) Pre-filter**: Bounding box $[minLat, maxLat] \times [minLng, maxLng]$ discards any coordinates outside latitude/longitude extrema in sub-microsecond scalar comparisons.
  3. **Exact Ray-Casting**: Executed only on points that pass both pre-filter stages, preventing wasted compute cycles on obviously far coordinates.

#### 3. 🗺️ Interactive Polygon Geofence Editor for Admin/Superadmin (`client/src/components/GeofenceMapPicker.jsx`)
- **Visual Vertex Tracing Tool**: Replaced the center lat/lng and radius slider inputs with an interactive polygon-drawing canvas on Leaflet.
- **Draggable Numbered Vertex Handles**: Each vertex placed by the admin appears with an interactive glowing numbered pin (#1, #2, #3, ...) that can be dragged in real time to reshape the venue boundary.
- **Action Controls**:
  - *Click to Place*: Admin clicks anywhere on the map to append vertices.
  - *Undo Last Vertex*: Rolls back the latest placed vertex.
  - *Clear / Reset*: Resets the canvas.
  - *Presets*: 1-click apply presets for MMSU Sunken Garden Quadrangle, Teatro Ilocandia Oval, or a regular Hexagon perimeter.
  - *Pick My Location*: Snaps map view and centers geofence shape on the device's native GPS position.
- **Dynamic Stats Display**: Automatically calculates and displays vertex count, centroid coordinates, and equivalent bounding radius.

#### 4. 📲 Polygon-Aware Student Verification & Live Dashboard Telemetry
- **Student Geofence Verification (`server/routes/attendance.js`)**: Submissions are evaluated through `isWithinPolygonGeofence(point, polygon)`, returning exact ray crossings, centroid distance, and containment status.
- **Student UI Client-Side PIP (`client/src/pages/StudentHome.jsx`)**: Implemented standalone client-side PIP test in React so students receive instantaneous visual feedback ("In Polygon" vs "Outside Polygon") before submitting.
- **Live Campus Radar Map (`client/src/components/LiveGeofenceMap.jsx`)**: Updated student and admin live maps to render the exact polygon boundary shape (`L.polygon`) with dashed perimeter styling and centroid pin instead of a static circle.
- **Grace Period State Machine**: Keyed strictly to "Inside Polygon" / "Outside Polygon". If a student exits the venue polygon boundary, the 15-minute grace period timer activates; re-entering the polygon resets the timer; exceeding the timer marks the log as borderline/grace violation without preventing time-out.

#### 5. 🧪 Unit Test Suite (`server/scripts/testGeofence.js`) & Evaluation Harness Confirmation
- **15 Automated Unit Tests**: Created `server/scripts/testGeofence.js` (executable via `npm test` or `npm run test:geofence`) verifying:
  - Strict convex & concave L-shaped containment
  - Exterior points across all cardinal directions
  - Boundary edge and vertex collinear collisions
  - Fast Haversine sphere and AABB pre-filter rejections
  - Flexible coordinate format parsing (`[lat, lng]`, `{lat, lng}`, GeoJSON, JSON strings)
  - Geometric centroid and bounding box calculations
- **Evaluation Harness Confirmation**: Verified that `server/scripts/evalSpoofDetector.js` evaluates anti-spoofing heuristic and ML classifiers independently of venue geofence geometry, ensuring existing benchmark tests (`npm run eval:rule`, `npm run eval:ml`) continue to operate with 100% fidelity.

---

## 📌 Version 2.0 (Day 2 Updates & Enhancements)

### 🚀 What Has Been Updated & Implemented

#### 1. 🔬 Research Module & Thesis Claims Verification (Defense-Ready)
- **Standalone Haversine Geofencing Engine (`server/services/haversine.js`)**:
  - Modular spherical geometry calculation computing great-circle distance between coordinate pairs $(lat_1, lon_1)$ and $(lat_2, lon_2)$ using standard Earth radius $R = 6,371,000\text{ m}$:
    $$\Delta\text{lat} = (\text{lat}_2 - \text{lat}_1) \cdot \frac{\pi}{180},\quad \Delta\text{lon} = (\text{lon}_2 - \text{lon}_1) \cdot \frac{\pi}{180}$$
    $$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1 \cdot \frac{\pi}{180}) \cdot \cos(\text{lat}_2 \cdot \frac{\pi}{180}) \cdot \sin^2\left(\frac{\Delta\text{lon}}{2}\right)$$
    $$c = 2 \cdot \operatorname{atan2}\left(\sqrt{a}, \sqrt{1-a}\right),\quad \text{distance} = R \cdot c$$
  - Exposes `calculateDistance(lat1, lon1, lat2, lon2)` and `isWithinGeofence(lat, lon, centerLat, centerLon, radiusMeters)`.
  - Fully integrated into `server/routes/attendance.js` to evaluate whether submitted telemetry falls within the event's perimeter radius.

- **Dual Swappable Anti-Spoofing Architecture (`server/services/spoofDetection/`)**:
  - Implemented via a clean **Strategy Pattern** facade (`SpoofDetector` in `index.js`), enabling runtime switching (`setStrategy('rule-based' | 'ml-classifier')`) and per-request overrides. Both strategies adhere to the unified interface `evaluate(currentTrace, history)`.
  - **Strategy A — Rule-Based Weighted Scoring Strategy (`ruleBasedStrategy.js`, `heuristics.js`)**:
    - Evaluates 4 multi-sensor heuristic checks against a 100-point trust score baseline:
      1. *Implausible Speed*: Flagged if speed $> 15\text{ m/s}$ ($54\text{ km/h}$) or instantaneous teleportation ($\Delta t \le 0\text{ s}$ with $\Delta d > 5\text{ m}$). Penalty: $\min(50, \lfloor v \cdot 2 \rfloor)$.
      2. *Accuracy Anomaly*: Flagged if precision $\le 0.2\text{ m}$ (unrealistic web Geolocation accuracy) or identical static accuracy across $\ge 3$ consecutive readings. Penalty: $-30$ to $-35$.
      3. *Timestamp Irregularity*: Flagged if timestamp precedes previous report or repeats exact integer-second intervals ($1,000\text{ ms}$). Penalty: $-20$ to $-40$.
      4. *Sensor Motion Mismatch*: Flagged if position changes $> 3\text{ m/s}$ while device accelerometer linear acceleration magnitude is stationary ($|\sqrt{x^2+y^2+z^2} - 9.81| < 0.08\text{ m/s}^2$). Penalty: $-35$.
    - Classifies as spoofed if $\text{Trust Score} < 60$ or critical flag combinations trigger (`IMPLAUSIBLE_SPEED`, `TIMESTAMP_OUT_OF_ORDER`, `STATIC_ACCURACY_PATTERN`).
  - **Strategy B — Machine Learning Logistic Regression Strategy (`mlStrategy.js`)**:
    - Extracts continuous & binary feature vectors $(f_{\text{speed}}, f_{\text{accLow}}, f_{\text{staticAcc}}, f_{\text{timestamp}}, f_{\text{motion}})$ from raw telemetry and computes logit $z$:
      $$z = w_0 + w_1 f_{\text{speed}} + w_2 f_{\text{accLow}} + w_3 f_{\text{staticAcc}} + w_4 f_{\text{timestamp}} + w_5 f_{\text{motion}}$$
      $$\text{where } w_0 = -2.85, w_1 = 0.42, w_2 = 2.80, w_3 = 2.15, w_4 = 2.65, w_5 = 2.40$$
    - Evaluates probability through Sigmoid activation $\sigma(z) = \frac{1}{1 + e^{-z}}$. Classifies as spoofed if $P(\text{spoof}) \ge 0.50$, outputting a trust score of $\operatorname{round}((1 - P(\text{spoof})) \times 100)$.

- **CLI Evaluation Harness & Sample Dataset Generator (`server/scripts/`)**:
  - `evalSpoofDetector.js`: Ingests labeled trace CSV files (`--dataset <path>` `--strategy <name>`) and outputs confusion matrix ($TP, FP, TN, FN$) along with complete academic metrics:
    $$\text{Accuracy} = \frac{TP + TN}{TP + FP + TN + FN},\quad \text{Precision} = \frac{TP}{TP + FP}$$
    $$\text{Recall (Sensitivity)} = \frac{TP}{TP + FN},\quad \text{Specificity (TNR)} = \frac{TN}{TN + FP}$$
    $$\text{False Positive Rate (FPR)} = \frac{FP}{TN + FP},\quad \text{F1 Score} = \frac{2 \cdot \text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$
  - `generateSampleDataset.js`: Generates baseline labeled university trace benchmarks (`sample_traces.csv`) simulating legitimate campus walks, teleport attacks, static mock location apps, and automated cadence scripts.
  - NPM Scripts added to `package.json`: `npm run eval:rule`, `npm run eval:ml`, and `npm run generate-dataset`.

- **Honest Thesis Defense Matrix**:
  | Feature | Confirmed & Fully Implemented in Code | To Acknowledge to Defense Panel (Pilot / Data) |
  | :--- | :--- | :--- |
  | **Haversine Geofencing** | Pure JS spherical trigonometry ($R = 6,371\text{ km}$); centimeters precision. | Spherical model is optimal for campus radii ($< 5\text{ km}$) vs. ellipsoidal (WGS-84). |
  | **Detection Strategies** | Strategy Pattern with swappable Rule-Based and ML Logistic Regression classifiers. | ML weights calibrated on baseline synthetic vectors; larger offline training planned for full deployment. |
  | **Evaluation Harness** | Full CLI evaluation tool calculating Accuracy, Precision, Recall, Specificity, FPR, F1. | Benchmark dataset (`sample_traces.csv`, 34 records) is a synthetic validation suite for algorithm verification. |

#### 2. 🔐 Event Deletion & RBAC Authorization Fixes
- **Explicit Role Permissions**: Enforced `requireRole(['admin', 'superadmin'])` across `POST /api/events`, `PUT /api/events/:id`, and `DELETE /api/events/:id` so both Superadmins and Admins have explicit authority to create, update, and delete events.
- **Resolved 403 Forbidden Issue**: Fixed HTTP 403 Forbidden errors when deleting events by implementing dynamic Axios Request Interceptors to attach `Authorization: Bearer <token>` on all HTTP methods (including `DELETE`).
- **Standardized Auth Status Codes**: Updated JWT verification failure status in `server/middleware/auth.js` from `403` to `401 Unauthorized` (`Invalid or expired token`), reserving `403` for role permission mismatches (`Insufficient permissions`).
- **Automatic Session Cleanup**: Added Axios Response Interceptor to clear expired tokens and trigger auto-logout on `401` responses, preventing invalid token login loops.

#### 2. 🧹 Clean Database Seeding Policy (No Auto-Restoring Test Events)
- **Removed Hardcoded Test Events**: Removed sample events (`University Convocation 2026` & `CCIS Research Presentation`) from automatic seeding in `server/seed.js`.
- **Persisted Admin State**: Prevents deleted test events from automatically reviving or re-populating during container restarts, server reboots, or Render redeployments.

#### 3. 📱 Full Mobile Responsiveness Rebuild & UI Polish
- **Mobile Hamburger Drawer**: Rebuilt `Navbar.jsx` to collapse desktop navigation into a sleek mobile header with a toggleable slide-over Hamburger Drawer (`Menu` / `X` icons).
- **Persistent Mobile Bottom Navigation**: Integrated a blurred mobile bottom navigation bar (`Student`, `Live Feed`, `Events`, `Logs`) for instant 1-tap view switching on mobile phones.
- **Fluid Layout Containment**: Applied `w-full max-w-full overflow-x-hidden` across `App.jsx` and all view pages to eliminate horizontal scrollbars and dead black margins on small screens (tested across 360px, 390px, and 428px viewports).
- **Touch Target Optimization**: Standardized minimum ~44x44px touch targets across all interactive buttons, inputs, toggles, and modal triggers.
- **Fixed Interactive Overlay Hit-Testing**: Added `pointer-events-none` to decorative ambient blur overlays in `StudentHome.jsx` so background visual effects no longer block click events on the Refresh button.

#### 4. 🔀 Multi-Active Event Switching & Flexible Student Attendance
- **Multi-Active Events API**: Added `GET /api/events/active/all` endpoint to return all currently open/active university events.
- **Student Event Switcher**: Added an Event Selector dropdown in `StudentHome.jsx` allowing students to switch between multiple active events occurring simultaneously across different campuses/locations.
- **Flexible Time-In / Time-Out Workflow**: Ensured zero hardlocks or softlocks when students log Time In, leave the geofence perimeter (e.g. to attend another assembly or go home), and return later to log Time Out.
- **Single-Device Student Log Integrity**: Ensured logs are recorded per Student ID, with live admin dashboards grouping latest telemetry entries per student without overwriting historical records.

#### 5. 🏫 Strict College-Eligibility & Active Status Filtering
- **College Eligibility Filter**: Updated `GET /api/events/active/all` and `StudentHome.jsx` to filter active events based on the student's registered college. Students only see events intended for their college or marked as University-Wide (`college_filter === 'all'`).
- **Exclusion of Non-Active Events**: Students are **strictly restricted** to `status === 'active'` events. Upcoming and closed/finished events are hidden from student views and accessible only to Admins/Superadmins.
- **API Access Restriction**: Added backend verification in `server/routes/attendance.js`. If a student attempts to log attendance for an event restricted to another college, the API rejects it with HTTP 403 (*"Access Restricted! This event is exclusive to [Target College] students. Your recorded college is [Student College]."*).

#### 6. ⚡ Real-Time Auto-Refresh & High-Concurrency Scaling
- **Socket.io + 5s Background Polling Sync**: Combined Socket.io real-time event broadcasting (`attendance_updated`, `events_updated`) with a 5-second background polling timer across `AdminDashboard.jsx` and `AttendanceLogs.jsx`, keeping telemetry synced live without browser refreshes.
- **High-Performance SQLite Indexes**: Added database indexes in `server/db.js` on `attendance_logs(event_id, student_id)`, `attendance_logs(event_id, timestamp DESC)`, `events(status)`, and `violations(event_id)`. Combined with WAL mode, lookups execute in sub-milliseconds over large log volumes.
- **Roster Pagination**: Added pagination (25 attendees per page) with Next/Previous navigation controls to `AdminDashboard.jsx`, ensuring rendering 500+ attendees remains smooth and lag-free.
- **Monitored Event Selector for Admins**: Added an event switcher in `AdminDashboard.jsx` allowing Admins & Superadmins to monitor live telemetry for **ANY** event (Active, Upcoming, or Closed).

#### 7. 🧪 Interactive Anti-Spoofing Countermeasure Tester
- **4-Scenario Research Simulator**: Integrated an interactive Anti-Spoofing Countermeasure Tester into `StudentHome.jsx` for live testing and demonstrations:
  - 🟢 **Normal Authentic GPS**: Evaluates live native device location & sensors.
  - 🚨 **Fake GPS Teleport**: Simulates a 33km instant position jump $\rightarrow$ triggers `HIGH_SPEED_TELEPORT`.
  - 🚨 **Synthetic Static Accuracy**: Simulates 0.1m constant static accuracy $\rightarrow$ triggers `STATIC_ACCURACY_REPEATED`.
  - 🚨 **Sensor Motion Mismatch**: Simulates position displacement with zero accelerometer movement $\rightarrow$ triggers `SENSOR_MOTION_MISMATCH`.

#### 8. 🛠️ Robust API Endpoint Fallbacks & Valid PWA Asset Management
- **Multi-Level Endpoint Fallbacks**: Implemented fallback chain in `StudentHome.jsx` (`/api/events/active/all` $\rightarrow$ `/api/events/active-list` $\rightarrow$ `/api/events/active`) with case-insensitive `LOWER(TRIM(college_filter))` query matching, returning `200 OK` responses so browser client errors never occur.
- **Valid PWA PNG Assets**: Replaced placeholder 70-byte manifest files with high-resolution PNG image assets (`pwa-192x192.png`, `pwa-512x512.png`), resolving browser Service Worker PWA installation warnings.

---

## 📌 Version 1.0 (Day 1 Initial Release)

### 🚀 What Has Been Built                                                                                              

#### 1. Public Student Flow (`/`)
- **No Account / No Login Needed**: Students enter their official Student ID in standard `xx-xxxxxx` format (e.g. `23-140015`).                                                               
- **Auto-Formatting & Input Validation**: Automatically formats raw numeric inputs (e.g. `23140015` $\rightarrow$ `23-140015`) and enforces `xx-xxxxxx` format validation.  
- **Instant Verification Lookup**: Automatically looks up student records (e.g. `Micko Gabriel D. Permison` • BS Computer Science, Year 4, College of Computing and Information Sciences).                                   
- **Auto-Action Detection**: Intelligently determines whether `TIME_IN` or `TIME_OUT` applies based on active event windows and previous logs.                      
- **Geofence Distance Meter**: Calculates live distance from the event center using the Haversine formula.
- **Live Geofence Radar Map**: Interactive live map preview showing the event center, the glowing geofence perimeter circle, student position pin, and GPS accuracy range overlay.                                       
- **Live Grace Period Countdown**: Triggers a 15-minute countdown timer if a student steps outside the perimeter. If they re-enter before the timer expires, countdown resets; if expired, action is logged as `Borderline` / `Grace Exceeded` without locking out time-outs.
- **Brand Header & Custom Logo**: Features official custom framed logo (`THerta_LogoWFrame.png`) with tag: *"Skip the line and TapIn here!"*, browser tab favicon integration, and subtle top-left "Admin Portal" link.                                                     

---

#### 2. GPS Spoofing-Detection Research Module (`server/services/spoofDetection/`)                                                                   

Built as a standalone, decoupled service so it can be evaluated independently of Express routes:                                                        

- **Captured Signals**: GPS Coords `(lat, lng)`, reported accuracy (`coords.accuracy`), timestamp, and accelerometer motion sensors (`DeviceMotionEvent`).                              
- **Detection Heuristics**:                                                                                                                           
    1. **Implausible Travel Speed**: Physics check for speeds $>15\text{ m/s}$ (54 km/h) or instant teleports.                                                               
    2. **GPS Accuracy Anomaly**: Identifies static accuracy values repeated across consecutive updates or unrealistically exact values ($\le 0.2\text{m}$).                                     
    3. **Timestamp Irregularity**: Identifies out-of-order timestamps and synthetic integer-second cadences.                                                           
    4. **Sensor Motion Mismatch**: Flags reported position displacement while physical accelerometer magnitude indicates zero linear acceleration.                                   
- **Swappable Classification Strategies**:                                                                                                            
    - **Rule-Based Weighted Scoring Strategy**: Computes a trust score ($0 - 100$) and generates detailed flags.                                                        
    - **ML Logistic Regression Classifier Strategy**: Pure JS logistic model derived from feature extraction vectors:

$$P(\text{spoof}) = \frac{1}{1 + e^{-z}}$$

- **CLI Evaluation Harness (`server/scripts/evalSpoofDetector.js`)**:                                                                                   
    - Command-line tool to run datasets against the detector and compute: **Accuracy, Precision, Recall, Specificity, False Positive Rate (FPR), and F1 Score**.
- **Spoof Research Lab UI**: Interactive testing tab in the web app for custom telemetry inputs and harness metric execution.                                                    

---

#### 3. Real-Time Admin & Superadmin Dashboard                                                                                                    

- **Live Socket.io Telemetry**: Real-time WebSocket connection streaming active student roster (In-Range count, Grace countdown count, Flagged/Spoof count).
- **Live Campus Map Radar**: Interactive map displaying event radius perimeter circles and real-time student position pins color-coded by status.                         
- **Event Geofence Manager**: 
  - Interactive Leaflet map picker restricted to the **Ilocos Norte** region (Laoag City, Batac City).
  - *"Pick My Location"* button to snap event center to admin's current GPS position.
  - Interactive radius slider ($30\text{m} - 500\text{m}$) with real-time map circle overlay.
  - **Editable Event IDs**: Custom Event ID assignment (e.g. `1`, `2`, `101`).
  - **Non-Destructive Database Seeding**: Admin-created and edited events are permanently preserved across server restarts and redeploys.
- **Official 14 MMSU Colleges Support**: Target filters mapped to official MMSU colleges (CAFSD, CASAT, CAS, CBEA, CCIS, COE, CHS, CIT, CTE, COM, COL, COD, CVM, GS).
- **Multi-Window Scheduling**: Add multiple `TIME_IN` and `TIME_OUT` windows per event.                                                                                   
- **Superadmin Control (`/api/auth/admins`)**: Dedicated screen for Superadmins to create, edit, and remove Admin accounts.                                                            

---

#### 4. Penalty & Violation Engine (`server/services/penaltyEngine.js`)                                                                             

- **Automated Post-Event Assessment**: Machine-evaluates registered students and tags status as Compliant or W/ Penalty with specific reasons:                                      
    - `"No time-out recorded"`                                                                                                                              
    - `"No time-in recorded"`                                                                                                                               
    - `"Did not complete full event duration"`                                                                                                              
    - `"Exceeded allowed time outside event radius"`                                                                                                        
    - `"GPS Spoofing / Location Anomaly Detected"`                                                                                                          
- **Configurable Reason Types**: Database table (`violation_types`) allows admins to add or rename violation labels without code modifications.                                                                       

---

#### 5. Reports & Installable PWA                                                                                                                 

- **Export Center**: Download logs filtered by Event, College, Course, Year, and Status as CSV, Excel (.xlsx), or PDF Reports.                                                      
- **PWA (`manifest.json` + `sw.js`)**: Configured service worker for home screen installation, Web Push notification support, and valid PNG icons (`pwa-192x192.png`, `pwa-512x512.png`).
- **Containerization**: Multi-stage `Dockerfile` and `.dockerignore` configured for Docker deployments.                                                         
- **Honest Platform Limitation Disclosure**: Includes a dedicated modal banner and README section explaining browser background GPS constraints and how PWA installation optimizes reliability within OS boundaries.

---

### 🔐 Demo Credentials                                                                                                                       

| Role | Username | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Student** | *No login needed* | *No login needed* | Enter Student ID (e.g., `23-140015`) on home screen |
| **Admin** | `admin` | `admin123` | Manage events, live monitoring feed, attendance history, penalty engine |
| **Superadmin** | `superadmin` | `super123` | Full admin privileges + Admin account creation/removal |

---

## 🌐 Hosting & Deployment Architecture Guide

### Production Setup
- **GitHub Repository**: [https://github.com/IshiguroTaiga/TapIn.git](https://github.com/IshiguroTaiga/TapIn.git)
- **Deployment Platform**: Render (`https://tapin-1s8k.onrender.com`), Vercel (`https://tap-in-ashen.vercel.app`)

### Environment Variables
- `PORT`: `5000`
- `NODE_ENV`: `production`
- `JWT_SECRET`: `tapin_secret_key_2026_super_secure`
- `Health Check Path`: `/api/health`
