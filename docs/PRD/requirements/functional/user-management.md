# Functional Requirements: User Management

**Category:** Authentication & User Management
**Priority:** High
**Status:** Approved
**Owner:** Development Team

---

## Overview

This document specifies the functional requirements for user registration, authentication, and account management in GraphMind. These features form the foundation of the application by providing secure access control and user data isolation.

---

## Requirements

### FR-UM-001: User Registration

**Priority:** High
**Status:** Required for MVP

#### Description
Users can create an account to start their personal knowledge graph.

#### Requirements
- Email and password registration
- Email verification required before full access
- Create isolated user workspace in FalkorDB
- Initialize empty knowledge graph with base ontology
- Store user metadata in D1 database
- Password strength requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one number
  - At least one special character

#### User Flow
```
1. User visits registration page
2. User enters email and password
3. System validates input
4. System creates user record in D1
5. System creates isolated FalkorDB namespace
6. System sends verification email
7. User clicks verification link
8. Account activated
9. User redirected to dashboard
```

#### Acceptance Criteria
- [ ] User successfully registers with valid email
- [ ] Invalid emails rejected with clear error message
- [ ] Weak passwords rejected with requirements displayed
- [ ] Verification email sent within 5 seconds
- [ ] Email contains secure verification link (24-hour expiration)
- [ ] Isolated knowledge graph created in FalkorDB
- [ ] User can log in immediately after verification
- [ ] Duplicate email addresses prevented

#### Technical Specifications

**API Endpoint:**
```typescript
POST /api/auth/register

Request: {
  email: string,
  password: string,
  name?: string
}

Response: {
  success: boolean,
  user_id: string,
  message: "Verification email sent"
}

Error Responses:
- 400: Invalid email format
- 400: Password does not meet requirements
- 409: Email already registered
- 500: Server error
```

**D1 Schema:**
```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    falkordb_namespace TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    verification_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);
```

#### Security Requirements
- Password hashed using bcrypt (cost factor: 12)
- Verification token: cryptographically secure random (32 bytes)
- Rate limiting: 5 registration attempts per IP per hour
- Email validation (RFC 5322 compliant)
- SQL injection prevention (parameterized queries)

---

### FR-UM-002: User Authentication

**Priority:** High
**Status:** Required for MVP

#### Description
Secure login with session management to protect user data and maintain authentication state.

#### Requirements
- Email/password login
- JWT session tokens with 24-hour expiration
- Session stored in Cloudflare KV
- Rate limiting (5 failed attempts per 15 minutes)
- "Remember me" option (30-day token expiration)
- Logout functionality (token invalidation)
- Password reset flow

#### User Flow - Login
```
1. User enters email and password
2. System validates credentials
3. System generates JWT token
4. System stores session in KV
5. Token returned to client
6. Client stores token (localStorage or cookie)
7. Token included in subsequent requests (Authorization header)
```

#### User Flow - Password Reset
```
1. User clicks "Forgot password"
2. User enters email
3. System sends password reset email
4. User clicks reset link
5. User enters new password
6. System validates and updates password
7. User redirected to login
```

#### Acceptance Criteria
- [ ] Valid credentials grant access
- [ ] Invalid credentials rejected with generic error (no user enumeration)
- [ ] Sessions persist across page refreshes
- [ ] Account locked after 5 failed attempts (15-minute cooldown)
- [ ] JWT tokens expire after 24 hours (or 30 days with "remember me")
- [ ] Logout invalidates token
- [ ] Password reset flow works correctly
- [ ] Secure password hashing (bcrypt)

#### Technical Specifications

**API Endpoint - Login:**
```typescript
POST /api/auth/login

Request: {
  email: string,
  password: string,
  remember_me?: boolean
}

Response: {
  success: boolean,
  token: string, // JWT
  user: {
    user_id: string,
    email: string,
    name: string
  }
}

Error Responses:
- 401: Invalid credentials
- 429: Too many attempts, account temporarily locked
- 500: Server error
```

**API Endpoint - Logout:**
```typescript
POST /api/auth/logout

Headers: {
  Authorization: "Bearer {token}"
}

Response: {
  success: boolean,
  message: "Logged out successfully"
}
```

**API Endpoint - Password Reset Request:**
```typescript
POST /api/auth/reset-password

Request: {
  email: string
}

Response: {
  success: boolean,
  message: "Password reset email sent"
}
```

**API Endpoint - Password Reset Confirm:**
```typescript
POST /api/auth/reset-password/confirm

Request: {
  token: string,
  new_password: string
}

Response: {
  success: boolean,
  message: "Password updated successfully"
}
```

