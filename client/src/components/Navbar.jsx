import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  MapPin,
  ShieldAlert,
  LogOut,
  Lock,
  LayoutDashboard,
  Calendar,
  FileText,
  Cpu,
  Users,
  AlertTriangle,
  Menu,
  X
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenLogin, onOpenPwaNotice }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'student', label: 'Student Flow', icon: MapPin, color: 'indigo' },
    ...(user ? [
      { id: 'dashboard', label: 'Live Feed', icon: LayoutDashboard, color: 'indigo' },
      { id: 'events', label: 'Events', icon: Calendar, color: 'indigo' },
      { id: 'history', label: 'Logs & Export', icon: FileText, color: 'indigo' },
      { id: 'penalties', label: 'Penalties', icon: AlertTriangle, color: 'indigo' },
      { id: 'spoof-lab', label: 'Spoof Lab', icon: Cpu, color: 'purple' },
      ...(user.role === 'superadmin' ? [{ id: 'admins', label: 'Admins', icon: Users, color: 'indigo' }] : [])
    ] : [])
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-3 sm:px-6 py-2.5 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          
          {/* Brand Logo & Slogan */}
          <div 
            onClick={() => handleSelectTab('student')} 
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          >
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900/90 border border-indigo-500/30 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform overflow-hidden p-0.5">
              <img src="/THerta_LogoWFrame.png" alt="TapIn Logo" className="w-full h-full object-contain rounded-lg" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-950"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1 leading-none">
                Tap<span className="gradient-text">In</span>
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-wider uppercase text-slate-400 font-medium hidden xs:inline-block">
                Skip the line and TapIn!
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-2">
            {user ? (
              <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px] ${
                        isActive
                          ? item.color === 'purple'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            ) : (
              <button
                onClick={onOpenPwaNotice}
                className="text-xs text-amber-400/90 hover:text-amber-300 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 transition-all hover:bg-amber-500/20 cursor-pointer min-h-[38px]"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Background Limits Notice</span>
              </button>
            )}
          </div>

          {/* Right Header Status / Trigger */}
          <div className="flex items-center gap-2">
            {!user ? (
              <button
                onClick={onOpenLogin}
                className="text-xs text-slate-300 hover:text-indigo-400 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 transition-colors cursor-pointer min-h-[40px] font-semibold"
                title="Admin Login Portal"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Admin Portal</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                  {user.role === 'superadmin' ? 'Superadmin' : 'Admin'}: {user.username}
                </span>
                <button
                  onClick={logout}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer min-h-[36px]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Slide-Over Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-slate-800/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {user && (
              <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 rounded-lg border border-slate-800/60 text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Logged in as <strong className="text-white">{user.username}</strong> ({user.role})
                </span>
                <button
                  onClick={logout}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 font-bold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}

            <nav className="grid grid-cols-2 gap-2 text-xs">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`px-3 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all min-h-[44px] ${
                      isActive
                        ? item.color === 'purple'
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-indigo-600 text-white shadow-lg'
                        : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {!user && (
              <button
                onClick={() => {
                  onOpenPwaNotice();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-xs text-amber-300 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 font-medium min-h-[44px]"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Background Limits Notice</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* Mobile Quick Bottom Navigation Bar for Admin/Student view switching */}
      {user && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl">
          <button
            onClick={() => setActiveTab('student')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold min-h-[44px] transition-colors ${
              activeTab === 'student' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-5 h-5 mb-0.5" />
            <span>Student</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold min-h-[44px] transition-colors ${
              activeTab === 'dashboard' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Live Feed</span>
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold min-h-[44px] transition-colors ${
              activeTab === 'events' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span>Events</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold min-h-[44px] transition-colors ${
              activeTab === 'history' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-5 h-5 mb-0.5" />
            <span>Logs</span>
          </button>
        </div>
      )}
    </>
  );
}
