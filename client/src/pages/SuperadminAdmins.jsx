import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  ShieldCheck,
  Lock,
  XCircle,
  Save
} from 'lucide-react';

export default function SuperadminAdmins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const res = await axios.get('/api/auth/admins');
      setAdmins(res.data);
    } catch (err) {
      console.error('Failed to fetch admin accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingAdmin(null);
    setUsername('');
    setPassword('');
    setRole('admin');
    setShowModal(true);
  };

  const handleOpenEditModal = (admin) => {
    setEditingAdmin(admin);
    setUsername(admin.username);
    setPassword(''); // leave empty unless changing
    setRole(admin.role);
    setShowModal(true);
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    try {
      if (editingAdmin) {
        await axios.put(`/api/auth/admins/${editingAdmin.id}`, { username, password, role });
      } else {
        await axios.post('/api/auth/admins', { username, password, role });
      }
      setShowModal(false);
      fetchAdmins();
    } catch (err) {
      alert('Failed to save admin account: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (confirm('Are you sure you want to remove this admin account?')) {
      try {
        await axios.delete(`/api/auth/admins/${id}`);
        fetchAdmins();
      } catch (err) {
        alert('Failed to delete admin: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            Superadmin Account Management
          </h1>
          <p className="text-xs text-slate-400">Create, modify, and remove university administrator access credentials.</p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Admin Account</span>
        </button>
      </div>

      {/* Admins Table */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-3">ID</th>
              <th className="py-3 px-3">Username</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-3">Created At</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-500">Loading admin accounts...</td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-500">#{admin.id}</td>
                  <td className="py-3 px-3 font-semibold text-white">{admin.username}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      admin.role === 'superadmin' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}>
                      {admin.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                    {new Date(admin.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEditModal(admin)}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-indigo-400 border border-slate-800 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAdmin(admin.id)}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingAdmin ? 'Edit Admin Account' : 'Create Admin Account'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Password {editingAdmin && '(Leave blank to keep unchanged)'}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingAdmin ? '••••••••' : 'Enter password'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  required={!editingAdmin}
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 bg-slate-900 border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Account</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
