# TapIn Project Documentation & Changelog

---

## 📌 Version 2.0 (Day 2 Updates & Enhancements)

### 🚀 What Has Been Updated & Fixed

#### 1. 🔐 Event Deletion & RBAC Authorization Fixes
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
- **Deployment Platform**: Render (`https://tapin-1s8k.onrender.com`)

### Environment Variables
- `PORT`: `5000`
- `NODE_ENV`: `production`
- `JWT_SECRET`: `tapin_secret_key_2026_super_secure`
- `Health Check Path`: `/api/health`
