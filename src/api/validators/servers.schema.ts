import { z } from 'zod';

export const createServerSchema = z.object({
  name: z.string().min(2, 'Server name must be at least 2 characters').max(128),
  description: z.string().max(500).optional(),
  node_id: z.string().uuid().optional(),
  memory_mb: z.number().int().min(512).max(131072).default(2048),
  cpu_limit: z.number().int().min(20).max(1600).default(100),
  disk_mb: z.number().int().min(1024).max(1048576).default(10240),
  port: z.number().int().min(1024).max(65535).default(25565),
  server_type: z.enum(['paper', 'spigot', 'vanilla', 'forge', 'fabric', 'purpur', 'velocity', 'bungeecord', 'custom']).default('paper'),
  minecraft_version: z.string().default('1.20.4'),
  auto_start: z.boolean().default(false),
});

export const updateServerSchema = createServerSchema.partial().extend({
  status: z.enum(['online', 'offline', 'starting', 'stopping', 'crashed']).optional(),
});

export const serverQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  node_id: z.string().optional(),
});

export const addMemberSchema = z.object({
  user_id: z.string().uuid('Valid user ID required'),
  role: z.enum(['admin', 'operator', 'viewer']).default('operator'),
});

export const createScheduleSchema = z.object({
  name: z.string().min(2).max(128),
  cron_expression: z.string().min(5).max(64),
  is_active: z.boolean().default(true),
  action: z.string().min(2).max(64),
  payload: z.record(z.string(), z.any()).default({}),
});

export const fileTrackChangeSchema = z.object({
  server_id: z.string().uuid('Valid server ID required'),
  file_path: z.string().min(1),
  action: z.enum(['FILE_CREATE', 'FILE_EDIT', 'FILE_DELETE', 'FILE_RENAME']),
  before_value: z.string().optional(),
  after_value: z.string().optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  mime_type: z.string().optional(),
});
