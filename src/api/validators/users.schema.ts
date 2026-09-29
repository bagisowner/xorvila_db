import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  role: z.string().default('user'),
  is_active: z.boolean().default(true),
  is_verified: z.boolean().default(true),
  display_name: z.string().max(128).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.string().optional(),
  is_active: z.boolean().optional(),
  is_verified: z.boolean().optional(),
  display_name: z.string().max(128).optional(),
  bio: z.string().max(1000).optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.string().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['created_at', 'username', 'email']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createRoleSchema = z.object({
  name: z.string().min(2).max(64).regex(/^[a-z0-9_-]+$/, 'Role name must be lowercase alphanumeric with hyphens or underscores'),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).optional(),
});
