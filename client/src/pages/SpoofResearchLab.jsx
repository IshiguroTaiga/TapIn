import React, { useState } from 'react';
import axios from 'axios';
import {
  Cpu,
  Play,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  FileCode,
  Activity,
  Zap,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

export default function SpoofResearchLab() {
  const [strategy, setStrategy] = useState('rule-based');
  
  // Custom trace tester form
  const [testLat, setTestLat] = useState(14.6050);
  const [testLng, setTestLng] = useState(120.9900);
  const [testAccuracy, setTestAccuracy] = useState(0.1);
  const [testAccelX, setTestAccelX] = useState(0.0);
  const [testAccelY, setTestAccelY] = useState(0.0);
  const [testAccelZ, setTestAccelZ] = useState(9.81);
  const [evalResult, setEvalResult] = useState(null);
  const [testingTrace, setTestingTrace] = useState(false);

  // Harness metrics
  const [harnessRunning, setHarnessRunning] = useState(false);
  const [harnessOutput, setHarnessOutput] = useState(null);

  const handleTestTrace = async (e) => {
    e.preventDefault();
    setTestingTrace(true);

    const tracePayload = {
      currentTrace: {
        lat: parseFloat(testLat),
        lng: parseFloat(testLng),
        accuracy: parseFloat(testAccuracy),
        timestamp: new Date().toISOString(),
        motionData: {
          accelX: parseFloat(testAccelX),
          accelY: parseFloat(testAccelY),
          accelZ: parseFloat(testAccelZ)
        }
      },
      history: [
        { lat: 14.5995, lng: 120.9842, accuracy: 5.0, timestamp: new Date(Date.now() - 5000).toISOString() }
      ],
      strategy
    };

    try {
      const res = await axios.post('/api/spoof/evaluate', tracePayload);
      setEvalResult(res.data);
    } catch (err) {
      alert('Trace evaluation failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setTestingTrace(false);
    }
  };

  const handleRunHarness = async () => {
    setHarnessRunning(true);
    try {
      const res = await axios.get(`/api/spoof/run-harness?strategy=${strategy}`);
      setHarnessOutput(res.data.stdout);
    } catch (err) {
      alert('Harness execution failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setHarnessRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-6 h-6 text-purple-400" />
            GPS Spoofing Research Module & Evaluation Lab
          </h1>
          <p className="text-xs text-slate-400">Core thesis contribution: Standalone multi-heuristic location anomaly classifier & metrics harness.</p>
        </div>

        {/* Strategy Switcher */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
          <span className="text-xs font-semibold text-slate-400 px-2">Classifier Strategy:</span>
          <button
            onClick={() => setStrategy('rule-based')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              strategy === 'rule-based' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Rule-Based Weighted
          </button>
          <button
            onClick={() => setStrategy('ml-classifier')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              strategy === 'ml-classifier' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ML Logistic Regression
          </button>
        </div>
      </div>

      {/* Defense-in-depth Thesis Disclosure Banner */}
      <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200 space-y-1.5 flex items-start gap-3">
        <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white block font-bold">Research Methodology & Scope Note:</strong>
          No GPS spoofing-detection approach on the open browser web achieves 100% prevention due to client-side API boundaries. This module provides a measured defense-in-depth layer combining physics speed limits, accuracy jitter profiling, timestamp cadence, and accelerometer sensor cross-checking. Its reported metrics (Accuracy, Precision, Recall, FPR) constitute the empirical deliverable.
        </div>
      </div>

      {/* Grid: Interactive Telemetry Tester vs Evaluation Harness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Interactive Telemetry Simulator */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            Simulate Location Telemetry Report
          </h2>

          <form onSubmit={handleTestTrace} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400">Reported Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={testLat}
                  onChange={(e) => setTestLat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400">Reported Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={testLng}
                  onChange={(e) => setTestLng(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400">Accuracy (meters)</label>
                <input
                  type="number"
                  step="0.01"
                  value={testAccuracy}
                  onChange={(e) => setTestAccuracy(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                  required
                />
                <span className="text-[10px] text-slate-500">Tip: set to 0.1m for fake GPS check</span>
              </div>

              <div>
                <label className="text-slate-400">Accel Z (Gravity)</label>
                <input
                  type="number"
                  step="0.01"
                  value={testAccelZ}
                  onChange={(e) => setTestAccelZ(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                  required
                />
                <span className="text-[10px] text-slate-500">Normal resting: ~9.81 m/s²</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={testingTrace}
              className="w-full py-3 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Evaluate Telemetry Report ({strategy})</span>
            </button>
          </form>

          {/* Test Evaluation Output */}
          {evalResult && (
            <div className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in ${
              evalResult.isSpoofed ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              <div className="flex items-center justify-between font-bold text-sm">
                <span className="flex items-center gap-2">
                  {evalResult.isSpoofed ? <ShieldAlert className="w-5 h-5 text-rose-400" /> : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                  Classification: {evalResult.isSpoofed ? 'SPOOFING ANOMALY DETECTED' : 'LEGITIMATE TRACE'}
                </span>
                <span className="font-mono text-white">Score: {evalResult.trustScore}/100</span>
              </div>

              {evalResult.flags.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <div className="font-semibold text-slate-300">Triggered Heuristics & Flags:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {evalResult.flags.map((f, i) => (
                      <li key={i} className="font-mono text-rose-400">{f}: {evalResult.details[i]}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Column: Research Evaluation Harness Output */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-purple-400" />
                CLI Evaluation Harness Output
              </h2>

              <button
                onClick={handleRunHarness}
                disabled={harnessRunning}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{harnessRunning ? 'Executing CLI Harness...' : 'Run Dataset Harness'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Executes <code className="text-indigo-300">server/scripts/evalSpoofDetector.js</code> against labeled CSV dataset <code className="text-indigo-300">sample_traces.csv</code> to output Accuracy, Precision, Recall, F1, and FPR metrics for the thesis results section.
            </p>

            {harnessOutput ? (
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[350px] leading-relaxed">
                {harnessOutput}
              </pre>
            ) : (
              <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-500 text-xs">
                Click "Run Dataset Harness" above to generate confusion matrix and statistical evaluation metrics.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
