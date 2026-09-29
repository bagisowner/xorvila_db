import {
  ApiResponse,
  User,
  Role,
  Server,
  SystemStatus,
  SystemConfig,
  ApiKey,
} from './types.js';

export class MCPANELDatabaseClient {
  private baseUrl: string;
  private sessionToken: string | null = null;
  private apiKey: string | null = null;
  private fetchFn: typeof fetch;

  constructor(options: { baseUrl?: string; sessionToken?: string; apiKey?: string; fetch?: typeof fetch } = {}) {
    this.baseUrl = options.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    this.sessionToken = options.sessionToken || null;
    this.apiKey = options.apiKey || null;
    this.fetchFn = options.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (null as any));
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setSessionToken(token: string | null) {
    this.sessionToken = token;
  }

  setApiKey(key: string | null) {
    this.apiKey = key;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await this.fetchFn(url, {
        ...options,
        headers,
        credentials: 'include', // Sends HttpOnly mcpanel_session cookie automatically in browsers
      });

      const data = await response.json();
      if (typeof data.success === 'boolean') {
        return data as ApiResponse<T>;
      }
      return {
        success: response.ok,
        data: data as T,
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Failed to communicate with MCPANEL Database API',
        },
      };
    }
  }

  // Health
  health = {
    check: () => this.request<{ status: string; database: string }>('/health'),
  };

  // Auth
  auth = {
    register: async (data: { email: string; username: string; password?: string; name?: string }) => {
      return this.request<{ user: User; expires_at: string }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    login: async (credentials: { usernameOrEmail: string; password: string }) => {
      return this.request<{ user: User; expires_at: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    },

    logout: async () => {
      const res = await this.request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' });
      this.setSessionToken(null);
      return res;
    },

    me: () => this.request<{ user: User; authType: string }>('/api/v1/auth/me'),

    forgotPassword: (email: string) =>
      this.request<{ message: string; resetToken?: string }>('/api/v1/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (data: { token: string; password: string }) =>
      this.request<{ message: string }>('/api/v1/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getOAuthStatus: () => this.request<any>('/api/v1/auth/oauth/config'),

    sessions: {
      list: () => this.request<{ sessions: any[] }>('/api/v1/auth/sessions'),
      revoke: (id: string) => this.request<{ message: string }>(`/api/v1/auth/sessions/${id}`, { method: 'DELETE' }),
      revokeAll: (keepCurrent: boolean = true) => 
        this.request<{ message: string }>(`/api/v1/auth/sessions?keepCurrent=${keepCurrent}`, { method: 'DELETE' }),
    },
  };

  // Servers
  servers = {
    list: () => this.request<{ servers: Server[]; total: number }>('/api/v1/servers'),
    get: (id: string) => this.request<{ server: Server }>(`/api/v1/servers/${id}`),
    create: (data: Partial<Server> & { name: string }) =>
      this.request<{ server: Server }>('/api/v1/servers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, updates: Partial<Server>) =>
      this.request<{ server: Server }>(`/api/v1/servers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      this.request<{ message: string }>(`/api/v1/servers/${id}`, {
        method: 'DELETE',
      }),
  };

  // Users
  users = {
    list: () => this.request<{ users: User[]; total: number }>('/api/v1/users'),
    get: (id: string) => this.request<{ user: User }>(`/api/v1/users/${id}`),
    update: (id: string, updates: Partial<User>) =>
      this.request<{ user: User }>(`/api/v1/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    changePassword: (id: string, data: { currentPassword?: string; newPassword: string }) =>
      this.request<{ message: string }>(`/api/v1/users/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      this.request<{ message: string }>(`/api/v1/users/${id}`, {
        method: 'DELETE',
      }),
  };

  // Roles
  roles = {
    list: () => this.request<{ roles: Role[] }>('/api/v1/roles'),
    create: (data: { name: string }) =>
      this.request<{ role: Role }>('/api/v1/roles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      this.request<{ message: string }>(`/api/v1/roles/${id}`, {
        method: 'DELETE',
      }),
  };

  // System
  system = {
    status: () => this.request<SystemStatus>('/api/v1/system/status'),
    getConfig: () => this.request<{ config: SystemConfig; allowedKeys: string[] }>('/api/v1/system/config'),
    updateConfig: (updates: Partial<SystemConfig>) =>
      this.request<{ updated: boolean; requiresRestart: boolean; message: string }>('/api/v1/system/config', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
  };

  // API Keys
  apiKeys = {
    list: () => this.request<{ api_keys: ApiKey[] }>('/api/v1/api-keys'),
    get: (id: string) => this.request<{ api_key: ApiKey }>(`/api/v1/api-keys/${id}`),
    create: (data: { name: string; scopes?: string[]; expiresInDays?: number }) =>
      this.request<{ api_key: ApiKey & { token: string }; notice: string }>('/api/v1/api-keys', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    revoke: (id: string) =>
      this.request<{ message: string }>(`/api/v1/api-keys/${id}/revoke`, {
        method: 'POST',
      }),
    delete: (id: string) =>
      this.request<{ message: string }>(`/api/v1/api-keys/${id}`, {
        method: 'DELETE',
      }),
  };

  // OpenAPI Documentation
  docs = {
    getOpenApiSpec: () => this.request<any>('/openapi.json'),
  };
}

export const dbClient = new MCPANELDatabaseClient();
