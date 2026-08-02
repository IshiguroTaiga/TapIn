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
  FileCode
} from 'lucide-react';

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
      'Action': l.action.toUpperCase(),
      'In Geofence Radius': l.in_range ? 'Yes' : 'No',
      'Trust Score': l.trust_score,
      'Spoof Flagged': l.is_spoofed ? 'YES' : 'No',
      'Flags': l.spoof_flags || '',
      'Status': l.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Logs');
    XLSX.writeFile(workbook, `tapin_attendance_report_${Date.now()}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text('TapIn University Attendance Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Filtered Count: ${filteredLogs.length}`, 14, 22);

    const tableColumn = ['Timestamp', 'Student ID', 'Name', 'College', 'Action', 'In Range', 'Trust', 'Status'];
    const tableRows = filteredLogs.map(l => [
      new Date(l.timestamp).toLocaleString(),
      l.student_id,
      l.name,
      l.college,
      l.action.toUpperCase(),
      l.in_range ? 'Yes' : 'No',
      `${l.trust_score}/100`,
      l.status
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`tapin_attendance_summary_${Date.now()}.pdf`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header & Export Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            Attendance History & Export Center
          </h1>
          <p className="text-xs text-slate-400">Filter, inspect, and export verified attendance records and spoofing telemetry.</p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            onClick={exportExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Excel</span>
          </button>

          <button
            onClick={exportPDF}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Report</span>
          </button>
        </div>
      </div>

      {/* Filter Control Panel */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        
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
              <option key={c} value={c}>{c}</option>
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

        <div>
          <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Search ID / Name</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
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
              <th className="py-3 px-3">Trust Score</th>
              <th className="py-3 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500">Loading attendance history...</td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500">No attendance logs matching selected criteria.</td>
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
                        <CheckCircle className="w-3.5 h-3.5" /> Inside
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Outside
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
                        <span className="text-[9px] px-1 py-0.5 bg-rose-500/20 text-rose-400 rounded">
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
