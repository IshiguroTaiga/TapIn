import React from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, ShieldAlert, LogOut, Lock, LayoutDashboard, Calendar, FileText, Cpu, Users, AlertTriangle } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenLogin, onOpenPwaNotice }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Left Side: Secondary Admin Login Button (or Active Admin Status) */}
        <div className="flex items-center space-x-3">
          {!user ? (
            <button
              onClick={onOpenLogin}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800 transition-colors"
              title="Admin Login Portal"
            >
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Admin Portal</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                {user.role === 'superadmin' ? 'Superadmin' : 'Admin'}: {user.username}
              </span>
              <button
                onClick={logout}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            </div>
          )}
        </div>

        {/* Center: Brand Logo */}
        <div 
          onClick={() => setActiveTab('student')} 
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <MapPin className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-950"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
              Tap<span className="gradient-text">In</span>
            </span>
            <span className="text-[10px] tracking-wider uppercase text-slate-400 font-medium">
              Geofence & Spoof Detection
            </span>
          </div>
        </div>

        {/* Right Side: Admin Navigation & PWA Notice Trigger */}
        <div className="flex items-center space-x-2">
          {user ? (
            <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('student')}
                className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'student' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                Student Flow
              </button>

              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Live Feed
              </button>

              <button
                onClick={() => setActiveTab('events')}
                className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'events' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Events
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'history' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Logs & Export
              </button>

              <button
                onClick={() => setActiveTab('penalties')}
                className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'penalties' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Penalties
              </button>

              <button
                onClick={() => setActiveTab('spoof-lab')}
                className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'spoof-lab' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-purple-300'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                Spoof Research Lab
              </button>

              {user.role === 'superadmin' && (
                <button
                  onClick={() => setActiveTab('admins')}
                  className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                    activeTab === 'admins' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Admins
                </button>
              )}
            </nav>
          ) : (
            <button
              onClick={onOpenPwaNotice}
              className="text-xs text-amber-400/90 hover:text-amber-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-all hover:bg-amber-500/20"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Background Limits Notice</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
