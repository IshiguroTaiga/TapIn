import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  Play,
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  FileText,
  ShieldCheck
} from 'lucide-react';

export default function PenaltyEngineView() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [results, setResults] = useState([]);
  const [violationTypes, setViolationTypes] = useState([]);

  // Config modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPenalty, setNewPenalty] = useState('Warning');

  useEffect(() => {
    fetchEvents();
    fetchViolationTypes();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      setEvents(res.data);
      if (res.data.length > 0) {
        setSelectedEventId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const fetchViolationTypes = async () => {
    try {
      const res = await axios.get('/api/penalties/types');
      setViolationTypes(res.data);
    } catch (err) {
      console.error('Failed to fetch violation types:', err);
    }
  };

  const handleRunEvaluation = async () => {
    if (!selectedEventId) return;
    setEvaluating(true);
    try {
      const res = await axios.post(`/api/penalties/evaluate/${selectedEventId}`);
      setResults(res.data.results || []);
    } catch (err) {
      alert('Penalty evaluation failed: ' + (err.response?.data?.error || err.message));
    } fontFinally: {
      setEvaluating(false);
    }
  };

  const handleSaveViolationType = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/penalties/types', {
        code: newCode,
        label: newLabel,
        description: newDesc,
        default_penalty: newPenalty
      });
      setShowConfigModal(false);
      setNewCode('');
      setNewLabel('');
      setNewDesc('');
      fetchViolationTypes();
    } catch (err) {
      alert('Failed to save violation type: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            Penalty & Violation Engine
          </h1>
          <p className="text-xs text-slate-400">Automated post-event evaluation engine for attendance compliance and grace period violations.</p>
        </div>

        <button
          onClick={() => setShowConfigModal(true)}
          className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 self-start md:self-auto transition-colors cursor-pointer min-h-[44px]"
        >
          <Settings className="w-4 h-4 text-indigo-400" />
          <span>Configure Violation Types</span>
        </button>
      </div>

      {/* Control Panel */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-300 shrink-0">Select Target Event:</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 w-full sm:w-64"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name} (#{e.id})</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleRunEvaluation}
          disabled={evaluating || !selectedEventId}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>{evaluating ? 'Running Machine Evaluation...' : 'Run Auto-Evaluation'}</span>
        </button>
      </div>

      {/* Results Section */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center justify-between">
          <span>Evaluation Outcome ({results.length} Students Assessed)</span>
          {results.length > 0 && (
            <span className="text-xs font-normal text-slate-400">
              Compliant: <strong className="text-emerald-400">{results.filter(r => r.status === 'Compliant').length}</strong> | 
              W/ Penalty: <strong className="text-rose-400">{results.filter(r => r.status === 'W/ Penalty').length}</strong>
            </span>
          )}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Student Details</th>
                <th className="py-3 px-3">College & Course</th>
                <th className="py-3 px-3">Compliance Status</th>
                <th className="py-3 px-3">Machine-Generated Violation Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {results.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500">
                    Click "Run Auto-Evaluation" above to execute penalty analysis for the selected event.
                  </td>
                </tr>
              ) : (
                results.map((res) => (
                  <tr key={res.student_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{res.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{res.student_id}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-400">
                      <div>{res.college}</div>
                      <div className="text-[10px] text-slate-500">{res.course} • Yr {res.year}</div>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                        res.status === 'Compliant' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {res.status}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {res.violations.length === 0 ? (
                        <span className="text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Full Duration & Radius Compliant
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {res.violations.map((v, idx) => (
                            <div key={idx} className="p-1.5 rounded bg-rose-950/40 border border-rose-500/20 text-rose-300 text-[11px] font-medium flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>[{v.code}] {v.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Violation Types Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Configure University Violation Types</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* List of existing violation types */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Registered Violation Enums</span>
              {violationTypes.map((vt) => (
                <div key={vt.code} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-start justify-between">
                  <div>
                    <div className="font-bold text-white font-mono">{vt.code}</div>
                    <div className="text-slate-300">{vt.label}</div>
                    <div className="text-[10px] text-slate-500">{vt.description}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">
                    {vt.default_penalty}
                  </span>
                </div>
              ))}
            </div>

            {/* Add new violation type form */}
            <form onSubmit={handleSaveViolationType} className="pt-3 border-t border-slate-800 space-y-3 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">Add New Custom Violation Reason</span>
              
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="CODE (e.g. EARLY_DEPARTURE)"
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono text-xs uppercase"
                  required
                />
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Label (e.g. Left Assembly Early)"
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                  required
                />
              </div>

              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Full Description for Machine Generator"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                required
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3 py-2 rounded-lg text-slate-400 bg-slate-900 border border-slate-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Violation Type</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
