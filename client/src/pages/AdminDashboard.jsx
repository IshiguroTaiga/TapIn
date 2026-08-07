import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import LiveGeofenceMap from '../components/LiveGeofenceMap';
import {
  Users,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Radio,
  RefreshCw,
  Search,
  Filter,
  Activity,
  ChevronLeft,
  ChevronRight,
  Layers
} from 'lucide-react';

export default function AdminDashboard() {
  const [eventsList, setEventsList] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('active_latest');
  const [activeEvent, setActiveEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalActive: 0,
    inRangeCount: 0,
    outRangeCount: 0,
    flaggedCount: 0
  });
  const [students, setStudents] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination for large attendee counts
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const autoRefreshTimerRef = useRef(null);

  useEffect(() => {
    fetchAllEvents();

    // Socket.io Real-time Connection
    const socket = io();

    socket.on('connect', () => {
      console.log('[Socket.io] Admin connected to live telemetry stream');
    });

    socket.on('attendance_updated', () => {
      fetchLiveTelemetry();
    });

    socket.on('events_updated', () => {
      fetchAllEvents();
    });

    // Auto-refresh polling every 5 seconds for background sync
    autoRefreshTimerRef.current = setInterval(() => {
      fetchLiveTelemetry();
    }, 5000);

    return () => {
      socket.disconnect();
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchLiveTelemetry();
  }, [selectedEventId]);

  const fetchAllEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      setEventsList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch events list:', err);
    }
  };

  const fetchLiveTelemetry = async () => {
    try {
      let targetEventId = selectedEventId;

      if (targetEventId === 'active_latest') {
        const activeRes = await axios.get('/api/events/active');
        if (activeRes.data) {
          setActiveEvent(activeRes.data);
          targetEventId = activeRes.data.id;
        } else {
          setActiveEvent(null);
          return;
        }
      } else {
        const singleRes = await axios.get(`/api/events/${targetEventId}`);
        setActiveEvent(singleRes.data);
      }

      if (targetEventId) {
        const liveRes = await axios.get(`/api/attendance/live/${targetEventId}`);
        setSummary(liveRes.data.summary);
        setStudents(liveRes.data.students);
        setRecentActivity(liveRes.data.recentActivity);
      }
    } catch (err) {
      console.error('Failed to fetch live admin telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.student_id.toLowerCase().includes(search.toLowerCase()) ||
                          s.name.toLowerCase().includes(search.toLowerCase()) ||
                          s.college.toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === 'in_range') return matchesSearch && s.in_range === 1 && s.is_spoofed === 0;
    if (statusFilter === 'out_range') return matchesSearch && s.in_range === 0 && s.is_spoofed === 0;
    if (statusFilter === 'flagged') return matchesSearch && (s.is_spoofed === 1 || s.status === 'rejected');
    return matchesSearch;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      
      {/* Header & Event Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Live Attendance & Telemetry Feed</h1>
          </div>
          <p className="text-xs text-slate-400">Real-time telemetry stream & geofence monitoring</p>
        </div>

        {/* Active Event Selector & Refresh */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs w-full sm:w-auto">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-white font-semibold focus:outline-none w-full sm:w-auto cursor-pointer"
            >
              <option value="active_latest">⚡ Latest Active Event</option>
              {eventsList.map(e => (
                <option key={e.id} value={e.id}>
                  [{e.status.toUpperCase()}] #{e.id} - {e.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchLiveTelemetry}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer min-h-[40px] shrink-0"
            title="Force refresh data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Attendees</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{summary.totalActive}</div>
          <span className="text-[10px] text-slate-500">Recorded student logs</span>
        </div>

        <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 space-y-1">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
            <span>In-Range Verified</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400">{summary.inRangeCount}</div>
          <span className="text-[10px] text-emerald-500/80">Inside geofence radius</span>
        </div>

        <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-amber-500/20 bg-amber-950/20 space-y-1">
          <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
            <span>Out-of-Range (Grace)</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-400">{summary.outRangeCount}</div>
          <span className="text-[10px] text-amber-500/80">Grace period active</span>
        </div>

        <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-rose-500/20 bg-rose-950/20 space-y-1">
          <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
            <span>Spoof Alerts</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400">{summary.flaggedCount}</div>
          <span className="text-[10px] text-rose-500/80">Anomaly / Rejected</span>
        </div>
      </div>

      {/* Live Campus Map & Geofence Perimeter Radar */}
      {activeEvent ? (
        <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
            <span className="font-bold flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
              Live Campus Map Telemetry ({activeEvent.name})
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Geofence Radius: {activeEvent.radius_m}m • Grace: {activeEvent.grace_minutes}m</span>
          </div>
          <LiveGeofenceMap
            event={activeEvent}
            studentsList={students}
            height="300px"
          />
        </div>
      ) : (
        <div className="p-6 glass-card rounded-2xl border border-slate-800 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold text-white">No Event Selected / Open</h3>
          <p className="text-xs text-slate-400">Select an event from the top switcher to monitor its live telemetry feed.</p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Live Student Telemetry Roster */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
              Live Student Roster ({filteredStudents.length})
            </h2>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search ID, Name..."
                  className="w-full sm:w-44 pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="in_range">In-Range</option>
                <option value="out_range">Out-of-Range</option>
                <option value="flagged">Flagged / Spoofed</option>
              </select>
            </div>
          </div>

          {/* Student Telemetry Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">College & Course</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Geofence Status</th>
                  <th className="py-2.5 px-3">Spoof Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedStudents.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500">
                      No active student records matching filters.
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((s) => (
                    <tr key={s.id || s.student_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{s.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{s.student_id}</div>
                      </td>

                      <td className="py-3 px-3 text-slate-400">
                        <div className="truncate max-w-[180px]">{s.college}</div>
                        <div className="text-[10px] text-slate-500">{s.course} (Yr {s.year}, Sec {s.section || 'A'})</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.action === 'time_in' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {s.action}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {s.in_range === 1 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> In-Range
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                            <Clock className="w-3.5 h-3.5" /> Grace Active
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold ${
                            s.trust_score >= 80 ? 'text-emerald-400' : s.trust_score >= 60 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {s.trust_score}/100
                          </span>

                          {s.is_spoofed === 1 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              SPOOFED
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Roster Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
              <span>Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length}</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono font-semibold text-white">Page {currentPage} of {totalPages}</span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Live Event Activity Stream */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            Recent Activity Log
          </h2>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No recent location reports logged.</p>
            ) : (
              recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold text-white">{log.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{log.student_id} • {log.action.toUpperCase()}</span>
                    <span className={log.in_range ? 'text-emerald-400' : 'text-amber-400'}>
                      {log.in_range ? 'In Geofence' : 'Outside Radius'}
                    </span>
                  </div>

                  {log.spoof_flags && (
                    <div className="text-[10px] text-rose-400 font-mono bg-rose-950/40 p-1 rounded border border-rose-500/20">
                      Flags: {log.spoof_flags}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
