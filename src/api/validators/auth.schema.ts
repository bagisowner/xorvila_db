import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  username: z.string().min(3, 'Username must be at least 3 characters').max(32).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, underscores, and hyphens'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  display_name: z.string().max(128).optional(),
});

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Key name is required').max(128),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});
