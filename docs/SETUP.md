# GraphMind - Development Setup Guide

This guide explains how to set up your local development environment for GraphMind.

## Why This Setup?

GraphMind uses a **project-specific + API token** approach for these reasons:

1. **Version Consistency** - Everyone uses the same Wrangler version (defined in package.json)
2. **Team Collaboration** - Easy onboarding, reproducible builds
3. **CI/CD Ready** - Works seamlessly in automated pipelines
4. **Security** - API tokens can be rotated easily, not tied to personal OAuth sessions
5. **Multi-Project** - No conflicts with other Cloudflare projects on your machine

## Prerequisites

- **Node.js v18+** - [Download here](https://nodejs.org/)
- **Cloudflare Account** - [Sign up free](https://dash.cloudflare.com/sign-up)
- **Git** - For version control

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd graphmind
```

### 2. Install Dependencies

```bash
# Install Wrangler and other dependencies locally
npm install
```

This installs Wrangler as a dev dependency (not globally), ensuring version consistency.

### 3. Get Your Cloudflare API Token

**Why API Token vs OAuth?**
- OAuth (`wrangler login`) stores credentials globally and is tied to your browser session
- API Token is project-specific, easier to rotate, and works in CI/CD

**Steps:**

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Click **"Create Custom Token"** (don't use templates - they're incomplete for our needs)
4. Configure permissions - **See [CLOUDFLARE_API_TOKEN_PERMISSIONS.md](CLOUDFLARE_API_TOKEN_PERMISSIONS.md) for complete list**

**Quick Checklist:**

Account Permissions:
- ✓ Account Settings: Read
- ✓ Workers Scripts: Edit (includes Durable Objects)
- ✓ Workers KV Storage: Edit
- ✓ Workers R2 Storage: Edit
- ✓ D1: Edit
- ✓ Workers Tail: Read
- ✓ Analytics: Read
- ✓ Logs: Read
- ✓ Cloudflare Pages: Edit

User Permissions:
- ✓ User Details: Read

5. Set Account Resources to your account
6. Click "Continue to summary" then "Create Token"
7. **Copy the token immediately** (you won't see it again!)

### 4. Get Your Cloudflare Account ID

1. Go to https://dash.cloudflare.com/
2. Select any site (or go to Workers & Pages)
3. Look in the right sidebar - your Account ID is listed there
4. Copy it

### 5. Create Your .env File

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your credentials:

```bash
# Required
CLOUDFLARE_API_TOKEN=your_actual_token_here
CLOUDFLARE_ACCOUNT_ID=your_actual_account_id_here
CLOUDFLARE_S3_API=https://your_account_id.r2.cloudflarestorage.com

# For local development (FalkorDB Cloud free tier)
FALKORDB_HOST=your_falkordb_host_here
FALKORDB_PORT=your_falkordb_port_here
FALKORDB_USER=your_falkordb_user_here
FALKORDB_PASSWORD=your_falkordb_password_here

# Environment
NODE_ENV=development
```

**IMPORTANT:** Never commit your `.env` file! It's already in `.gitignore`.

**Note about CLOUDFLARE_S3_API:** This is the R2 S3-compatible API endpoint. Replace `your_account_id` with your actual Cloudflare Account ID. Format: `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com`

### 6. Verify Authentication

```bash
# Using npx to run the local wrangler
npx wrangler whoami
```

You should see your Cloudflare account details.

### 7. Set Up FalkorDB Cloud (Free Tier for Development)

For local development, use FalkorDB Cloud's free tier:

1. **Sign up for FalkorDB Cloud:**
   - Go to https://app.falkordb.cloud/
   - Create a free account

2. **Create a database instance:**
   - Click "Create Database" or "New Instance"
   - Select **Free tier** (no credit card required)
   - Choose a name like "graphmind-dev"
   - Note the region (choose closest to you)

3. **Get connection credentials:**
   - Once created, click on your database instance
   - Copy the host, port, username, and password
   - Add them to your `.env` file:
     ```
     FALKORDB_HOST=your-instance.falkordb.cloud
     FALKORDB_PORT=your-port-number
     FALKORDB_USER=your-username-here
     FALKORDB_PASSWORD=your-password-here
     ```

4. **Test connection** (optional):
   ```bash
   # Install redis-cli if needed
   redis-cli -u redis://your-instance.falkordb.cloud:port -a your-password ping
   ```

**For production:** You'll upgrade to Starter tier ($15/mo) or Pro tier ($50/mo) which offers higher limits and SLA.

### 8. Initialize Wrangler Configuration

Create a basic `wrangler.toml` file (we'll expand this in Phase 1):

```bash
npx wrangler init --yes
```

This creates a starter configuration file.

## Running the Project

### Local Development

```bash
# Start local dev server
npm run dev

# Alternative: npx wrangler dev
```

This starts a local Cloudflare Workers environment at http://localhost:8787

### Generate TypeScript Types (for D1, KV, R2)

```bash
npm run cf-typegen
```

### Deploy to Cloudflare (when ready)

```bash
npm run deploy

# Alternative: npx wrangler deploy
```

## Team Collaboration

### For New Team Members

1. Clone the repo
2. Run `npm install`
3. Get their own Cloudflare API token (follow steps above)
4. Create their own `.env` file with their token
5. Run `npm run dev`

### For CI/CD

In your CI/CD environment (GitHub Actions, GitLab CI, etc.):

1. Add `CLOUDFLARE_API_TOKEN` as a secret environment variable
2. Add `CLOUDFLARE_ACCOUNT_ID` as a variable
3. CI/CD will automatically use these for deployment

Example GitHub Actions:

```yaml
- name: Deploy to Cloudflare
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: npm run deploy
```

## Security Best Practices

### DO:
- Use API tokens (not global OAuth) for projects
- Keep `.env` in `.gitignore` (already done)
- Rotate API tokens periodically
- Use `.env.example` to document required variables (already created)
- Give each team member their own API token

### DON'T:
- Commit `.env` files
- Share API tokens between team members
- Use `wrangler login` for project work (save it for quick experiments)
- Commit secrets to `wrangler.toml`

## Using Wrangler Commands

Since Wrangler is installed locally, prefix commands with `npx`:

```bash
# Good (uses local version)
npx wrangler dev
npx wrangler deploy
npx wrangler d1 create graphmind-db

# Or use npm scripts
npm run dev
npm run deploy
```

```bash
# Avoid (uses global version, may have version conflicts)
wrangler dev
```

## Troubleshooting

### "wrangler: command not found"

Use `npx wrangler` or `npm run dev` instead of `wrangler` directly.

### "Authentication required"

1. Check your `.env` file exists and has valid credentials
2. Verify token with: `npx wrangler whoami`
3. If token expired, create a new one from Cloudflare dashboard

### "CLOUDFLARE_API_TOKEN not found"

Wrangler looks for the token in:
1. `CLOUDFLARE_API_TOKEN` environment variable
2. `.env` file (if using a loader like dotenv)

Make sure your `.env` file is in the project root.

### Version Conflicts

If you have global Wrangler installed and it conflicts:

```bash
# Uninstall global version
npm uninstall -g wrangler

# Always use project version
npx wrangler <command>
```

## Next Steps

Once your environment is set up:

1. Review the PRD: `PRD/REQUIREMENTS-PRD.md`
2. Read Phase 1 plan: `PRD/phases/phase-1-foundation.md`
3. Check out the API specs: `PRD/technical/api-specifications.md`
4. Start building! Follow `PRD/phases/phase-1-foundation.md` for implementation

## Additional Resources

- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [GraphMind PRD](PRD/REQUIREMENTS-PRD.md)
- [MCP Setup Guide](MCP_SETUP.md) - For Cloudflare MCP servers with Claude Code
