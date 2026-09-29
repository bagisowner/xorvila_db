import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Clock,
  Shield,
  RefreshCw,
  X,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { dbClient } from '../client/index.js';
import { ApiKey } from '../client/types.js';

const AVAILABLE_SCOPES = [
  { id: 'servers:read', label: 'servers:read', desc: 'View server registries and configs' },
  { id: 'servers:write', label: 'servers:write', desc: 'Create, update, and delete servers' },
  { id: 'users:read', label: 'users:read', desc: 'View registered users' },
  { id: 'users:write', label: 'users:write', desc: 'Modify and delete user accounts' },
  { id: 'settings:read', label: 'settings:read', desc: 'Read runtime settings' },
  { id: 'settings:write', label: 'settings:write', desc: 'Update system configuration live' },
  { id: 'system:read', label: 'system:read', desc: 'Access system status and health' },
  { id: 'api-keys:read', label: 'api-keys:read', desc: 'List and inspect API keys' },
  { id: 'api-keys:write', label: 'api-keys:write', desc: 'Create, revoke, and delete API keys' },
];

export function ApiKeysView({
  showToast,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create Key modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['servers:read', 'servers:write']);
  const [expiryDays, setExpiryDays] = useState<number | ''>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New key generated display state (Shown ONLY ONCE)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    id: string;
    name: string;
    token: string;
    keyPrefix: string;
    scopes: string[];
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await dbClient.apiKeys.list();
      if (res.success && res.data?.api_keys) {
        setKeys(res.data.api_keys);
      } else {
        showToast(res.error?.message || 'Failed to fetch API keys', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading API keys', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      showToast('API key name is required', 'error');
      return;
    }
    if (selectedScopes.length === 0) {
      showToast('Select at least one scope for this API key', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await dbClient.apiKeys.create({
        name: keyName.trim(),
        scopes: selectedScopes,
        expiresInDays: expiryDays === '' ? undefined : Number(expiryDays),
      });

      if (res.success && res.data?.api_key) {
        const created = res.data.api_key;
        setNewlyCreatedKey({
          id: created.id,
          name: created.name,
          token: created.token,
          keyPrefix: created.key_prefix,
          scopes: created.scopes || selectedScopes,
        });
        setIsCreateOpen(false);
        setKeyName('');
        setSelectedScopes(['servers:read', 'servers:write']);
        setExpiryDays(30);
        showToast('API key created successfully');
        loadKeys();
      } else {
        showToast(res.error?.message || 'Failed to create API key', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating API key', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke API key "${name}"? It will immediately stop working.`)) {
      return;
    }

    try {
      const res = await dbClient.apiKeys.revoke(id);
      if (res.success) {
        showToast(`API key "${name}" revoked`);
        loadKeys();
      } else {
        showToast(res.error?.message || 'Failed to revoke API key', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error revoking API key', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete API key "${name}" from PostgreSQL?`)) {
      return;
    }

    try {
      const res = await dbClient.apiKeys.delete(id);
      if (res.success) {
        showToast(`API key "${name}" deleted`);
        loadKeys();
      } else {
        showToast(res.error?.message || 'Failed to delete API key', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting API key', 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 3000);
  };

  const toggleScope = (scopeId: string) => {
    if (selectedScopes.includes(scopeId)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scopeId));
    } else {
      setSelectedScopes([...selectedScopes, scopeId]);
    }
  };

  const formatRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSecs < 60) return 'Just now';
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} minutes ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} hours ago`;
    if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const getKeyStatus = (key: ApiKey) => {
    if (key.revoked_at) {
      return { status: 'Revoked', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    }
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return { status: 'Expired', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    }
    return { status: 'Active', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <span>API Keys</span>
          </h2>
          <p className="text-xs text-slate-400">
            Create and manage cryptographically secure Bearer tokens to authenticate external clients with MCPANEL Database API.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadKeys}
            disabled={isLoading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-emerald-950/40 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create API Key</span>
          </button>
        </div>
      </div>

      {/* NEWLY CREATED KEY NOTICE MODAL (SHOWN ONLY ONCE) */}
      {newlyCreatedKey && (
        <div className="bg-emerald-950/40 border-2 border-emerald-500/60 rounded-xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">API Key Created Successfully</h3>
                <p className="text-xs text-slate-300">
                  Key name: <strong className="text-white">{newlyCreatedKey.name}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="font-mono text-emerald-400 text-xs sm:text-sm select-all break-all">
              {newlyCreatedKey.token}
            </div>
            <button
              onClick={() => copyToClipboard(newlyCreatedKey.token)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium flex items-center justify-center space-x-1.5 shrink-0 transition"
            >
              {hasCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy API Key</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2 text-rose-300 bg-rose-950/40 border border-rose-900/40 px-3 py-2 rounded-lg text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              <strong>WARNING:</strong> This key will not be shown again. Please copy and store it in a secure location now.
            </span>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Registered API Keys ({keys.length})
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Hashed with HMAC-SHA256 • Stored in PostgreSQL
          </span>
        </div>

        {keys.length === 0 ? (
          <div className="py-14 text-center px-4">
            <Key className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-medium">No API keys created yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Create an API key to securely connect MCPANEL web panel or external microservices directly to the Database API.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create First API Key</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {keys.map((k) => {
              const status = getKeyStatus(k);
              const isActive = status.status === 'Active';

              return (
                <div
                  key={k.id}
                  className="p-6 hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-sm font-bold text-white tracking-wide">{k.name}</h4>
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${status.color}`}
                      >
                        {status.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <div className="flex items-center space-x-1.5 font-mono">
                        <Key className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-300 font-semibold">{k.key_prefix}</span>
                      </div>

                      <div className="flex items-center space-x-1 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Created: {new Date(k.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center space-x-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Last used: {formatRelativeTime(k.last_used_at)}</span>
                      </div>

                      {k.expires_at ? (
                        <div className="flex items-center space-x-1 text-slate-400">
                          <span>Expires: {new Date(k.expires_at).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Never expires</span>
                      )}
                    </div>

                    {/* Scopes */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 font-medium">Scopes:</span>
                      {k.scopes && k.scopes.length > 0 ? (
                        k.scopes.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">None</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                    {isActive && (
                      <button
                        onClick={() => handleRevoke(k.id, k.name)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:border-rose-700/60 hover:text-rose-300 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                      >
                        Revoke
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(k.id, k.name)}
                      className="p-2 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg transition"
                      title="Delete API key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE API KEY MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-white">
                <Key className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Generate New API Key</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Key Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MCPANEL Production"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Expiration</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>1 Year</option>
                  <option value="">Never Expires</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-300 font-semibold">Select Scopes</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedScopes.length === AVAILABLE_SCOPES.length) {
                        setSelectedScopes(['servers:read']);
                      } else {
                        setSelectedScopes(AVAILABLE_SCOPES.map((s) => s.id));
                      }
                    }}
                    className="text-[11px] text-emerald-400 hover:underline"
                  >
                    {selectedScopes.length === AVAILABLE_SCOPES.length ? 'Select Minimal' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-950/60 border border-slate-800 rounded-lg">
                  {AVAILABLE_SCOPES.map((scope) => {
                    const isChecked = selectedScopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        className={`flex items-start space-x-2.5 p-2 rounded cursor-pointer border text-xs transition ${
                          isChecked
                            ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleScope(scope.id)}
                          className="mt-0.5 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-0"
                        />
                        <div className="leading-tight">
                          <span className="font-mono font-medium block">{scope.label}</span>
                          <span className="text-[10px] text-slate-500">{scope.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-950/40"
                >
                  {isSubmitting ? 'Generating...' : 'Create Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
