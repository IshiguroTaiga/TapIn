import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { MMSU_COLLEGES } from '../constants/colleges';
import {
  FileText,
  Download,
  Filter,
  Search,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  FileSpreadsheet,
  FileCode,
  Key,
  ShieldCheck
} from 'lucide-react';

import io from 'socket.io-client';

export default function AttendanceLogs() {
  const [logs, setLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [eventId, setEventId] = useState('all');
  const [college, setCollege] = useState('all');
  const [course, setCourse] = useState('all');
  const [year, setYear] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchEvents();
    fetchLogs();

    const socket = io();
    socket.on('attendance_updated', () => {
      fetchLogs();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/attendance/history', {
        params: {
          event_id: eventId,
          college,
          course,
          year,
          status
        }
      });
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [eventId, college, course, year, status]);

  const filteredLogs = logs.filter(l =>
    l.student_id.toLowerCase().includes(search.toLowerCase()) ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.event_name.toLowerCase().includes(search.toLowerCase())
  );

  // Export handlers
  const exportCSV = () => {
    window.open(`/api/attendance/export/csv?event_id=${eventId}`, '_blank');
  };

  const exportExcel = () => {
    const dataToExport = filteredLogs.map(l => ({
      'Log ID': l.id,
      'Timestamp': new Date(l.timestamp).toLocaleString(),
      'Event': l.event_name,
      'Student ID': l.student_id,
      'Student Name': l.name,
      'College': l.college,
      'Course': l.course,
      'Year': l.year,
      'Section': l.section || 'A',
      'Action': l.action,
      'Geofence': l.in_range ? 'Inside Polygon' : 'Outside Boundary',
      'Trust Score': l.trust_score,
      'Signature Valid': l.signature_valid ? 'Verified (Ed25519)' : 'Unsigned',
      'Spoofed': l.is_spoofed ? 'YES' : 'No',
      'Spoof Flags': l.spoof_flags || '',
      'Status': l.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance_Logs');
    XLSX.writeFile(wb, `tapin_attendance_${Date.now()}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text('TapIn Attendance Records Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()} | Total Records: ${filteredLogs.length}`, 14, 22);

    const tableData = filteredLogs.map(l => [
      new Date(l.timestamp).toLocaleString(),
      l.student_id,
      l.name,
      l.college,
      l.event_name,
      l.action.toUpperCase(),
      l.in_range ? 'Inside Polygon' : 'Outside',
      l.signature_valid ? 'Verified' : 'Unsigned',
      `${l.trust_score}/100`,
      l.status.toUpperCase()
    ]);

    doc.autoTable({
      head: [['Timestamp', 'Student ID', 'Name', 'College', 'Event', 'Action', 'Geofence', 'Signature', 'Trust', 'Status']],
      body: tableData,
      startY: 26,
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    doc.save(`tapin_attendance_${Date.now()}.pdf`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
            Attendance Logs & Audit Trail
          </h1>
          <p className="text-xs text-slate-400">Complete historical records with Ed25519 signature verification, geofence, and spoof audits.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={exportExcel}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={exportPDF}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div>
          <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Event</label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
          >
            <option value="all">All Events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">College</label>
          <select
            value={college}
            onChange={(e) => setCollege(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
          >
            <option value="all">All Colleges</option>
            {MMSU_COLLEGES.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Year Level</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
          >
            <option value="all">All Years</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
        </div>

        <div>
          <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
          >
            <option value="all">All Statuses</option>
            <option value="valid">Valid (Verified)</option>
            <option value="borderline">Borderline (Grace)</option>
            <option value="rejected">Rejected (Spoof/Out)</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Search ID / Name / Event</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or event..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-3">Timestamp</th>
              <th className="py-3 px-3">Student Details</th>
              <th className="py-3 px-3">Event</th>
              <th className="py-3 px-3">Action</th>
              <th className="py-3 px-3">Geofence</th>
              <th className="py-3 px-3">Credential Auth</th>
              <th className="py-3 px-3">Trust Score</th>
              <th className="py-3 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-500">Loading attendance history...</td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-500">No attendance logs matching selected criteria.</td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>

                  <td className="py-3 px-3">
                    <div className="font-semibold text-white">{log.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{log.student_id} • {log.college}</div>
                  </td>

                  <td className="py-3 px-3 text-slate-300 font-medium">
                    {log.event_name}
                  </td>

                  <td className="py-3 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.action === 'time_in' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'
                    }`}>
                      {log.action}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    {log.in_range ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> In Polygon
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Outside Boundary
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    {log.signature_valid ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5" /> Ed25519 Signed
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium flex items-center gap-1 text-[11px]">
                        <Key className="w-3.5 h-3.5" /> Unsigned
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono font-bold ${
                        log.trust_score >= 80 ? 'text-emerald-400' : log.trust_score >= 60 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {log.trust_score}/100
                      </span>
                      {log.spoof_flags && (
                        <span className="text-[9px] px-1 py-0.5 bg-rose-500/20 text-rose-400 rounded max-w-[120px] truncate" title={log.spoof_flags}>
                          {log.spoof_flags}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.status === 'valid' ? 'bg-emerald-500/20 text-emerald-400' : log.status === 'borderline' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
