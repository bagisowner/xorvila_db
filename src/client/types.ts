export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
  requestId?: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

export interface Role {
  id: string;
  name: string;
}

export interface Server {
  id: string;
  owner_user_id?: string;
  owner_username?: string;
  owner_email?: string;
  name: string;
  server_identifier: string;
  ram: number;
  disk: number;
  cpu: number;
  minecraft_version: string;
  jdk_version: string;
  ip: string;
  created_at?: string;
  updated_at?: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  last_used_at?: string;
  created_at: string;
  revoked_at?: string;
}

export interface SystemStatus {
  status: 'online' | 'degraded';
  database: 'connected' | 'disconnected';
  api: 'online';
  authentication: 'operational' | 'degraded';
  serverRegistry: 'operational' | 'degraded';
  uptime: number;
  version: string;
  databaseEngine?: string;
  metrics?: {
    usersCount: number;
    serversCount: number;
  };
}

export interface SystemConfig {
  API_PORT: number;
  CORS_ORIGINS: string;
  SESSION_DURATION_DAYS: number;
  OAUTH_GOOGLE_ENABLED: boolean;
  GOOGLE_CLIENT_ID: string;
  OAUTH_DISCORD_ENABLED: boolean;
  DISCORD_CLIENT_ID: string;
  REGISTRATION_ENABLED: boolean;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes?: string[];
  expires_at?: string;
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
  username?: string;
  email?: string;
}
