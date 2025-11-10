# Success Metrics

**Document Type:** Project Management / KPIs
**Status:** Active
**Owner:** Product Team
**Review Frequency:** Weekly (operational), Monthly (strategic)

---

## Overview

This document defines success metrics for GraphMind across user engagement, technical performance, and business outcomes. Metrics are tracked continuously and reviewed regularly to guide product decisions.

---

## 1. User Engagement Metrics

### 1.1 Daily Active Users (DAU)

**Definition:** Unique users who perform at least one action (note creation or query) per day.

**Target:** 50% of registered users

**Measurement:**
```sql
SELECT COUNT(DISTINCT user_id) as dau
FROM (
  SELECT user_id, DATE(created_at) as date FROM voice_notes
  UNION
  SELECT user_id, DATE(created_at) as date FROM voice_queries
)
WHERE date = CURRENT_DATE;
```

**Success Criteria:**
- Week 1: >20% DAU
- Month 1: >35% DAU
- Month 3: >50% DAU

**Actions if Below Target:**
- Improve onboarding
- Add push notifications
- Identify friction points
- User interviews

---

### 1.2 Notes per User per Week

**Definition:** Average number of voice notes created per user per week.

**Target:** 10+ notes/week

**Measurement:**
```sql
SELECT AVG(note_count) as avg_notes_per_week
FROM (
  SELECT user_id, COUNT(*) as note_count
  FROM voice_notes
  WHERE created_at >= DATE('now', '-7 days')
  GROUP BY user_id
);
```

**Success Criteria:**
- Week 1: >3 notes/week
- Month 1: >7 notes/week
- Month 3: >10 notes/week

**Segments:**
- Power users: >20 notes/week
- Regular users: 5-20 notes/week
- Light users: 1-5 notes/week
- Inactive: 0 notes/week

**Actions if Below Target:**
- Improve voice capture UX
- Add reminders/prompts
- Showcase use cases
- Reduce friction

---

### 1.3 Queries per User per Week

**Definition:** Average number of voice queries made per user per week.

**Target:** 5+ queries/week

**Measurement:**
```sql
SELECT AVG(query_count) as avg_queries_per_week
FROM (
  SELECT user_id, COUNT(*) as query_count
  FROM voice_queries
  WHERE created_at >= DATE('now', '-7 days')
  GROUP BY user_id
);
```

**Success Criteria:**
- Week 1: >1 query/week
- Month 1: >3 queries/week
- Month 3: >5 queries/week

**Actions if Below Target:**
- Improve query accuracy
- Showcase query examples
- Prompt users to ask questions
- Improve answer quality

---

### 1.4 Session Duration

**Definition:** Average time spent per session (from login to logout or inactivity).

**Target:** 5+ minutes

**Measurement:**
- Track session start/end times
- Calculate duration per session
- Average across users

**Success Criteria:**
- Week 1: >2 minutes
- Month 1: >4 minutes
- Month 3: >5 minutes

**Actions if Below Target:**
- Identify drop-off points
- Improve page load speed
- Add engaging features
- Reduce friction

---

### 1.5 User Retention

**Definition:** Percentage of users who return after initial signup.

**Targets:**
- **7-day retention:** 40%+
- **30-day retention:** 20%+
- **90-day retention:** 10%+

**Measurement:**
```sql
-- 7-day retention
SELECT
  COUNT(DISTINCT u.user_id) * 100.0 /
  (SELECT COUNT(*) FROM users WHERE created_at >= DATE('now', '-14 days') AND created_at < DATE('now', '-7 days')) as retention_7d
FROM users u
JOIN voice_notes n ON u.user_id = n.user_id
WHERE u.created_at >= DATE('now', '-14 days')
  AND u.created_at < DATE('now', '-7 days')
  AND n.created_at >= u.created_at + INTERVAL '7 days';
```

**Cohort Analysis:**
- Track retention by signup cohort (week)
- Identify drop-off points
- Compare cohorts to measure improvements

**Actions if Below Target:**
- Improve onboarding
- Email re-engagement campaigns
- Add value quickly (first note <30 sec)
- Identify churn reasons (exit surveys)

---

## 2. Technical Performance Metrics

### 2.1 Voice Transcription Latency

**Definition:** Time from audio stop to transcript displayed.

**Target:** <2 seconds (p95)

**Measurement:**
- Log timestamps: audio_stop, transcript_ready
- Calculate: transcript_ready - audio_stop
- Track p50, p95, p99 percentiles

**Success Criteria:**
- p50: <1 second
- p95: <2 seconds
- p99: <3 seconds

**Actions if Above Target:**
- Optimize Deepgram API calls
- Reduce audio chunk size
- Use faster Workers regions
- Investigate network latency

---

### 2.2 Entity Extraction Accuracy

**Definition:** Percentage of correctly extracted entities (validated by user feedback).

