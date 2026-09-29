import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Users,
  Server,
  Activity,
  LogOut,
  LogIn,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Cpu,
  HardDrive,
  Globe,
  Sliders,
  Lock,
  Eye,
  EyeOff,
  Edit2,
  ExternalLink,
  Shield,
  HelpCircle,
  Key,
  Code,
} from 'lucide-react';
import { dbClient } from './client/index.js';
import { User, Server as ServerType, SystemStatus, SystemConfig } from './client/types.js';
import { ApiKeysView } from './components/ApiKeysView.js';
import { ApiDocsView } from './components/ApiDocsView.js';
import { SessionManagerView } from './components/SessionManagerView.js';

type Tab = 'status' | 'servers' | 'users' | 'api-keys' | 'docs' | 'sessions' | 'config' | 'account';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Password reset modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // App navigation & status
  const [currentTab, setCurrentTab] = useState<Tab>('status');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Resource states
  const [servers, setServers] = useState<ServerType[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

  // Modals
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [serverForm, setServerForm] = useState({
    name: '',
    server_identifier: '',
    ram: 4096,
    disk: 10240,
    cpu: 100,
    minecraft_version: '1.21',
    jdk_version: '21',
    ip: '127.0.0.1',
  });

  const [editingServer, setEditingServer] = useState<ServerType | null>(null);

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'user',
  });

  // Account password change form
  const [accountPasswordForm, setAccountPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const checkSession = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      const res = await dbClient.auth.me();
      if (res.success && res.data?.user) {
        setCurrentUser(res.data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await dbClient.system.status();
      if (res.success && res.data) {
        setSystemStatus(res.data);
      }
    } catch {}
  }, []);

  const loadTabData = useCallback(async (tab: Tab) => {
    setIsLoadingData(true);
    try {
      if (tab === 'status') {
        await loadStatus();
      } else if (tab === 'servers') {
        const res = await dbClient.servers.list();
        if (res.success && res.data?.servers) {
          setServers(res.data.servers);
        }
      } else if (tab === 'users') {
        const res = await dbClient.users.list();
        if (res.success && res.data?.users) {
          setUsersList(res.data.users);
        }
      } else if (tab === 'config') {
        const res = await dbClient.system.getConfig();
        if (res.success && res.data?.config) {
          setSystemConfig(res.data.config);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading data', 'error');
    } finally {
      setIsLoadingData(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    checkSession();
    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, [checkSession, loadStatus]);

  useEffect(() => {
    if (currentUser) {
      loadTabData(currentTab);
    }
  }, [currentUser, currentTab, loadTabData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = await dbClient.auth.login({
      usernameOrEmail: loginUsername.trim(),
      password: loginPassword,
    });
    if (res.success && res.data?.user) {
      setCurrentUser(res.data.user);
      showToast(`Welcome back, ${res.data.user.name || res.data.user.username}!`);
      loadStatus();
    } else {
      setAuthError(res.error?.message || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = await dbClient.auth.register({
      email: registerEmail.trim(),
      username: loginUsername.trim(),
      password: loginPassword,
      name: registerName.trim(),
    });
    if (res.success && res.data?.user) {
      setCurrentUser(res.data.user);
      showToast(`Welcome, ${res.data.user.name || res.data.user.username}! You have been registered.`);
      loadStatus();
    } else {
      setAuthError(res.error?.message || 'Registration failed.');
    }
  };

  const handleLogout = async () => {
    await dbClient.auth.logout();
    setCurrentUser(null);
    showToast('Logged out successfully');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await dbClient.auth.forgotPassword(forgotEmail);
    if (res.success) {
      setForgotMessage(res.data?.message || 'Reset instructions dispatched.');
      if (res.data?.resetToken) {
        setResetTokenInput(res.data.resetToken);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await dbClient.auth.resetPassword({
      token: resetTokenInput,
      password: newPasswordInput,
    });
    if (res.success) {
      showToast('Password reset successfully! You can now log in.');
      setIsForgotModalOpen(false);
      setForgotMessage(null);
      setResetTokenInput('');
      setNewPasswordInput('');
    } else {
      showToast(res.error?.message || 'Reset failed', 'error');
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await dbClient.servers.create(serverForm);
    if (res.success) {
      showToast('Server registered successfully');
      setIsCreateServerOpen(false);
      setServerForm({
        name: '',
        server_identifier: '',
        ram: 4096,
        disk: 10240,
        cpu: 100,
        minecraft_version: '1.21',
        jdk_version: '21',
        ip: '127.0.0.1',
      });
      loadTabData('servers');
      loadStatus();
    } else {
      showToast(res.error?.message || 'Failed to create server', 'error');
    }
  };

  const handleUpdateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;

    const res = await dbClient.servers.update(editingServer.id, {
      name: editingServer.name,
      ram: Number(editingServer.ram),
      disk: Number(editingServer.disk),
      cpu: Number(editingServer.cpu),
      minecraft_version: editingServer.minecraft_version,
      jdk_version: editingServer.jdk_version,
      ip: editingServer.ip,
    });

    if (res.success) {
      showToast('Server parameters updated live');
      setEditingServer(null);
      loadTabData('servers');
    } else {
      showToast(res.error?.message || 'Update failed', 'error');
    }
  };

  const handleDeleteServer = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to unregister server "${name}"?`)) return;
    const res = await dbClient.servers.delete(id);
    if (res.success) {
      showToast('Server removed from registry');
      loadTabData('servers');
      loadStatus();
    } else {
      showToast(res.error?.message || 'Failed to delete server', 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await dbClient.auth.register(userForm);
    if (res.success) {
      showToast(`User ${userForm.username} created`);
      setIsCreateUserOpen(false);
      setUserForm({ username: '', email: '', password: '', name: '', role: 'user' });
      loadTabData('users');
      loadStatus();
    } else {
      showToast(res.error?.message || 'Failed to create user', 'error');
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    const res = await dbClient.users.delete(id);
    if (res.success) {
      showToast('User deleted');
      loadTabData('users');
      loadStatus();
    } else {
      showToast(res.error?.message || 'Failed to delete user', 'error');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemConfig) return;

    const res = await dbClient.system.updateConfig(systemConfig);
    if (res.success) {
      showToast(res.data?.message || 'Configuration updated');
      if (res.data?.requiresRestart) {
        alert('Notice: Changes to API_PORT require a service restart to bind the new port.');
      }
    } else {
      showToast(res.error?.message || 'Failed to update config', 'error');
    }
  };

  const handleChangeAccountPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accountPasswordForm.newPassword !== accountPasswordForm.confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (accountPasswordForm.newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    const res = await dbClient.users.changePassword(currentUser!.id, {
      currentPassword: accountPasswordForm.currentPassword,
      newPassword: accountPasswordForm.newPassword,
    });

    if (res.success) {
      showToast('Password changed successfully');
      setAccountPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      showToast(res.error?.message || 'Failed to change password', 'error');
    }
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  // 1. Loading State on startup
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
        <p className="text-sm font-medium tracking-wide">Checking MCPANEL session...</p>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <Database className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {isRegisterMode ? 'Register Admin Account' : 'MCPANEL Database API'}
              </h1>
              <p className="text-xs text-slate-400">
                {isRegisterMode ? 'Setup the first administrator user' : 'PostgreSQL Identity & Server Registry'}
              </p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center space-x-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-4">
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="admin@mcpanel.local"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => {
                  setLoginUsername(e.target.value);
                  if (authError) setAuthError(null);
                }}
                placeholder="admin"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="System Administrator"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1 focus:outline-none"
                >
                  {showLoginPassword ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>
              <input
                type={showLoginPassword ? 'text' : 'password'}
                required
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  if (authError) setAuthError(null);
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-lg transition-all flex items-center justify-center space-x-2"
              >
                {isRegisterMode ? <Plus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                <span>{isRegisterMode ? 'Complete Registration' : 'Enter MCPANEL'}</span>
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col items-center space-y-2 text-center">
            <p className="text-xs text-slate-500">
              {isRegisterMode 
                ? 'Already have an account?' 
                : 'New installation? The first user to register becomes administrator.'
              }
            </p>
            <div className="flex items-center space-x-4 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setAuthError(null);
                }}
                className="text-emerald-400 hover:text-emerald-300 font-medium underline"
              >
                {isRegisterMode ? 'Back to Login' : 'Register Now'}
              </button>
              {!isRegisterMode && (
                <>
                  <span className="text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-slate-400 hover:text-slate-300 underline"
                  >
                    Reset Password
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {isForgotModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full space-y-4">
              <h3 className="text-lg font-bold text-white">Password Recovery</h3>
              <p className="text-xs text-slate-400">
                Enter your account email address to receive a secure password reset token.
              </p>

              {!forgotMessage ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <input
                    type="email"
                    required
                    placeholder="Enter account email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
                    >
                      Request Reset
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <p className="text-xs text-emerald-400">{forgotMessage}</p>
                  <div>
                    <label className="text-xs text-slate-400">Reset Token</label>
                    <input
                      type="text"
                      required
                      value={resetTokenInput}
                      onChange={(e) => setResetTokenInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">New Password (min 8 chars)</label>
                    <input
                      type="password"
                      required
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotModalOpen(false);
                        setForgotMessage(null);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
                    >
                      Set New Password
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Authenticated State
  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Alert */}
      {notification && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`px-4 py-3 rounded-lg shadow-xl border flex items-center space-x-3 text-sm ${
              notification.type === 'error'
                ? 'bg-rose-950 border-rose-800 text-rose-200'
                : 'bg-emerald-950 border-emerald-800 text-emerald-200'
            }`}
          >
            {notification.type === 'error' ? <XCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white flex items-center space-x-2">
              <span>MCPANEL Database API</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                v1.0.0
              </span>
            </h1>
            <p className="text-xs text-slate-400">Real PostgreSQL Identity & Central Server Registry</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white">{currentUser.name || currentUser.username}</div>
            <div className="text-xs text-slate-400 uppercase font-mono">{currentUser.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 bg-slate-800 hover:bg-rose-900/40 hover:text-rose-400 text-slate-300 rounded-lg transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-6 flex space-x-2 overflow-x-auto">
        <button
          onClick={() => setCurrentTab('status')}
          className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 transition ${
            currentTab === 'status'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Status</span>
        </button>

        <button
          onClick={() => setCurrentTab('servers')}
          className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 transition ${
            currentTab === 'servers'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Server Registry</span>
          {servers.length > 0 && (
            <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px] text-slate-300 font-mono">
              {servers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentTab('users')}
          className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 transition ${
            currentTab === 'users'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users</span>
        </button>

        <button
          onClick={() => setCurrentTab('api-keys')}
          className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 transition ${
            currentTab === 'api-keys'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Keys</span>
        </button>

        <button
          onClick={() => setCurrentTab('sessions')}
          className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 transition ${
            currentTab === 'sessions'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Session Manager</span>
        </button>

        <button
          onClick={() => setCurrentTab('docs')}
          className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 transition ${
            currentTab === 'docs'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code className="w-4 h-4" />
          <span>API Documentation</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setCurrentTab('config')}
            className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 transition ${
              currentTab === 'config'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Live Configuration</span>
          </button>
        )}

        <button
          onClick={() => setCurrentTab('account')}
          className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 transition ${
            currentTab === 'account'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>My Account</span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* TAB 1: SYSTEM STATUS */}
        {currentTab === 'status' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">System Status</h2>
                <p className="text-xs text-slate-400">Live operational health of MCPANEL database subsystems</p>
              </div>
              <button
                onClick={loadStatus}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Status</span>
              </button>
            </div>

            {/* REAL SYSTEM STATUS CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
                Subsystem Diagnostics
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* API */}
                <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">API Gateway</span>
                    <div className="text-base font-bold text-white mt-1">Online</div>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                {/* Database */}
                <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Database (PostgreSQL)</span>
                    <div className="text-base font-bold text-white mt-1 capitalize">
                      {systemStatus?.database || 'Connecting...'}
                    </div>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      systemStatus?.database === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                </div>

                {/* Authentication */}
                <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Authentication</span>
                    <div className="text-base font-bold text-white mt-1 capitalize">
                      {systemStatus?.authentication || 'Degraded'}
                    </div>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      systemStatus?.authentication === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                </div>

                {/* Server Registry */}
                <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Server Registry</span>
                    <div className="text-base font-bold text-white mt-1 capitalize">
                      {systemStatus?.serverRegistry || 'Degraded'}
                    </div>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      systemStatus?.serverRegistry === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Uptime: <strong>{systemStatus?.uptime ? formatUptime(systemStatus.uptime) : '0s'}</strong></span>
                </div>
                <div>
                  Engine: <span className="font-mono text-slate-300">{systemStatus?.databaseEngine || 'PostgreSQL'}</span>
                </div>
                <div>
                  Version: <span className="font-mono text-slate-300">v{systemStatus?.version || '1.0.0'}</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Registered Servers</span>
                  <Server className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-3xl font-extrabold text-white">
                  {systemStatus?.metrics?.serversCount ?? 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">Real servers registered in database</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Registered Users</span>
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-extrabold text-white">
                  {systemStatus?.metrics?.usersCount ?? 1}
                </div>
                <p className="text-xs text-slate-500 mt-1">User accounts authenticated via PostgreSQL</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SERVER REGISTRY */}
        {currentTab === 'servers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">MCPANEL Server Registry</h2>
                <p className="text-xs text-slate-400">Basic server configuration and connection registry</p>
              </div>
              <button
                onClick={() => setIsCreateServerOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Register Server</span>
              </button>
            </div>

            {isLoadingData ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                Loading servers...
              </div>
            ) : servers.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
                <Server className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-semibold text-white">No servers found.</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  The servers table in PostgreSQL is currently empty. Register your first Minecraft server using the button above.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Server Name</th>
                        <th className="py-3 px-4">Identifier</th>
                        <th className="py-3 px-4">RAM (MB)</th>
                        <th className="py-3 px-4">Disk (MB)</th>
                        <th className="py-3 px-4">CPU (%)</th>
                        <th className="py-3 px-4">Version</th>
                        <th className="py-3 px-4">IP</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {servers.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-semibold text-white">{s.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">{s.server_identifier}</td>
                          <td className="py-3 px-4">{s.ram} MB</td>
                          <td className="py-3 px-4">{s.disk} MB</td>
                          <td className="py-3 px-4">{s.cpu}%</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[11px]">
                              {s.minecraft_version} (JDK {s.jdk_version})
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">{s.ip}</td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => setEditingServer(s)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                              title="Edit Server Parameters"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteServer(s.id, s.name)}
                              className="p-1.5 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 rounded"
                              title="Delete Server"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal: Register Server */}
            {isCreateServerOpen && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-lg w-full space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white">Register Minecraft Server</h3>
                    <button
                      onClick={() => setIsCreateServerOpen(false)}
                      className="text-slate-400 hover:text-white text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateServer} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-300 font-semibold mb-1 block">Server Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Survival SMP"
                        value={serverForm.name}
                        onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold mb-1 block">Server Identifier (Unique)</label>
                      <input
                        type="text"
                        placeholder="e.g. srv-survival-1 (optional)"
                        value={serverForm.server_identifier}
                        onChange={(e) => setServerForm({ ...serverForm, server_identifier: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">RAM (MB)</label>
                        <input
                          type="number"
                          required
                          value={serverForm.ram}
                          onChange={(e) => setServerForm({ ...serverForm, ram: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">Disk (MB)</label>
                        <input
                          type="number"
                          required
                          value={serverForm.disk}
                          onChange={(e) => setServerForm({ ...serverForm, disk: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">CPU (%)</label>
                        <input
                          type="number"
                          required
                          value={serverForm.cpu}
                          onChange={(e) => setServerForm({ ...serverForm, cpu: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">Minecraft Version</label>
                        <input
                          type="text"
                          required
                          value={serverForm.minecraft_version}
                          onChange={(e) => setServerForm({ ...serverForm, minecraft_version: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">JDK Version</label>
                        <input
                          type="text"
                          required
                          value={serverForm.jdk_version}
                          onChange={(e) => setServerForm({ ...serverForm, jdk_version: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold mb-1 block">Server IP / Bind Address</label>
                      <input
                        type="text"
                        required
                        value={serverForm.ip}
                        onChange={(e) => setServerForm({ ...serverForm, ip: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsCreateServerOpen(false)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium"
                      >
                        Save Server
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Edit Server */}
            {editingServer && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-lg w-full space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white">Edit Server: {editingServer.name}</h3>
                    <button
                      onClick={() => setEditingServer(null)}
                      className="text-slate-400 hover:text-white text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleUpdateServer} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-300 font-semibold mb-1 block">Server Name</label>
                      <input
                        type="text"
                        required
                        value={editingServer.name}
                        onChange={(e) => setEditingServer({ ...editingServer, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">RAM (MB)</label>
                        <input
                          type="number"
                          required
                          value={editingServer.ram}
                          onChange={(e) => setEditingServer({ ...editingServer, ram: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">Disk (MB)</label>
                        <input
                          type="number"
                          required
                          value={editingServer.disk}
                          onChange={(e) => setEditingServer({ ...editingServer, disk: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">CPU (%)</label>
                        <input
                          type="number"
                          required
                          value={editingServer.cpu}
                          onChange={(e) => setEditingServer({ ...editingServer, cpu: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">Minecraft Version</label>
                        <input
                          type="text"
                          required
                          value={editingServer.minecraft_version}
                          onChange={(e) => setEditingServer({ ...editingServer, minecraft_version: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-semibold mb-1 block">JDK Version</label>
                        <input
                          type="text"
                          required
                          value={editingServer.jdk_version}
                          onChange={(e) => setEditingServer({ ...editingServer, jdk_version: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold mb-1 block">IP Address</label>
                      <input
                        type="text"
                        required
                        value={editingServer.ip}
                        onChange={(e) => setEditingServer({ ...editingServer, ip: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditingServer(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium"
                      >
                        Update Server
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: USERS */}
        {currentTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Users & Access Control</h2>
                <p className="text-xs text-slate-400">PostgreSQL authenticated accounts and role assignments</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setIsCreateUserOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create User</span>
                </button>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Created</th>
                      {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{u.name || u.username}</div>
                          <div className="text-[11px] text-slate-500">@{u.username}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono">{u.email}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              u.role === 'admin'
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            {u.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                className="p-1.5 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 rounded"
                                title="Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal: Create User */}
            {isCreateUserOpen && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white">Create New User</h3>
                    <button
                      onClick={() => setIsCreateUserOpen(false)}
                      className="text-slate-400 hover:text-white text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-300 font-semibold mb-1 block">Username</label>
                      <input
                        type="text"
                        required
                        value={userForm.username}
                        onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold mb-1 block">Email</label>
                      <input
                        type="email"
                        required
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold mb-1 block">Display Name</label>
                      <input
                        type="text"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold mb-1 block">Password (min 8 chars)</label>
                      <input
                        type="password"
                        required
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                    <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsCreateUserOpen(false)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium"
                      >
                        Create User
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LIVE CONFIGURATION (Admin only) */}
        {currentTab === 'config' && isAdmin && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Live System Configuration</h2>
              <p className="text-xs text-slate-400">
                Manage supported runtime parameters securely. Secrets are never exposed.
              </p>
            </div>

            {systemConfig && (
              <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold mb-1 block">API Port</label>
                    <input
                      type="number"
                      value={systemConfig.API_PORT}
                      onChange={(e) =>
                        setSystemConfig({ ...systemConfig, API_PORT: parseInt(e.target.value, 10) || 3000 })
                      }
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Requires service restart if modified.</p>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold mb-1 block">CORS Allowed Origins</label>
                    <input
                      type="text"
                      value={systemConfig.CORS_ORIGINS}
                      onChange={(e) => setSystemConfig({ ...systemConfig, CORS_ORIGINS: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Comma-separated URLs or *</p>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold mb-1 block">Session Duration (Days)</label>
                    <input
                      type="number"
                      value={systemConfig.SESSION_DURATION_DAYS}
                      onChange={(e) =>
                        setSystemConfig({
                          ...systemConfig,
                          SESSION_DURATION_DAYS: parseInt(e.target.value, 10) || 7,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold mb-1 block">Public Registration</label>
                    <label className="flex items-center space-x-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={systemConfig.REGISTRATION_ENABLED}
                        onChange={(e) =>
                          setSystemConfig({ ...systemConfig, REGISTRATION_ENABLED: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-0"
                      />
                      <span className="text-slate-300">Allow new users to register</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold mb-1 block">Google OAuth</label>
                    <label className="flex items-center space-x-2 mt-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={systemConfig.OAUTH_GOOGLE_ENABLED}
                        onChange={(e) =>
                          setSystemConfig({ ...systemConfig, OAUTH_GOOGLE_ENABLED: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-0"
                      />
                      <span className="text-slate-300">Enable Google OAuth Sign-in</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Google Client ID (Public)"
                      value={systemConfig.GOOGLE_CLIENT_ID}
                      onChange={(e) => setSystemConfig({ ...systemConfig, GOOGLE_CLIENT_ID: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold mb-1 block">Discord OAuth</label>
                    <label className="flex items-center space-x-2 mt-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={systemConfig.OAUTH_DISCORD_ENABLED}
                        onChange={(e) =>
                          setSystemConfig({ ...systemConfig, OAUTH_DISCORD_ENABLED: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-0"
                      />
                      <span className="text-slate-300">Enable Discord OAuth Sign-in</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Discord Client ID (Public)"
                      value={systemConfig.DISCORD_CLIENT_ID}
                      onChange={(e) => setSystemConfig({ ...systemConfig, DISCORD_CLIENT_ID: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-950/40"
                  >
                    Save Runtime Configuration
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB: API KEYS */}
        {currentTab === 'api-keys' && <ApiKeysView showToast={showToast} />}

        {/* TAB: SESSION MANAGER */}
        {currentTab === 'sessions' && <SessionManagerView />}

        {/* TAB: API DOCUMENTATION */}
        {currentTab === 'docs' && <ApiDocsView showToast={showToast} />}

        {/* TAB 5: MY ACCOUNT */}
        {currentTab === 'account' && (
          <div className="space-y-6 max-w-xl">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Account Settings</h2>
              <p className="text-xs text-slate-400">Manage your credentials and persistent session</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-semibold text-white">Profile Details</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Username</span>
                  <span className="font-mono text-white">@{currentUser.username}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Email</span>
                  <span className="font-mono text-white">{currentUser.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Display Name</span>
                  <span className="text-white">{currentUser.name || 'Not set'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Role</span>
                  <span className="font-mono uppercase text-emerald-400">{currentUser.role}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleChangeAccountPassword} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-semibold text-white">Change Password</h3>
              <p className="text-xs text-slate-400">
                Updating your password re-hashes credentials with Argon2id and secures your account.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Current Password</label>
                  <input
                    type="password"
                    required
                    value={accountPasswordForm.currentPassword}
                    onChange={(e) =>
                      setAccountPasswordForm({ ...accountPasswordForm, currentPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">New Password (min 8 chars)</label>
                  <input
                    type="password"
                    required
                    value={accountPasswordForm.newPassword}
                    onChange={(e) =>
                      setAccountPasswordForm({ ...accountPasswordForm, newPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={accountPasswordForm.confirmPassword}
                    onChange={(e) =>
                      setAccountPasswordForm({ ...accountPasswordForm, confirmPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
