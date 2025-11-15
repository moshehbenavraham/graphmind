# Next Spec: Frontend Deployment to Cloudflare Pages

**Phase**: Phase 4 - Polish & Features (Frontend Integration)
**Priority**: P1 (Critical - Enables Testing)
**Estimated Context**: ~15,000 tokens
**Dependencies**: Features 008, 009, 010 (all complete, backend ready)
**Status**: Ready to Implement

---

## What We're Building

Deploy the GraphMind frontend (React components) to Cloudflare Pages with a proper build system, enabling end-to-end testing of the complete voice query system. This connects the existing backend API (Features 008-010) with the already-built React UI components, creating a functional web application users can access.

## Why This Next

**Critical Need:**
- Dependency on: Features 008, 009, 010 are **deployed to production but untestable**
- Enables: End-to-end testing of voice query → TTS flow
- Blocks: Cannot verify Feature 010 (TTS) without frontend playback UI
- Phase requirement: Phase 3 features need validation, Phase 4 requires production frontend

**Current State:**
- Backend API live at https://graphmind-api.apex-web-services-llc-0d4.workers.dev ✅
- React components exist in `src/frontend/components/` ✅
  - VoiceQueryApp.jsx (integration)
  - VoiceQueryRecorder.jsx (voice recording)
  - AudioPlayer.jsx (TTS playback)
  - QueryResults.jsx (answer display)
  - QueryHistory.jsx (history view)
- Missing: HTML entry point, build system, deployment to Pages ❌

**Impact:**
- Without frontend: Backend features remain untested in production
- With frontend: Full voice-first assistant usable, features validated
- Urgency: 24-hour monitoring for Feature 010 can't proceed without frontend

---

## Scope (Single Context Window)

**Included**:
- Create `index.html` entry point with React 18 integration
- Set up Vite build system (fast, modern, Cloudflare-optimized)
- Configure routing (React Router for navigation)
- Create main App.jsx with layout and navigation
- Deploy to Cloudflare Pages (`wrangler pages deploy`)
- Connect frontend to production API (CORS, JWT auth)
- Create `.env` configuration for API URL
- Basic error boundary and loading states
- Mobile-responsive layout
- Production build optimization

**Explicitly Excluded** (for later specs):
- Graph visualization UI (Feature 012 - Phase 2 deferred)
- Advanced entity management UI - Phase 4
- PWA capabilities (offline mode, install) - Phase 4
- Dark mode - Phase 4
- Internationalization (i18n) - Phase 5
- Analytics integration - Phase 4
- A/B testing - Phase 5

**Estimated Tokens**: ~15,000 tokens

---

## User Stories (for this spec)

### Story 1: Access GraphMind Web App (P1)
As a user, I want to access GraphMind in my web browser so I can use the voice-first knowledge assistant without installing anything.

**Acceptance Criteria**:
- [ ] Navigate to Pages URL and see GraphMind interface
- [ ] Mobile and desktop browsers supported (Chrome, Safari, Firefox)
- [ ] App loads within 2 seconds (p95)
- [ ] Responsive design works on all screen sizes
- [ ] No console errors on page load

### Story 2: Use Voice Query System (P1)
As a user, I want to ask questions via voice and hear spoken answers so I can interact hands-free with my knowledge graph.

**Acceptance Criteria**:
- [ ] Click microphone button to start recording
- [ ] See real-time transcription of question
- [ ] Receive answer as text and audio
- [ ] Audio plays automatically (or on click if autoplay blocked)
- [ ] Playback controls work (pause/resume/stop)
- [ ] Complete flow works end-to-end in production

### Story 3: View Query History (P2)
As a user, I want to see my previous queries so I can review past conversations with my knowledge assistant.

**Acceptance Criteria**:
- [ ] Navigate to history page
- [ ] See list of past queries with timestamps
- [ ] Click on query to see full details
- [ ] History persists across sessions
- [ ] Pagination works for large histories

### Story 4: Manage Authentication (P1)
As a user, I want to log in and register so my knowledge graph is private and secure.

**Acceptance Criteria**:
- [ ] Register with email and password
- [ ] Login with credentials
- [ ] JWT token stored securely (httpOnly cookie or localStorage)
- [ ] Redirect to login if not authenticated
- [ ] Logout button clears session
- [ ] Protected routes require authentication

---

## Technical Approach

### Cloudflare Pages Deployment

**Build System:**
- **Vite** - Fast, modern build tool with HMR
- **React 18** - Already used in components
- **React Router v6** - Client-side routing
- **Tailwind CSS** - Already used in components (utility-first CSS)

**Deployment Flow:**
```bash
# 1. Build production bundle
npm run build

# 2. Deploy to Cloudflare Pages
npx wrangler pages deploy dist
```

