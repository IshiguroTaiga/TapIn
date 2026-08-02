# TapIn Project Documentation

## Day 1

### 🚀 What Has Been Built                                                                                              

#### 1. Public Student Flow (`/`)
• **No Account / No Login Needed**: Students enter their official Student ID in standard `xx-xxxxxx` format (e.g. `23-140015`).                                                               
• **Auto-Formatting & Input Validation**: Automatically formats raw numeric inputs (e.g. `23140015` $\rightarrow$ `23-140015`) and enforces `xx-xxxxxx` format validation.  
• **Instant Verification Lookup**: Automatically looks up student records (e.g. `Micko Gabriel D. Permison` • BS Computer Science, Year 4, College of Computing and Information Sciences).                                   
• **Auto-Action Detection**: Intelligently determines whether `TIME_IN` or `TIME_OUT` applies based on active event windows and previous logs.                      
• **Geofence Distance Meter**: Calculates live distance from the event center using the Haversine formula.
• **Live Geofence Radar Map**: Interactive live map preview showing the event center, the glowing geofence perimeter circle, student position pin, and GPS accuracy range overlay.                                       
• **Live Grace Period Countdown**: Triggers a 15-minute countdown timer if a student steps outside the perimeter. If they re-enter before the timer expires, countdown resets; if expired, action is logged as `Borderline` / `Grace Exceeded` without locking out time-outs.
• **Brand Header**: Features logo with tag: *"Skip the line and TapIn here!"* and subtle top-left "Admin Portal" link.                                                     

---

#### 2. GPS Spoofing-Detection Research Module (`server/services/spoofDetection/`)                                                                   

Built as a standalone, decoupled service so it can be evaluated independently of Express routes:                                                        

• **Captured Signals**: GPS Coords `(lat, lng)`, reported accuracy (`coords.accuracy`), timestamp, and accelerometer motion sensors (`DeviceMotionEvent`).                              
• **Detection Heuristics**:                                                                                                                           
    1. **Implausible Travel Speed**: Physics check for speeds $>15\text{ m/s}$ (54 km/h) or instant teleports.                                                               
    2. **GPS Accuracy Anomaly**: Identifies static accuracy values repeated across consecutive updates or unrealistically exact values ($\le 0.2\text{m}$).                                     
    3. **Timestamp Irregularity**: Identifies out-of-order timestamps and synthetic integer-second cadences.                                                           
    4. **Sensor Motion Mismatch**: Flags reported position displacement while physical accelerometer magnitude indicates zero linear acceleration.                                   
• **Swappable Classification Strategies**:                                                                                                            
    • **Rule-Based Weighted Scoring Strategy**: Computes a trust score ($0 - 100$) and generates detailed flags.                                                        
    • **ML Logistic Regression Classifier Strategy**: Pure JS logistic model derived from feature extraction vectors:

$$P(\text{spoof}) = \frac{1}{1 + e^{-z}}$$

• **CLI Evaluation Harness (`server/scripts/evalSpoofDetector.js`)**:                                                                                   
    • Command-line tool to run datasets against the detector and compute: **Accuracy, Precision, Recall, Specificity, False Positive Rate (FPR), and F1 Score**.
• **Spoof Research Lab UI**: Interactive testing tab in the web app for custom telemetry inputs and harness metric execution.                                                    

---

#### 3. Real-Time Admin & Superadmin Dashboard                                                                                                    

• **Live Socket.io Telemetry**: Real-time WebSocket connection streaming active student roster (In-Range count, Grace countdown count, Flagged/Spoof count).
• **Live Campus Map Radar**: Interactive map displaying event radius perimeter circles and real-time student position pins color-coded by status.                         
• **Event Geofence Manager**: 
  - Interactive Leaflet map picker restricted to the **Ilocos Norte** region (Laoag City, Batac City).
  - *"Pick My Location"* button to snap event center to admin's current GPS position.
  - Interactive radius slider ($30\text{m} - 500\text{m}$) with real-time map circle overlay.
  - **Editable Event IDs**: Custom Event ID assignment (e.g. `1`, `2`, `101`).
  - **Non-Destructive Database Seeding**: Admin-created and edited events are permanently preserved across server restarts and redeploys.
• **Official 14 MMSU Colleges Support**: Target filters mapped to official MMSU colleges (CAFSD, CASAT, CAS, CBEA, CCIS, COE, CHS, CIT, CTE, COM, COL, COD, CVM, GS).
• **Multi-Window Scheduling**: Add multiple `TIME_IN` and `TIME_OUT` windows per event.                                                                                   
• **Superadmin Control (`/api/auth/admins`)**: Dedicated screen for Superadmins to create, edit, and remove Admin accounts.                                                            

---

#### 4. Penalty & Violation Engine (`server/services/penaltyEngine.js`)                                                                             

• **Automated Post-Event Assessment**: Machine-evaluates registered students and tags status as Compliant or W/ Penalty with specific reasons:                                      
    • `"No time-out recorded"`                                                                                                                              
    • `"No time-in recorded"`                                                                                                                               
    • `"Did not complete full event duration"`                                                                                                              
    • `"Exceeded allowed time outside event radius"`                                                                                                        
    • `"GPS Spoofing / Location Anomaly Detected"`                                                                                                          
• **Configurable Reason Types**: Database table (`violation_types`) allows admins to add or rename violation labels without code modifications.                                                                       

---

#### 5. Reports & Installable PWA                                                                                                                 

• **Export Center**: Download logs filtered by Event, College, Course, Year, and Status as CSV, Excel (.xlsx), or PDF Reports.                                                      
• **PWA (`manifest.json` + `sw.js`)**: Configured service worker for home screen installation, Web Push notification support, and valid PNG icons (`pwa-192x192.png`, `pwa-512x512.png`).
• **Containerization**: Multi-stage `Dockerfile` and `.dockerignore` configured for Docker deployments.                                                         
• **Honest Platform Limitation Disclosure**: Includes a dedicated modal banner and README section explaining browser background GPS constraints and how PWA installation optimizes reliability within OS boundaries.

---

### 🔐 Credentials for Demo                                                                                                                       

| Role | Username | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Student** | *No login needed* | *No login needed* | Enter Student ID (e.g., `23-140015`) on home screen |
| **Admin** | `admin` | `admin123` | Manage events, live monitoring feed, attendance history, penalty engine |
| **Superadmin** | `superadmin` | `super123` | Full admin privileges + Admin account creation/removal |

---

## 🌐 Hosting & Deployment Options Guide

### Deployment Architecture
- **GitHub Repository**: [https://github.com/IshiguroTaiga/TapIn.git](https://github.com/IshiguroTaiga/TapIn.git)
- **Frontend PWA**: Hosted on Vercel (`https://tap-in-ashen.vercel.app/`)
- **Backend API**: Hosted on Render (`https://your-backend.onrender.com`)

### Environment Variable Checklist
- **Render Backend**: `PORT=5000`, `JWT_SECRET=tapin_super_secret_key_2026`
- **Render Health Check Path**: `/api/health`
- **Vercel Frontend**: `VITE_API_URL=https://your-backend.onrender.com`
