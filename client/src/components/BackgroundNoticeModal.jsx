import React from 'react';
import { X, Smartphone, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function BackgroundNoticeModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-5">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Platform Background Boundary</h3>
              <p className="text-xs text-slate-400">Important technical disclosure regarding Web & OS background GPS constraints</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Browser Background GPS Constraints</span>
            </div>
            <p>
              Modern web browsers (Chrome, Safari, Firefox) restrict active GPS location tracking once a browser tab is fully closed or suspended by the operating system. This is a W3C security standard constraint.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-indigo-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-400" />
              <span>How TapIn Solves This via Progressive Web App (PWA)</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-slate-300">
              <li>
                <strong className="text-white">Home Screen Installation:</strong> TapIn includes a PWA Manifest and Service Worker so you can install it directly to your phone’s home screen.
              </li>
              <li>
                <strong className="text-white">Active Grace Period Watcher:</strong> While the PWA remains open or background-active, TapIn continually monitors distance and manages the 15-minute grace countdown.
              </li>
              <li>
                <strong className="text-white">Web Push Notifications:</strong> Warning alerts are dispatched prior to grace countdown expiry if notification permissions are granted.
              </li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-300">OS Aggressive Battery Savers:</strong> If an operating system forcefully terminates background service workers, TapIn logs the last verified GPS location and enforces compliance checks upon app re-activation.
            </span>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            Understood & Proceed
          </button>
        </div>

      </div>
    </div>
  );
}
