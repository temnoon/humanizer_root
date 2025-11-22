# Dual Deployment Architecture Guide

**Last Updated**: Nov 21, 2025
**Status**: ✅ Ollama Integration Complete

---

## 📋 **Overview**

The Humanizer platform supports **two deployment modes** with maximum code reuse:

1. **Cloud Deployment** (Production)
   - Frontend: Cloudflare Pages
   - Backend: Cloudflare Workers
   - LLMs: Cloudflare AI binding (@cf/ models)
   - Database: Cloudflare D1
   - Storage: Cloudflare R2

2. **Local Deployment** (Development)
   - Frontend: Vite dev server (localhost:5173)
   - Backend: Wrangler dev (localhost:8787)
   - LLMs: Ollama (localhost:11434)
   - Database: Local D1 (SQLite)
   - Storage: Local filesystem

---

## 🏗️ **Architecture**

### **Backend: LLM Provider Abstraction**

All LLM calls go through a provider interface (`LLMProvider`), allowing seamless switching between cloud and local models:

```typescript
// providers/npe-api/src/services/llm-providers/
├── base.ts              // LLMProvider interface
├── cloudflare.ts        // Cloudflare AI binding (cloud)
├── ollama.ts            // Ollama local server (local) ← NEW
├── openai.ts            // External OpenAI API
├── anthropic.ts         // External Anthropic API
├── google.ts            // External Google Gemini API
└── index.ts             // Provider factory
```

### **Model Selection Strategy**

Model IDs determine which provider to use:
- `@cf/*` → Cloudflare AI (cloud only)
- `ollama/*` or `local/*` → Ollama (local only)
- `gpt-*` → OpenAI
- `claude-*` → Anthropic
- `gemini-*` → Google

### **Environment Detection**

The system automatically detects the environment:

```typescript
// config/llm-models.ts
function detectEnvironment(hasAIBinding: boolean): 'local' | 'cloud' {
  return hasAIBinding ? 'cloud' : 'local';
}
```

---

## 🚀 **Setup Instructions**

### **Cloud Deployment**

1. **Backend**:
   ```bash
   cd /Users/tem/humanizer_root/workers/npe-api
   npx wrangler deploy
   ```

2. **Frontend**:
   ```bash
   cd /Users/tem/humanizer_root/narrative-studio
   npm run build
   npx wrangler pages deploy dist
   ```

3. **Configuration**:
   - No additional config needed
   - Cloudflare AI binding automatically available
   - Uses models from `MODEL_CONFIGS.*.cloud`

### **Local Deployment**

1. **Install Ollama**:
   ```bash
   # macOS
   brew install ollama

   # Or download from: https://ollama.com
   ```

2. **Pull Required Models**:
   ```bash
   # Fast, good quality (default)
   ollama pull llama3.1:8b

   # Larger, better quality (optional)
   ollama pull llama3.1:70b
   ```

3. **Start Ollama Server**:
   ```bash
   # Ollama starts automatically on macOS
   # Or start manually:
   ollama serve

   # Verify it's running:
   curl http://localhost:11434/api/tags
   ```

4. **Start Backend** (Terminal 1):
   ```bash
   cd /Users/tem/humanizer_root/workers/npe-api
   source ~/.nvm/nvm.sh && nvm use 22

   # Use --local flag to disable Cloudflare AI binding
   # This forces Ollama usage for LLM calls
   npx wrangler dev --local
   ```

5. **Start Frontend** (Terminal 2):
   ```bash
   cd /Users/tem/humanizer_root/narrative-studio
   npm run dev  # localhost:5173
   ```

6. **Start Archive Server** (Optional - Terminal 3):
   ```bash
   cd /Users/tem/humanizer_root/narrative-studio
   node archive-server.js  # Port 3002
   ```

---

## 🔧 **Configuration**

### **Model Mappings**

Edit `/workers/npe-api/src/config/llm-models.ts`:

```typescript
export const MODEL_CONFIGS = {
  persona: {
    cloud: '@cf/meta/llama-3.1-70b-instruct',  // Cloudflare
    local: 'ollama/llama3.1:8b',                // Ollama
  },
  style: {
    cloud: '@cf/meta/llama-3.1-70b-instruct',
    local: 'ollama/llama3.1:8b',
  },
  // ... more configurations
};
```

### **Ollama URL Override**

Set custom Ollama URL in `wrangler.toml` or `.dev.vars`:

```toml
# wrangler.toml
[env.dev.vars]
OLLAMA_URL = "http://localhost:11434"  # Default
```

### **Frontend Environment Detection**

Frontend auto-detects based on hostname:

```typescript
// narrative-studio/src/services/transformationService.ts
const isLocalhost = window.location.hostname === 'localhost';
const API_BASE = isLocalhost
  ? 'http://localhost:8787'              // Local wrangler dev
  : 'https://npe-api.tem-527.workers.dev'; // Cloud Workers
```

