import React, { useState, useEffect } from 'react';
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
  Info,
  Settings,
  Save,
  Clock,
  Crosshair
} from 'lucide-react';

export default function SpoofResearchLab() {
  const [strategy, setStrategy] = useState('rule-based');
  
  // Anomaly config parameters
  const [stationaryWindowSeconds, setStationaryWindowSeconds] = useState(300);
  const [stationaryThresholdMeters, setStationaryThresholdMeters] = useState(1.0);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaveMsg, setConfigSaveMsg] = useState(null);

  // Custom trace tester form
  const [testLat, setTestLat] = useState(14.6050);
  const [testLng, setTestLng] = useState(120.9900);
  const [testAccuracy, setTestAccuracy] = useState(0.1);
  const [testAccelX, setTestAccelX] = useState(0.0);
  const [testAccelY, setTestAccelY] = useState(0.0);
  const [testAccelZ, setTestAccelZ] = useState(9.81);
  const [testScenario, setTestScenario] = useState('stationary');
  const [evalResult, setEvalResult] = useState(null);
  const [testingTrace, setTestingTrace] = useState(false);

  // Harness metrics
  const [harnessRunning, setHarnessRunning] = useState(false);
  const [harnessOutput, setHarnessOutput] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/spoof/config');
      if (res.data) {
        setStationaryWindowSeconds(res.data.stationary_window_seconds || 300);
        setStationaryThresholdMeters(res.data.stationary_movement_threshold_m || 1.0);
      }
    } catch (err) {}
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigSaveMsg(null);
    try {
      await axios.post('/api/spoof/config', {
        stationary_window_seconds: parseFloat(stationaryWindowSeconds),
        stationary_movement_threshold_m: parseFloat(stationaryThresholdMeters),
        activeStrategy: strategy
      });
      setConfigSaveMsg('Anomaly detection parameters updated & applied server-wide!');
      setTimeout(() => setConfigSaveMsg(null), 4000);
    } catch (err) {
      alert('Failed to save config: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleApplyPreset = (scenario) => {
    setTestScenario(scenario);
    if (scenario === 'stationary') {
      setTestLat(18.196000);
      setTestLng(120.592700);
      setTestAccuracy(5.0);
      setTestAccelX(0);
      setTestAccelY(0);
      setTestAccelZ(9.81);
    } else if (scenario === 'teleport') {
      setTestLat(18.5000);
      setTestLng(120.9000);
      setTestAccuracy(5.0);
    } else if (scenario === 'static_accuracy') {
      setTestLat(18.1960);
      setTestLng(120.5927);
      setTestAccuracy(0.1);
    } else if (scenario === 'sensor_mismatch') {
      setTestLat(18.2000);
      setTestLng(120.5950);
      setTestAccelX(0);
      setTestAccelY(0);
      setTestAccelZ(9.81);
    }
  };

  const handleTestTrace = async (e) => {
    e.preventDefault();
    setTestingTrace(true);

    const now = Date.now();
    let history = [];

    if (testScenario === 'stationary') {
      // Simulate 6-minute stationary trace history with 0.05m movement
      history = [
        { lat: parseFloat(testLat), lng: parseFloat(testLng), accuracy: 5.0, timestamp: new Date(now - 360000).toISOString() },
        { lat: parseFloat(testLat) + 0.000001, lng: parseFloat(testLng), accuracy: 5.0, timestamp: new Date(now - 240000).toISOString() },
        { lat: parseFloat(testLat), lng: parseFloat(testLng) + 0.000001, accuracy: 5.0, timestamp: new Date(now - 120000).toISOString() }
      ];
    } else {
      history = [
        { lat: 18.1960, lng: 120.5927, accuracy: 5.0, timestamp: new Date(now - 5000).toISOString() }
      ];
    }

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
      history,
      strategy,
      evalConfig: {
        stationaryWindowSeconds: parseFloat(stationaryWindowSeconds),
        stationaryThresholdMeters: parseFloat(stationaryThresholdMeters)
      }
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
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            GPS Spoofing Research Module & Evaluation Lab
          </h1>
          <p className="text-xs text-slate-400">Multi-heuristic anomaly classifier & stationary signal verification engine.</p>
        </div>

        {/* Strategy Switcher */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto flex-wrap">
          <span className="text-xs font-semibold text-slate-400 px-2">Classifier Strategy:</span>
          <button
            onClick={() => setStrategy('rule-based')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
              strategy === 'rule-based' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Rule-Based Weighted
          </button>
          <button
            onClick={() => setStrategy('ml-classifier')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
              strategy === 'ml-classifier' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ML Logistic Regression
          </button>
        </div>
      </div>

      {/* Admin Configurable Parameters Panel */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 border border-purple-500/30 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Configurable Spoof Detection Heuristics</h2>
              <p className="text-xs text-slate-400">Tune stationary anomaly time window and displacement threshold dynamically.</p>
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={savingConfig}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/25 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingConfig ? 'Saving...' : 'Save Parameters'}</span>
          </button>
        </div>

        {configSaveMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{configSaveMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Stationary Window (Seconds)</span>
              <span className="font-mono text-purple-400 font-bold">{stationaryWindowSeconds}s ({Math.round(stationaryWindowSeconds / 60)} mins)</span>
            </div>
            <input
              type="range"
              min={60}
              max={600}
              step={30}
              value={stationaryWindowSeconds}
              onChange={(e) => setStationaryWindowSeconds(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">Duration of consecutive GPS telemetry inspected for absence of natural jitter.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Stationary Movement Threshold (Meters)</span>
              <span className="font-mono text-purple-400 font-bold">{stationaryThresholdMeters}m</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={5.0}
              step={0.1}
              value={stationaryThresholdMeters}
              onChange={(e) => setStationaryThresholdMeters(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">Maximum displacement below which location updates are flagged as stationary mock.</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Tester & Harness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Custom Trace Evaluator */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" />
              Live Custom Trace Evaluator
            </h2>
            <span className="text-xs text-slate-400 font-mono">POST /api/spoof/evaluate</span>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 block font-semibold">Test Attack Scenarios:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleApplyPreset('stationary')}
                className={`p-2 rounded-lg border font-medium text-left transition-all ${
                  testScenario === 'stationary' ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                🚨 Stationary Mock
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('teleport')}
                className={`p-2 rounded-lg border font-medium text-left transition-all ${
                  testScenario === 'teleport' ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                🚨 Teleport 33km
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('static_accuracy')}
                className={`p-2 rounded-lg border font-medium text-left transition-all ${
                  testScenario === 'static_accuracy' ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                🚨 0.1m Precision
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('sensor_mismatch')}
                className={`p-2 rounded-lg border font-medium text-left transition-all ${
                  testScenario === 'sensor_mismatch' ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                🚨 Sensor Mismatch
              </button>
            </div>
          </div>

          <form onSubmit={handleTestTrace} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={testLat}
                  onChange={(e) => setTestLat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={testLng}
                  onChange={(e) => setTestLng(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Accuracy (m)</label>
                <input
                  type="number"
                  step="any"
                  value={testAccuracy}
                  onChange={(e) => setTestAccuracy(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Accel X (m/s²)</label>
                <input
                  type="number"
                  step="any"
                  value={testAccelX}
                  onChange={(e) => setTestAccelX(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Accel Z (m/s²)</label>
                <input
                  type="number"
                  step="any"
                  value={testAccelZ}
                  onChange={(e) => setTestAccelZ(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={testingTrace}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/25"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{testingTrace ? 'Evaluating Anomaly Heuristics...' : `Run ${strategy} Evaluation`}</span>
            </button>
          </form>

          {/* Outcome Result */}
          {evalResult && (
            <div className={`p-4 rounded-xl border space-y-2 animate-in fade-in ${
              evalResult.isSpoofed ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm flex items-center gap-1.5">
                  {evalResult.isSpoofed ? <ShieldAlert className="w-5 h-5 text-rose-400" /> : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                  {evalResult.isSpoofed ? 'SPOOFING / ANOMALY DETECTED' : 'GENUINE AUTHENTIC GPS'}
                </span>
                <span className="text-xs font-mono font-bold">Trust Score: {evalResult.trustScore}/100</span>
              </div>

              {evalResult.flags?.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 text-xs space-y-1">
                  <span className="text-slate-400 block font-semibold">Triggered Heuristics:</span>
                  <div className="flex flex-wrap gap-1">
                    {evalResult.flags.map((fl, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                        {fl}
                      </span>
                    ))}
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5 mt-1">
                    {evalResult.details?.map((dt, i) => (
                      <li key={i}>{dt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Academic CLI Evaluation Harness */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-purple-400" />
                CLI Benchmark Evaluation Harness
              </h2>
              <span className="text-xs text-slate-400 font-mono">evalSpoofDetector.js</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Executes the thesis evaluation benchmark across 1,000 labeled trace samples to compute academic confusion matrix metrics (Accuracy, Precision, Recall, Specificity, F1 Score).
            </p>

            <button
              onClick={handleRunHarness}
              disabled={harnessRunning}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Activity className={`w-4 h-4 ${harnessRunning ? 'animate-spin' : ''}`} />
              <span>{harnessRunning ? 'Executing Benchmark Suite...' : `Run Harness on ${strategy}`}</span>
            </button>
          </div>

          {harnessOutput && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-64 whitespace-pre">
              {harnessOutput}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
