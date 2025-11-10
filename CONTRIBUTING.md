# Contributing to GraphMind

Thank you for your interest in contributing to GraphMind! This document provides guidelines and information to help you contribute effectively.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Development Notes](#development-notes)
- [Common Tasks](#common-tasks)

## Code of Conduct

By participating in this project, you agree to maintain a respectful, inclusive, and collaborative environment. We welcome contributions from developers of all skill levels.

## Getting Started

GraphMind is a voice-first personal knowledge assistant built on Cloudflare's edge network, combining real-time voice AI with graph-based RAG (Retrieval-Augmented Generation).

**Key Technologies:**
- Cloudflare Workers, Durable Objects, D1, KV, R2
- FalkorDB Cloud (GraphRAG)
- Workers AI (Deepgram STT/TTS, Llama 3.1)
- Pipecat for voice pipeline

**Current Status:** Planning phase, preparing for Phase 1 implementation

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- Git
- Cloudflare account (free tier works for development)
- FalkorDB Cloud account (free tier available)

### Initial Setup

1. **Fork and clone the repository:**
```bash
git clone https://github.com/moshehbenavraham/graphmind.git
cd graphmind
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
```

4. **Configure Cloudflare authentication:**
   - Visit https://dash.cloudflare.com/profile/api-tokens
   - Create token with "Edit Cloudflare Workers" template
   - Add to `.env`:
     ```
     CLOUDFLARE_API_TOKEN=your_token
     CLOUDFLARE_ACCOUNT_ID=your_account_id
     ```

5. **Set up FalkorDB Cloud:**
   - Sign up at https://app.falkordb.cloud/
   - Create a free tier database instance
   - Add connection credentials to `.env`:
     ```
     FALKORDB_HOST=your_host
     FALKORDB_PORT=your_port
     FALKORDB_USER=your_user
     FALKORDB_PASSWORD=your_password
     ```

6. **Verify authentication:**
```bash
npx wrangler whoami
```

7. **Run local development server:**
```bash
npm run dev
```

For complete setup instructions, see `docs/SETUP.md`.

## How to Contribute

### Reporting Issues

Before creating an issue, please:
- Check existing issues to avoid duplicates
- Use the issue template (when available)
- Include relevant details: environment, steps to reproduce, expected vs actual behavior

**Issue Labels:**
- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed

### Suggesting Features

We welcome feature suggestions! Please:
- Check the PRD (`docs/PRD/REQUIREMENTS-PRD.md`) to see if it's already planned
- Open an issue with the `enhancement` label
- Describe the use case and expected behavior
- Consider implementation approach and impacts

### Submitting Pull Requests

1. **Create a feature branch:**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes:**
   - Follow coding standards (see below)
   - Write tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass

3. **Commit your changes:**
```bash
git add .
git commit -m "feat: add voice note export functionality"
```

Use conventional commit format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

4. **Push and create PR:**
```bash
git push origin feature/your-feature-name
```

5. **PR Guidelines:**
   - Provide clear description of changes
   - Link related issues
   - Include screenshots for UI changes
   - Ensure CI checks pass
   - Request review from maintainers

## Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Local Development

```bash
# Start Workers local dev server
npm run dev

# Run tests
npm test

# Run integration tests
npm run test:integration

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

### Database Migrations

```bash
# Create new migration
npx wrangler d1 migrations create graphmind-db <migration-name>

# Apply locally
npx wrangler d1 migrations apply graphmind-db --local

# Apply to production (maintainers only)
npx wrangler d1 migrations apply graphmind-db --env production
```

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Enable strict mode
- Provide proper type annotations
- Avoid `any` types when possible

### Code Style
- Use 2 spaces for indentation
- Use single quotes for strings
- Include trailing commas in multi-line objects/arrays
- Max line length: 100 characters
- Use meaningful variable names

### Architecture Patterns
- **Workers**: Keep handlers thin, delegate to services
- **Durable Objects**: Use for stateful operations (sessions, connection pooling)
- **Error Handling**: Always use try-catch, return proper error responses
- **Validation**: Validate all inputs, use Zod or similar
- **Security**: Never trust user input, use parameterized queries

### File Organization
```
src/
├── workers/          # API endpoint handlers
├── durable-objects/  # Stateful objects
├── lib/
│   ├── auth/         # Authentication utilities
│   ├── voice/        # Voice processing
│   ├── graph/        # FalkorDB operations
│   ├── entities/     # Entity extraction
│   └── db/           # Database utilities
└── frontend/         # UI components
```

## Testing Requirements

### Unit Tests
- Write tests for all business logic
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Minimum 80% code coverage

### Integration Tests
- Test complete user flows
- Test API endpoints end-to-end
- Test database interactions
- Test voice pipeline integration

### Test Categories
```bash
# Unit tests (fast)
npm test -- --unit

# Integration tests (slower)
npm test -- --integration

# E2E tests (slowest)
npm test -- --e2e
```

### Required Tests Before PR
- All existing tests pass
- New functionality has tests
- Edge cases covered
- Error scenarios tested

## Documentation

### Code Documentation
- Add JSDoc comments for public APIs
- Explain complex logic with inline comments
- Document function parameters and return types
- Include usage examples for utilities

### README Updates
- Update README.md if user-facing changes
- Add new features to feature list
- Update setup instructions if needed

### API Documentation
- Document new endpoints in `docs/PRD/technical/api-specifications.md`
- Include request/response examples
- Document error codes
- Update OpenAPI spec if applicable

## Development Notes

### When Starting Phase 1
1. Set up Cloudflare Workers project with TypeScript
2. Configure D1 database and run migrations from `/docs/PRD/technical/database-schemas.md`
3. Set up FalkorDB Cloud account (Starter tier recommended)
4. Implement authentication endpoints with JWT + bcrypt
5. Create Durable Object for voice session management
6. Integrate Deepgram STT via Workers AI
7. Build minimal frontend with voice recording UI

### Entity Extraction Best Practices
- Use structured prompts for Llama 3.1 to extract entities/relationships
- Implement fuzzy matching with entity_cache (D1) and KV
- Set confidence threshold >0.8 for automatic acceptance
- Flag ambiguous entities for user confirmation
- Use FalkorDB GraphRAG SDK's auto ontology detection

### Graph Query Best Practices
- Leverage FalkorDB GraphRAG SDK for Cypher generation
- Cache frequent queries in KV (1-hour TTL)
- Use conversation context for follow-up questions
- Include temporal expressions (last week, this month, etc.)
- Always validate generated Cypher before execution

### Testing Strategy
- Unit tests: Authentication, entity extraction logic, Cypher validation
- Integration tests: Voice capture flow, query flow, graph operations
- Manual testing: Browser compatibility (Chrome/Safari/Firefox), microphone permissions, transcript accuracy

### Performance Considerations
- Voice transcription latency: <2 seconds (p95)
- Entity extraction: <3 seconds
- Graph query execution: <500ms uncached, <100ms cached
- Answer generation: <2 seconds
- TTS playback start: <1 second

### Security Checklist
- [ ] Input validation implemented
- [ ] Authentication required for protected endpoints
- [ ] Rate limiting configured
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevention in frontend
- [ ] JWT tokens properly validated
- [ ] User data isolation enforced

## Common Tasks

### Adding a New Entity Type
1. Update ontology in FalkorDB (auto-detected, no manual config needed)
2. Update entity extraction prompt for Llama 3.1
3. Add color coding for graph visualization
4. Update API documentation

### Adding a New API Endpoint
1. Create route handler in Workers
2. Add authentication middleware
3. Implement rate limiting
4. Add to API documentation
5. Write integration tests

### Modifying Database Schema
1. Create migration file in `/migrations/`
2. Test locally with `wrangler d1 migrations apply --local`
3. Apply to staging
4. Verify data integrity
5. Apply to production
6. Update schema documentation

### Adding a New Voice AI Model
1. Check Workers AI catalog for available models
2. Update model configuration in `wrangler.toml`
3. Create adapter in `src/lib/voice/`
4. Add model-specific tests
5. Update documentation

### Implementing a New Graph Query Type
1. Design Cypher query pattern
2. Add query builder in `src/lib/graph/`
3. Implement caching strategy
4. Add validation
5. Write tests with sample data
6. Document query pattern

## Getting Help

- **Documentation**: Check `docs/` directory
- **Issues**: Search existing issues or create new one
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join our community (link TBA)

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes for significant contributions
- GitHub contributor graph

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

---

**Thank you for contributing to GraphMind!** Your efforts help make knowledge management more accessible and intuitive for everyone.

For questions or clarifications, please open an issue or reach out to the maintainers.
