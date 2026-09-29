import React, { useState, useEffect } from 'react';
import {
  FileText,
  ExternalLink,
  Play,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
  Key,
  Shield,
  Code2,
  Lock,
  ChevronDown,
  ChevronRight,
  Database,
} from 'lucide-react';
import { openApiSpec } from '../api/docs/openapi.js';

interface EndpointDoc {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  path: string;
  tag: string;
  summary: string;
  description?: string;
  security?: any[];
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: any; description?: string }>;
  requestBody?: any;
  responses?: Record<string, any>;
}

export function ApiDocsView({
  showToast,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});
  
  // Try it tester state
  const [testerAuthType, setTesterAuthType] = useState<'session' | 'apiKey'>('session');
  const [testerApiKey, setTesterApiKey] = useState('');
  const [testStates, setTestStates] = useState<Record<string, {
    pathParams: Record<string, string>;
    requestBody: string;
    isLoading: boolean;
    response: {
      status?: number;
      statusText?: string;
      timeMs?: number;
      data?: any;
      headers?: Record<string, string>;
      error?: string;
    } | null;
  }>>({});

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:3000/api/v1';

  // Parse OpenAPI spec into flat endpoints list
  const endpoints: EndpointDoc[] = React.useMemo(() => {
    const list: EndpointDoc[] = [];
    const paths = (openApiSpec.paths || {}) as Record<string, any>;

    for (const [path, methods] of Object.entries(paths)) {
      if (!methods || typeof methods !== 'object') continue;
      for (const [method, details] of Object.entries(methods as Record<string, any>)) {
        if (['get', 'post', 'patch', 'delete', 'put'].includes(method.toLowerCase())) {
          const upperMethod = method.toUpperCase() as EndpointDoc['method'];
          const tag = (details?.tags && details.tags[0]) || 'General';
          list.push({
            method: upperMethod,
            path,
            tag,
            summary: details?.summary || '',
            description: details?.description || '',
            security: details?.security,
            parameters: details?.parameters,
            requestBody: details?.requestBody,
            responses: details?.responses,
          });
        }
      }
    }
    return list;
  }, []);

  const categories = React.useMemo(() => {
    const tags = Array.from(new Set(endpoints.map((e) => e.tag)));
    return ['all', ...tags];
  }, [endpoints]);

  const filteredEndpoints = React.useMemo(() => {
    return endpoints.filter((e) => {
      const matchesCategory = activeCategory === 'all' || e.tag.toLowerCase() === activeCategory.toLowerCase();
      const matchesSearch =
        e.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.tag.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [endpoints, activeCategory, searchQuery]);

  const toggleExpand = (key: string) => {
    setExpandedEndpoints((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getEndpointKey = (endpoint: EndpointDoc) => `${endpoint.method}_${endpoint.path}`;

  const getRequiredScopes = (endpoint: EndpointDoc): string[] => {
    const desc = (endpoint.description || '') + (endpoint.summary || '');
    const scopes: string[] = [];
    const scopeNames = [
      'servers:read',
      'servers:write',
      'users:read',
      'users:write',
      'settings:read',
      'settings:write',
      'system:read',
      'api-keys:read',
      'api-keys:write',
    ];
    for (const s of scopeNames) {
      if (desc.includes(s) || endpoint.path.includes(s.split(':')[0])) {
        if (!scopes.includes(s)) scopes.push(s);
      }
    }
    return scopes.length > 0 ? scopes : ['session/bearer'];
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'POST':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'PATCH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getDefaultRequestBody = (endpoint: EndpointDoc): string => {
    if (!endpoint.requestBody) return '';
    const content = endpoint.requestBody.content?.['application/json'];
    if (!content || !content.schema) return '{}';
    const schema = content.schema;
    if (schema.example) return JSON.stringify(schema.example, null, 2);

    const sample: Record<string, any> = {};
    if (schema.properties) {
      for (const [prop, val] of Object.entries(schema.properties as Record<string, any>)) {
        if (val.example !== undefined) sample[prop] = val.example;
        else if (val.type === 'string') sample[prop] = prop.includes('email') ? 'user@example.com' : 'sample_value';
        else if (val.type === 'integer' || val.type === 'number') sample[prop] = 100;
        else if (val.type === 'boolean') sample[prop] = true;
        else if (val.type === 'array') sample[prop] = ['servers:read'];
      }
    }
    return Object.keys(sample).length > 0 ? JSON.stringify(sample, null, 2) : '{}';
  };

  const handleExecuteRequest = async (endpoint: EndpointDoc) => {
    const key = getEndpointKey(endpoint);
    const state = testStates[key] || {
      pathParams: {},
      requestBody: getDefaultRequestBody(endpoint),
      isLoading: false,
      response: null,
    };

    // Replace path parameters (e.g. {id})
    let targetPath = endpoint.path;
    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        if (param.in === 'path') {
          const val = state.pathParams[param.name] || 'demo-id';
          targetPath = targetPath.replace(`{${param.name}}`, val);
        }
      }
    }

    const fullUrl = `${baseUrl.replace(/\/$/, '')}${targetPath}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (testerAuthType === 'apiKey' && testerApiKey.trim()) {
      headers['Authorization'] = `Bearer ${testerApiKey.trim()}`;
    }

    const reqInit: RequestInit = {
      method: endpoint.method,
      headers,
      credentials: 'include', // Includes HttpOnly session cookie
    };

    if (['POST', 'PATCH', 'PUT'].includes(endpoint.method) && state.requestBody) {
      reqInit.body = state.requestBody;
    }

    setTestStates((prev) => ({
      ...prev,
      [key]: { ...state, isLoading: true, response: null },
    }));

    const startTime = performance.now();
    try {
      const res = await fetch(fullUrl, reqInit);
      const timeMs = Math.round(performance.now() - startTime);

      let responseData: any = null;
      const text = await res.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }

      setTestStates((prev) => ({
        ...prev,
        [key]: {
          ...state,
          isLoading: false,
          response: {
            status: res.status,
            statusText: res.statusText,
            timeMs,
            data: responseData,
          },
        },
      }));
    } catch (err: any) {
      const timeMs = Math.round(performance.now() - startTime);
      setTestStates((prev) => ({
        ...prev,
        [key]: {
          ...state,
          isLoading: false,
          response: {
            error: err.message || 'Network request failed',
            timeMs,
          },
        },
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and API Info Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 mb-1">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider">
                OpenAPI 3.0.3 Specification
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">MCPANEL Database API Documentation</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Complete, real OpenAPI specification generated directly from active backend routes. All endpoints interact directly with PostgreSQL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition"
            >
              <span>Swagger UI</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>

            <a
              href="/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs font-mono font-medium flex items-center space-x-1.5 transition"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>/openapi.json</span>
            </a>
          </div>
        </div>

        {/* Base URL Banner */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">API Base URL:</span>
            <code className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-emerald-400 font-mono font-semibold select-all">
              {baseUrl}
            </code>
          </div>
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Accepts HttpOnly Session or Bearer API Key</span>
          </div>
        </div>

        {/* Global Tester Authorization Config */}
        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-300">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">Interactive Test Credentials:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setTesterAuthType('session')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  testerAuthType === 'session'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Current Session
              </button>
              <button
                type="button"
                onClick={() => setTesterAuthType('apiKey')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  testerAuthType === 'apiKey'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Custom API Key
              </button>
            </div>

            {testerAuthType === 'apiKey' && (
              <input
                type="password"
                placeholder="Paste mc_live_... key"
                value={testerApiKey}
                onChange={(e) => setTesterApiKey(e.target.value)}
                className="px-3 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white font-mono placeholder-slate-600 w-48 focus:outline-none focus:border-emerald-500"
              />
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Categories */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize shrink-0 transition ${
                activeCategory === cat
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Endpoints' : cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter by path, method, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Endpoints List */}
      <div className="space-y-3">
        {filteredEndpoints.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
            <p className="text-sm">No matching endpoints found</p>
          </div>
        ) : (
          filteredEndpoints.map((endpoint) => {
            const key = getEndpointKey(endpoint);
            const isExpanded = Boolean(expandedEndpoints[key]);
            const badgeColor = getMethodBadgeColor(endpoint.method);
            const scopes = getRequiredScopes(endpoint);
            const testState = testStates[key] || {
              pathParams: {},
              requestBody: getDefaultRequestBody(endpoint),
              isLoading: false,
              response: null,
            };

            return (
              <div
                key={key}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition shadow-lg"
              >
                {/* Endpoint Header Bar */}
                <div
                  onClick={() => toggleExpand(key)}
                  className="px-5 py-4 cursor-pointer hover:bg-slate-800/40 flex items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <span
                      className={`text-xs font-bold font-mono px-2.5 py-1 rounded border uppercase tracking-wider shrink-0 ${badgeColor}`}
                    >
                      {endpoint.method}
                    </span>
                    <span className="font-mono text-sm font-semibold text-white tracking-wide truncate">
                      {endpoint.path}
                    </span>
                    <span className="text-xs text-slate-400 hidden md:inline truncate">
                      {endpoint.summary}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                      {endpoint.tag}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details & Try It Console */}
                {isExpanded && (
                  <div className="p-6 border-t border-slate-800 bg-slate-950/60 space-y-6 animate-in fade-in duration-150">
                    {/* Description & Security */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="md:col-span-2 space-y-2">
                        <h4 className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                          Description
                        </h4>
                        <p className="text-slate-300 leading-relaxed">
                          {endpoint.description || endpoint.summary}
                        </p>
                      </div>

                      <div className="space-y-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
                        <h4 className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                          Authentication & Scopes
                        </h4>
                        <div className="text-slate-300 font-mono text-[11px] flex items-center space-x-1.5">
                          <Lock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Bearer API Key / Session</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {scopes.map((s) => (
                            <span
                              key={s}
                              className="px-1.5 py-0.5 bg-slate-800 text-emerald-400 rounded text-[10px] font-mono border border-slate-700"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Path Parameters (if any) */}
                    {endpoint.parameters && endpoint.parameters.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                          Parameters
                        </h4>
                        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                              <tr>
                                <th className="p-2.5">Name</th>
                                <th className="p-2.5">In</th>
                                <th className="p-2.5">Required</th>
                                <th className="p-2.5">Value (Test Input)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                              {endpoint.parameters.map((param) => (
                                <tr key={param.name}>
                                  <td className="p-2.5 font-bold text-white">{param.name}</td>
                                  <td className="p-2.5 text-slate-400">{param.in}</td>
                                  <td className="p-2.5 text-amber-400">
                                    {param.required ? 'Yes' : 'No'}
                                  </td>
                                  <td className="p-2.5">
                                    <input
                                      type="text"
                                      placeholder={`Enter ${param.name}`}
                                      value={testState.pathParams[param.name] || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTestStates((prev) => ({
                                          ...prev,
                                          [key]: {
                                            ...testState,
                                            pathParams: {
                                              ...testState.pathParams,
                                              [param.name]: val,
                                            },
                                          },
                                        }));
                                      }}
                                      className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white w-full max-w-xs focus:outline-none focus:border-emerald-500 font-mono"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Request Body (if any) */}
                    {['POST', 'PATCH', 'PUT'].includes(endpoint.method) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                            Request Body (application/json)
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">Editable test payload</span>
                        </div>
                        <textarea
                          rows={5}
                          value={testState.requestBody}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTestStates((prev) => ({
                              ...prev,
                              [key]: { ...testState, requestBody: val },
                            }));
                          }}
                          className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}

                    {/* Try It Action & Live Response Section */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          disabled={testState.isLoading}
                          onClick={() => handleExecuteRequest(endpoint)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-emerald-950/40 transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{testState.isLoading ? 'Executing Request...' : 'Try It / Test Endpoint'}</span>
                        </button>

                        <span className="text-xs text-slate-500 font-mono">
                          Target: {baseUrl}
                          {endpoint.path}
                        </span>
                      </div>

                      {/* Response Box */}
                      {testState.response && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <div className="flex items-center space-x-3">
                              <span className="text-xs font-semibold text-slate-400">Response</span>
                              {testState.response.status !== undefined && (
                                <span
                                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                    testState.response.status >= 200 && testState.response.status < 300
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  }`}
                                >
                                  {testState.response.status} {testState.response.statusText}
                                </span>
                              )}
                              {testState.response.timeMs !== undefined && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {testState.response.timeMs}ms
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  JSON.stringify(testState.response?.data, null, 2)
                                );
                                showToast('Response copied to clipboard');
                              }}
                              className="text-slate-400 hover:text-white p-1 text-xs flex items-center space-x-1"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy JSON</span>
                            </button>
                          </div>

                          <pre className="p-3 bg-slate-900 rounded font-mono text-xs text-slate-200 overflow-x-auto max-h-72">
                            {JSON.stringify(testState.response.data || testState.response.error, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
