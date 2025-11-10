# Security Policy

## Supported Versions

GraphMind is currently in active development (pre-v1.0). Security updates will be provided for:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 1.0   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by using GitHub's Security Advisories feature:

1. Go to https://github.com/moshehbenavraham/graphmind/security/advisories/new
2. Click "Report a vulnerability"
3. Fill out the form with as much detail as possible

Alternatively, you can email security reports to: max@aiwithapex.com

### What to Include

Please include as much of the following information as possible:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it
- Any mitigations you've identified

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: Within 7 days
  - High: Within 14 days
  - Medium: Within 30 days
  - Low: Next planned release

## Security Best Practices

When contributing to GraphMind, please follow these security guidelines:

### Authentication & Authorization
- Always validate JWT tokens properly
- Use bcrypt for password hashing (cost factor 12)
- Implement proper session management
- Never expose sensitive data in logs or error messages

### Input Validation
- Validate all user inputs
- Use parameterized queries for database operations
- Sanitize data before displaying in UI
- Implement rate limiting on all endpoints

### Cloudflare Workers Security
- Never commit API tokens or secrets to version control
- Use environment variables for sensitive configuration
- Implement proper CORS policies
- Use HTTPS only
- Validate WebSocket connections

### Data Protection
- Isolate user data (separate FalkorDB namespaces)
- Encrypt sensitive data at rest
- Use secure WebRTC connections
- Implement proper access controls for R2 buckets

### Dependencies
- Keep dependencies up to date
- Review dependency security advisories
- Use `npm audit` regularly
- Pin dependency versions in production

## Known Security Considerations

### Current Development Phase
As GraphMind is in early development:

- Security features are being actively implemented
- Some endpoints may not have full authentication yet
- Rate limiting may not be fully implemented
- This is a local development environment

### Third-Party Services
GraphMind relies on:

- **Cloudflare Workers** - Review Cloudflare's security documentation
- **FalkorDB Cloud** - Ensure connection credentials are secure
- **Workers AI** - Follow Cloudflare AI security best practices

## Security Updates

Security updates will be announced through:

- GitHub Security Advisories
- Release notes with `[SECURITY]` prefix
- Project README updates

## Security Audit Status

- [ ] Initial security review (planned for Phase 4)
- [ ] Penetration testing (planned post-MVP)
- [ ] Third-party security audit (planned for v1.0)

## Acknowledgments

We appreciate the security research community and will acknowledge individuals who responsibly disclose vulnerabilities in our release notes (unless they prefer to remain anonymous).

## Questions

If you have questions about this security policy, please open a GitHub Discussion or contact the maintainers.

---

Last updated: 2025-11-10