**Pages Configuration** (`wrangler.toml` or `pages.json`):
```toml
[build]
command = "npm run build"
directory = "dist"
```

### Project Structure

```
graphmind/
├── src/
│   ├── frontend/
│   │   ├── index.html          # NEW: Entry point
│   │   ├── main.jsx            # NEW: React 18 root
│   │   ├── App.jsx             # NEW: Main app component
│   │   ├── components/         # ✅ EXISTS
│   │   │   ├── VoiceQueryApp.jsx
│   │   │   ├── AudioPlayer.jsx
│   │   │   ├── QueryResults.jsx
│   │   │   ├── QueryHistory.jsx
│   │   │   └── ...
│   │   ├── hooks/              # ✅ EXISTS
│   │   ├── utils/              # ✅ EXISTS
│   │   ├── styles/             # ✅ EXISTS
│   │   └── routes/             # NEW: Page components
│   │       ├── HomePage.jsx
│   │       ├── QueryPage.jsx
│   │       ├── HistoryPage.jsx
│   │       ├── LoginPage.jsx
│   │       └── RegisterPage.jsx
├── vite.config.js              # NEW: Vite configuration
├── package.json                # UPDATE: Add Vite, React Router
└── .env.production             # NEW: Production API URL
```

### API Integration

**Environment Configuration:**
```javascript
// .env.development
VITE_API_URL=http://localhost:8787

// .env.production
VITE_API_URL=https://graphmind-api.apex-web-services-llc-0d4.workers.dev
```

**API Client** (`src/frontend/utils/api.js`):
```javascript
const API_URL = import.meta.env.VITE_API_URL;

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}
```

**WebSocket Connection:**
```javascript
const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');

export function createWebSocketConnection(endpoint, token) {
  return new WebSocket(`${WS_URL}${endpoint}?token=${token}`);
}
```

### CORS Configuration (Backend)

Update `src/index.js` to allow Pages domain:

```javascript
const allowedOrigins = [
  'http://localhost:5173',           // Vite dev server
  'https://graphmind.pages.dev',     // Cloudflare Pages (auto)
  'https://graphmind-*.pages.dev',   // Preview deployments
];

function corsPreflightResponse(request) {
  const origin = request.headers.get('Origin');

  if (allowedOrigins.some(allowed => origin?.includes(allowed))) {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  return new Response('Forbidden', { status: 403 });
}
```

---

## Implementation Steps

### 1. Setup Build System (Day 1)

**Install Dependencies:**
```bash
cd /home/aiwithapex/projects/graphmind
npm install --save-dev vite @vitejs/plugin-react
npm install react-router-dom
```

**Create `vite.config.js`:**
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/frontend',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
      },
    },
  },
});
```

**Update `package.json`:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy:pages": "npm run build && npx wrangler pages deploy dist --project-name=graphmind"
  }
}
```

### 2. Create Entry Point (Day 1)

**`src/frontend/index.html`:**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="GraphMind - Voice-First Personal Knowledge Assistant" />
    <title>GraphMind</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>
```

**`src/frontend/main.jsx`:**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

### 3. Build Main App Component (Day 1-2)

**`src/frontend/App.jsx`:**
```javascript
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import HomePage from './routes/HomePage';
import QueryPage from './routes/QueryPage';
import HistoryPage from './routes/HistoryPage';
import LoginPage from './routes/LoginPage';
import RegisterPage from './routes/RegisterPage';
import { useAuth } from './hooks/useAuth';
import Navigation from './components/Navigation';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/query"
              element={
                <ProtectedRoute>
                  <QueryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <HistoryPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
}
```

### 4. Create Page Components (Day 2)

**`src/frontend/routes/QueryPage.jsx`:**
```javascript
import React from 'react';
import { VoiceQueryApp } from '../components/VoiceQueryApp';

export default function QueryPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Ask Your Knowledge Graph</h1>
      <VoiceQueryApp />
    </div>
  );
}
```

(Create similar pages for Home, History, Login, Register)

### 5. Configure CORS on Backend (Day 2)

Update `src/index.js` to allow Pages origin (see Technical Approach above).

### 6. Test Locally (Day 2)

```bash
# Terminal 1: Start backend
npx wrangler dev

# Terminal 2: Start frontend
npm run dev

# Visit http://localhost:5173
```

Verify:
- Authentication flow works
- Voice query recording works
- TTS audio playback works
- History page loads
- WebSocket connections establish

### 7. Deploy to Production (Day 3)

```bash
# Build and deploy
npm run build
npx wrangler pages deploy dist --project-name=graphmind

# OR use custom script
npm run deploy:pages
```

**Cloudflare Pages will auto-assign URL:**
- Production: `https://graphmind.pages.dev`
- Or custom domain: `https://app.graphmind.com` (if configured)