**Target:** >85%

**Measurement:**
- Track user corrections (entity edits, merges)
- Calculate: correct_entities / total_entities
- User feedback (thumbs up/down)

**Success Criteria:**
- Person entities: >90%
- Project entities: >85%
- Meeting entities: >85%
- Overall: >85%

**Actions if Below Target:**
- Refine extraction prompts
- Improve entity resolution
- Add more context to LLM
- User confirmation for low confidence

---

### 2.3 Query Answer Accuracy

**Definition:** Percentage of queries with satisfactory answers (user-rated).

**Target:** >90%

**Measurement:**
- User rates answer (1-5 stars)
- Satisfactory: 4-5 stars
- Calculate: (4-5 star ratings) / total_ratings

**Success Criteria:**
- Week 1: >70%
- Month 1: >80%
- Month 3: >90%

**Actions if Below Target:**
- Improve Cypher generation
- Better answer prompts
- Expand context retrieval
- Handle edge cases

---

### 2.4 System Uptime

**Definition:** Percentage of time system is available and functional.

**Target:** 99.9% (8.76 hours downtime/year)

**Measurement:**
- External uptime monitoring (e.g., Pingdom)
- Track service availability
- Exclude scheduled maintenance

**Success Criteria:**
- Week 1: >99%
- Month 1: >99.5%
- Month 3: >99.9%

**Actions if Below Target:**
- Identify failure points
- Improve monitoring/alerting
- Add redundancy
- Disaster recovery testing

---

### 2.5 Page Load Time

**Definition:** Time from navigation to page fully loaded (interactive).

**Target:** <2 seconds (p95)

**Measurement:**
- Browser Performance API
- Track p50, p95, p99
- Lighthouse scores

**Success Criteria:**
- p50: <1 second
- p95: <2 seconds
- Lighthouse: >90 score

**Actions if Above Target:**
- Optimize bundle size
- Code splitting
- Image optimization
- CDN optimization

---

### 2.6 API Response Time

**Definition:** Time to respond to API requests.

**Target:** <500ms (p95)

**Measurement:**
- Track request start/end timestamps
- Calculate response time
- Group by endpoint

**Success Criteria:**
- p50: <100ms
- p95: <500ms
- p99: <1 second

**Actions if Above Target:**
- Optimize database queries
- Add caching
- Index optimization
- Reduce payload sizes

---

## 3. Business Metrics

### 3.1 Cost per User per Month

**Definition:** Average infrastructure cost per active user per month.

**Target:** ~$20/month (production deployment)

**Measurement:**
- Total monthly infrastructure cost
- Divide by monthly active users (MAU)

**Cost Breakdown:**
- Cloudflare Workers: $X
- Workers AI: $Y (TBA post-beta)
- D1: $Z
- FalkorDB: $W
- R2: $V

**Success Criteria:**
- Development: <$10/user
- Light use: $7-15/user
- Moderate use: $20-30/user

**Actions if Above Target:**
- Optimize caching
- Reduce LLM calls
- Audio storage optimization
- Review FalkorDB tier (downgrade if possible)

---

### 3.2 User Satisfaction (NPS)

**Definition:** Net Promoter Score - likelihood to recommend (0-10 scale).

**Target:** NPS >40

**Measurement:**
- Survey: "How likely are you to recommend GraphMind?" (0-10)
- NPS = % Promoters (9-10) - % Detractors (0-6)

**Success Criteria:**
- Month 1: NPS >20
- Month 3: NPS >30
- Month 6: NPS >40

**Survey Frequency:**
- After 7 days of use
- After 30 days of use
- Quarterly for active users

**Actions if Below Target:**
- Identify top complaints
- Improve pain points
- Feature prioritization
- Customer success outreach

---

### 3.3 Feature Usage

**Definition:** Percentage of users using key features.

**Targets:**
- Voice capture: 100% (core feature)
- Voice query: 80%+
- Graph visualization: 50%+
- Manual entity editing: 30%+
- Multi-source ingestion: 20%+
- Search: 60%+

**Measurement:**
```sql
SELECT
  COUNT(DISTINCT CASE WHEN note_count > 0 THEN user_id END) * 100.0 / COUNT(DISTINCT user_id) as voice_capture_usage,
  COUNT(DISTINCT CASE WHEN query_count > 0 THEN user_id END) * 100.0 / COUNT(DISTINCT user_id) as voice_query_usage
FROM (
  SELECT
    u.user_id,
    COUNT(DISTINCT n.note_id) as note_count,
    COUNT(DISTINCT q.query_id) as query_count
  FROM users u
  LEFT JOIN voice_notes n ON u.user_id = n.user_id
  LEFT JOIN voice_queries q ON u.user_id = q.user_id
  WHERE u.created_at >= DATE('now', '-30 days')
  GROUP BY u.user_id
);
```

