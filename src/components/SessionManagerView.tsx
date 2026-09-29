import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Smartphone, Monitor, Globe, Clock, Trash2, LogOut, RefreshCw } from 'lucide-react';
import { dbClient } from '../client/index.js';

export function SessionManagerView() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await dbClient.auth.sessions.list();
      if (res.success && res.data?.sessions) {
        setSessions(res.data.sessions);
      } else {
        setError(res.error?.message || 'Failed to load sessions');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revoke this session? You will be logged out on that device.')) return;
    try {
      const res = await dbClient.auth.sessions.revoke(id);
      if (res.success) {
        loadSessions();
      } else {
        alert(res.error?.message || 'Failed to revoke session');
      }
    } catch (err: any) {
      alert(err.message || 'Error revoking session');
    }
  };

  const handleRevokeAllOther = async () => {
    if (!window.confirm('Revoke all other active sessions?')) return;
    try {
      const res = await dbClient.auth.sessions.revokeAll(true);
      if (res.success) {
        loadSessions();
      } else {
        alert(res.error?.message || 'Failed to revoke sessions');
      }
    } catch (err: any) {
      alert(err.message || 'Error revoking sessions');
    }
  };

  const getDeviceIcon = (userAgent: string = '') => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return <Smartphone className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Session Manager</h2>
          <p className="text-xs text-slate-400">Manage active browser sessions across your devices</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadSessions}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleRevokeAllOther}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium flex items-center space-x-2"
          >
            <Shield className="w-4 h-4" />
            <span>Revoke Other Sessions</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {isLoading && sessions.length === 0 ? (
        <div className="p-12 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-emerald-500" />
          <p>Loading active sessions...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`bg-slate-900 border ${
                session.isCurrent ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800'
              } rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}
            >
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-lg ${session.isCurrent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  {getDeviceIcon(session.user_agent)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-200">
                      {session.user_agent?.split(') ')[0]?.split(' (')[1] || 'Unknown Device'}
                    </span>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        Current Session
                      </span>
                    )}
                    {session.revoked_at && (
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>{session.ip || '127.0.0.1'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Last active: {new Date(session.last_used_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right hidden md:block">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Expires</div>
                  <div className="text-xs text-slate-400">{new Date(session.expires_at).toLocaleDateString()}</div>
                </div>
                {!session.revoked_at && !session.isCurrent && (
                  <button
                    onClick={() => handleRevoke(session.id)}
                    className="p-2 bg-slate-800 hover:bg-rose-900/40 hover:text-rose-400 text-slate-400 rounded-lg transition"
                    title="Revoke Session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {session.isCurrent && (
                   <button
                   onClick={() => dbClient.auth.logout().then(() => window.location.reload())}
                   className="p-2 bg-slate-800 hover:bg-rose-900/40 hover:text-rose-400 text-slate-400 rounded-lg transition"
                   title="Log Out"
                 >
                   <LogOut className="w-4 h-4" />
                 </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