**JWT Structure:**
```json
{
  "user_id": "usr_abc123",
  "email": "user@example.com",
  "iat": 1699622400,
  "exp": 1699708800
}
```

**KV Session Storage:**
```typescript
// Key: `session:{token_hash}`
{
  user_id: "usr_abc123",
  created_at: 1699622400,
  expires_at: 1699708800,
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0..."
}

// TTL: Matches JWT expiration
```

#### Security Requirements
- JWT signed with HS256 algorithm
- Secret key: 256-bit minimum, stored in Workers secrets
- Rate limiting: 5 attempts per 15 minutes per IP
- Failed login attempts logged
- Password reset token: 32-byte random, 1-hour expiration
- HTTPS only (no plain HTTP)
- HttpOnly cookies option (if using cookies instead of localStorage)
- CSRF protection if using cookies

---

### FR-UM-003: User Profile Management

**Priority:** Medium
**Status:** Post-MVP (Nice to have)

#### Description
Users can view and update their profile information and account settings.

#### Requirements
- View profile (name, email, member since, stats)
- Update profile (name, email)
- Change password (requires current password)
- Email change requires verification
- View account statistics:
  - Total notes created
  - Total queries made
  - Knowledge graph size (entity count)
  - Storage used
- Account deletion (with confirmation)

#### Acceptance Criteria
- [ ] User can view profile information
- [ ] User can update name
- [ ] Email change triggers verification
- [ ] Password change requires current password
- [ ] Statistics displayed accurately
- [ ] Account deletion removes all user data (GDPR compliance)
- [ ] Deleted data cannot be recovered (except from backups)

#### Technical Specifications

**API Endpoint - Get Profile:**
```typescript
GET /api/user/profile

Headers: {
  Authorization: "Bearer {token}"
}

Response: {
  user_id: string,
  email: string,
  name: string,
  created_at: string,
  stats: {
    notes_count: number,
    queries_count: number,
    entities_count: number,
    storage_used_mb: number
  }
}
```

**API Endpoint - Update Profile:**
```typescript
PUT /api/user/profile

Headers: {
  Authorization: "Bearer {token}"
}

Request: {
  name?: string,
  email?: string
}

Response: {
  success: boolean,
  email_verification_sent?: boolean
}
```

**API Endpoint - Change Password:**
```typescript
POST /api/user/change-password

Headers: {
  Authorization: "Bearer {token}"
}

Request: {
  current_password: string,
  new_password: string
}

Response: {
  success: boolean,
  message: "Password updated successfully"
}
```

**API Endpoint - Delete Account:**
```typescript
DELETE /api/user/account

Headers: {
  Authorization: "Bearer {token}"
}

Request: {
  password: string, // confirmation
  confirm_deletion: boolean
}

Response: {
  success: boolean,
  message: "Account deleted"
}
```

---

## Non-Functional Requirements

### Performance
- Login response time: <500ms (p95)
- Registration response time: <1 second (p95)
- JWT token validation: <10ms

### Security
- Password hashing: bcrypt cost factor 12
- JWT secret: 256-bit minimum
- Rate limiting on all auth endpoints
- HTTPS enforcement
- OWASP Top 10 compliance

### Reliability
- Auth service uptime: 99.9%
- Session persistence across Workers deployments
- Graceful error handling

### Scalability
- Support 10,000+ concurrent users
- Handle 1000+ registrations per day
- Session storage in KV (globally distributed)

---

## Testing Requirements

### Unit Tests
- Password hashing and validation
- JWT token generation and validation
- Email validation logic
- Rate limiting logic

### Integration Tests
- End-to-end registration flow
- End-to-end login flow
- Password reset flow
- Session expiration
- Token invalidation on logout

### Security Tests
- SQL injection attempts
- Brute force login attempts
- Password reset token tampering
- JWT token manipulation
- CSRF attacks (if using cookies)

---

## Dependencies

- **Cloudflare Workers**: Authentication logic
- **Cloudflare D1**: User data storage
- **Cloudflare KV**: Session storage
- **FalkorDB**: User namespace creation
- **Email Service**: Verification and password reset emails (e.g., SendGrid, Resend)

---

## Open Questions

- [ ] Which email service provider to use?
- [ ] Should we support OAuth (Google, GitHub)?
- [ ] Should we implement 2FA (future)?
- [ ] Cookie-based auth vs localStorage JWT?

---

## Related Documents

- [Phase 1: Foundation](../../phases/phase-1-foundation.md)
- [API Specifications](../../technical/api-specifications.md)
- [Database Schemas](../../technical/database-schemas.md)
- [Security Requirements](../non-functional-requirements.md)

---

**Last Updated:** 2025-11-10
**Review Status:** Approved
**Implementation Phase:** Phase 1