---

## 🛠️ **How It Works**

### **Request Flow (Local)**

1. User triggers transformation in frontend (localhost:5173)
2. Frontend sends request to `http://localhost:8787/transformations/persona`
3. Backend detects no AI binding → environment = 'local'
4. Provider factory creates `OllamaProvider` with model `llama3.1:8b`
5. Ollama provider calls `http://localhost:11434/api/chat`
6. Ollama returns LLM response
7. Backend processes and returns to frontend

### **Request Flow (Cloud)**

1. User triggers transformation in frontend (humanizer.com)
2. Frontend sends request to `https://npe-api.tem-527.workers.dev/transformations/persona`
3. Backend detects AI binding → environment = 'cloud'
4. Provider factory creates `CloudflareProvider` with model `@cf/meta/llama-3.1-70b-instruct`
5. Cloudflare AI returns LLM response
6. Backend processes and returns to frontend

---

## 📝 **Code Changes Summary**

### **New Files**
- ✅ `/workers/npe-api/src/services/llm-providers/ollama.ts` - Ollama provider
- ✅ `/workers/npe-api/src/config/llm-models.ts` - Model configuration
- ✅ `/DUAL_DEPLOYMENT_GUIDE.md` - This documentation

### **Modified Files**
- ✅ `/workers/npe-api/src/services/llm-providers/base.ts` - Added 'ollama' to provider types
- ✅ `/workers/npe-api/src/services/llm-providers/index.ts` - Added Ollama case to factory
- ✅ `/narrative-studio/src/services/transformationService.ts` - Added timeout handling

---

## 🧪 **Testing**

### **Test Local Deployment**

1. **Verify Ollama is running**:
   ```bash
   curl http://localhost:11434/api/tags
   # Should return: {"models":[...]}
   ```

2. **Test Persona Transformation**:
   ```bash
   curl -X POST http://localhost:8787/transformations/persona \
     -H "Content-Type: application/json" \
     -d '{
       "text": "The cat sat on the mat. It was a sunny day.",
       "persona": "holmes_analytical"
     }'
   ```

3. **Monitor Ollama Logs**:
   ```bash
   # Watch Ollama process requests
   tail -f ~/.ollama/logs/server.log
   ```

### **Test Cloud Deployment**

Use production API URL instead:
```bash
curl -X POST https://npe-api.tem-527.workers.dev/transformations/persona \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"text": "...", "persona": "holmes_analytical"}'
```

---

## 🎯 **Tools Status**

| Tool | Cloud | Local (Ollama) | Local (Non-LLM) |
|------|-------|----------------|-----------------|
| Computer Humanizer | ✅ | N/A | ✅ (heuristic) |
| AI Detection (Lite) | ✅ | N/A | ✅ (heuristic) |
| AI Detection (GPTZero) | ✅ | ✅ | N/A |
| Persona Transformation | ✅ | ✅ NEW | ❌ |
| Style Transformation | ✅ | ✅ NEW | ❌ |
| Round-Trip Translation | ✅ | ✅ NEW | ❌ |

---

## 💡 **Best Practices**

1. **Development**:
   - Always use `wrangler dev --local` for local development
   - Keep Ollama running in background
   - Use lightweight models (8B) for faster iteration

2. **Testing**:
   - Test locally with Ollama first
   - Deploy to staging with Cloudflare AI
   - Verify production deployment

3. **Model Selection**:
   - Use 8B models for local development (fast)
   - Use 70B models for cloud production (quality)
   - Configure per use case in `llm-models.ts`

4. **Debugging**:
   - Check `wrangler dev` logs for provider selection
   - Check Ollama logs for model loading issues
   - Use `isAvailable()` to verify provider health

---

## 🔍 **Troubleshooting**

### **"Binding AI needs to be run remotely"**
- ✅ **Solution**: Run `wrangler dev --local` instead of `wrangler dev`
- This disables Cloudflare AI binding and forces Ollama usage

### **"Ollama failed: fetch failed"**
- ✅ **Solution**: Start Ollama server: `ollama serve`
- Verify it's running: `curl http://localhost:11434/api/tags`

### **"Model not found"**
- ✅ **Solution**: Pull the model: `ollama pull llama3.1:8b`
- Check available models: `ollama list`

### **Slow local transformations**
- ✅ **Solution**: Use smaller models (8B instead of 70B)
- Ensure Ollama has GPU access (check Activity Monitor)

---

## 📦 **Next Steps**

1. ✅ Ollama provider created
2. ✅ Environment detection added
3. ✅ Configuration system created
4. ⏳ Test all transformations locally
5. ⏳ Update documentation
6. ⏳ Deploy to production

---

**Questions?** Check the implementation files or test with curl commands above.