### 8. Validate Production Deployment (Day 3)

Test on production Pages URL:
- [ ] Load app successfully
- [ ] Login/register works
- [ ] Voice query end-to-end works
- [ ] TTS audio plays
- [ ] History persists
- [ ] Mobile responsive
- [ ] No console errors

---

## Success Criteria

**Deployment Success:**
- [ ] Frontend deployed to Cloudflare Pages
- [ ] Production URL accessible and loads correctly
- [ ] Build process completes without errors
- [ ] Environment variables configured correctly

**Functionality Success:**
- [ ] Complete voice query flow works (record → transcribe → query → answer → TTS playback)
- [ ] Audio Player controls work (pause/resume/stop)
- [ ] Query history loads and displays correctly
- [ ] Authentication flow complete (register/login/protected routes)
- [ ] WebSocket connections establish successfully

**Quality Success:**
- [ ] Page load time <2 seconds (p95)
- [ ] Mobile responsive on iOS Safari and Chrome Mobile
- [ ] No console errors in production
- [ ] Error boundaries catch and display errors gracefully
- [ ] CORS configured correctly (no CORS errors)

**Testing Success:**
- [ ] Feature 010 (TTS) 24-hour monitoring can proceed
- [ ] End-to-end testing documented
- [ ] Production smoke tests pass

---

## Next After This

Once frontend is deployed and tested, the next logical steps are:

### Immediate (Testing & Validation)
1. **Feature 010 Monitoring** - Complete 24-hour TTS latency and cache monitoring
2. **End-to-End Test Suite** - Create Playwright/Cypress tests for full flow
3. **Update PRD** - Document frontend deployment, update implementation report

### Phase 3 Completion
4. **Feature 011: Conversation Context Management** - Multi-turn conversations
5. **Phase 3 Deployment** - Final production validation of complete voice query system

### Phase 4 (Polish & Features)
6. **Feature 012: Graph Visualization** - Interactive D3.js graph UI (deferred from Phase 2)
7. **Multi-Source Ingestion UI** - URL, file, text paste interfaces
8. **Full-Text Search UI** - Search across notes and entities
9. **Entity Management UI** - Merge duplicates, edit, bulk operations
10. **PWA Support** - Offline mode, installable app
11. **Dark Mode** - User preference for theme
12. **Performance Optimization** - Lazy loading, code splitting, caching

---

## References

**PRD Phase**: [Phase 4: Polish & Features](./phases/phase-4-polish.md)

**Related Specs**:
- [Feature 008: Voice Query Input](../../specs/008-voice-query-input/spec.md) - Backend voice query system
- [Feature 009: Answer Generation](../../specs/009-answer-generation/spec.md) - LLM answer generation
- [Feature 010: TTS Responses](../../specs/010-tts-responses/spec.md) - Audio synthesis and streaming

**Technical Docs**:
- [API Specifications](./technical/api-specifications.md) - Backend API endpoints
- [Frontend Components](../../src/frontend/components/README.md) - Existing React components
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/) - Deployment guide

**External Resources**:
- [Vite Documentation](https://vitejs.dev/) - Build tool
- [React Router v6](https://reactrouter.com/) - Routing
- [Cloudflare Pages Framework Guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/) - React on Pages

---

## Implementation Timeline

**Estimated Duration**: 2-3 days

**Day 1** (4-6 hours):
- Set up Vite build system
- Create index.html and main.jsx
- Configure routing
- Create basic App.jsx layout
- Test local development

**Day 2** (4-6 hours):
- Create all page components (Home, Query, History, Login, Register)
- Integrate existing React components
- Configure API client with auth
- Update backend CORS
- Test full local flow

**Day 3** (2-4 hours):
- Build production bundle
- Deploy to Cloudflare Pages
- Configure custom domain (optional)
- Production smoke tests
- Document deployment process

**Total**: 10-16 hours of focused work

---

## Token Budget Validation

**Estimated Tokens for Implementation:**
- Vite configuration: ~500 tokens
- HTML entry point: ~300 tokens
- main.jsx: ~400 tokens
- App.jsx with routing: ~800 tokens
- 5 page components: ~2,500 tokens (500 each)
- API client utilities: ~600 tokens
- Authentication hook: ~500 tokens
- Navigation component: ~400 tokens
- Backend CORS update: ~300 tokens
- Environment configuration: ~200 tokens
- Deployment scripts: ~300 tokens
- Testing and validation: ~1,000 tokens

**Total Estimated**: ~7,800 tokens (well under 15,000 target)

**Buffer**: 7,200 tokens for edge cases, debugging, documentation

---

**Ready to connect your backend to a real frontend and make GraphMind usable! 🚀**
