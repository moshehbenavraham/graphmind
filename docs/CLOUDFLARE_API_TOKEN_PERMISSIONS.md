# Cloudflare API Token Permissions for GraphMind

This document lists all the permissions needed for your Cloudflare API token to work with the GraphMind project.

## How to Create the Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Click "Create Custom Token" (don't use a template)
4. Use the permissions listed below

## Required Permissions

### Account Permissions

| Resource | Permission | Why Needed |
|----------|-----------|------------|
| **Account Settings** | Read | View account details, required for wrangler |
| **Workers Scripts** | Edit | Deploy Workers, manage Durable Objects |
| **Workers KV Storage** | Edit | Create/manage KV namespaces for caching |
| **Workers R2 Storage** | Edit | Create/manage R2 buckets for audio storage |
| **D1** | Edit | Create databases, run migrations, execute queries |
| **Workers Tail** | Read | View real-time logs during development |
| **Analytics** | Read | Monitor performance and usage |
| **Logs** | Read | Debug and troubleshoot issues |

### User Permissions

| Resource | Permission | Why Needed |
|----------|-----------|------------|
| **User Details** | Read | For `wrangler whoami` command to show email |

### Zone Permissions (if using custom domain)

| Resource | Permission | Why Needed |
|----------|-----------|------------|
| **Zone** | Read | View zone details |
| **Workers Routes** | Edit | Configure custom domain routing |
| **DNS** | Edit | Set up custom domain DNS (optional) |
| **Page Rules** | Edit | Configure routing rules (optional) |

### Pages Permissions

| Resource | Permission | Why Needed |
|----------|-----------|------------|
| **Cloudflare Pages** | Edit | Deploy frontend to Pages |

## Token Configuration

### Account Resources
- **Include:** Your specific account (select from dropdown)

### Zone Resources (Optional - only if using custom domain)
- **Include:** All zones OR specific zone

### TTL (Time to Live)
- **Recommendation:** No expiration (or very long, like 1 year)
- This avoids having to recreate the token frequently

### IP Address Filtering (Optional)
- Leave blank for maximum flexibility during development
- Can restrict to your IP range for production if needed

## Complete Permission List (Copy-Paste Reference)

When creating your custom token, select these permissions:

### Account Permissions:
```
✓ Account Settings - Read
✓ Workers Scripts - Edit (this includes Durable Objects)
✓ Workers KV Storage - Edit
✓ Workers R2 Storage - Edit
✓ D1 - Edit
✓ Workers Tail - Read
✓ Analytics - Read
✓ Logs - Read
✓ Cloudflare Pages - Edit
```

### User Permissions:
```
✓ User Details - Read (needed for wrangler whoami)
```

**IMPORTANT NOTES:**
- **"Durable Objects"** is NOT a separate permission - it's included in "Workers Scripts"
- **"User Details"** is under the "User" category, NOT "Account"
- **"Workers AI"** doesn't appear as a separate permission - it's accessible with Workers Scripts

### Permission Levels Explained

Cloudflare has various permission levels depending on the resource:
- **Read** = View/list only
- **Run** = Execute/trigger actions (e.g., deploy, invoke functions)
- **Edit** = Create, modify, delete
- **Send** = Publish/transmit data (e.g., send logs, push events)
- **Purge** = Clear/delete bulk data (e.g., clear cache)
- And possibly others...

## IMPORTANT: The "Just Give Me Everything" Approach

Since you want to avoid recreating this token at all costs, here's the simplest approach:

**For EACH resource in the list above:**
1. Click on the resource (e.g., "Workers Scripts")
2. **CHECK ALL AVAILABLE PERMISSION BOXES** for that resource
   - If you see Read, Run, Edit, Send, Purge, whatever → **check them all**
3. Move to the next resource

**Don't overthink it!** Cloudflare's permission UI is notoriously complex with 9872398732984 options (as you said).

The nuclear option is the safe option here:
- ✓ All permissions for Workers Scripts
- ✓ All permissions for Workers KV Storage
- ✓ All permissions for Workers R2 Storage
- ✓ All permissions for D1
- ✓ All permissions for Durable Objects
- ✓ All permissions for everything listed above

**You're using this for YOUR OWN development** - there's no security risk in giving your own token full permissions on your own account.

### Zone Permissions (Optional):
```
✓ Zone - Read
✓ Workers Routes - Edit
✓ DNS - Edit (if custom domain)
```

## Notes

- **Workers AI** might not appear as a separate permission - it's included with Workers Scripts Edit permission
- **Cloudflare Pages** may appear under Account permissions or as a separate category
- If you can't find "Workers AI", don't worry - it's accessible with Workers Scripts permission
- **Durable Objects** permission is required even though it's part of Workers - some operations specifically check for it
- **Analytics** and **Logs** are helpful for debugging but not strictly required for basic deployment

## Testing Your Token

After creating the token, test it:

```bash
# Set the token
export CLOUDFLARE_API_TOKEN=your-token-here

# Verify it works
npx wrangler whoami

# Test Workers access
npx wrangler deployments list

# Test D1 access
npx wrangler d1 list

# Test KV access
npx wrangler kv:namespace list

# Test R2 access
npx wrangler r2 bucket list

# Test Pages access
npx wrangler pages project list
```

## Troubleshooting

### Error: "Insufficient permissions"
- Go back to token settings
- Verify all permissions from the list above are checked
- Make sure Account Resources includes your account

### Error: "Authentication error"
- Check that the token is correctly set in your `.env` file
- Verify no extra spaces or newlines in the token
- Try regenerating the token

### Error: "Resource not found"
- Make sure Account Resources is set to your specific account
- For Zone permissions, ensure the zone is included

## Recommended: Save Your Token Securely

1. **Copy the token immediately** - You can only see it once!
2. **Store in password manager** - 1Password, LastPass, Bitwarden, etc.
3. **Add to `.env`** - Your local development file (gitignored)
4. **Backup** - Keep a secure backup of the token

## When to Recreate the Token

You'll need to recreate if:
- Token is compromised or exposed in public repo
- You need additional permissions not originally granted
- Token expires (if you set a TTL)
- You lose the token and didn't save it

To minimize recreations, start with ALL the permissions listed above!
