export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'MCPANEL Database API',
    version: '1.0.0',
    description: 'Clean, production-ready, standalone API-first database and authentication service for MCPANEL with PostgreSQL persistence and server registry.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Gateway',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'mcpanel_session',
        description: 'HttpOnly browser session cookie (mcpanel_session)',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Bearer API Key (mc_live_...) or session token in Authorization header',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          username: { type: 'string' },
          name: { type: 'string' },
          avatar: { type: 'string' },
          role: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Server: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          owner_user_id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          server_identifier: { type: 'string' },
          ram: { type: 'integer', example: 4096 },
          disk: { type: 'integer', example: 10240 },
          cpu: { type: 'integer', example: 100 },
          minecraft_version: { type: 'string', example: '1.21' },
          jdk_version: { type: 'string', example: '21' },
          ip: { type: 'string', example: '127.0.0.1' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          key_prefix: { type: 'string', example: 'mc_live_1234...' },
          scopes: {
            type: 'array',
            items: { type: 'string' },
            example: ['servers:read', 'servers:write'],
          },
          created_at: { type: 'string', format: 'date-time' },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
          last_used_at: { type: 'string', format: 'date-time', nullable: true },
          revoked_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      SystemStatus: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'online' },
          database: { type: 'string', example: 'connected' },
          api: { type: 'string', example: 'online' },
          authentication: { type: 'string', example: 'operational' },
          serverRegistry: { type: 'string', example: 'operational' },
          uptime: { type: 'integer', example: 12345 },
          version: { type: 'string', example: '1.0.0' },
          databaseEngine: { type: 'string', example: 'PostgreSQL 18' },
          totalServers: { type: 'integer', example: 0 },
          totalUsers: { type: 'integer', example: 1 },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'UNAUTHORIZED' },
              message: { type: 'string', example: 'Authentication required' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Root service health check',
        description: 'Verifies PostgreSQL database connection and overall service vitality.',
        responses: {
          200: { description: 'Service operational' },
          503: { description: 'Database disconnected / degraded' },
        },
      },
    },
    '/system/status': {
      get: {
        tags: ['System'],
        summary: 'Live real system status',
        description: 'Returns real PostgreSQL connection state, uptime, memory, version, and server counts.',
        responses: {
          200: {
            description: 'Real-time operational status of all subsystems',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SystemStatus' } } },
          },
        },
      },
    },
    '/system/config': {
      get: {
        tags: ['System'],
        summary: 'Get supported runtime configuration (Admin only)',
        description: 'Read runtime settings stored in PostgreSQL system_settings table.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: { description: 'Runtime configuration object' },
          401: { $ref: '#/components/schemas/ApiError' },
          403: { $ref: '#/components/schemas/ApiError' },
        },
      },
      patch: {
        tags: ['System'],
        summary: 'Update supported runtime configuration live (Admin only)',
        description: 'Safely updates whitelisted runtime configuration settings in PostgreSQL.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  serverName: { type: 'string' },
                  enableRegistrations: { type: 'boolean' },
                  maintenanceMode: { type: 'boolean' },
                  defaultServerRam: { type: 'integer' },
                  defaultServerDisk: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Configuration updated successfully' },
          400: { description: 'Invalid configuration parameters' },
          401: { $ref: '#/components/schemas/ApiError' },
          403: { $ref: '#/components/schemas/ApiError' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user account',
        description: 'Creates a new user record in PostgreSQL with Argon2id password hash.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'username', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  username: { type: 'string' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User registered and logged in with HttpOnly cookie' },
          400: { description: 'Validation error or email/username already taken' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate user and create session',
        description: 'Verifies credentials against Argon2id hash in PostgreSQL and issues HttpOnly session cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['usernameOrEmail', 'password'],
                properties: {
                  usernameOrEmail: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful, returns user info and sets session cookie' },
          401: { description: 'Invalid username/email or password' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke session and clear cookies',
        description: 'Marks session revoked in PostgreSQL and clears HttpOnly cookie.',
        responses: {
          200: { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user profile',
        description: 'Retrieves current user identity from PostgreSQL session or Bearer token.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: { description: 'Current user profile with role' },
          401: { description: 'Unauthenticated or session expired' },
        },
      },
    },
    '/auth/password/forgot': {
      post: {
        tags: ['Authentication'],
        summary: 'Request password reset token',
        description: 'Generates secure hashed reset token in PostgreSQL for the matching user.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset token generated and returned' },
        },
      },
    },
    '/auth/password/reset': {
      post: {
        tags: ['Authentication'],
        summary: 'Reset password with token',
        description: 'Validates single-use reset token and hashes new password with Argon2id.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password successfully updated' },
          400: { description: 'Invalid or expired reset token' },
        },
      },
    },
    '/servers': {
      get: {
        tags: ['Servers'],
        summary: 'List servers',
        description: 'Lists servers from PostgreSQL registry. Non-admins only see their owned servers. Requires servers:read scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of servers',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Server' } } } },
          },
          401: { $ref: '#/components/schemas/ApiError' },
          403: { $ref: '#/components/schemas/ApiError' },
        },
      },
      post: {
        tags: ['Servers'],
        summary: 'Register a new server',
        description: 'Registers basic server configuration in PostgreSQL registry. Requires servers:write scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Survival World' },
                  server_identifier: { type: 'string', example: 'srv_survival_01' },
                  ram: { type: 'integer', example: 4096 },
                  disk: { type: 'integer', example: 20480 },
                  cpu: { type: 'integer', example: 200 },
                  minecraft_version: { type: 'string', example: '1.21.1' },
                  jdk_version: { type: 'string', example: '21' },
                  ip: { type: 'string', example: '192.168.1.10' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Server registered in PostgreSQL' },
          400: { description: 'Validation failed or duplicate identifier' },
          401: { $ref: '#/components/schemas/ApiError' },
          403: { $ref: '#/components/schemas/ApiError' },
        },
      },
    },
    '/servers/{id}': {
      get: {
        tags: ['Servers'],
        summary: 'Get server by ID',
        description: 'Fetches single server record. Requires servers:read scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Server details' },
          404: { description: 'Server not found' },
        },
      },
      patch: {
        tags: ['Servers'],
        summary: 'Update server configuration',
        description: 'Updates server parameters in PostgreSQL. Requires servers:write scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  ram: { type: 'integer' },
                  disk: { type: 'integer' },
                  cpu: { type: 'integer' },
                  minecraft_version: { type: 'string' },
                  jdk_version: { type: 'string' },
                  ip: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Server updated successfully' },
          404: { description: 'Server not found' },
        },
      },
      delete: {
        tags: ['Servers'],
        summary: 'Delete server from registry',
        description: 'Removes server from PostgreSQL registry. Requires servers:write scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Server deleted successfully' },
          404: { description: 'Server not found' },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        description: 'Retrieves user list. Admins see all users; regular users see self. Requires users:read scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: { description: 'User list' },
          401: { $ref: '#/components/schemas/ApiError' },
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user details by ID',
        description: 'Requires users:read scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'User profile details' },
          404: { description: 'User not found' },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update user profile',
        description: 'Requires users:write scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  avatar: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User profile updated' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user account (Admin only)',
        description: 'Deletes user and cascades to owned resources in PostgreSQL. Requires users:write scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'User deleted' },
        },
      },
    },
    '/api-keys': {
      get: {
        tags: ['API Keys'],
        summary: 'List API keys',
        description: 'Retrieves API keys created by the user (or all keys for admin). Never returns plaintext keys. Requires api-keys:read scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of API keys',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } } } },
          },
          401: { $ref: '#/components/schemas/ApiError' },
        },
      },
      post: {
        tags: ['API Keys'],
        summary: 'Create a new API Key',
        description: 'Generates a cryptographically secure API key. Plaintext token is returned ONLY ONCE upon creation. Requires api-keys:write scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'scopes'],
                properties: {
                  name: { type: 'string', example: 'MCPANEL Production' },
                  scopes: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['servers:read', 'servers:write'],
                  },
                  expiresInDays: { type: 'integer', example: 30 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'API key created. Token is displayed only once.',
          },
          400: { description: 'Invalid input or empty name' },
          401: { $ref: '#/components/schemas/ApiError' },
        },
      },
    },
    '/api-keys/{id}': {
      get: {
        tags: ['API Keys'],
        summary: 'Get API Key metadata by ID',
        description: 'Retrieves metadata for an API key without disclosing the secret. Requires api-keys:read scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'API key details' },
          404: { description: 'API key not found' },
        },
      },
      delete: {
        tags: ['API Keys'],
        summary: 'Delete API Key',
        description: 'Deletes API key permanently from PostgreSQL. Requires api-keys:write scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'API key deleted' },
          404: { description: 'API key not found' },
        },
      },
    },
    '/api-keys/{id}/revoke': {
      post: {
        tags: ['API Keys'],
        summary: 'Revoke API Key',
        description: 'Marks API key as revoked immediately. Requires api-keys:write scope.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'API key revoked' },
          404: { description: 'API key not found' },
        },
      },
    },
  },
};
