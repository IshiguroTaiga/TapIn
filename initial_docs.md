# 📄 TAPIN: THESIS PROPOSAL MANUSCRIPT
## Official Capstone & Thesis Proposal Form (Print-Ready Version)

---

### **TITLE**
**TapIn: Point-in-Polygon Geofence-Based Attendance Monitoring System with Real-Time Analytics**

---

### **DESCRIPTION**
**TapIn** is a web-based, mobile-responsive Progressive Web Application (PWA) that leverages device GPS telemetry and an interactive **Ray-Casting Point-in-Polygon (PIP) geofencing engine** to verify a student's authentic physical presence at mandatory university events. 

Students record attendance seamlessly through a 3-step zero-friction workflow: access the portal, allow browser geolocation access, and enter their Student ID—requiring **no bottleneck queues, no barcode scanning hardware, and no student account registration**. 

The platform automatically sanitizes and formats the Student ID, cross-references identity against official university master records, and intelligently determines whether `TIME_IN` or `TIME_OUT` applies. Administrators and Superadministrators utilize a centralized command dashboard to configure custom venue polygon boundaries on interactive campus maps, monitor live telemetry streams via WebSockets (Socket.io), and enforce continuous event compliance through an automated post-event penalty engine.

---

### **PROBLEM STATEMENT**
Mandatory university-wide assemblies, college convocations, institutional seminars, and academic events currently rely on manual attendance methods—such as students queuing to write their credentials on paper sign-in sheets, typing their ID on shared laptops, or scanning physical ID barcodes. This traditional paradigm suffers from four critical institutional vulnerabilities:

1. **Queue Bottlenecks & Operational Inefficiency**: Hundreds of attendees crowding at entrance doorways creates severe congestion, delays event commencement, and ties down faculty proctors to manual data entry.
2. **Vulnerability to Proxy Signing ("Buddy Punching")**: Paper sheets, barcode screenshots, and unmonitored Google Forms allow present students to easily record attendance on behalf of absent peers without physical verification.
3. **Absence of Continuous Presence Verification**: Current checkpoints record presence at only one instant; students routinely log `TIME_IN`, depart the venue immediately to go off-campus, and return hours later solely to log `TIME_OUT`, artificially inflating attendance figures.
4. **Susceptibility to Location Spoofing**: Standard, unhardened web geolocation implementations can be trivially bypassed using third-party Mock GPS and location-spoofing applications.

---

### **OBJECTIVES**
The general objective of this research is to design, develop, and evaluate **TapIn**, a unified mobile-responsive academic attendance verification platform that:

1. **Eliminates Manual Queues**: Provides a streamlined 3-step verification workflow (Portal Access $\rightarrow$ GPS Permission $\rightarrow$ Student ID Entry) with automatic identity validation against university master student records.
2. **Ensures Authentic Physical Presence**: Validates real-time student coordinates against irregular, custom-shaped venue boundaries using the **Jordan Curve Ray-Casting Point-in-Polygon (PIP)** algorithm, optimized with a fast Haversine bounding sphere pre-filter.
3. **Enforces Continuous Duration Compliance**: Monitors attendee dwell time through an automated **Grace Period Engine** featuring live countdown timers and automatic reset triggers upon boundary re-entry.
4. **Automates Violation Assessment**: Evaluates post-event compliance through a rule-based **Penalty Engine** that flags specific infractions (e.g., unauthorized early departure, unrecorded time-out, or geofence boundary expiration) tailored to collegiate policy requirements.
5. **Empowers Administrators with Real-Time Analytics**: Delivers live attendance feeds, occupancy rates, and multi-college filtered data streams powered by Socket.io WebSocket architecture.
6. **Hardens System Security Against Mock Locations**: Employs a decoupled **GPS Spoofing-Detection Research Module** evaluating multi-sensor heuristics (velocity plausibility, static precision patterns, timestamp cadences, and accelerometer motion correlation) and a Machine Learning Logistic Regression classifier.

---

