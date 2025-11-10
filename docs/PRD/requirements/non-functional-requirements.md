# Non-Functional Requirements

**Document Type:** Technical Requirements
**Status:** Approved
**Owner:** Development Team

---

## Overview

This document specifies the non-functional requirements (NFRs) for GraphMind, covering performance, reliability, security, cost efficiency, usability, and maintainability. These requirements ensure the system is production-ready, scalable, and provides excellent user experience.

---

## 1. Performance

### NFR-PF-001: Response Time

**Requirement:** All user-facing operations must complete within acceptable time limits.

**Targets:**
- Voice transcription latency: <2 seconds (p95)
- Entity extraction: <3 seconds (p95)
- Graph query execution: <500ms uncached, <100ms cached (p95)
- Answer generation: <2 seconds (p95)
- TTS audio playback start: <1 second (p95)
- Page load time: <2 seconds (p95)
- API response time: <500ms (p95)
- Graph visualization render: <3 seconds for <1000 nodes (p95)

**Measurement:**
- Use Cloudflare Workers Analytics
- Log all operation latencies
- P50, P95, P99 percentiles tracked
- Monthly performance reports

---

### NFR-PF-002: Scalability

**Requirement:** System must scale to support growing user base and data volume.

**Targets:**
- Support 10,000+ entities per user
- Support 1,000+ notes per user
- Handle 100+ concurrent voice sessions per Durable Object
- FalkorDB scales to millions of nodes/relationships
- Support 10,000+ registered users
- Handle 1,000+ concurrent API requests

**Implementation:**
- Horizontal scaling via Cloudflare's edge network
- FalkorDB connection pooling in Durable Objects
- Pagination for large result sets
- Lazy loading for graph visualization

---

### NFR-PF-003: Throughput

**Requirement:** System must handle expected user activity levels.

**Targets:**
- 100 voice captures per hour per user
- 50 voice queries per hour per user
- 10 concurrent users per Durable Object instance
- 1,000+ notes processed per day (system-wide)

**Monitoring:**
- Track requests per second
- Monitor queue depths
- Alert on sustained high load

---

## 2. Reliability

### NFR-RL-001: Availability

**Requirement:** System must be highly available with minimal downtime.

**Targets:**
- Overall system uptime: 99.9% (8.76 hours downtime/year)
- FalkorDB availability: 99.95% (managed service SLA)
- Cloudflare Workers: 99.99% (Cloudflare SLA)
- Scheduled maintenance: <2 hours/month, announced 48 hours in advance

**Implementation:**
- Deploy across Cloudflare's global edge network
- Use FalkorDB Cloud with HA configuration
- Graceful degradation (e.g., voice -> text fallback)
- Health check endpoints
- Automatic failover for critical services

**Monitoring:**
- Uptime monitoring (external service)
- Synthetic monitoring
- Real user monitoring (RUM)
- Incident response SLAs

---

### NFR-RL-002: Data Durability

**Requirement:** User data must be protected against loss.

**Targets:**
- FalkorDB: Redis persistence (RDB + AOF snapshots)
- D1: Automatic replication, daily backups
- R2: 99.999999999% durability (Cloudflare SLA)
- No data loss for committed transactions
- 30-day backup retention

**Implementation:**
- Transactional writes (ACID compliance)
- Daily automated backups (D1, FalkorDB)
- Point-in-time recovery capability
- Backup validation (monthly restore tests)

---

### NFR-RL-003: Error Handling

**Requirement:** System must handle errors gracefully without data loss or poor UX.

**Implementation:**
- Graceful degradation (voice fails -> text input still works)
- Retry logic for transient failures (3 retries, exponential backoff)
- User-friendly error messages (not technical jargon)
- Automatic error logging to monitoring service
- Circuit breakers for external dependencies
- Timeout handling (prevent hanging requests)

**Error Categories:**
- Transient errors: Retry automatically
- Permanent errors: Clear user feedback
- Critical errors: Alert development team

---

## 3. Security

### NFR-SC-001: Authentication

**Requirement:** Secure user authentication and session management.

