# GPTZero API Worker

Professional-grade AI detection service with quota tracking for humanizer.com

## 🚀 Production URL

https://gptzero-api.tem-527.workers.dev

## 📋 Features

- **GPTZero Integration**: Professional AI detection via GPTZero API (latest 2025-11-13-base model)
- **Quota Tracking**: Per-user, per-month word quotas stored in Cloudflare KV
- **Tier Support**: Free (0 words), Pro (50k words), Premium (unlimited)
- **CORS Configured**: Works with narrative-studio and humanizer.com
- **Health Monitoring**: `/health` endpoint for status checks

## 🔑 API Endpoints

### POST /api/gptzero/detect

Run GPTZero AI detection on text.

**Request:**
```json
{
  "text": "Your text to analyze...",
  "userId": "user_123",
  "userTier": "pro"  // "free" | "pro" | "premium"
}
```

**Response:**
```json
{
  "detector_type": "gptzero",
  "ai_likelihood": 0.85,
  "confidence": "high",
  "label": "likely_ai",
  "metrics": {
    "averageGeneratedProb": 0.82,
    "completelyGeneratedProb": 0.85,
    "overallBurstiness": 15.2
  },
  "highlights": [
    {
      "start": 0,
      "end": 120,
      "sentence": "...",
      "score": 0.92,
      "reason": "High AI probability (92%)"
    }
  ],
  "quota": {
    "used": 154,
    "limit": 50000,
    "remaining": 49846,
    "resetDate": "2025-12-01T05:00:00.000Z",
    "percentUsed": 0.3
  },
  "wordsProcessed": 154
}
```

### GET /api/gptzero/quota/:userId

Get quota information for a user.

**Query params:**
- `tier`: User tier (`free` | `pro` | `premium`)

**Response:**
```json
{
  "used": 154,
  "limit": 50000,
  "remaining": 49846,
  "resetDate": "2025-12-01T05:00:00.000Z",
  "percentUsed": 0.3
}
```

### POST /api/gptzero/quota/:userId/set-limit

Set custom quota limit (admin only).

**Request:**
```json
{
  "limit": 100000
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "gptzero-api",
  "timestamp": "2025-11-19T20:00:00.000Z"
}
```

## 🛠️ Development

### Prerequisites

- Node.js 22+
- Cloudflare account
- GPTZero API key

### Setup

```bash
# Install dependencies
npm install

# Create KV namespace
npx wrangler kv namespace create USAGE_KV

# Set API key secret (production)
npx wrangler secret put GPTZERO_API_KEY

# Create .dev.vars for local development
echo "GPTZERO_API_KEY=your-key-here" > .dev.vars
```

### Local Development

```bash
# Start local dev server
npm run dev

# Worker runs on http://localhost:8787
```

### Testing

```bash
# Run test suite
node test-gptzero.mjs
```

Expected output:
- ✅ Health check passes
- ✅ Detection works with GPTZero API
- ✅ Quota tracking accurate
- ✅ Quota endpoint functional

### Deployment

```bash
# Deploy to production
npm run deploy

# View logs
npm run tail
```

## 📊 Quota Tiers

| Tier | Words/Month | Cost Basis |
|------|-------------|-----------|
| Free | 0 | No GPTZero access |
| Pro | 50,000 | Included in $10/mo |
| Premium | 1,000,000 | Included in $30/mo |

## 🔒 Security

- API key stored as Cloudflare secret (never in code)
- `.dev.vars` gitignored (local development only)
- CORS restricted to allowed origins
- Quota enforced before API calls (429 on limit)

## 📈 Cost Management

GPTZero API pricing (~$0.15 per 1k words):
- 20 users: $45/month (300k words)
- 100 users: $135/month (1M words)
- 200 users: $250/month (2M words)

Profitable at 16+ Pro users @ $10/month.

## 🔗 Integration

Used by:
- **narrative-studio**: localhost:5173 (development)
- **workbench.humanizer.com**: Production web app
- **humanizer.com**: Marketing site

## 📝 Version History

**v1.0.0** (2025-11-19)
- Initial release
- GPTZero 2025-11-13-base model
- KV quota tracking
- CORS configuration
- Health endpoint
