import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { createLogger } from '../utils/logger';
import api from '../utils/api.js';
import Navigation from '../components/Navigation';
import {
  GlitchText,
  Card,
  Button,
  Badge,
  OffsetLayer,
} from '../design-system';

const logger = createLogger('dashboard');
const SEED_TIMEOUT_MS = 20000;

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');
  const [seedError, setSeedError] = useState('');

  const handleSeedData = async () => {
    setSeedLoading(true);
    setSeedMessage('');
    setSeedError('');
    logger.info('seed.click', 'Add Test Data clicked', { user: user?.email });

    try {
      const data = await api.seedData({ timeoutMs: SEED_TIMEOUT_MS });

      if (data.success) {
        setSeedMessage('Test data successfully added! Try asking: "Who works on GraphMind?"');
      } else if (data.existing_data) {
        setSeedMessage('Your graph already has data. Seed data is only added to empty graphs.');
      } else {
        const message = data.message || 'Failed to add seed data';
        setSeedError(message);
        logger.error('seed.response_error', 'Seed data API returned error', { message });
      }
    } catch (error) {
      console.error('[Dashboard] Seed data error:', error);
      const message = error?.message || 'Failed to add seed data. Please try again.';
      setSeedError(message);
      logger.error('seed.exception', 'Seed data request failed', { message });
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFEF0]">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-12">
          <GlitchText as="h1" className="text-4xl md:text-5xl mb-4">
            Welcome to GraphMind
          </GlitchText>
          <p className="text-lg text-brutal-charcoal/70 font-mono">
            Your voice-first personal knowledge assistant
          </p>
        </div>

        {/* Action Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 mb-12">
          {/* Ask a Question Card */}
          <OffsetLayer variant="accent" size="lg">
            <Card
              interactive
              onClick={() => navigate('/query')}
              className="h-full"
            >
              <Card.Body>
                <h2 className="text-xl font-bold mb-2 text-accent-primary">
                  Ask a Question
                </h2>
                <p className="text-brutal-charcoal/70 mb-4 font-mono text-sm">
                  Use voice to query your knowledge graph
                </p>
                <Button variant="primary" size="sm">
                  Start Recording
                </Button>
              </Card.Body>
            </Card>
          </OffsetLayer>

          {/* View History Card */}
          <OffsetLayer size="lg">
            <Card
              interactive
              onClick={() => navigate('/history')}
              className="h-full"
            >
              <Card.Body>
                <h2 className="text-xl font-bold mb-2 text-brutal-charcoal">
                  View History
                </h2>
                <p className="text-brutal-charcoal/70 mb-4 font-mono text-sm">
                  Review past queries and answers
                </p>
                <Button variant="secondary" size="sm">
                  Browse History
                </Button>
              </Card.Body>
            </Card>
          </OffsetLayer>
        </div>

        {/* Seed Data Card */}
        <Card className="mb-8">
          <Card.Body>
            <h2 className="text-lg font-bold mb-2 text-brutal-charcoal">
              Need Test Data?
            </h2>
            <p className="text-brutal-charcoal/70 mb-4 font-mono text-sm">
              Add sample knowledge graph data to test voice queries. Includes people, projects, meetings, and more.
            </p>

            <Button
              onClick={handleSeedData}
              disabled={seedLoading}
              loading={seedLoading}
              variant="primary"
              className="mb-4"
            >
              {seedLoading ? 'Adding Test Data...' : 'Add Test Data'}
            </Button>

            {seedMessage && (
              <div className="mt-4 p-4 bg-status-success/10 border-l-4 border-status-success">
                <Badge variant="success" className="mb-2">Success</Badge>
                <p className="text-brutal-charcoal font-mono text-sm">{seedMessage}</p>
              </div>
            )}

            {seedError && (
              <div className="mt-4 p-4 bg-status-error/10 border-l-4 border-status-error">
                <Badge variant="error" className="mb-2">Error</Badge>
                <p className="text-brutal-charcoal font-mono text-sm">{seedError}</p>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Getting Started Card */}
        <Card>
          <Card.Header>
            <h2 className="text-lg font-bold text-brutal-charcoal">
              Getting Started
            </h2>
          </Card.Header>
          <Card.Body>
            <ol className="space-y-0">
              <li className="py-3 border-b-2 border-brutal-black/10 font-mono text-sm">
                <span className="inline-block w-8 text-accent-primary font-bold">01</span>
                Click "Ask a Question" to start a voice query
              </li>
              <li className="py-3 border-b-2 border-brutal-black/10 font-mono text-sm">
                <span className="inline-block w-8 text-accent-primary font-bold">02</span>
                Allow microphone access when prompted
              </li>
              <li className="py-3 border-b-2 border-brutal-black/10 font-mono text-sm">
                <span className="inline-block w-8 text-accent-primary font-bold">03</span>
                Speak your question clearly
              </li>
              <li className="py-3 font-mono text-sm">
                <span className="inline-block w-8 text-accent-primary font-bold">04</span>
                Listen to the AI-generated answer
              </li>
            </ol>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;