**Implementation:**
- JWT tokens with HS256 signing
- Token expiration: 24 hours (or 30 days with "remember me")
- Secret key: 256-bit minimum, rotated quarterly
- Session management in KV with TTL
- Rate limiting:
  - Login: 5 attempts per 15 minutes per IP
  - Registration: 5 attempts per hour per IP
  - API calls: 100 requests per minute per user
- Account lockout after 5 failed login attempts (15-minute cooldown)

---

### NFR-SC-002: Data Privacy

**Requirement:** User data must be protected and isolated.

**Implementation:**
- User data isolated (separate FalkorDB namespaces)
- No cross-user data access (verified via tests)
- End-to-end encryption for voice in transit (WebRTC DTLS)
- Audio storage encryption at rest (R2 server-side encryption)
- GDPR-compliant data deletion (30-day retention after account deletion)
- Privacy policy clearly displayed
- User data export capability
- No third-party data sharing

---

### NFR-SC-003: API Security

**Requirement:** All API endpoints must be secure.

**Implementation:**
- All endpoints require authentication (except registration/login)
- CORS properly configured (whitelist origins)
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize user input)
- No sensitive data in logs (passwords, tokens)
- HTTPS enforcement (HSTS headers)
- Security headers:
  - Content-Security-Policy
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff

---

## 4. Cost Efficiency

### NFR-CE-001: Infrastructure Costs

**Requirement:** Keep costs reasonable for users and maintainers.

**Target:** ~$20/month for production deployment (100 notes/month, 50 queries/month)

**Cost Breakdown (Estimated):**

**Cloudflare:**
- Workers Paid: $5/mo base (includes Workers, Pages, KV, Durable Objects)
- Workers AI: FREE during beta -> Pricing TBA
- D1: FREE tier sufficient for development, ~$1-2/mo at scale
- R2: FREE tier (10GB), ~$0.15/GB/mo beyond
- Total Cloudflare: $5-10/mo typical use

**FalkorDB Cloud:**
- Starter tier: $15/mo (up to 10K entities)
- Pro tier: $50/mo (production scale)

**Total Estimated Cost:**
- Local Development: $0/mo (Docker FalkorDB + free tiers)
- Staging/Production: $20/mo (FalkorDB Cloud $15 + Cloudflare $5)
- Production at scale: $55+/mo (FalkorDB Pro $50 + Cloudflare $5-20)

**Cost Optimization Strategies:**
- Aggressive caching in KV
- Batch entity extraction (reduce LLM calls)
- Voice storage optional (save R2 costs)
- Start with FalkorDB Cloud starter tier ($15/mo)
- Monitor usage, set budget alerts

---

## 5. Usability

### NFR-US-001: Ease of Use

**Requirement:** System must be intuitive and require minimal training.

**Targets:**
- Record voice note in 1 click
- Query knowledge in 1 click
- No manual required (intuitive UI)
- Mobile-friendly (works on phones)
- Onboarding tour <2 minutes
- Time to first note: <30 seconds after registration

**Implementation:**
- Clean, minimal UI design
- Large, obvious action buttons
- Real-time visual feedback
- Progressive disclosure (advanced features hidden initially)
- Contextual help tooltips
- Error messages suggest solutions

---

### NFR-US-002: Accessibility

**Requirement:** System must be accessible to users with disabilities (WCAG 2.1 AA).

**Requirements:**
- Keyboard navigation for all features
- Screen reader support (ARIA labels)
- Color contrast ratios 4.5:1 (normal text), 3:1 (large text)
- Focus indicators visible (3px outline)
- Skip to main content link
- Form validation accessible
- Error messages clear and helpful
- Images have alt text
- Video/audio have transcripts
- No flashing content (seizure risk)
- Resizable text (up to 200%)

**Testing:**
- Automated accessibility scans (axe, Lighthouse)
- Manual keyboard navigation testing
- Screen reader testing (NVDA, JAWS, VoiceOver)

---

## 6. Maintainability

### NFR-MT-001: Code Quality

**Requirement:** Codebase must be maintainable and follow best practices.

**Standards:**
- TypeScript for type safety
- Unit test coverage: >80%
- Integration tests for critical flows
- Documentation for all components
- Follow Cloudflare Workers best practices
- Code reviews required for all changes
- Linting (ESLint) and formatting (Prettier)
- Consistent naming conventions

