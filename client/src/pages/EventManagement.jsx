import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GeofenceMapPicker from '../components/GeofenceMapPicker';
import { MMSU_COLLEGES } from '../constants/colleges';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  MapPin,
  Clock,
  Filter,
  CheckCircle,
  XCircle,
  Save,
  AlertCircle
} from 'lucide-react';

export default function EventManagement() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Form State (Default to Laoag City, Ilocos Norte)
  const [customEventId, setCustomEventId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [centerLat, setCenterLat] = useState(18.1960);
  const [centerLng, setCenterLng] = useState(120.5927);
  const [radiusMeters, setRadiusMeters] = useState(150);
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [status, setStatus] = useState('active');

  // Time Windows State
  const [windows, setWindows] = useState([
    { window_type: 'time_in', start_time: '2026-08-02T07:00', end_time: '2026-08-02T08:30' },
    { window_type: 'time_out', start_time: '2026-08-02T16:30', end_time: '2026-08-02T18:00' }
  ]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingEvent(null);
    setCustomEventId('');
    setName('');
    setDescription('');
    setCenterLat(18.1960);
    setCenterLng(120.5927);
    setRadiusMeters(150);
    setGraceMinutes(15);
    setCollegeFilter('all');
    setCourseFilter('all');
    setYearFilter('all');
    setStatus('active');
    setWindows([
      { window_type: 'time_in', start_time: new Date().toISOString().slice(0, 16), end_time: new Date(Date.now() + 3600000).toISOString().slice(0, 16) }
    ]);
    setShowModal(true);
  };

  const handleOpenEditModal = (event) => {
    setEditingEvent(event);
    setCustomEventId(String(event.id));
    setName(event.name);
    setDescription(event.description || '');
    setCenterLat(event.center_lat);
    setCenterLng(event.center_lng);
    setRadiusMeters(event.radius_m);
    setGraceMinutes(event.grace_minutes);
    setCollegeFilter(event.college_filter || 'all');
    setCourseFilter(event.course_filter || 'all');
    setYearFilter(event.year_filter || 'all');
    setStatus(event.status);
    setWindows(event.windows || []);
    setShowModal(true);
  };

  const handleAddWindow = () => {
    setWindows([
      ...windows,
      { window_type: 'time_in', start_time: new Date().toISOString().slice(0, 16), end_time: new Date(Date.now() + 3600000).toISOString().slice(0, 16) }
    ]);
  };

  const handleRemoveWindow = (index) => {
    setWindows(windows.filter((_, idx) => idx !== index));
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    const payload = {
      id: customEventId ? parseInt(customEventId) : undefined,
      new_id: customEventId ? parseInt(customEventId) : undefined,
      name,
      description,
      center_lat: parseFloat(centerLat),
      center_lng: parseFloat(centerLng),
      radius_m: parseFloat(radiusMeters),
      grace_minutes: parseInt(graceMinutes),
      college_filter: collegeFilter,
      course_filter: courseFilter,
      year_filter: yearFilter,
      status,
      windows
    };

    try {
      if (editingEvent) {
        await axios.put(`/api/events/${editingEvent.id}`, payload);
      } else {
        await axios.post('/api/events', payload);
      }
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      alert('Failed to save event: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteEvent = async (id) => {
    if (confirm('Are you sure you want to delete this event and all associated logs?')) {
      try {
        await axios.delete(`/api/events/${id}`);
        fetchEvents();
      } catch (err) {
        alert('Failed to delete event: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
            University Event Geofence Configuration
          </h1>
          <p className="text-xs text-slate-400">Manage event boundaries, scheduled time-in/out windows, and grace periods.</p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 self-start sm:self-auto transition-all cursor-pointer min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm">Loading event configurations...</div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-400 text-sm">
          No university events created yet. Click "Create New Event" to set up a geofenced assembly.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map((event) => (
            <div key={event.id} className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 hover:border-slate-700 transition-all shadow-xl">
              
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      event.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {event.status}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">ID #{event.id}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{event.name}</h3>
                  <p className="text-xs text-slate-300">{event.description}</p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(event)}
                    className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-indigo-400 border border-slate-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Geofence Parameters */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Center Coords</span>
                  <span className="font-mono text-slate-300">{event.center_lat.toFixed(4)}, {event.center_lng.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Geofence Radius</span>
                  <span className="font-bold text-indigo-400">{event.radius_m} meters</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Grace Period</span>
                  <span className="font-bold text-amber-400">{event.grace_minutes} minutes</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">College Filter</span>
                  <span className="font-medium text-purple-300 truncate block">{event.college_filter}</span>
                </div>
              </div>

              {/* Time Windows */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Scheduled Windows</span>
                {event.windows && event.windows.length > 0 ? (
                  <div className="space-y-1">
                    {event.windows.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 text-slate-300 border border-slate-800 text-[11px]">
                        <span className={`font-bold uppercase ${w.window_type === 'time_in' ? 'text-indigo-400' : 'text-purple-400'}`}>
                          {w.window_type}
                        </span>
                        <span>{new Date(w.start_time).toLocaleString()} → {new Date(w.end_time).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-[11px]">No specific time windows configured.</p>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">
                {editingEvent ? 'Edit Event Configuration' : 'Create New Geofenced Event'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Event ID / Number</label>
                  <input
                    type="number"
                    value={customEventId}
                    onChange={(e) => setCustomEventId(e.target.value)}
                    placeholder="Auto or Custom (e.g. 1, 101)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-500 block">Editable unique ID</span>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-slate-300 font-medium">Event Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. University Convocation 2026"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                >
                  <option value="active">Active (Open for Attendance)</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="closed">Closed / Finished</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="2"
                  placeholder="Event purpose or guidelines"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              {/* Geofence Map Center & Radius */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                {/* Interactive Leaflet Map Picker Bounded to Ilocos Norte */}
                <GeofenceMapPicker
                  centerLat={centerLat}
                  centerLng={centerLng}
                  radiusMeters={radiusMeters}
                  onChangeCenter={(lat, lng) => {
                    setCenterLat(Math.round(lat * 100000) / 100000);
                    setCenterLng(Math.round(lng * 100000) / 100000);
                  }}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400">Center Latitude</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={centerLat}
                      onChange={(e) => setCenterLat(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">Center Longitude</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={centerLng}
                      onChange={(e) => setCenterLng(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400">Geofence Radius: <strong className="text-indigo-400">{radiusMeters}m</strong></label>
                    <input
                      type="range"
                      min="30"
                      max="500"
                      step="10"
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(e.target.value)}
                      className="w-full accent-indigo-500 mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400">Grace Period: <strong className="text-amber-400">{graceMinutes} mins</strong></label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={graceMinutes}
                      onChange={(e) => setGraceMinutes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-slate-400">Target College Filter</label>
                  <select
                    value={collegeFilter}
                    onChange={(e) => setCollegeFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                  >
                    <option value="all">All Colleges (General Assembly)</option>
                    {MMSU_COLLEGES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time Windows Config */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-400" />
                    Scheduled Time Windows
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddWindow}
                    className="px-2.5 py-1 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium"
                  >
                    + Add Window
                  </button>
                </div>

                {windows.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <select
                      value={w.window_type}
                      onChange={(e) => {
                        const newW = [...windows];
                        newW[idx].window_type = e.target.value;
                        setWindows(newW);
                      }}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-white text-[11px]"
                    >
                      <option value="time_in">Time In</option>
                      <option value="time_out">Time Out</option>
                    </select>

                    <input
                      type="datetime-local"
                      value={w.start_time ? w.start_time.slice(0, 16) : ''}
                      onChange={(e) => {
                        const newW = [...windows];
                        newW[idx].start_time = e.target.value;
                        setWindows(newW);
                      }}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-white text-[11px]"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="datetime-local"
                      value={w.end_time ? w.end_time.slice(0, 16) : ''}
                      onChange={(e) => {
                        const newW = [...windows];
                        newW[idx].end_time = e.target.value;
                        setWindows(newW);
                      }}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-white text-[11px]"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveWindow(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 bg-slate-900 border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Event</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