### **METHODOLOGY & TECHNICAL MODULES**
This study follows an **Agile Development Methodology**, structured across six iterative technical modules:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           TAPIN SYSTEM MODULES                           │
├────────────────────────────────┬─────────────────────────────────────────┤
│ 1. Point-in-Polygon Geofencing │ Jordan Curve Ray-Casting PIP algorithm  │
│    & Spatial Radar Engine      │ with O(1) Haversine sphere pre-filter.  │
├────────────────────────────────┼─────────────────────────────────────────┤
│ 2. Interactive Venue & Event   │ Interactive Leaflet polygon canvas with │
│    Boundary Configuration      │ draggable vertices and MMSU presets.    │
├────────────────────────────────┼─────────────────────────────────────────┤
│ 3. Grace Period & Compliance   │ 15-minute countdown buffer for boundary │
│    State Machine Engine        │ exits with automatic re-entry resets.   │
├────────────────────────────────┼─────────────────────────────────────────┤
│ 4. Automated Penalty Engine    │ Policy-driven classification tagging    │
│                                │ Compliant vs. With Penalty records.     │
├────────────────────────────────┼─────────────────────────────────────────┤
│ 5. Real-Time Telemetry Feed    │ Socket.io bidirectional WebSocket hub   │
│    & Command Dashboard         │ streaming live in-range & spoof alerts. │
├────────────────────────────────┼─────────────────────────────────────────┤
│ 6. Anti-Spoofing Heuristics &  │ Rule-based multi-sensor scoring and ML  │
│    Research Evaluation Harness │ Logistic Regression classifier CLI tool.│
└────────────────────────────────┴─────────────────────────────────────────┘
```

#### Detailed Module Breakdown:
1. **Point-in-Polygon Geofencing & Spatial Radar Engine**: Casts a horizontal ray from student coordinates to evaluate boundary containment parity against ordered polygon vertices ($N \ge 3$), eliminating false positives/negatives inherent in circular radius models.
2. **Event & Schedule Configuration Module**: Enables administrators to draw custom venue shapes (e.g. L-shaped buildings, quadrangles), assign targeted college/course/year filters, and configure multi-window scheduling (`TIME_IN` and `TIME_OUT`).
3. **Grace Period State Machine**: Manages a 15-minute tolerance timer when students step outside venue boundaries, resetting upon timely re-entry and tagging expired records as `Borderline` without hard-locking time-out capability.
4. **Penalty Evaluation Engine**: Evaluates completed attendance logs against configurable infraction rules (insufficient duration, missed windows, geofence non-compliance) to generate institutional clearance reports.
5. **Real-Time Monitoring Dashboard**: Streams live telemetry via Socket.io, displaying instant metrics for in-range attendees, active grace countdowns, and flagged anomalies.
6. **Anti-Spoofing Research Module & Evaluation Harness**: Evaluates 4 multi-sensor heuristic checks (`IMPLAUSIBLE_SPEED`, `STATIC_ACCURACY_REPEATED`, `TIMESTAMP_OUT_OF_ORDER`, `SENSOR_MOTION_MISMATCH`) alongside a Logistic Regression classifier, verified against labeled benchmark datasets via a CLI evaluation tool reporting Accuracy, Precision, Recall, Specificity, FPR, and F1 Score.

---

### **PROJECT TIMELINE**

| Phase | Milestone / Activity | Duration |
| :--- | :--- | :---: |
| **Phase 1** | Literature Review & Theoretical Formulation | 2 Weeks |
| **Phase 2** | Requirement Analysis & Master Data Gathering | 2 Weeks |
| **Phase 3** | System Architecture & Database Schema Design | 2 Weeks |
| **Phase 4** | Full-Stack System Development & Module Integration | 4 Weeks |
| **Phase 5** | System Verification, Spoofing Harness Testing & Field Trials | 2 Weeks |
| **Phase 6** | Documentation, Manuscript Finalization & Defense Preparation | 4 Weeks |
| **Total** | **End-to-End Capstone Lifecycle** | **16 Weeks** |

---

### **TOOLS & TECHNOLOGIES**
* **Frontend Architecture**: React 19 (SPA/PWA), Vite, Vanilla CSS Design System with custom dark glassmorphism styling, Lucide Icons, Leaflet.js mapping library.
* **Backend Architecture**: Node.js, Express.js REST API with Strategy Pattern service layers.
* **Data Storage**: SQLite with Write-Ahead Logging (WAL) mode and indexed relational tables.
* **Real-Time Communications**: Socket.io (WebSocket duplex streaming).
* **Security & Authentication**: JSON Web Tokens (JWT), bcrypt password hashing, role-based authorization middleware.
* **DevOps, Testing & Deployment**: Docker containerization, Node Test Runner, Git version control, Render Cloud hosting.

---

### **EXPECTED OUTPUTS**
A production-grade, mobile-responsive Progressive Web Application (PWA) delivering:
1. **Public Student Attendance Interface**: Zero-login portal featuring automatic ID input masking, instant master record lookup, native Geolocation watcher, and live polygon radar visualization.
2. **Ray-Casting Point-in-Polygon Geofence Engine**: High-precision boundary verification with fast Haversine bounding sphere pre-filtering.
3. **Interactive Venue Geofence Editor**: Leaflet canvas enabling admins to click, drag, scale, rotate, and trace arbitrary venue footprints (L-shapes, U-shapes, quadrangles).
4. **Automated Penalty & Compliance Engine**: Machine-evaluates post-event logs and generates college-customizable infraction breakdowns.
5. **Real-Time Administrative Dashboard**: Socket.io live telemetry hub showing in-range verified counts, active grace periods, and live student pins.
6. **Decoupled Spoofing Research Lab & CLI Harness**: Interactive testing suite with benchmark evaluation reporting academic classification metrics.
7. **Multi-Role Access Control & Export Center**: Strict Superadmin and Admin role segregation with one-click report generation in CSV, Excel (.xlsx), and PDF formats.

---

### **EXPECTED BENEFICIARIES**
* **Students**: Eliminates congested entrance lines, saving 15–30 minutes per event through an instant, 3-step mobile check-in.
* **Event Organizers & Faculty Proctors**: Relieves personnel from tedious manual roll calls and manual spreadsheet tallying; provides real-time crowd distribution and venue occupancy data.
* **University Administration & College Offices**: Provides auditable, tamper-resistant attendance records with verifiable physical presence tracking for institutional clearance and accreditation compliance.

---

### **SDG COVERAGE & RESEARCH THRUST ALIGNMENT**

#### **Research Thrusts (MMSU CCIS)**:
1. *Information Systems and Software Development*
2. *Digital Transformation and Smart Campus Technologies*
3. *Geographic Information Systems (GIS) and Location-Based Services (LBS)*

#### **Sustainable Development Goals (SDGs)**:
* **SDG 4: Quality Education** (Target 4.7) — Promotes institutional transparency, academic event accountability, and verified student participation.
* **SDG 9: Industry, Innovation, and Infrastructure** (Target 9.5) — Fosters smart campus digital infrastructure through modern web technologies and sensor-fusion algorithms.
* **SDG 11: Sustainable Cities and Communities** (Target 11.a) — Eliminates disposable paper sign-in sheets and enables intelligent venue space management.

---

### **RESEARCH INTEREST & MOTIVATION**
The motivation for developing TapIn originates from direct observations during On-the-Job Training (OJT) assignments:

1. **Provincial Government of Ilocos Norte (PGIN - IT Office Department)**:  
   *Observed regular employees checking out instantaneously using mobile geofencing on their smartphones, while student interns were subjected to long, slow-moving queues at physical barcode scanner stations.*
2. **Department of Science and Technology (DOST Region 1 - ITSM Unit)**:  
   *Observed fully digitized, traceable institutional information systems that operate without paper redundancy, emphasizing the operational gap in standard university event management.*

These experiences led to the central capstone hypothesis:
> *"University attendance verification can be completely automated through non-invasive mobile browser geolocation, eliminating entrance queues while enforcing continuous physical presence through mathematical polygon geofencing and multi-signal spoofing countermeasures."*

---

### **TEAM PLAN**
In accordance with capstone guidelines where group members submit individual proposals, formal execution and division of development tasks (Frontend UI/UX, Spatial Geofencing Engine, Backend REST/Socket.io API, Anti-Spoofing Evaluation Harness) will be finalized upon panel approval of this proposal.

---

### **STRENGTHS, WEAKNESSES & COMPENSATION STRATEGY**

* **Strengths**: Solid foundation in modern web development (React, HTML5, CSS3, JavaScript ES6+), backend API architecture (Node.js, Express, PHP, Python), relational databases (SQLite, MySQL), and component-driven UI design.
* **Weaknesses**: Initial unfamiliarity with advanced spherical trigonometric algorithms, Point-in-Polygon ray intersection math, and multi-sensor browser hardware security (`DeviceMotionEvent`).
* **Compensation Strategy**: Successfully mitigated through deep review of computational geometry literature (Jordan Curve Theorem), implementation of clean Strategy Pattern software architecture, development of a standalone 15-case automated unit testing suite (`testGeofence.js`), and empirical evaluation using a research CLI benchmark harness.

---

*Form submitted for Capstone & Thesis Proposal Review — Department of Computer Science, College of Computing and Information Sciences (CCIS), Mariano Marcos State University.*
