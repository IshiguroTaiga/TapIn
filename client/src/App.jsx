import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import BackgroundNoticeModal from './components/BackgroundNoticeModal';
import AdminLogin from './pages/AdminLogin';
import StudentHome from './pages/StudentHome';
import AdminDashboard from './pages/AdminDashboard';
import EventManagement from './pages/EventManagement';
import AttendanceLogs from './pages/AttendanceLogs';
import PenaltyEngineView from './pages/PenaltyEngineView';
import SpoofResearchLab from './pages/SpoofResearchLab';
import SuperadminAdmins from './pages/SuperadminAdmins';

function MainLayout() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('student');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isPwaNoticeOpen, setIsPwaNoticeOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenPwaNotice={() => setIsPwaNoticeOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'student' && (
          <StudentHome onOpenPwaNotice={() => setIsPwaNoticeOpen(true)} />
        )}

        {activeTab === 'dashboard' && user && (
          <AdminDashboard />
        )}

        {activeTab === 'events' && user && (
          <EventManagement />
        )}

        {activeTab === 'history' && user && (
          <AttendanceLogs />
        )}

        {activeTab === 'penalties' && user && (
          <PenaltyEngineView />
        )}

        {activeTab === 'spoof-lab' && user && (
          <SpoofResearchLab />
        )}

        {activeTab === 'admins' && user && user.role === 'superadmin' && (
          <SuperadminAdmins />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500 space-y-1">
        <div className="font-semibold text-slate-400">TapIn • University Geofencing & GPS Spoofing Detection Research Prototype</div>
        <div>Built for DOST / University Research Thesis Project • Node.js + Express + SQLite + Socket.io + React PWA</div>
      </footer>

      {/* Modals */}
      <AdminLogin
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => setActiveTab('dashboard')}
      />

      <BackgroundNoticeModal
        isOpen={isPwaNoticeOpen}
        onClose={() => setIsPwaNoticeOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
