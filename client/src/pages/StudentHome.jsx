import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import LiveGeofenceMap from '../components/LiveGeofenceMap';
import {
  MapPin,
  Clock,
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Compass,
  Zap,
  RefreshCw,
  Activity,
  Bell,
  Smartphone
} from 'lucide-react';

export default function StudentHome({ onOpenPwaNotice }) {
  const [studentId, setStudentId] = useState('23-140015');
  const [studentInfo, setStudentInfo] = useState(null);
  const [studentError, setStudentError] = useState(null);
  
  const [activeEvent, setActiveEvent] = useState(null);
  const [allActiveEvents, setAllActiveEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);

  // Live Location & Sensors State
  const [locationPermission, setLocationPermission] = useState('prompt');
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [motionData, setMotionData] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [inRange, setInRange] = useState(false);

  // Grace Period Countdown
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(null);
  const [isGraceActive, setIsGraceActive] = useState(false);
  const [graceExpired, setGraceExpired] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);

  const watchIdRef = useRef(null);
  const graceTimerRef = useRef(null);

  // Fetch active events on load
  useEffect(() => {
    fetchActiveEvent();
  }, []);

  const fetchActiveEvent = async () => {
    setEventLoading(true);
    try {
      const res = await axios.get('/api/events/active/all');
      const eventsList = res.data || [];
      setAllActiveEvents(eventsList);
      
      if (eventsList.length > 0) {
        if (selectedEventId) {
          const matched = eventsList.find(e => e.id === parseInt(selectedEventId));
          setActiveEvent(matched || eventsList[0]);
        } else {
          setActiveEvent(eventsList[0]);
          setSelectedEventId(eventsList[0].id);
        }
      } else {
        setActiveEvent(null);
      }
    } catch (err) {
      setActiveEvent(null);
      setAllActiveEvents([]);
    } finally {
      setEventLoading(false);
    }
  };

  // Student ID Lookup
  useEffect(() => {
    if (!studentId || studentId.trim().length < 5) {
      setStudentInfo(null);
      setStudentError(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/students/lookup/${encodeURIComponent(studentId.trim())}`);
        setStudentInfo(res.data);
        setStudentError(null);
      } catch (err) {
        setStudentInfo(null);
        setStudentError('Student ID not found in university database');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [studentId]);

  // Request & Watch Geolocation
  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLocationPermission('requesting');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationPermission('granted');
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        setCoords({ lat, lng });
        setAccuracy(acc);

        // Calculate distance if active event exists
        if (activeEvent) {
          const dist = calculateHaversine(lat, lng, activeEvent.center_lat, activeEvent.center_lng);
          setDistanceMeters(dist);
          const inside = dist <= activeEvent.radius_m;
          setInRange(inside);

          // Handle Grace Period Countdown
          if (!inside && !isGraceActive && !graceExpired) {
            startGraceCountdown(activeEvent.grace_minutes * 60);
          } else if (inside && isGraceActive) {
            resetGraceCountdown();
          }
        }
      },
      (err) => {
        setLocationPermission('denied');
        console.error('Geolocation error:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    // Listen to Device Acceleration (Accelerometer sensor for spoof detection)
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', (e) => {
        if (e.accelerationIncludingGravity) {
          setMotionData({
            accelX: e.accelerationIncludingGravity.x || 0,
            accelY: e.accelerationIncludingGravity.y || 0,
            accelZ: e.accelerationIncludingGravity.z || 9.81
          });
        }
      }, { once: true });
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    };
  }, []);

  // Haversine helper for immediate client feedback
  const calculateHaversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  // Grace Period Countdown Logic
  const startGraceCountdown = (seconds) => {
    setIsGraceActive(true);
    setGraceSecondsLeft(seconds);

    if (graceTimerRef.current) clearInterval(graceTimerRef.current);

    graceTimerRef.current = setInterval(() => {
      setGraceSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(graceTimerRef.current);
          setIsGraceActive(false);
          setGraceExpired(true);
          sendGraceWarningNotification();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetGraceCountdown = () => {
    if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    setIsGraceActive(false);
    setGraceSecondsLeft(null);
    setGraceExpired(false);
  };

  const sendGraceWarningNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('TapIn Grace Period Expired!', {
        body: 'You have been outside the event geofence radius for longer than allowed. Please re-enter or time out.',
        icon: '/pwa-192x192.png'
      });
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  // Submit Time In / Time Out Attendance
  const handleSubmitAttendance = async () => {
    if (!studentId || !studentInfo) {
      setSubmissionError('Please enter a valid Student ID');
      return;
    }

    if (!coords) {
      setSubmissionError('Please grant location access before logging attendance.');
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);
    setSubmissionResult(null);

    try {
      const res = await axios.post('/api/attendance/submit', {
        student_id: studentId.trim(),
        event_id: activeEvent?.id,
        lat: coords.lat,
        lng: coords.lng,
        accuracy,
        timestamp: new Date().toISOString(),
        motionData
      });

      setSubmissionResult(res.data);
    } catch (err) {
      if (err.response?.data) {
        setSubmissionResult(err.response.data);
      } else {
        setSubmissionError(err.message || 'Failed to submit attendance');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatCountdown = (secs) => {
    if (secs === null || secs === undefined) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Auto-format Student ID as xx-xxxxxx (e.g. 23-140015)
  const handleStudentIdChange = (e) => {
    let input = e.target.value.toUpperCase().replace(/[^0-9-]/g, '');
    
    // Auto-insert hyphen after 2 digits if user types raw digits (e.g., 23140015 -> 23-140015)
    if (/^\d{3,}/.test(input) && !input.includes('-')) {
      input = `${input.slice(0, 2)}-${input.slice(2, 8)}`;
    }

    // Limit length to 9 chars (2 digits + 1 hyphen + 6 digits)
    if (input.length > 9) {
      input = input.slice(0, 9);
    }

    setStudentId(input);
  };

  const isIdFormatValid = /^\d{2}-\d{6}$/.test(studentId.trim());

  return (
    <div className="w-full max-w-2xl mx-auto px-1 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      
      {/* Active Event Banner */}
      {eventLoading ? (
        <div className="p-4 sm:p-6 glass-card rounded-2xl animate-pulse flex items-center justify-center text-slate-400 text-sm">
          Loading active university event details...
        </div>
      ) : activeEvent ? (
        <div className="glass-panel rounded-2xl p-4 sm:p-6 border border-indigo-500/30 relative overflow-hidden shadow-xl">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

          {allActiveEvents.length > 1 && (
            <div className="relative z-10 mb-3 pb-3 border-b border-slate-800/80">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Switch Event ({allActiveEvents.length} Active Events Open)
              </label>
              <select
                value={activeEvent.id}
                onChange={(e) => {
                  const evId = parseInt(e.target.value);
                  setSelectedEventId(evId);
                  const selected = allActiveEvents.find(item => item.id === evId);
                  if (selected) setActiveEvent(selected);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
              >
                {allActiveEvents.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} (ID #{e.id})
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="relative z-10 flex items-start justify-between gap-2">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE EVENT
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{activeEvent.name}</h1>
              <p className="text-xs text-slate-300">{activeEvent.description}</p>
            </div>
            
            <button
              onClick={fetchActiveEvent}
              className="p-2.5 rounded-xl bg-slate-900/60 text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
              title="Refresh Event"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Event Geofence Parameters */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 block font-medium">Radius</span>
              <span className="text-xs sm:text-sm font-bold text-indigo-400">{activeEvent.radius_m}m</span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 block font-medium">Grace Window</span>
              <span className="text-xs sm:text-sm font-bold text-amber-400">{activeEvent.grace_minutes}m</span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 block font-medium">Target</span>
              <span className="text-xs sm:text-sm font-bold text-purple-400 truncate block">
                {activeEvent.college_filter === 'all' ? 'All' : activeEvent.college_filter}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-6 glass-card rounded-2xl border border-slate-800 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold text-white">No Active Event Right Now</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            An administrator has not opened a live attendance session yet. Sample active events can be created or toggled from the Admin Portal.
          </p>
        </div>
      )}

      {/* Step 1: Location Access Request Card */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-4 border border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${coords ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
              <Compass className={`w-5 h-5 sm:w-6 sm:h-6 ${coords ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">1. Live Location Telemetry</h2>
              <p className="text-[11px] sm:text-xs text-slate-400">Verifying GPS coordinates against geofence boundaries.</p>
            </div>
          </div>

          {coords && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <CheckCircle className="w-3.5 h-3.5" />
              GPS Active
            </span>
          )}
        </div>

        {!coords ? (
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              To verify attendance seamlessly without selfie biometrics, TapIn uses your device's native browser Geolocation API.
            </p>
            <button
              onClick={requestLocation}
              className="w-full min-h-[44px] py-3 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>Allow Location Access</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 block">Distance to Center</span>
              <div className={`text-sm sm:text-base font-bold ${inRange ? 'text-emerald-400' : 'text-amber-400'}`}>
                {distanceMeters !== null ? `${distanceMeters}m` : 'Calculating...'}
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 block">GPS Accuracy</span>
              <div className="text-sm sm:text-base font-bold text-indigo-300">
                ±{accuracy ? Math.round(accuracy * 10) / 10 : '--'} m
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-0.5 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 block">Geofence Status</span>
              <div className="text-xs sm:text-sm font-semibold">
                {inRange ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> In Geofence
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Out of Range
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live Visual Map Preview with Geofence Radius Circle Overlay */}
        {activeEvent && (
          <div className="pt-2">
            <LiveGeofenceMap
              event={activeEvent}
              studentCoords={coords}
              studentAccuracy={accuracy}
              inRange={inRange}
              height="220px"
            />
          </div>
        )}

        {/* Grace Period Warning Banner */}
        {isGraceActive && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">Out of Range - Grace Period Active</h4>
                <p className="text-[11px] text-amber-200/80">Re-enter the event perimeter before countdown expires to avoid attendance penalty.</p>
              </div>
            </div>
            <div className="text-xl font-mono font-bold text-amber-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-amber-500/30">
              {formatCountdown(graceSecondsLeft)}
            </div>
          </div>
        )}

        {graceExpired && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Grace Period Countdown Expired!</span> You were outside the radius for over {activeEvent?.grace_minutes} mins. You may still time out, but a grace violation will be recorded.
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Student ID & Time In/Out Action */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">2. Student Verification & Action</h2>
            <p className="text-xs text-slate-400">Enter your official Student ID number to log attendance.</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Student ID Number</label>
            <span className="text-[11px] font-mono text-indigo-400">Format: xx-xxxxxx</span>
          </div>
          <input
            type="text"
            value={studentId}
            onChange={handleStudentIdChange}
            placeholder="xx-xxxxxx (e.g. 23-140015)"
            maxLength={9}
            className={`w-full px-4 py-3 rounded-xl bg-slate-900/90 border text-lg font-mono text-white placeholder-slate-600 focus:outline-none transition-colors tracking-wider ${
              studentId && !isIdFormatValid ? 'border-amber-500/60 focus:border-amber-500' : 'border-slate-800 focus:border-indigo-500'
            }`}
          />

          {studentId && !isIdFormatValid && (
            <p className="text-[11px] text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Student ID must follow format xx-xxxxxx (e.g. 23-140015)
            </p>
          )}

          {studentError && isIdFormatValid && (
            <p className="text-xs text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {studentError}
            </p>
          )}

          {/* Student Info Preview */}
          {studentInfo && (
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 space-y-1 text-xs text-slate-300 animate-in fade-in">
              <div className="font-bold text-white text-sm flex items-center justify-between">
                <span>{studentInfo.name}</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  Year {studentInfo.year}
                </span>
              </div>
              <p className="text-slate-400">{studentInfo.course} • {studentInfo.college}</p>
            </div>
          )}
        </div>

        {/* Time In / Time Out Button */}
        <div className="pt-2">
          <button
            onClick={handleSubmitAttendance}
            disabled={submitting || !coords || !studentInfo || !activeEvent}
            className="w-full py-4 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing GPS Telemetry & Logging...
              </span>
            ) : (
              <>
                <Zap className="w-5 h-5 fill-white text-white" />
                <span>Submit Time In / Time Out</span>
              </>
            )}
          </button>
        </div>

        {/* Submission Outcome Result */}
        {submissionResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in ${
            submissionResult.success
              ? submissionResult.status === 'borderline'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-2 font-bold text-sm">
              {submissionResult.success ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <span>{submissionResult.message}</span>
            </div>

            {submissionResult.spoofDetection && (
              <div className="pt-2 border-t border-slate-800 text-[11px] grid grid-cols-2 gap-2 text-slate-300">
                <div>Trust Score: <strong className="text-white">{submissionResult.spoofDetection.trustScore}/100</strong></div>
                <div>Spoof Flagged: <strong className={submissionResult.spoofDetection.isSpoofed ? 'text-rose-400' : 'text-emerald-400'}>{submissionResult.spoofDetection.isSpoofed ? 'YES' : 'NO'}</strong></div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* PWA & Web Push Helpers */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          <span>Enable Web Push warnings for grace countdowns</span>
        </div>
        <button
          onClick={requestNotificationPermission}
          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition-colors font-medium text-[11px]"
        >
          Enable Alerts
        </button>
      </div>

    </div>
  );
}
