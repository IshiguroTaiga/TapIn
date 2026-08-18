import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GeofenceMapPicker from '../components/GeofenceMapPicker';
import CheckpointMapPicker from '../components/CheckpointMapPicker';
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
  AlertCircle,
  CheckSquare,
  Shuffle,
  Copy,
  Layers,
  Camera,
  FileText,
  X,
  Target,
  ListTodo
} from 'lucide-react';

export default function EventManagement() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Checkpoints Modal State
  const [showCheckpointsModal, setShowCheckpointsModal] = useState(false);
  const [activeCheckpointEvent, setActiveCheckpointEvent] = useState(null);
  const [checkpointsList, setCheckpointsList] = useState([]);
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState(0);
  const [allowDuplicateTasks, setAllowDuplicateTasks] = useState(false);
  const [randomizeTasks, setRandomizeTasks] = useState(false);
  const [taskCollisionWindowMinutes, setTaskCollisionWindowMinutes] = useState(10);
  const [savingCheckpoints, setSavingCheckpoints] = useState(false);
  const [checkpointError, setCheckpointError] = useState(null);

  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskType, setNewTaskType] = useState('photo');
  const [newTaskInstructions, setNewTaskInstructions] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // Form State (Default to Laoag City, Ilocos Norte)
  const [customEventId, setCustomEventId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [polygonCoordinates, setPolygonCoordinates] = useState([
    [18.1960, 120.5920],
    [18.1972, 120.5920],
    [18.1972, 120.5936],
    [18.1960, 120.5936]
  ]);
  const [centerLat, setCenterLat] = useState(18.1965);
  const [centerLng, setCenterLng] = useState(120.5928);
  const [radiusMeters, setRadiusMeters] = useState(120);
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
    const defaultPoly = [
      [18.1960, 120.5920],
      [18.1972, 120.5920],
      [18.1972, 120.5936],
      [18.1960, 120.5936]
    ];
    setPolygonCoordinates(defaultPoly);
    setCenterLat(18.1965);
    setCenterLng(120.5928);
    setRadiusMeters(120);
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
    
    let poly = event.polygon_coordinates;
    if (typeof poly === 'string') {
      try { poly = JSON.parse(poly); } catch (e) { poly = []; }
    }
    setPolygonCoordinates(Array.isArray(poly) && poly.length >= 3 ? poly : [
      [18.1960, 120.5920],
      [18.1972, 120.5920],
      [18.1972, 120.5936],
      [18.1960, 120.5936]
    ]);
    setCenterLat(event.center_lat);
    setCenterLng(event.center_lng);
    setRadiusMeters(event.radius_m || 120);
    setGraceMinutes(event.grace_minutes || 15);
    setCollegeFilter(event.college_filter || 'all');
    setCourseFilter(event.course_filter || 'all');
    setYearFilter(event.year_filter || 'all');
    setStatus(event.status || 'active');
    setWindows(event.windows || []);
    setShowModal(true);
  };

  const handleOpenCheckpointsModal = async (event) => {
    setActiveCheckpointEvent(event);
    setCheckpointError(null);
    setCheckpointsList(event.checkpoints || []);
    setSelectedCheckpointIndex(0);
    setAllowDuplicateTasks(Boolean(event.allow_duplicate_tasks));
    setRandomizeTasks(Boolean(event.randomize_tasks));
    setTaskCollisionWindowMinutes(event.task_collision_window_minutes || 10);
    setShowCheckpointsModal(true);

    try {
      const res = await axios.get(`/api/checkpoints/event/${event.id}`);
      if (res.data) {
        setCheckpointsList(res.data.checkpoints || []);
        setAllowDuplicateTasks(Boolean(res.data.allowDuplicateTasks));
        setRandomizeTasks(Boolean(res.data.randomizeTasks));
        setTaskCollisionWindowMinutes(res.data.taskCollisionWindowMinutes || 10);
      }
    } catch (err) {
      console.warn('Could not sync remote checkpoints:', err.message);
    }
  };

  const handleAddCheckpoint = () => {
    if (checkpointsList.length >= 3) {
      alert('Maximum of 3 checkpoints per event allowed.');
      return;
    }
    const cLat = activeCheckpointEvent?.center_lat || 18.1960;
    const cLng = activeCheckpointEvent?.center_lng || 120.5927;
    const offset = (checkpointsList.length + 1) * 0.0002;

    const newCp = {
      id: null,
      name: `Station #${checkpointsList.length + 1}`,
      description: 'Checkpoint Zone',
      lat: Math.round((cLat + offset) * 100000) / 100000,
      lng: Math.round((cLng + offset) * 100000) / 100000,
      radius_m: 20.0,
      tasks: []
    };

    const updated = [...checkpointsList, newCp];
    setCheckpointsList(updated);
    setSelectedCheckpointIndex(updated.length - 1);
  };

  const handleUpdateSelectedCheckpoint = (field, value) => {
    if (selectedCheckpointIndex < 0 || selectedCheckpointIndex >= checkpointsList.length) return;
    const updated = [...checkpointsList];
    updated[selectedCheckpointIndex][field] = value;
    setCheckpointsList(updated);
  };

  const handleRemoveCheckpoint = (index) => {
    const updated = checkpointsList.filter((_, i) => i !== index);
    setCheckpointsList(updated);
    if (selectedCheckpointIndex >= updated.length) {
      setSelectedCheckpointIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleSaveCheckpoints = async () => {
    if (!activeCheckpointEvent) return;
    setSavingCheckpoints(true);
    setCheckpointError(null);
    try {
      const res = await axios.post(`/api/checkpoints/event/${activeCheckpointEvent.id}`, {
        checkpoints: checkpointsList,
        allowDuplicateTasks,
        randomizeTasks,
        taskCollisionWindowMinutes
      });
      setCheckpointsList(res.data.checkpoints);
      fetchEvents();
      alert('Checkpoints and Task Distribution settings saved successfully!');
    } catch (err) {
      setCheckpointError(err.response?.data?.error || err.message);
    } finally {
      setSavingCheckpoints(false);
    }
  };

  const handleAddTaskToSelectedCheckpoint = async () => {
    const selectedCp = checkpointsList[selectedCheckpointIndex];
    if (!selectedCp || !newTaskTitle || !newTaskDesc) {
      alert('Please provide a task title and description.');
      return;
    }

    setAddingTask(true);
    try {
      if (selectedCp.id) {
        // Checkpoint exists on server -> persist via API
        await axios.post(`/api/checkpoints/${selectedCp.id}/tasks`, {
          title: newTaskTitle,
          description: newTaskDesc,
          task_type: newTaskType,
          instructions: newTaskInstructions
        });

        // Refresh checkpoints
        const res = await axios.get(`/api/checkpoints/event/${activeCheckpointEvent.id}`);
        if (res.data?.checkpoints) {
          setCheckpointsList(res.data.checkpoints);
        }
      } else {
        // Local checkpoint not yet saved -> add to local task array
        const newTask = {
          id: `local_${Date.now()}`,
          title: newTaskTitle,
          description: newTaskDesc,
          task_type: newTaskType,
          instructions: newTaskInstructions
        };
        const updated = [...checkpointsList];
        updated[selectedCheckpointIndex].tasks = [...(updated[selectedCheckpointIndex].tasks || []), newTask];
        setCheckpointsList(updated);
      }

      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskInstructions('');
    } catch (err) {
      alert('Failed to add task: ' + (err.response?.data?.error || err.message));
    } finally {
      setAddingTask(false);
    }
  };

  const handleDeleteTask = async (taskId, taskIdx) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      if (typeof taskId === 'number' || (typeof taskId === 'string' && !taskId.startsWith('local_'))) {
        await axios.delete(`/api/checkpoints/tasks/${taskId}`);
        const res = await axios.get(`/api/checkpoints/event/${activeCheckpointEvent.id}`);
        if (res.data?.checkpoints) {
          setCheckpointsList(res.data.checkpoints);
        }
      } else {
        // Remove from local state
        const updated = [...checkpointsList];
        updated[selectedCheckpointIndex].tasks = (updated[selectedCheckpointIndex].tasks || []).filter((_, i) => i !== taskIdx);
        setCheckpointsList(updated);
      }
    } catch (err) {
      alert('Failed to delete task: ' + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      id: customEventId ? parseInt(customEventId) : undefined,
      new_id: customEventId ? parseInt(customEventId) : undefined,
      name,
      description,
      polygon_coordinates: polygonCoordinates,
      center_lat: centerLat,
      center_lng: centerLng,
      radius_m: radiusMeters,
      grace_minutes: graceMinutes,
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
      alert('Error saving event: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event? This will also remove associated logs, checkpoints, and tasks.')) return;
    try {
      await axios.delete(`/api/events/${id}`);
      fetchEvents();
    } catch (err) {
      alert('Error deleting event: ' + err.message);
    }
  };

  const addWindow = () => {
    setWindows([...windows, { window_type: 'time_in', start_time: '', end_time: '' }]);
  };

  const removeWindow = (index) => {
    setWindows(windows.filter((_, i) => i !== index));
  };

  const updateWindow = (index, field, value) => {
    const newWindows = [...windows];
    newWindows[index][field] = value;
    setWindows(newWindows);
  };

  const selectedCheckpoint = checkpointsList[selectedCheckpointIndex] || null;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-400" />
            Event Geofence & Checkpoint Management
          </h1>
          <p className="text-xs text-slate-400">Configure exact polygon geofences, up to 3 nested checkpoints, and anti-collusion task pools.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm animate-pulse">Loading university events...</div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Events Configured Yet</h3>
          <p className="text-xs max-w-sm mx-auto">Create an event to start monitoring student attendance with exact polygon geofences and checkpoints.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => {
            const numCheckpoints = (event.checkpoints || []).length;

            return (
              <div key={event.id} className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      event.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {event.status}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">ID #{event.id}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white">{event.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{event.description || 'No description provided.'}</p>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Geofence:</span>
                      <span className="font-semibold text-indigo-400">
                        {event.polygon_coordinates?.length >= 3 ? `Polygon (${event.polygon_coordinates.length} Nodes)` : `${event.radius_m}m Circle`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Checkpoints:</span>
                      <span className="font-semibold text-cyan-400">{numCheckpoints} Stations</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Target College:</span>
                      <span className="font-semibold text-purple-400 truncate max-w-[140px]">{event.college_filter}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Grace Period:</span>
                      <span className="font-semibold text-amber-400">{event.grace_minutes} mins</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenCheckpointsModal(event)}
                    className="flex-1 py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Checkpoints & Tasks ({numCheckpoints})</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(event)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                    title="Edit Event"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(event.id)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                    title="Delete Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Checkpoints & Task Pools Configuration Modal */}
      {showCheckpointsModal && activeCheckpointEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="glass-card max-w-4xl w-full rounded-2xl p-4 sm:p-6 border border-cyan-500/40 space-y-5 my-auto animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  INTERACTIVE CHECKPOINT STATION & TASK POOL MANAGER
                </span>
                <h2 className="text-lg font-bold text-white mt-1">Checkpoints: {activeCheckpointEvent.name}</h2>
                <p className="text-xs text-slate-400">Click anywhere on the map inside the venue polygon to place station nodes, or select a station to configure its tasks.</p>
              </div>

              <button
                onClick={() => setShowCheckpointsModal(false)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkpointError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{checkpointError}</span>
              </div>
            )}

            {/* Interactive Checkpoint Map Placement Canvas */}
            <CheckpointMapPicker
              event={activeCheckpointEvent}
              checkpoints={checkpointsList}
              selectedCheckpointIndex={selectedCheckpointIndex}
              onSelectCheckpoint={(idx) => setSelectedCheckpointIndex(idx)}
              onCheckpointsChange={(updated) => setCheckpointsList(updated)}
              maxAllowed={3}
            />

            {/* Station Selection Tabs */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  Stations:
                </span>
                {checkpointsList.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">No stations placed yet. Click the map above to drop a station.</span>
                ) : (
                  checkpointsList.map((cp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedCheckpointIndex(idx)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedCheckpointIndex === idx
                          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-400'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-slate-950/60 flex items-center justify-center text-[10px]">
                        C{idx + 1}
                      </span>
                      <span>{cp.name || `Station #${idx + 1}`}</span>
                      <span className="text-[10px] opacity-75">({(cp.tasks || []).length} tasks)</span>
                    </button>
                  ))
                )}
              </div>

              {checkpointsList.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddCheckpoint}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Station (+1)</span>
                </button>
              )}
            </div>

            {/* Selected Station Configuration & Task Pool Card */}
            {selectedCheckpoint && (
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 text-xs animate-in fade-in">
                
                {/* Station Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-400 block font-bold uppercase mb-1">Station Name</label>
                    <input
                      type="text"
                      value={selectedCheckpoint.name || ''}
                      onChange={(e) => handleUpdateSelectedCheckpoint('name', e.target.value)}
                      placeholder="e.g. Registration Booth / Hall Entrance"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block font-bold uppercase mb-1">
                      Catchment Radius: <span className="text-cyan-400 font-mono">{selectedCheckpoint.radius_m || 20}m</span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={50}
                      step={2}
                      value={selectedCheckpoint.radius_m || 20}
                      onChange={(e) => handleUpdateSelectedCheckpoint('radius_m', parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveCheckpoint(selectedCheckpointIndex)}
                    className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Station</span>
                  </button>
                </div>

                {/* Tasks in this Station Pool */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <ListTodo className="w-4 h-4 text-cyan-400" />
                      Task Pool for {selectedCheckpoint.name || `Station #${selectedCheckpointIndex + 1}`} ({(selectedCheckpoint.tasks || []).length} Tasks)
                    </span>
                  </div>

                  {(selectedCheckpoint.tasks || []).length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-slate-500 italic">
                      No tasks added to this checkpoint station pool yet. Use the form below to add a photo or text task.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedCheckpoint.tasks.map((task, taskIdx) => (
                        <div key={task.id || taskIdx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1.5 rounded-lg bg-slate-900 text-cyan-400 border border-slate-800 shrink-0 mt-0.5">
                              {task.task_type === 'photo' ? <Camera className="w-4 h-4" /> : <FileText className="w-4 h-4 text-purple-400" />}
                            </div>
                            <div>
                              <strong className="text-white block font-bold text-xs">{task.title}</strong>
                              <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{task.description}</p>
                              <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-900 text-[10px] text-slate-400 font-mono">
                                {task.task_type === 'photo' ? '📷 EXIF + Perceptual Hash' : '📝 Short Answer'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id, taskIdx)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-colors"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inline Add Task Form */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/20 space-y-3">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" />
                    Append New Task to this Station Pool:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Task Type</label>
                      <select
                        value={newTaskType}
                        onChange={(e) => setNewTaskType(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="photo">Photo Upload (EXIF + dHash Duplicate Check)</option>
                        <option value="text">Short Text / Code Answer</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Task Title</label>
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="e.g. Capture Registration Stage Banner"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Task Prompt / Verification Description</label>
                    <input
                      type="text"
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      placeholder="e.g. Take a live photo showing the official banner at Station #1 to prove physical arrival."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddTaskToSelectedCheckpoint}
                    disabled={addingTask}
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{addingTask ? 'Saving Task...' : 'Add Task to Pool'}</span>
                  </button>
                </div>

              </div>
            )}

            {/* Anti-Collusion Distribution Rules */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <Shuffle className="w-4 h-4 text-cyan-400" />
                Anti-Collusion Task Distribution Settings
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowDuplicateTasks}
                    onChange={(e) => setAllowDuplicateTasks(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="font-semibold text-white block">Allow Duplicate Tasks</span>
                    <span className="text-[10px] text-slate-400">Permit duplicate assignments</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={randomizeTasks}
                    onChange={(e) => setRandomizeTasks(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="font-semibold text-white block">Randomize Tasks</span>
                    <span className="text-[10px] text-slate-400">Random vs round-robin</span>
                  </div>
                </label>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="font-semibold text-white block">Collision Window</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={taskCollisionWindowMinutes}
                      onChange={(e) => setTaskCollisionWindowMinutes(e.target.value)}
                      className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                      min={1}
                      max={60}
                    />
                    <span className="text-[10px] text-slate-400">minutes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCheckpointsModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveCheckpoints}
                disabled={savingCheckpoints}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/30 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{savingCheckpoints ? 'Validating & Saving...' : 'Save Checkpoints & Task Pools'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Main Event Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="glass-card max-w-4xl w-full rounded-2xl p-4 sm:p-6 border border-indigo-500/40 space-y-6 my-auto animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {editingEvent ? 'Edit University Event' : 'Create New University Event'}
                </h2>
                <p className="text-xs text-slate-400">Specify exact polygon geofence vertices, college filters, and attendance windows.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-300 block mb-1">Event Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. University Convocation 2026"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Event ID # (Optional)</label>
                  <input
                    type="number"
                    value={customEventId}
                    onChange={(e) => setCustomEventId(e.target.value)}
                    placeholder="Auto ID"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Official event agenda or remarks"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Interactive Polygon Geofence Editor */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  <span>Interactive Venue Polygon Perimeter Tracing</span>
                </label>
                <GeofenceMapPicker
                  polygonCoordinates={polygonCoordinates}
                  polygon={polygonCoordinates}
                  onPolygonChange={(poly, center, rad) => {
                    setPolygonCoordinates(poly);
                    if (center) {
                      setCenterLat(center.lat);
                      setCenterLng(center.lng);
                    }
                    if (rad) setRadiusMeters(rad);
                  }}
                  onChangePolygon={(poly, center, rad) => {
                    setPolygonCoordinates(poly);
                    if (center) {
                      setCenterLat(center.lat);
                      setCenterLng(center.lng);
                    }
                    if (rad) setRadiusMeters(rad);
                  }}
                  centerLat={centerLat}
                  centerLng={centerLng}
                  radiusMeters={radiusMeters}
                />
              </div>

              {/* Target & Grace Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Target College</label>
                  <select
                    value={collegeFilter}
                    onChange={(e) => setCollegeFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Colleges (University-Wide)</option>
                    {MMSU_COLLEGES.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Grace Period (Minutes)</label>
                  <input
                    type="number"
                    value={graceMinutes}
                    onChange={(e) => setGraceMinutes(parseInt(e.target.value))}
                    min={1}
                    max={60}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Event Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active (Open for Attendance)</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Attendance Windows */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>Attendance Time Windows</span>
                  </label>
                  <button
                    type="button"
                    onClick={addWindow}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Window
                  </button>
                </div>

                {windows.map((w, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                    <select
                      value={w.window_type}
                      onChange={(e) => updateWindow(idx, 'window_type', e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                    >
                      <option value="time_in">Time In Window</option>
                      <option value="time_out">Time Out Window</option>
                    </select>
                    <input
                      type="datetime-local"
                      value={w.start_time}
                      onChange={(e) => updateWindow(idx, 'start_time', e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-[11px]"
                    />
                    <input
                      type="datetime-local"
                      value={w.end_time}
                      onChange={(e) => updateWindow(idx, 'end_time', e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => removeWindow(idx)}
                      className="text-rose-400 hover:text-rose-300 p-1.5 justify-self-end cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
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
