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
  Smartphone,
  Key,
  QrCode,
  Download,
  Camera,
  CheckSquare,
  Award,
  UploadCloud,
  FileCheck,
  Eye,
  Fingerprint,
  Mail,
  AlertCircle,
  X
} from 'lucide-react';

function normalizePolygon(poly) {
  if (!poly) return [];
  let raw = poly;
  while (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      break;
    }
  }

  // Handle GeoJSON format { type: 'Polygon', coordinates: [[[lng, lat], ...]] }
  if (raw && raw.type === 'Polygon' && Array.isArray(raw.coordinates) && raw.coordinates[0]) {
    return raw.coordinates[0].map(c => [parseFloat(c[1]), parseFloat(c[0])]).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
  }

  if (!Array.isArray(raw)) return [];

  return raw.map(p => {
    if (Array.isArray(p) && p.length >= 2) return [parseFloat(p[0]), parseFloat(p[1])];
    if (typeof p === 'object' && p !== null) {
      const lat = parseFloat(p.lat !== undefined ? p.lat : p.latitude);
      const lng = parseFloat(p.lng !== undefined ? p.lng : p.lon !== undefined ? p.lon : p.longitude);
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
    return null;
  }).filter(Boolean);
}

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

  // WebAuthn Biometrics State
  const [hasWebAuthn, setHasWebAuthn] = useState(false);
  const [isEnrollingWebAuthn, setIsEnrollingWebAuthn] = useState(false);
  const [webAuthnSuccess, setWebAuthnSuccess] = useState(null);
  const [webAuthnError, setWebAuthnError] = useState(null);
  const [isWebAuthnSupported, setIsWebAuthnSupported] = useState(true);

  // Email OTP Fallback State
  const [authMode, setAuthMode] = useState('webauthn'); // 'webauthn' | 'email_otp'
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpError, setOtpError] = useState(null);
  const [otpDevCode, setOtpDevCode] = useState(null);
  const [verifiedOtpToken, setVerifiedOtpToken] = useState(null);

  // Cryptographic Credential State (Backwards-compatibility)
  const [credentialPass, setCredentialPass] = useState(null);
  const [isEnrollingKey, setIsEnrollingKey] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [keyEnrollSuccess, setKeyEnrollSuccess] = useState(null);

  // Checkpoints & Task Distribution State
  const [checkpointProximity, setCheckpointProximity] = useState(null);
  const [activeTaskAssignment, setActiveTaskAssignment] = useState(null);
  const [taskPhotoFile, setTaskPhotoFile] = useState(null);
  const [taskPhotoPreview, setTaskPhotoPreview] = useState(null);
  const [taskAnswerText, setTaskAnswerText] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);
  const [taskSubmissionResult, setTaskSubmissionResult] = useState(null);
  const [studentVisits, setStudentVisits] = useState([]);
  const [checkingProximity, setCheckingProximity] = useState(false);

  const watchIdRef = useRef(null);
  const graceTimerRef = useRef(null);
  const otpCooldownTimerRef = useRef(null);

  // Check WebAuthn support and registered status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsWebAuthnSupported(Boolean(window.PublicKeyCredential));
    }
  }, []);

  useEffect(() => {
    if (!studentId || studentId.trim().length < 5) return;
    checkWebAuthnStatus(studentId.trim());
  }, [studentId]);

  const checkWebAuthnStatus = async (id) => {
    try {
      const res = await axios.get(`/api/auth/webauthn/status/${id}`);
      setHasWebAuthn(Boolean(res.data?.has_webauthn));
    } catch (err) {
      setHasWebAuthn(false);
    }
  };

  // OTP Cooldown Countdown Timer
  useEffect(() => {
    if (otpCooldown > 0) {
      otpCooldownTimerRef.current = setTimeout(() => {
        setOtpCooldown(otpCooldown - 1);
      }, 1000);
    }
    return () => clearTimeout(otpCooldownTimerRef.current);
  }, [otpCooldown]);

  // Load saved local private key / credential pass if available
  useEffect(() => {
    if (!studentId) return;
    const stored = localStorage.getItem(`tapin_credential_${studentId.trim()}`);
    if (stored) {
      try {
        setCredentialPass(JSON.parse(stored));
      } catch (e) {}
    } else {
      setCredentialPass(null);
    }
  }, [studentId]);

  // Fetch active events (filtered strictly for active status & student college eligibility)
  useEffect(() => {
    fetchActiveEvents();
  }, [studentInfo?.college]);

  const fetchActiveEvents = async (targetCollege = studentInfo?.college) => {
    setEventLoading(true);
    try {
      let eventsList = [];
      try {
        const res = await axios.get('/api/events/active/all', {
          params: {
            student_id: studentId.trim(),
            college: targetCollege || 'all'
          }
        });
        eventsList = Array.isArray(res.data) ? res.data : [];
      } catch (e1) {
        try {
          const res = await axios.get('/api/events/active', {
            params: {
              student_id: studentId.trim(),
              college: targetCollege || 'all'
            }
          });
          if (res.data) eventsList = [res.data];
        } catch (e2) {}
      }

      if (eventsList.length === 0) {
        try {
          const singleRes = await axios.get('/api/events/active');
          if (singleRes.data) eventsList = [singleRes.data];
        } catch (e3) {}
      }

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
        fetchActiveEvents(res.data?.college);
        if (activeEvent) {
          fetchStudentCheckpointStatus(activeEvent.id, res.data.student_id);
        }
      } catch (err) {
        setStudentInfo(null);
        setStudentError('Student ID not found in university database');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [studentId]);

  // Fetch Student Checkpoint Visits & Task History
  const fetchStudentCheckpointStatus = async (eventId, sId) => {
    if (!eventId || !sId) return;
    try {
      const res = await axios.get(`/api/checkpoints/student-status/${eventId}/${encodeURIComponent(sId)}`);
      setStudentVisits(res.data.visits || []);
    } catch (err) {}
  };

  // Evaluate Checkpoint Proximity when student coordinates update
  useEffect(() => {
    if (!coords || !activeEvent || !studentInfo) return;

    const checkProximity = async () => {
      setCheckingProximity(true);
      try {
        const res = await axios.post('/api/checkpoints/proximity', {
          student_id: studentInfo.student_id,
          event_id: activeEvent.id,
          lat: coords.lat,
          lng: coords.lng,
          accuracy: accuracy || 5,
          signature: credentialPass?.signature
        });

        setCheckpointProximity(res.data.proximity);
        if (res.data.taskAssignment) {
          setActiveTaskAssignment(res.data.taskAssignment);
        }
        fetchStudentCheckpointStatus(activeEvent.id, studentInfo.student_id);
      } catch (err) {
        console.error('Error evaluating checkpoint proximity:', err);
      } finally {
        setCheckingProximity(false);
      }
    };

    checkProximity();
  }, [coords?.lat, coords?.lng, activeEvent?.id, studentInfo?.student_id]);

  // Pure Ray-Casting Point-in-Polygon check for live client-side telemetry
  const isPointInPolygon = (point, polygon) => {
    const poly = normalizePolygon(polygon);
    if (!point || !poly || poly.length < 3) return false;
    const [lat, lng] = Array.isArray(point) ? point : [point.lat, point.lng];
    let inside = false;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const [lat1, lng1] = poly[i];
      const [lat2, lng2] = poly[j];

      // On-segment boundary check
      const minLat = Math.min(lat1, lat2) - 1e-7;
      const maxLat = Math.max(lat1, lat2) + 1e-7;
      const minLng = Math.min(lng1, lng2) - 1e-7;
      const maxLng = Math.max(lng1, lng2) + 1e-7;
      if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
        const cross = (lat - lat1) * (lng2 - lng1) - (lng - lng1) * (lat2 - lat1);
        if (Math.abs(cross) <= 1e-7) return true;
      }

      const intersects = ((lat1 > lat) !== (lat2 > lat)) &&
        (lng < (lng2 - lng1) * (lat - lat1) / (lat2 - lat1) + lng1);
      if (intersects) inside = !inside;
    }
    return inside;
  };

  // Re-evaluate Geofence containment whenever student coordinates OR activeEvent change
  useEffect(() => {
    if (!coords || !activeEvent) return;

    const { lat, lng } = coords;
    const dist = calculateHaversine(lat, lng, activeEvent.center_lat, activeEvent.center_lng);
    setDistanceMeters(dist);

    const poly = normalizePolygon(activeEvent.polygon_coordinates);
    let inside = false;
    if (poly.length >= 3) {
      inside = isPointInPolygon([lat, lng], poly);
    } else {
      inside = dist <= (activeEvent.radius_m || 100);
    }
    setInRange(inside);

    // Handle Grace Period Countdown
    if (!inside && !isGraceActive && !graceExpired) {
      startGraceCountdown(activeEvent.grace_minutes * 60);
    } else if (inside && isGraceActive) {
      resetGraceCountdown();
    }
  }, [coords, activeEvent]);

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
        body: 'You have been outside the event geofence polygon for longer than allowed. Please re-enter or time out.',
        icon: '/pwa-192x192.png'
      });
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  // 1. Enroll WebAuthn Biometrics (Face ID / Touch ID / Windows Hello)
  const handleEnrollWebAuthn = async () => {
    if (!studentId || !studentInfo) {
      alert('Please enter a valid Student ID first.');
      return;
    }

    setIsEnrollingWebAuthn(true);
    setWebAuthnError(null);
    setWebAuthnSuccess(null);

    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const res = await axios.post('/api/auth/webauthn/register-options', {
        student_id: studentId.trim()
      });

      const attResp = await startRegistration({ optionsJSON: res.data });

      const verifyRes = await axios.post('/api/auth/webauthn/register-verify', {
        student_id: studentId.trim(),
        response: attResp
      });

      if (verifyRes.data.success) {
        setHasWebAuthn(true);
        setWebAuthnSuccess('Device platform biometrics registered successfully! You can now check in with 1-tap Face ID / Touch ID.');
        setTimeout(() => setWebAuthnSuccess(null), 6000);
      }
    } catch (err) {
      setWebAuthnError(err.message || 'WebAuthn enrollment was cancelled or failed.');
    } finally {
      setIsEnrollingWebAuthn(false);
    }
  };

  // 2. Request Email OTP (Fallback Path)
  const handleRequestOtp = async () => {
    if (!studentId || !studentInfo) {
      alert('Please enter a valid Student ID first.');
      return;
    }

    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await axios.post('/api/auth/otp/request', {
        student_id: studentId.trim()
      });
      setOtpSent(true);
      setMaskedEmail(res.data.maskedEmail);
      setOtpCooldown(60);
      if (res.data.devCode) {
        setOtpDevCode(res.data.devCode);
      }
    } catch (err) {
      setOtpError(err.response?.data?.error || err.message);
    } finally {
      setOtpSending(false);
    }
  };

  // 3. Verify Email OTP Code
  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.trim().length !== 6) {
      setOtpError('Please enter a 6-digit numeric OTP code.');
      return null;
    }

    setOtpError(null);
    try {
      const res = await axios.post('/api/auth/otp/verify', {
        student_id: studentId.trim(),
        code: otpInput.trim()
      });
      setVerifiedOtpToken(res.data.token);
      return res.data.token;
    } catch (err) {
      setOtpError(err.response?.data?.error || err.message);
      return null;
    }
  };

  // 4. Biometric Scan helper for attendance submission
  const performBiometricCheckin = async () => {
    const { startAuthentication } = await import('@simplewebauthn/browser');
    const res = await axios.post('/api/auth/webauthn/login-options', {
      student_id: studentId.trim()
    });

    const authResp = await startAuthentication({ optionsJSON: res.data });

    const verifyRes = await axios.post('/api/auth/webauthn/login-verify', {
      student_id: studentId.trim(),
      response: authResp
    });

    return verifyRes.data.token;
  };

  // 1-Click Issue & Enroll Ed25519 Student Keypair
  const handleEnrollKeypair = async () => {
    if (!studentId || !studentInfo) {
      alert('Please enter a valid Student ID first.');
      return;
    }

    setIsEnrollingKey(true);
    try {
      const res = await axios.post(`/api/students/generate-keypair/${encodeURIComponent(studentId.trim())}`);
      const passData = res.data.credentialPass;
      setCredentialPass(passData);
      localStorage.setItem(`tapin_credential_${studentId.trim()}`, JSON.stringify(passData));
      
      setStudentInfo(prev => ({ ...prev, hasKeyEnrolled: true }));
      setKeyEnrollSuccess('Ed25519 Signed Credential Pass enrolled successfully! You can now present this pass or check in with 1 tap.');
      setTimeout(() => setKeyEnrollSuccess(null), 5000);
    } catch (err) {
      alert('Failed to enroll keypair: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsEnrollingKey(false);
    }
  };

  // Download Student Credential Pass
  const handleDownloadPass = () => {
    if (!credentialPass) return;
    const blob = new Blob([JSON.stringify(credentialPass, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tapin_pass_${studentId.trim()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Submit Time In / Time Out Attendance
  const [simulatedSpoofScenario, setSimulatedSpoofScenario] = useState('none');

  const handleSubmitAttendance = async () => {
    if (!studentId || !studentInfo) {
      setSubmissionError('Please enter a valid Student ID');
      return;
    }

    if (!coords && simulatedSpoofScenario === 'none') {
      setSubmissionError('Please grant location access before logging attendance.');
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);
    setSubmissionResult(null);

    let authToken = null;
    let authMethodToUse = authMode;

    // Step A: Perform Authentication Challenge
    if (authMode === 'webauthn') {
      if (hasWebAuthn) {
        try {
          authToken = await performBiometricCheckin();
        } catch (err) {
          setSubmitting(false);
          setSubmissionError('Biometric verification cancelled or failed: ' + err.message + '. You can switch to Email OTP verification.');
          return;
        }
      } else {
        authMethodToUse = 'signed_credential';
      }
    } else if (authMode === 'email_otp') {
      if (verifiedOtpToken) {
        authToken = verifiedOtpToken;
      } else {
        const token = await handleVerifyOtp();
        if (!token) {
          setSubmitting(false);
          return;
        }
        authToken = token;
      }
    }

    let submitLat = coords?.lat || (activeEvent ? activeEvent.center_lat : 18.1960);
    let submitLng = coords?.lng || (activeEvent ? activeEvent.center_lng : 120.5927);
    let submitAcc = accuracy || 5;
    let submitMotion = motionData;

    if (simulatedSpoofScenario === 'teleport' && activeEvent) {
      submitLat = activeEvent.center_lat + 0.3; // ~33km away teleport
      submitLng = activeEvent.center_lng + 0.3;
    } else if (simulatedSpoofScenario === 'static_accuracy') {
      submitAcc = 0.1; // unrealistically exact static accuracy
    } else if (simulatedSpoofScenario === 'sensor_mismatch') {
      submitLat = (activeEvent ? activeEvent.center_lat : 18.1960) + 0.05;
      submitMotion = { accelX: 0, accelY: 0, accelZ: 0 };
    }

    try {
      const res = await axios.post('/api/attendance/submit', {
        student_id: studentId.trim(),
        event_id: activeEvent?.id,
        lat: submitLat,
        lng: submitLng,
        accuracy: submitAcc,
        timestamp: new Date().toISOString(),
        motionData: submitMotion,
        auth_method: authMethodToUse,
        auth_token: authToken,
        signature: credentialPass?.signature
      });

      setSubmissionResult(res.data);
      if (authMode === 'email_otp') {
        setVerifiedOtpToken(null);
        setOtpSent(false);
        setOtpInput('');
      }
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

  // Submit Checkpoint Task (Photo or Text)
  const handleTaskPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setTaskPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => setTaskPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitTask = async () => {
    if (!activeTaskAssignment?.assignment?.id) return;
    const assignmentId = activeTaskAssignment.assignment.id;
    const taskType = activeTaskAssignment.task.task_type;

    if (taskType === 'photo' && !taskPhotoFile) {
      alert('Please take or choose a verification photo first.');
      return;
    }

    setSubmittingTask(true);
    setTaskSubmissionResult(null);

    const formData = new FormData();
    formData.append('student_id', studentId.trim());
    if (taskType === 'photo') {
      formData.append('photo', taskPhotoFile);
    } else {
      formData.append('answer_text', taskAnswerText);
    }
    if (credentialPass?.signature) {
      formData.append('signature', credentialPass.signature);
    }

    try {
      const res = await axios.post(`/api/checkpoints/tasks/${assignmentId}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTaskSubmissionResult(res.data);
      if (activeEvent) fetchStudentCheckpointStatus(activeEvent.id, studentId.trim());
    } catch (err) {
      if (err.response?.data) {
        setTaskSubmissionResult(err.response.data);
      } else {
        alert('Failed to submit task: ' + err.message);
      }
    } finally {
      setSubmittingTask(false);
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
    
    if (/^\d{3,}/.test(input) && !input.includes('-')) {
      input = `${input.slice(0, 2)}-${input.slice(2, 8)}`;
    }

    if (input.length > 9) {
      input = input.slice(0, 9);
    }

    setStudentId(input);
  };

  const isIdFormatValid = /^\d{2}-\d{6}$/.test(studentId.trim());

  return (
    <div className="w-full max-w-3xl mx-auto px-1 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      
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
              onClick={() => fetchActiveEvents(studentInfo?.college)}
              className="p-2.5 rounded-xl bg-slate-900/60 text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
              title="Refresh Event"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Event Geofence & Checkpoint Parameters */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 block font-medium">Geofence Boundary</span>
              <span className="text-xs sm:text-sm font-bold text-indigo-400">
                {normalizePolygon(activeEvent.polygon_coordinates).length >= 3
                  ? `Polygon (${normalizePolygon(activeEvent.polygon_coordinates).length} Nodes)`
                  : 'Custom Polygon'}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 block font-medium">Checkpoints</span>
              <span className="text-xs sm:text-sm font-bold text-cyan-400">
                {(activeEvent.checkpoints || []).length} Active Stations
              </span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 block font-medium">Grace Window</span>
              <span className="text-xs sm:text-sm font-bold text-amber-400">{activeEvent.grace_minutes}m</span>
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

      {/* Step 1: Location Access & Radar Card */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-4 border border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${coords ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
              <Compass className={`w-5 h-5 sm:w-6 sm:h-6 ${coords ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">1. Live Location Telemetry</h2>
              <p className="text-[11px] sm:text-xs text-slate-400">Verifying GPS coordinates against geofence & checkpoint zones.</p>
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
              TapIn uses browser Geolocation and signed cryptographic passes instead of fragile device biometrics.
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
              <span className="text-[10px] text-slate-400 block">Venue Boundary</span>
              <div className="text-xs sm:text-sm font-semibold">
                {inRange ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> In Polygon
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Outside Polygon
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live Visual Map Preview with Polygon Geofence and Checkpoint Overlays */}
        {activeEvent && (
          <div className="pt-2">
            <LiveGeofenceMap
              event={activeEvent}
              studentCoords={coords}
              studentAccuracy={accuracy}
              inRange={inRange}
              activeCheckpoint={checkpointProximity?.matchedCheckpoint}
              height="240px"
            />
          </div>
        )}

        {/* Grace Period Warning Banner */}
        {isGraceActive && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">Out of Bounds - Grace Period Active</h4>
                <p className="text-[11px] text-amber-200/80">Re-enter the venue polygon boundary before countdown expires.</p>
              </div>
            </div>
            <div className="text-xl font-mono font-bold text-amber-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-amber-500/30">
              {formatCountdown(graceSecondsLeft)}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Primary WebAuthn Biometrics & Email OTP Fallback Authentication */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-4 border border-slate-800">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">2. Biometric & Identity Verification</h2>
              <p className="text-xs text-slate-400">WebAuthn Platform Biometrics (Primary) or University Email OTP (Fallback).</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {authMode === 'webauthn' ? (
              hasWebAuthn ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Biometrics Enrolled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Enrollment Needed
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Mail className="w-3.5 h-3.5" />
                Email OTP Mode
              </span>
            )}
          </div>
        </div>

        {/* Auth Method Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
          <button
            type="button"
            onClick={() => setAuthMode('webauthn')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMode === 'webauthn'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Fingerprint className="w-4 h-4" />
            <span>WebAuthn Biometrics (Primary)</span>
          </button>

          <button
            type="button"
            onClick={() => setAuthMode('email_otp')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMode === 'email_otp'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email OTP (Fallback)</span>
          </button>
        </div>

        <div className="space-y-3">
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

          {/* Student Info Preview */}
          {studentInfo && (
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs text-slate-300">
              <div className="font-bold text-white text-sm flex items-center justify-between">
                <span>{studentInfo.name}</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  Year {studentInfo.year} • Sec {studentInfo.section || 'A'}
                </span>
              </div>
              <p className="text-slate-400">{studentInfo.course} • {studentInfo.college}</p>

              {/* Mode A: WebAuthn Platform Biometrics Card */}
              {authMode === 'webauthn' && (
                <div className="pt-3 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Fingerprint className={`w-5 h-5 ${hasWebAuthn ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <div>
                        <strong className="text-white block text-xs">
                          {hasWebAuthn ? 'Native Device Biometrics Enrolled' : 'Platform Biometrics Not Yet Enrolled'}
                        </strong>
                        <span className="text-[11px] text-slate-400">
                          {hasWebAuthn ? 'Touch ID / Face ID / Windows Hello is active' : 'Click below to bind this device with Face ID / Fingerprint'}
                        </span>
                      </div>
                    </div>

                    {!hasWebAuthn ? (
                      <button
                        type="button"
                        onClick={handleEnrollWebAuthn}
                        disabled={isEnrollingWebAuthn}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{isEnrollingWebAuthn ? 'Scanning Sensor...' : 'Register Device Biometrics'}</span>
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[11px]">
                        Ready to Time In/Out ✅
                      </span>
                    )}
                  </div>

                  {webAuthnSuccess && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>{webAuthnSuccess}</span>
                    </div>
                  )}

                  {webAuthnError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{webAuthnError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAuthMode('email_otp')}
                        className="text-cyan-400 underline font-bold cursor-pointer"
                      >
                        Use Email OTP
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mode B: Email One-Time-Passcode (OTP) Fallback Card */}
              {authMode === 'email_otp' && (
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-cyan-400 block">Registered University Email</span>
                        <strong className="text-white text-xs font-mono">
                          {maskedEmail || studentInfo.email || `${studentInfo.student_id.toLowerCase()}@mmsu.edu.ph`}
                        </strong>
                        <p className="text-[10px] text-slate-400">Non-editable • Pulled from verified university student roster.</p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={otpSending || otpCooldown > 0}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{otpSending ? 'Sending...' : otpCooldown > 0 ? `Resend in ${otpCooldown}s` : (otpSent ? 'Resend Code' : 'Send 6-Digit OTP')}</span>
                      </button>
                    </div>

                    {otpDevCode && (
                      <div className="p-2 rounded bg-slate-900 border border-cyan-500/30 text-[11px] text-cyan-300 font-mono flex items-center justify-between">
                        <span>🧪 Local Demo Verification Code:</span>
                        <strong className="text-white font-bold text-sm tracking-widest">{otpDevCode}</strong>
                      </div>
                    )}
                  </div>

                  {otpSent && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        Enter 6-Digit Email Verification Code
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                          placeholder="••••••"
                          maxLength={6}
                          className="w-40 px-3 py-2 rounded-xl bg-slate-950 border border-cyan-500/40 text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:border-cyan-400"
                        />

                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-600/20"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Verify Code</span>
                        </button>
                      </div>

                      {verifiedOtpToken && (
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>Email OTP verified successfully! You can now submit your Time In / Time Out below.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {otpError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{otpError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* QR Pass Download & Presentation (Backwards-compatibility) */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Portable Credential Pass:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View QR Pass</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPass}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    title="Download Pass JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Step 3: Checkpoint Mission & Task Verification HUD */}
      {activeEvent && (activeEvent.checkpoints || []).length > 0 && (
        <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-4 border border-cyan-500/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">3. Multi-Checkpoint Task Verification</h2>
                <p className="text-xs text-slate-400">Complete tasks at nested checkpoint zones to verify physical attendance.</p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {studentVisits.length}/{(activeEvent.checkpoints || []).length} Stations Completed
            </span>
          </div>

          {/* Checkpoint Station Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(activeEvent.checkpoints || []).map((cp, idx) => {
              const isVisited = studentVisits.some(v => v.checkpoint_id === cp.id);
              const isMatched = checkpointProximity?.matchedCheckpoint?.id === cp.id;

              return (
                <div
                  key={cp.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isVisited
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : isMatched
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-500/20 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Station #{cp.checkpoint_order || (idx + 1)}
                    </span>
                    {isVisited ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : isMatched ? (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    ) : null}
                  </div>
                  <h4 className="font-bold text-xs text-white truncate">{cp.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {isVisited ? 'Verified & Completed ✅' : isMatched ? 'Inside Zone (Task Active!)' : `Radius: ${cp.radius_m || 20}m`}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Active Assigned Task Box when in a Checkpoint Zone */}
          {activeTaskAssignment && activeTaskAssignment.task && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 space-y-3 animate-in fade-in">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 uppercase">
                    Assigned Checkpoint Mission
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1">{activeTaskAssignment.task.title}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">{activeTaskAssignment.task.description}</p>
                </div>
                <div className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 shrink-0">
                  {activeTaskAssignment.algorithmDetails?.mode || 'COLLISION-FREE'}
                </div>
              </div>

              {activeTaskAssignment.task.instructions && (
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                  <span className="font-semibold text-slate-200">Instructions: </span>
                  {activeTaskAssignment.task.instructions}
                </div>
              )}

              {/* Task Upload / Input Form */}
              {activeTaskAssignment.task.task_type === 'photo' ? (
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <span>Upload or Capture Verification Photo (EXIF + Duplicate Hash Analyzed)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleTaskPhotoChange}
                    className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer"
                  />

                  {taskPhotoPreview && (
                    <div className="relative mt-2 rounded-xl overflow-hidden border border-cyan-500/30 max-h-48 w-full bg-slate-950 flex items-center justify-center">
                      <img src={taskPhotoPreview} alt="Verification Preview" className="h-48 object-contain" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-medium text-slate-300">Your Response</label>
                  <input
                    type="text"
                    value={taskAnswerText}
                    onChange={(e) => setTaskAnswerText(e.target.value)}
                    placeholder="Enter requested answer / room number"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <button
                onClick={handleSubmitTask}
                disabled={submittingTask || (activeTaskAssignment.task.task_type === 'photo' && !taskPhotoFile)}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submittingTask ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing EXIF Geolocation & Perceptual Hash...
                  </span>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Submit & Verify Checkpoint Task</span>
                  </>
                )}
              </button>

              {/* Task Outcome Result */}
              {taskSubmissionResult && (
                <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 animate-in fade-in ${
                  taskSubmissionResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {taskSubmissionResult.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{taskSubmissionResult.message}</span>
                  </div>

                  {taskSubmissionResult.photoAnalysis && (
                    <div className="pt-1.5 border-t border-slate-800 text-[11px] grid grid-cols-2 gap-1.5 text-slate-300">
                      <div>EXIF GPS: <strong>{taskSubmissionResult.photoAnalysis.metadata.gpsExtracted ? 'Present' : 'Not found'}</strong></div>
                      <div>Hash Match: <strong className={taskSubmissionResult.photoAnalysis.duplicateDetection.isDuplicate ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{taskSubmissionResult.photoAnalysis.duplicateDetection.similarityPercentage} Duplicate</strong></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Anti-Spoof Tester & Attendance Submission */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">4. Final Attendance Check-in</h2>
            <p className="text-xs text-slate-400">Cryptographically signs your time-in / time-out record.</p>
          </div>
        </div>

        {/* Anti-Spoof Test Scenario Switcher */}
        <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/20 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              Anti-Spoofing Countermeasure Tester
            </span>
            <span className="text-[10px] text-purple-400 font-mono">Research Mode</span>
          </div>
          <select
            value={simulatedSpoofScenario}
            onChange={(e) => setSimulatedSpoofScenario(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-purple-800/60 text-white text-xs font-semibold focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="none">🟢 Normal Authentic GPS (Real Device Sensors)</option>
            <option value="teleport">🚨 Fake GPS Teleport (33km Physics Anomaly)</option>
            <option value="static_accuracy">🚨 Synthetic Static Accuracy (0.1m Static Range)</option>
            <option value="sensor_mismatch">🚨 Sensor Motion Mismatch (Zero Accelerometer Acceleration)</option>
          </select>
        </div>

        {/* Time In / Time Out Button */}
        <div className="pt-2">
          <button
            onClick={handleSubmitAttendance}
            disabled={submitting || !coords || !studentInfo || !activeEvent}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-sm text-white shadow-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
              authMode === 'email_otp'
                ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/25'
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-indigo-600/25'
            }`}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {authMode === 'webauthn' && hasWebAuthn ? 'Awaiting Biometric Sensor Scan...' : 'Verifying Identity & Telemetry...'}
              </span>
            ) : (
              <>
                {authMode === 'email_otp' ? (
                  <Mail className="w-5 h-5 fill-white text-white" />
                ) : (
                  <Fingerprint className="w-5 h-5 text-white" />
                )}
                <span>
                  {authMode === 'email_otp'
                    ? 'Verify Email OTP & Record Attendance'
                    : hasWebAuthn
                    ? 'Scan Biometrics & Record Attendance'
                    : 'Submit Signed Attendance (Biometrics Recommended)'}
                </span>
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

            {submissionResult.authVerification && (
              <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-300">
                Identity Auth: <strong className="text-emerald-400 font-semibold">{submissionResult.authVerification.modeDescription}</strong>
              </div>
            )}

            {submissionResult.spoofDetection && (
              <div className="pt-1 border-t border-slate-800 text-[11px] grid grid-cols-2 gap-2 text-slate-300">
                <div>Trust Score: <strong className="text-white">{submissionResult.spoofDetection.trustScore}/100</strong></div>
                <div>Spoof Flagged: <strong className={submissionResult.spoofDetection.isSpoofed ? 'text-rose-400' : 'text-emerald-400'}>{submissionResult.spoofDetection.isSpoofed ? 'YES' : 'NO'}</strong></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Pass Presentation Modal */}
      {showQrModal && credentialPass && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-2xl p-6 border border-indigo-500/40 space-y-4 text-center relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-3 bg-indigo-500/10 rounded-2xl w-14 h-14 mx-auto flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <QrCode className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">TapIn Cryptographic Pass</h3>
              <p className="text-xs text-slate-400">{studentInfo?.name} • {studentId}</p>
            </div>

            {/* Visual Pass Representation */}
            <div className="p-4 bg-white rounded-xl shadow-inner mx-auto w-48 h-48 flex flex-col items-center justify-center">
              <div className="w-40 h-40 border-4 border-slate-900 p-2 flex flex-col items-center justify-center text-slate-900 text-center">
                <Key className="w-10 h-10 text-indigo-600 mb-1" />
                <span className="text-[10px] font-mono font-bold break-all">ED25519-SIGNED</span>
                <span className="text-[9px] font-mono text-slate-600 mt-1">{studentId}</span>
                <span className="text-[8px] font-mono text-slate-400">{credentialPass.payload?.issued_at?.slice(0, 10)}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              This signed credential pass can be scanned at checkpoints or presented on any terminal.
            </p>

            <button
              onClick={handleDownloadPass}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Pass JSON File</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