**Actions if Below Target:**
- Improve feature discoverability
- Onboarding highlights
- In-app prompts
- Tutorial videos

---

### 3.4 Data Quality

**Definition:** Percentage of entities reviewed/confirmed by users.

**Target:** 70%+ entities reviewed

**Measurement:**
```sql
SELECT
  COUNT(DISTINCT CASE WHEN last_reviewed IS NOT NULL THEN entity_id END) * 100.0 /
  COUNT(DISTINCT entity_id) as reviewed_percentage
FROM entity_cache;
```

**Success Criteria:**
- Month 1: >40%
- Month 3: >60%
- Month 6: >70%

**Actions if Below Target:**
- Prompt entity review
- Gamification (badges for reviews)
- Show entity confidence scores
- Make review easy (quick UI)

---

### 3.5 Export Usage

**Definition:** Percentage of users who export their data.

**Target:** 20%+ users export data

**Measurement:**
```sql
SELECT
  COUNT(DISTINCT user_id) * 100.0 /
  (SELECT COUNT(*) FROM users WHERE created_at <= DATE('now', '-30 days')) as export_usage
FROM exports
WHERE created_at >= DATE('now', '-30 days');
```

**Success Criteria:**
- Month 3: >10%
- Month 6: >15%
- Month 12: >20%

**Significance:**
- Indicates data portability value
- User trust in data ownership
- Backup behavior

**Actions if Below Target:**
- Improve export formats
- Add more export options
- Highlight export feature
- Integration with other tools

---

## 4. Growth Metrics

### 4.1 User Growth Rate

**Definition:** Month-over-month growth in registered users.

**Target:** 20%+ MoM growth

**Measurement:**
```sql
SELECT
  current_month_users,
  previous_month_users,
  (current_month_users - previous_month_users) * 100.0 / previous_month_users as growth_rate
FROM (
  SELECT
    (SELECT COUNT(*) FROM users WHERE created_at >= DATE('now', 'start of month')) as current_month_users,
    (SELECT COUNT(*) FROM users WHERE created_at >= DATE('now', '-1 month', 'start of month') AND created_at < DATE('now', 'start of month')) as previous_month_users
);
```

**Success Criteria:**
- Months 1-3: >30% MoM
- Months 4-6: >20% MoM
- Months 7-12: >10% MoM

**Actions if Below Target:**
- Marketing campaigns
- Product Hunt launch
- Content marketing
- Referral program

---

### 4.2 Referral Rate

**Definition:** Percentage of new users from referrals.

**Target:** 20%+ from referrals

**Measurement:**
- Track referral codes
- Calculate: referred_users / total_new_users

**Success Criteria:**
- Month 1: >5%
- Month 3: >10%
- Month 6: >20%

**Actions if Below Target:**
- Implement referral program
- Incentivize referrals
- Make sharing easy
- Viral features

---

## 5. Metric Dashboard

**Real-Time Dashboard:**
- Current DAU/MAU
- Active sessions
- System health (uptime, latency)
- Error rates

**Daily Dashboard:**
- New users
- Notes created
- Queries made
- Retention cohorts

**Weekly Dashboard:**
- User engagement trends
- Performance metrics
- Feature usage
- User feedback

**Monthly Dashboard:**
- Business metrics (costs, NPS)
- Growth metrics
- Strategic KPIs
- OKR progress

---

## 6. Metric Review Cadence

### Daily
- DAU
- System uptime
- Error rates
- Performance metrics

### Weekly
- User engagement
- Retention trends
- Feature usage
- Technical performance

### Monthly
- Business metrics
- Growth metrics
- NPS
- OKR progress
- Strategic planning

### Quarterly
- Deep dive analysis
- Cohort analysis
- Competitive benchmarking
- Strategic pivots

---

## 7. Success Thresholds

### Launch Readiness (Pre-Launch)
- [ ] 99%+ uptime (1 month monitoring)
- [ ] <2s transcription latency (p95)
- [ ] >85% entity extraction accuracy
- [ ] Lighthouse score >90
- [ ] Security audit passed

### Product-Market Fit (3 months post-launch)
- [ ] 500+ registered users
- [ ] 40%+ 7-day retention
- [ ] 20%+ 30-day retention
- [ ] NPS >30
- [ ] 80%+ voice query usage

### Sustainable Growth (6 months post-launch)
- [ ] 2000+ registered users
- [ ] 20%+ MoM growth
- [ ] NPS >40
- [ ] ~$20/month production cost
- [ ] 99.9% uptime

---

## Related Documents

- [Non-Functional Requirements](../requirements/non-functional-requirements.md)
- [Risks and Mitigations](./risks-and-mitigations.md)
- [REQUIREMENTS-PRD.md](../REQUIREMENTS-PRD.md) - See Section 9 for complete success metrics

---

**Last Updated:** 2025-11-10
**Review Status:** Active
**Next Review:** Weekly
