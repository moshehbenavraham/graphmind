/**
 * Admin Authentication Security Tests (T106-T111)
 *
 * Tests admin endpoint authentication and authorization.
 * Validates admin role enforcement, token validation, and rate limiting.
 */

import { describe, it, expect, beforeAll } from 'vitest';

describe('Admin Authentication Security Tests', () => {
  let adminToken, userToken, invalidToken;
  let mockEnv;

  beforeAll(async () => {
    // Mock environment with JWT secret and KV
    const jwtSecret = 'test_secret_key_for_admin_auth';

    mockEnv = {
      JWT_SECRET: jwtSecret,
      KV: new Map() // Simple in-memory KV mock
    };

    // Mock KV operations
    mockEnv.KV.get = async function(key, options) {
      const value = this.get(key);
      if (!value) return null;
      if (options?.type === 'json') {
        return JSON.parse(value);
      }
      return value;
    }.bind(mockEnv.KV);

    mockEnv.KV.put = async function(key, value, options) {
      this.set(key, value);
    }.bind(mockEnv.KV);

    // Generate test tokens
    const { generateToken } = await import('../../src/lib/auth/crypto.js');

    // Admin token with admin role
    adminToken = generateToken({
      user_id: 'admin_user_123',
      email: 'admin@graphmind.test',
      namespace: 'user_admin_123',
      role: 'admin'
    }, jwtSecret);

    // Regular user token (no admin role)
    userToken = generateToken({
      user_id: 'regular_user_456',
      email: 'user@graphmind.test',
      namespace: 'user_regular_456',
      role: 'user'
    }, jwtSecret);

    // Invalid token (wrong secret)
    invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  });

  describe('T107: Valid admin token → 200 OK', () => {
    it('should allow admin access with valid admin token', async () => {
      const { requireAdmin } = await import('../../src/middleware/auth.js');

      const request = new Request('http://test.com/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      const result = await requireAdmin(request, mockEnv);

      expect(result).not.toBeInstanceOf(Response);
      expect(result.user_id).toBe('admin_user_123');
      expect(result.role).toBe('admin');
    });

    it('should extract admin role from JWT claims correctly', async () => {
      const { authenticateRequest } = await import('../../src/middleware/auth.js');

      const request = new Request('http://test.com/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      const user = await authenticateRequest(request, mockEnv);

      expect(user).toBeDefined();
      expect(user.role).toBe('admin');
    });
  });

  describe('T108: Invalid token → 401 Unauthorized', () => {
    it('should reject invalid JWT token', async () => {
      const { requireAdmin } = await import('../../src/middleware/auth.js');

      const request = new Request('http://test.com/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${invalidToken}`
        }
      });

      const result = await requireAdmin(request, mockEnv);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(401);

      const body = await result.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should reject request without Authorization header', async () => {
      const { requireAdmin } = await import('../../src/middleware/auth.js');

      const request = new Request('http://test.com/api/admin/backfill', {
        method: 'POST'
      });

      const result = await requireAdmin(request, mockEnv);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(401);
    });

    it('should reject malformed Authorization header', async () => {
      const { requireAdmin } = await import('../../src/middleware/auth.js');

      const request = new Request('http://test.com/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Authorization': 'InvalidFormat'
        }
      });

      const result = await requireAdmin(request, mockEnv);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(401);
    });
  });

  describe('T109: Non-admin user → 403 Forbidden', () => {
    it('should reject regular user without admin role', async () => {
      const { requireAdmin } = await import('../../src/middleware/auth.js');

      const request = new Request('http://test.com/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      const result = await requireAdmin(request, mockEnv);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(403);

      const body = await result.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('Admin role required');
    });

    it('should verify isAdmin helper function works correctly', async () => {
      const { isAdmin } = await import('../../src/middleware/auth.js');

      const adminUser = { user_id: '123', role: 'admin' };
      const regularUser = { user_id: '456', role: 'user' };
      const userWithIsAdminFlag = { user_id: '789', is_admin: true };

      expect(isAdmin(adminUser)).toBe(true);
      expect(isAdmin(regularUser)).toBe(false);
      expect(isAdmin(userWithIsAdminFlag)).toBe(true);
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
    });
  });

  describe('T110: Rate limit enforcement → 429 Too Many Requests', () => {
    it('should enforce rate limit for backfill endpoint (1 req/hour)', async () => {
      const { checkRateLimit, rateLimitError } = await import('../../src/middleware/rate-limit.js');

      const userId = 'admin_user_123';
      const rateLimitKey = `backfill:${userId}`;

      // First request should succeed
      const firstCheck = await checkRateLimit(rateLimitKey, 1, 3600, mockEnv.KV);
      expect(firstCheck.allowed).toBe(true);
      expect(firstCheck.remaining).toBe(0);

      // Second request within window should fail
      const secondCheck = await checkRateLimit(rateLimitKey, 1, 3600, mockEnv.KV);
      expect(secondCheck.allowed).toBe(false);
      expect(secondCheck.remaining).toBe(0);

      // Verify error response format
      const errorResponse = rateLimitError(secondCheck.reset);
      expect(errorResponse.status).toBe(429);

      const body = await errorResponse.json();
      expect(body.error).toBe('Too Many Requests');
      expect(body.retry_after).toBeDefined();
    });

    it('should include proper Retry-After header', async () => {
      const { rateLimitError } = await import('../../src/middleware/rate-limit.js');

      const resetTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const errorResponse = rateLimitError(resetTimestamp);

      expect(errorResponse.headers.get('Retry-After')).toBeDefined();
      expect(errorResponse.headers.get('X-RateLimit-Limit')).toBe('1');
      expect(errorResponse.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('should reset rate limit after window expires', async () => {
      const { checkRateLimit } = await import('../../src/middleware/rate-limit.js');

      const userId = 'test_user_reset';
      const rateLimitKey = `backfill:${userId}`;
      const shortWindow = 1; // 1 second window for testing

      // First request
      const firstCheck = await checkRateLimit(rateLimitKey, 1, shortWindow, mockEnv.KV);
      expect(firstCheck.allowed).toBe(true);

      // Second request should fail
      const secondCheck = await checkRateLimit(rateLimitKey, 1, shortWindow, mockEnv.KV);
      expect(secondCheck.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Third request should succeed (new window)
      const thirdCheck = await checkRateLimit(rateLimitKey, 1, shortWindow, mockEnv.KV);
      expect(thirdCheck.allowed).toBe(true);
    });
  });

  describe('T111: Run security test suite and verify all tests pass', () => {
    it('should have admin authentication working end-to-end', async () => {
      const { requireAdmin } = await import('../../src/middleware/auth.js');

      // Test 1: Admin succeeds
      const adminRequest = new Request('http://test.com/api/admin/backfill', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      const adminResult = await requireAdmin(adminRequest, mockEnv);
      expect(adminResult).not.toBeInstanceOf(Response);
      expect(adminResult.role).toBe('admin');

      // Test 2: Regular user fails
      const userRequest = new Request('http://test.com/api/admin/backfill', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      const userResult = await requireAdmin(userRequest, mockEnv);
      expect(userResult).toBeInstanceOf(Response);
      expect(userResult.status).toBe(403);

      // Test 3: No token fails
      const noTokenRequest = new Request('http://test.com/api/admin/backfill', {
        method: 'POST'
      });

      const noTokenResult = await requireAdmin(noTokenRequest, mockEnv);
      expect(noTokenResult).toBeInstanceOf(Response);
      expect(noTokenResult.status).toBe(401);

      console.log('✅ All admin authentication tests passed');
    });

    it('should have rate limiting working end-to-end', async () => {
      const { checkRateLimit } = await import('../../src/middleware/rate-limit.js');

      const userId = 'rate_limit_test';
      const key = `test:${userId}`;

      // Execute 3 requests with limit of 2
      const checks = [];
      for (let i = 0; i < 3; i++) {
        const check = await checkRateLimit(key, 2, 60, mockEnv.KV);
        checks.push(check);
      }

      expect(checks[0].allowed).toBe(true); // 1st allowed
      expect(checks[1].allowed).toBe(true); // 2nd allowed
      expect(checks[2].allowed).toBe(false); // 3rd blocked

      console.log('✅ All rate limiting tests passed');
    });
  });
});
