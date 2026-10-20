/// <reference types="@cloudflare/workers-types" />

/**
 * GraphMind environment bindings
 * Auto-generated from wrangler.toml configuration
 */
interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespaces
  KV: KVNamespace;
  RATE_LIMIT: KVNamespace;

  // R2 Bucket
  AUDIO_BUCKET: R2Bucket;

  // Workers AI
  AI: Ai;

  // Durable Objects
  FALKORDB_POOL: DurableObjectNamespace;
  VOICE_SESSION: DurableObjectNamespace;
  QUERY_SESSION_MANAGER: DurableObjectNamespace;

  // Queues
  ENTITY_EXTRACTION_QUEUE: Queue;
  GRAPH_SYNC_QUEUE: Queue;

  // Environment variables (from [vars])
  ENVIRONMENT: string;

  // Production environment variables (optional)
  ANSWER_CACHE_TTL?: string;
  ANSWER_MAX_TOKENS?: string;
  LLM_TEMPERATURE?: string;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  FALKORDB_HOST: string;
  FALKORDB_PORT: string;
  FALKORDB_USER: string;
  FALKORDB_PASSWORD: string;
  FALKORDB_REST_API_KEY: string;
}

/**
 * Cloudflare Worker fetch handler context
 */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Standard Cloudflare Worker export
 */
interface ExportedHandler<E = Env> {
  fetch?(request: Request, env: E, ctx: ExecutionContext): Promise<Response>;
  scheduled?(event: ScheduledEvent, env: E, ctx: ExecutionContext): Promise<void>;
  queue?(batch: MessageBatch, env: E, ctx: ExecutionContext): Promise<void>;
}
