// @ts-check
/// <reference types="node" />

/**
 * Generate Admin JWT Token
 *
 * Creates a JWT token with admin privileges for testing backfill and admin endpoints.
 * Uses the first user from the database or a specified user ID.
 *
 * Usage:
 *   node scripts/generate-admin-jwt.mjs
 *   node scripts/generate-admin-jwt.mjs --user-id=<uuid>
 */

import jwt from 'jsonwebtoken';
import 'dotenv/config';

/**
 * @typedef {Object} JWTClaims
 * @property {string} sub - Subject (user ID)
 * @property {string} email - User email
 * @property {string} namespace - User namespace
 * @property {string} role - User role
 * @property {boolean} is_admin - Admin flag
 * @property {number} iat - Issued at timestamp
 * @property {number} exp - Expiration timestamp
 */

// Get JWT secret from environment
/** @type {string|undefined} */
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET not set in .env');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
let userId = '30a4f21d-7cd6-47e3-bcf9-bb7265f27ffe'; // Default: max@aiwithapex.com
let email = 'max@aiwithapex.com';
let namespace = 'user_30a4f21d-7cd6-47e3-bcf9-bb7265f27ffe';

for (const arg of args) {
  if (arg.startsWith('--user-id=')) {
    userId = arg.split('=')[1];
    namespace = `user_${userId}`;
  }
  if (arg.startsWith('--email=')) {
    email = arg.split('=')[1];
  }
}

// Create JWT claims with admin privileges
/** @type {JWTClaims} */
const claims = {
  sub: userId,
  email: email,
  namespace: namespace,
  role: 'admin',       // Admin role
  is_admin: true,      // Backup admin flag
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
};

// Sign the token (JWT_SECRET is guaranteed to be defined after the check above)
const token = jwt.sign(claims, /** @type {string} */ (JWT_SECRET));

console.log('=== Admin JWT Token Generated ===');
console.log('');
console.log('User:', email);
console.log('User ID:', userId);
console.log('Namespace:', namespace);
console.log('Expires:', new Date(claims.exp * 1000).toISOString());
console.log('');
console.log('Token:');
console.log(token);
console.log('');
console.log('=== Usage ===');
console.log('');
console.log('Export as environment variable:');
console.log(`export ADMIN_JWT="${token}"`);
console.log('');
console.log('Use in curl:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:8787/api/admin/backfill-embeddings`);
