import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import {
  CheckSquare,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  X,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export default function TaskSubmissionsReview() {
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Modals
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [rejectModalData, setRejectModalData] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      setEvents(res.data || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedEventId !== 'all') params.event_id = selectedEventId;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await axios.get('/api/checkpoints/submissions', { params });
      setSubmissions(res.data.submissions || []);
      setStats(res.data.stats || { total: 0, pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      console.error('Failed to fetch task submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchSubmissions();

    const socket = io();
    socket.on('task_submission_updated', () => fetchSubmissions());
    socket.on('task_submission_approved', () => fetchSubmissions());
    socket.on('task_submission_rejected', () => fetchSubmissions());
    socket.on('task_submissions_bulk_approved', () => fetchSubmissions());

    return () => {
      socket.disconnect();
    };
  }, [selectedEventId, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSubmissions();
  };

  const handleApprove = async (id, studentName) => {
    setActionLoading(id);
    try {
      await axios.post(`/api/checkpoints/submissions/${id}/approve`, {
        notes: 'Approved by administrator'
      });
      fetchSubmissions();
    } catch (err) {
      alert('Failed to approve task: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectModalData) return;

    setActionLoading(rejectModalData.id);
    try {
      await axios.post(`/api/checkpoints/submissions/${rejectModalData.id}/reject`, {
        reason: rejectReason.trim() || 'Submission rejected by administrator. Please re-submit valid task verification.'
      });
      setRejectModalData(null);
      setRejectReason('');
      fetchSubmissions();
    } catch (err) {
      alert('Failed to reject task: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprovePending = async () => {
    const pendingIds = submissions.filter(s => s.status === 'submitted').map(s => s.id);
    if (pendingIds.length === 0) return;

    if (!window.confirm(`Are you sure you want to approve all ${pendingIds.length} pending task submissions?`)) {
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/checkpoints/submissions/bulk-approve', {
        submission_ids: pendingIds,
        notes: 'Bulk approved by administrator'
      });
      fetchSubmissions();
    } catch (err) {
      alert('Failed to bulk approve: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 py-4">
      {/* Top Header & Metrics Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CheckSquare className="w-7 h-7 text-indigo-400" />
            <span>Checkpoint Task Submissions Review</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review, verify, and approve physical student station submissions (photo EXIF analytics & text answers).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSubmissions}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {stats.pending > 0 && (
            <button
              type="button"
              onClick={handleBulkApprovePending}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Approve All Pending ({stats.pending})</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Submissions</span>
          <div className="text-2xl font-black text-white font-mono">{stats.total}</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 space-y-1">
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            Pending Approval
          </span>
          <div className="text-2xl font-black text-amber-400 font-mono">{stats.pending}</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-emerald-500/30 bg-emerald-500/5 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block">Approved & Verified</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">{stats.approved}</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-rose-500/30 bg-rose-500/5 space-y-1">
          <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block">Rejected Submissions</span>
          <div className="text-2xl font-black text-rose-400 font-mono">{stats.rejected}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
          {[
            { id: 'all', label: 'All Submissions', count: stats.total },
            { id: 'submitted', label: 'Pending Approval', count: stats.pending, badgeColor: 'bg-amber-500/20 text-amber-300' },
            { id: 'verified', label: 'Approved', count: stats.approved, badgeColor: 'bg-emerald-500/20 text-emerald-300' },
            { id: 'rejected', label: 'Rejected', count: stats.rejected, badgeColor: 'bg-rose-500/20 text-rose-300' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${tab.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 flex-1 min-w-[280px] justify-end">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All University Events</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>

          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Student ID, Name, Station..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </form>
        </div>
      </div>

      {/* Submissions Grid */}
      {loading ? (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-sm animate-pulse space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
          <span>Loading task submissions...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No Task Submissions Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {statusFilter === 'submitted'
                ? 'Great news! All submitted checkpoint tasks have been reviewed and approved.'
                : 'No student checkpoint task assignments match your selected event and search filters.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {submissions.map((sub) => {
            const isPending = sub.status === 'submitted';
            const isVerified = sub.status === 'verified';
            const isRejected = sub.status === 'rejected';

            return (
              <div
                key={sub.id}
                className={`glass-card rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between space-y-4 ${
                  isPending
                    ? 'border-amber-500/40 bg-amber-950/10 shadow-lg shadow-amber-500/5'
                    : isVerified
                    ? 'border-emerald-500/30 bg-emerald-950/5'
                    : 'border-rose-500/30 bg-rose-950/5'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-400 block">{sub.student_id}</span>
                      <h3 className="text-sm font-bold text-white leading-snug">{sub.student_name}</h3>
                      <p className="text-[11px] text-slate-400">
                        {sub.student_course} • Yr {sub.student_year}-{sub.student_section || 'A'}
                      </p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 flex items-center gap-1 ${
                      isPending
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                        : isVerified
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}>
                      {isPending && <Clock className="w-3 h-3" />}
                      {isVerified && <CheckCircle className="w-3 h-3" />}
                      {isRejected && <XCircle className="w-3 h-3" />}
                      <span>{isPending ? 'Pending Approval' : isVerified ? 'Verified' : 'Rejected'}</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Station #{sub.checkpoint_order}:</span>
                      <strong className="text-cyan-300 font-semibold">{sub.checkpoint_name}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Assigned Task:</span>
                      <strong className="text-white font-semibold">{sub.task_title}</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{sub.event_name}</div>
                  </div>

                  {sub.photo_url ? (
                    <div className="space-y-2">
                      <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-video group">
                        <img
                          src={sub.photo_url}
                          alt="Student Task Submission"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewPhotoUrl(sub.photo_url)}
                          className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white font-bold cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Full Photo</span>
                        </button>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">EXIF Camera GPS:</span>
                          <span className={sub.exif_metadata?.gpsExtracted ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                            {sub.exif_metadata?.gpsExtracted ? '✔ GPS Embedded' : 'No GPS Metadata'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Anti-Collusion dHash:</span>
                          <span className={sub.flag_duplicate ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                            {sub.flag_duplicate ? `🚨 Duplicate Flagged` : '✔ Unique Image'}
                          </span>
                        </div>
                        {sub.duplicate_reason && (
                          <p className="text-[10px] text-rose-300/90 pt-0.5 border-t border-slate-800">
                            {sub.duplicate_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Submitted Text Answer:</span>
                      <p className="text-slate-200 font-mono text-[11px] bg-slate-950 p-2 rounded-lg border border-slate-800/60 whitespace-pre-wrap">
                        {sub.submission_data || 'No text answer provided.'}
                      </p>
                    </div>
                  )}

                  {sub.admin_notes && (
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Admin Note:</span>
                      <p className="text-slate-300">{sub.admin_notes}</p>
                      <span className="text-[9px] text-slate-400 block">
                        Reviewed by {sub.reviewed_by || 'Admin'} • {sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(sub.id, sub.student_name)}
                        disabled={actionLoading === sub.id}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{actionLoading === sub.id ? 'Approving...' : 'Approve'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRejectModalData(sub);
                          setRejectReason('');
                        }}
                        disabled={actionLoading === sub.id}
                        className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-rose-400 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  ) : isVerified ? (
                    <div className="w-full flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Approved & Completed
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectModalData(sub);
                          setRejectReason('');
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-400 underline cursor-pointer"
                      >
                        Revoke / Reject
                      </button>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between text-xs">
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Rejected
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApprove(sub.id, sub.student_name)}
                        className="text-[11px] text-emerald-400 hover:underline font-bold cursor-pointer"
                      >
                        Re-Approve
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full glass-card rounded-2xl p-4 border border-slate-700 space-y-3 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-white">Full Photo Submission Preview</h3>
            <div className="rounded-xl overflow-hidden max-h-[75vh] flex items-center justify-center bg-black">
              <img src={previewPhotoUrl} alt="High resolution preview" className="max-h-[75vh] w-auto object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 border border-rose-500/40 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Reject Task Submission</span>
              </h3>
              <button
                onClick={() => setRejectModalData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Rejecting submission for <strong>{rejectModalData.student_name}</strong> ({rejectModalData.student_id}). This will prompt the student to re-submit in their HUD.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Rejection Reason / Feedback</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Photo blurry / unreadable, duplicate photo detected, wrong station landmark..."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalData(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading === rejectModalData.id}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  {actionLoading === rejectModalData.id ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