**Code Structure:**
```
/src
  /api        # API endpoint handlers
  /services   # Business logic
  /models     # Data models and types
  /utils      # Utility functions
  /config     # Configuration
/tests
  /unit       # Unit tests
  /integration # Integration tests
  /e2e        # End-to-end tests
```

---

### NFR-MT-002: Observability

**Requirement:** System must be observable for monitoring and debugging.

**Implementation:**
- Structured logging (JSON format)
- Log levels: ERROR, WARN, INFO, DEBUG
- Error tracking and alerting (e.g., Sentry)
- Performance monitoring (APM)
- Cloudflare Workers Analytics
- Custom metrics:
  - Notes created per day
  - Queries run per day
  - Active users (DAU, MAU)
  - Entity extraction accuracy
  - Average query latency
- Distributed tracing for complex operations
- Health check endpoints

**Alerting:**
- Critical: Page immediately (>5xx errors spike, system down)
- Warning: Email (degraded performance, high latency)
- Info: Dashboard only (usage milestones)

---

### NFR-MT-003: Deployment

**Requirement:** Deployment must be automated and reliable.

**Implementation:**
- CI/CD pipeline (GitHub Actions)
- Automated testing before deployment
- Staging environment for pre-production testing
- Blue-green deployments (zero downtime)
- Rollback capability (1-click)
- Database migrations automated
- Environment-specific configuration
- Deployment frequency: Multiple times per week

**Deployment Pipeline:**
```
1. Developer pushes to main branch
2. CI runs tests (unit, integration, e2e)
3. Build frontend and backend
4. Deploy to staging
5. Run smoke tests
6. Deploy to production (blue-green)
7. Monitor for errors
8. Automatic rollback if error rate >5%
```

---

## 7. Compliance

### NFR-CP-001: Data Protection

**Requirement:** Comply with data protection regulations.

**Regulations:**
- GDPR (EU General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)

**Implementation:**
- Privacy policy clearly stating data usage
- User consent for data processing
- Right to access (user can export data)
- Right to deletion (user can delete account)
- Right to portability (export in standard formats)
- Data retention policies (30 days after deletion)
- Data breach notification procedures
- DPA (Data Processing Agreement) for sub-processors

---

## 8. Browser & Device Support

### NFR-BD-001: Browser Compatibility

**Requirement:** Support major browsers and versions.

**Supported Browsers:**
- Chrome: Latest 2 versions
- Safari: Latest 2 versions
- Firefox: Latest 2 versions
- Edge: Latest 2 versions
- Mobile Safari (iOS): Latest 2 versions
- Chrome Mobile (Android): Latest 2 versions

**Testing:**
- Automated cross-browser testing (BrowserStack)
- Manual testing on key browsers
- WebRTC compatibility checks
- Audio codec support verification

---

### NFR-BD-002: Device Support

**Requirement:** Work across desktop, tablet, and mobile devices.

**Supported Devices:**
- Desktop: Windows, macOS, Linux
- Mobile: iOS 14+, Android 10+
- Tablets: iPad, Android tablets

**Responsive Breakpoints:**
- Mobile: <768px
- Tablet: 768px-1024px
- Desktop: >1024px

---

## Acceptance Criteria Summary

All NFRs must be verified before production release:

- [ ] All performance targets met (load testing)
- [ ] 99.9% uptime demonstrated (1 month monitoring)
- [ ] Security audit completed (no critical vulnerabilities)
- [ ] Accessibility compliance verified (WCAG 2.1 AA)
- [ ] Code quality standards met (>80% test coverage)
- [ ] Monitoring and alerting configured
- [ ] Cost tracking in place (~$20/mo production)
- [ ] GDPR compliance verified
- [ ] Cross-browser testing passed
- [ ] Disaster recovery plan tested

---

## Related Documents

- [Success Metrics](../project/success-metrics.md)
- [Risks and Mitigations](../project/risks-and-mitigations.md)
- [REQUIREMENTS-PRD.md](../REQUIREMENTS-PRD.md) - See Section 4 for complete NFR details

---

**Last Updated:** 2025-11-10
**Review Status:** Approved
**Next Review:** Quarterly
