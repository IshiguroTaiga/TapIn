# TapIn Project Documentation

## Day 1

### 🚀 What Has Been Built                                                                                                                                                                                      
                                                                                                                                                                                                                  
#### 1. Public Student Flow (/)                                                                                                                                                                                 
                                                                                                                                                                                                                  
• **No Account / No Login Needed**: Students enter their official Student ID (e.g. `2023-00101`).                                                                                                                     
• **Instant Verification Lookup**: Automatically looks up and previews the student's name, college, course, and year level.                                                                                         
• **Auto-Action Detection**: Intelligently determines whether `TIME_IN` or `TIME_OUT` applies based on the active event and existing logs.                                                                              
• **Geofence Distance Meter**: Calculates live distance from the event's center coordinates using the Haversine formula.                                                                                            
• **Live Grace Period Countdown**: Automatically triggers a 15-minute (configurable) countdown timer if a student steps outside the perimeter. If they re-enter before the timer expires, the countdown resets; if expired, the action is logged as Borderline / Grace Exceeded without locking out time-outs.                                                                                                                     
• **Hidden Admin Portal Link**: Subtle "Admin Portal" link situated in the top-left corner of the header.                                                                                                           

---

#### 2. GPS Spoofing-Detection Research Module (`server/services/spoofDetection/`)                                                                                                                                
                                                                                                                                                                                                                  
Built as a standalone, decoupled service so it can be evaluated independently of Express routes:                                                                                                                
                                                                                                                            .
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
    • Command-line tool to run datasets against the detector and compute: Accuracy, Precision, Recall, Specificity, False Positive Rate (FPR), and F1 Score.                                                    

---

#### 3. Real-Time Admin & Superadmin Dashboard                                                                                                                                                                  
                                                                                                                                                                                                                  
• **Live Socket.io Telemetry**: Real-time WebSocket connection streaming active student roster (In-Range count, Grace countdown count, Flagged/Spoof count).                                                        
• **Event Geofence Manager**: Set event center lat/lng coordinates, interactive radius slider ($50\text{m} - 500\text{m}$), grace period minutes, and target college/course/year filters.                                         
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
• **PWA (`manifest.json` + `sw.js`)**: Configured service worker for home screen installation and Web Push notification support.                                                                                        
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

### Can you use Vercel?
**Not alone out-of-the-box** for the full backend application. Here is why:
1. **Socket.io (WebSockets)**: Vercel runs on stateless **Serverless Functions** that spin down after every HTTP request. They cannot maintain persistent, real-time WebSocket connections required by Socket.io.
2. **SQLite Database (`tapin.db`)**: Serverless functions have read-only file systems (except `/tmp`), meaning your SQLite database will reset or wipe whenever the serverless container restarts.

---

### Recommended Free Hosting Solutions for TapIn

#### 1. Koyeb (Free Tier) — [koyeb.com](https://www.koyeb.com)
- **Website**: [https://www.koyeb.com](https://www.koyeb.com)
- **Why**: Koyeb provides free continuous Node.js application hosting that runs persistent web servers (not serverless).
- **Socket.io & SQLite Support**: WebSockets work automatically. SQLite runs cleanly directly on the disk.

#### 2. Render (Free Web Service) — [render.com](https://render.com)
- **Website**: [https://render.com](https://render.com)
- **Why**: Excellent free tier for Node.js Express + Socket.io backends.
- **SQLite Note**: Disk is ephemeral on Render's free tier (resets on redeploy). For permanent data persistence, you can connect a 100% free PostgreSQL cloud database like **Supabase** ([supabase.com](https://supabase.com)) or **Neon** ([neon.tech](https://neon.tech)).

#### 3. Railway — [railway.app](https://railway.app)
- **Website**: [https://railway.app](https://railway.app)
- **Why**: Instantly deploys full-stack Node.js + WebSockets + SQLite from GitHub with $5 free usage credit.

#### 4. Glitch — [glitch.com](https://glitch.com)
- **Website**: [https://glitch.com](https://glitch.com)
- **Why**: 1-click free online Node.js server environment where Express, Socket.io, and SQLite run together seamlessly for quick thesis demos.
