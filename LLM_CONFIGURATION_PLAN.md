# LLM Configuration & AI Vetting System - Implementation Plan

**Date**: January 23, 2026  
**Project**: humanizer-platinum  
**Status**: Planning Phase  
**Priority**: High - Critical for production readiness

---

## 🎯 **EXECUTIVE SUMMARY**

Implement a comprehensive LLM configuration system that:
1. **Unifies** model management across Electron, web, and MCP interfaces
2. **Secures** API key storage with encryption
3. **Vets** all models before production use
4. **Enables** sophisticated prompt engineering and configuration
5. **Provides** development house agents accessible via Claude Code MCP

---

## 🏗️ **ARCHITECTURE OVERVIEW**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON APP (Local Studio)                  │
├─────────────────────────────────────────────────────────────────┤
│  Settings UI → ConfigManager → Encrypted Store                  │
│  Model Testing → Vetting Pipeline → Profile Registry            │
└─────────────────────────────────────────────────────────────────┘
                            ↓ IPC
┌─────────────────────────────────────────────────────────────────┐
│                   CORE SYSTEM (@humanizer/core)                 │
├─────────────────────────────────────────────────────────────────┤
│  ConfigManager → Provider Factory → Model Vetting               │
│  House Agents (Book) + Dev Agents (Code) → MCP Exposure         │
└─────────────────────────────────────────────────────────────────┘
                            ↓ MCP
┌─────────────────────────────────────────────────────────────────┐
│                      CLAUDE CODE ACCESS                         │
├─────────────────────────────────────────────────────────────────┤
│  Development Agents: Architect, Stylist, Security, etc.         │
│  Book Agents: Curator, Builder, Harvester, etc.                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 **PHASE 1: Core Configuration Infrastructure**

### **1.1 Enhanced ConfigManager**

Extend `packages/core/src/config/` with:

**New Files:**
- `encrypted-config.ts` - Encrypted storage for API keys
- `model-config.ts` - LLM model configuration management
- `provider-config.ts` - Provider-specific settings
- `vetting-config.ts` - Model vetting pipeline configuration

**Key Features:**
```typescript
interface LLMConfig {
  providers: {
    openai: { apiKey: string; baseUrl?: string; models: string[] };
    anthropic: { apiKey: string; models: string[] };
    cloudflare: { apiKey: string; accountId: string; models: string[] };
    ollama: { baseUrl: string; models: string[] };
    custom: { name: string; endpoint: string; auth: any }[];
  };
  
  vettingRules: {
    requireVetting: boolean;
    autoVetLocal: boolean;
    vettingPrompts: string[];
    outputFilters: Record<string, FilterRule>;
  };
  
  modelAssignments: {
    [useCase: string]: {
      primary: string;
      fallback: string;
      localFallback: string;
    };
  };
}
```

### **1.2 Secure Storage**

**Encryption Strategy:**
- Use `node:crypto` for AES-256-GCM encryption
- Derive key from OS keychain (Electron's safeStorage)
- Store encrypted config in app data directory
- Never store plaintext API keys

**Implementation:**
```typescript
class EncryptedConfigStore {
  async setApiKey(provider: string, key: string): Promise<void>;
  async getApiKey(provider: string): Promise<string | null>;
  async encrypt(data: any): Promise<string>;
  async decrypt(encrypted: string): Promise<any>;
}
```

---

## 📋 **PHASE 2: Model Vetting Pipeline**

### **2.1 Vetting Framework**

Port and enhance the existing vetting system from narrative-studio:

**Components:**
- `packages/core/src/vetting/model-tester.ts`
- `packages/core/src/vetting/output-analyzer.ts` 
- `packages/core/src/vetting/profile-generator.ts`

**Vetting Tests:**
1. **Basic Functionality**: Can follow simple instructions
2. **Output Cleanliness**: Doesn't add reasoning preambles
3. **Prompt Adherence**: Follows system prompts vs ignores them
4. **Temperature Sensitivity**: Optimal temperature for each use case
5. **Token Efficiency**: Cost per transformation
6. **Error Handling**: Behavior with malformed prompts

### **2.2 Automated Profile Generation**

```typescript
interface VettingResult {
  modelId: string;
  passed: boolean;
  profile: {
    optimalTemperature: number;
    useSystemPrompt: boolean;
    outputDelimiters: string[];
    commonFailurePatterns: string[];
    recommendedUseCases: string[];
    costPerToken: number;
  };
  testResults: {
    testName: string;
    passed: boolean;
    output: string;
    issues: string[];
  }[];
}
```

### **2.3 Continuous Monitoring**

Track model performance in production:
- Success/failure rates per model
- User satisfaction scores
- Cost tracking
- Performance drift detection

---

## 📋 **PHASE 3: Electron Configuration UI**

### **3.1 Settings Interface**

Create comprehensive settings UI in Electron app:

**Main Sections:**
1. **Providers Tab**: API key management, endpoint configuration
2. **Models Tab**: Available models, vetting status, assignments
3. **Vetting Tab**: Run tests, view results, approve models
4. **Advanced Tab**: Prompt templates, output filters, debugging

**Key Components:**
```typescript
// Electron renderer process
interface SettingsWindow {
  providersPanel: ProvidersPanel;
  modelsPanel: ModelsPanel;
  vettingPanel: VettingPanel;
  promptsPanel: PromptsPanel;
}

class ProvidersPanel {
  renderApiKeyInput(provider: string): JSX.Element;
  testConnection(provider: string): Promise<boolean>;
  loadAvailableModels(provider: string): Promise<string[]>;
}
```

### **3.2 Model Testing Interface**

Interactive vetting UI:
- Select models to test
- Run vetting suite
- Review results
- Approve/reject for production
- Generate profiles automatically

### **3.3 Security Features**

- API keys masked in UI (show only last 4 characters)
- "Test Connection" button (doesn't expose full key)
- Export/import encrypted config (for team sharing)
- Audit log of configuration changes

---

## 📋 **PHASE 4: Development House Agents**

### **4.1 Create Development Agent Suite**

Based on the `HouseType` enum in humanizer-gm, create:

**New Agents in `packages/core/src/houses/development/`:**
```typescript
// From humanizer-gm types.ts:
// | 'stylist'          // Writing style management
// | 'architect'        // Structure and patterns  
// | 'security'         // Auth and privacy
// | 'accessibility'    // A11y compliance

export class ArchitectAgent extends AgentBase {
  async reviewArchitecture(codebase: string): Promise<ArchitectureReview>;
  async suggestPatterns(requirements: string): Promise<DesignPattern[]>;
  async validateStructure(files: FileTree): Promise<StructureIssue[]>;
}

export class StylistAgent extends AgentBase {
  async reviewCodeStyle(files: string[]): Promise<StyleReview>;
  async suggestRefactoring(code: string): Promise<RefactoringPlan>;
  async enforceConventions(codebase: string): Promise<ConventionReport>;
}

export class SecurityAgent extends AgentBase {
  async scanVulnerabilities(codebase: string): Promise<SecurityIssue[]>;
  async reviewApiKeys(config: any): Promise<SecurityReport>;
  async validatePermissions(code: string): Promise<PermissionIssue[]>;
}

export class AccessibilityAgent extends AgentBase {
  async auditA11y(components: string[]): Promise<A11yIssue[]>;
  async suggestFixes(issues: A11yIssue[]): Promise<A11yFix[]>;
  async validateAria(jsx: string): Promise<AriaReport>;
}
```

### **4.2 Additional Development Agents**

Create domain-specific development agents:

```typescript
export class DataAgent extends AgentBase {
  async reviewSchema(schema: string): Promise<SchemaReview>;
  async optimizeQueries(sql: string): Promise<QueryOptimization>;
  async validateMigrations(migrations: string[]): Promise<MigrationIssues>;
}

export class TestingAgent extends AgentBase {
  async generateTests(code: string): Promise<TestSuite>;
  async reviewCoverage(coverage: CoverageReport): Promise<CoverageAnalysis>;
  async suggestTestCases(spec: string): Promise<TestCase[]>;
}

export class PerformanceAgent extends AgentBase {
  async profileCode(codebase: string): Promise<PerformanceProfile>;
  async suggestOptimizations(profile: PerformanceProfile): Promise<Optimization[]>;
  async reviewBundleSize(bundle: BundleAnalysis): Promise<BundleReport>;
}

export class DocAgent extends AgentBase {
  async generateDocs(code: string): Promise<Documentation>;
  async reviewDocs(existing: string): Promise<DocReview>;
  async validateExamples(examples: CodeExample[]): Promise<ExampleValidation>;
}
```

### **4.3 MCP Interface for Development Agents**

Expose development agents via MCP for Claude Code:

**New MCP Tools:**
```typescript
// In packages/core/src/mcp/development-tools.ts
export const developmentTools = [
  {
    name: "review_architecture",
    description: "Review codebase architecture and suggest improvements",
    inputSchema: {
      type: "object",
      properties: {
        files: { type: "array", items: { type: "string" } },
        focus: { type: "string", enum: ["patterns", "structure", "coupling"] }
      }
    }
  },
  {
    name: "audit_security", 
    description: "Scan code for security vulnerabilities",
    inputSchema: {
      type: "object",
      properties: {
        codebase: { type: "string" },
        scanType: { type: "string", enum: ["api-keys", "xss", "injection", "permissions"] }
      }
    }
  },
  {
    name: "review_accessibility",
    description: "Audit frontend components for accessibility issues",
    inputSchema: {
      type: "object", 
      properties: {
        components: { type: "array", items: { type: "string" } },
        standards: { type: "string", enum: ["WCAG-2.1-AA", "WCAG-2.2-AA"] }
      }
    }
  }
  // ... more tools
];
```

---

## 📋 **PHASE 5: Integration & Testing**

### **5.1 Electron IPC Bridge**

Connect Electron UI to core system:

```typescript
// In Electron main process
class LLMConfigBridge {
  async getConfig(): Promise<LLMConfig>;
  async updateConfig(config: Partial<LLMConfig>): Promise<void>;
  async testModel(modelId: string): Promise<VettingResult>;
  async runVettingSuite(modelIds: string[]): Promise<VettingResult[]>;
}
```

### **5.2 MCP Server Integration**

Ensure MCP server exposes all agents:
```json
// ~/.claude_desktop_config.json
{
  "mcpServers": {
    "humanizer-platinum": {
      "command": "node",
      "args": ["packages/core/dist/mcp/server.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

### **5.3 Testing Strategy**

**Unit Tests:**
- ConfigManager encryption/decryption
- Model vetting pipeline
- Agent message handling

**Integration Tests:**
- Electron IPC communication
- MCP tool execution
- Provider authentication

**End-to-End Tests:**
- Full configuration flow in Electron
- Claude Code agent interaction
- Model switching and fallbacks

---

## 📋 **PHASE 6: Advanced Features**

### **6.1 Prompt Engineering Suite**

Advanced prompt management:
- Template library with variables
- A/B testing framework for prompts  
- Performance tracking per prompt version
- Collaborative prompt development

### **6.2 Cost Management**

Token usage tracking and budgeting:
- Per-model cost tracking
- Daily/monthly budget limits
- Cost optimization suggestions
- Cheapest-viable-model routing

### **6.3 Multi-Environment Support**

Configuration profiles:
- Development vs Production model assignments
- Team configuration sharing
- Environment-specific API keys
- Staged rollout of new models

---

## 🚀 **IMPLEMENTATION TIMELINE**

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1** | 1 week | Enhanced ConfigManager, encrypted storage |
| **Phase 2** | 1 week | Model vetting pipeline, automated profiles |
| **Phase 3** | 2 weeks | Electron settings UI, testing interface |
| **Phase 4** | 2 weeks | Development house agents, MCP integration |
| **Phase 5** | 1 week | Integration testing, bug fixes |
| **Phase 6** | 2 weeks | Advanced features, polish |

**Total**: ~9 weeks

---

## 🎯 **SUCCESS CRITERIA**

**✅ Configuration Management:**
- [ ] Secure API key storage with encryption
- [ ] Multi-provider support (OpenAI, Anthropic, Cloudflare, Ollama, custom)
- [ ] Intuitive Electron configuration UI
- [ ] Export/import encrypted configurations

**✅ Model Vetting:**
- [ ] Automated vetting pipeline for new models
- [ ] Model performance profiles with optimization settings
- [ ] Continuous monitoring and drift detection
- [ ] Approval workflow for production models

**✅ Development Agents:**
- [ ] 8 development house agents (architect, stylist, security, accessibility, data, testing, performance, documentation)
- [ ] MCP exposure for Claude Code integration
- [ ] Proper separation from book-making agents
- [ ] Comprehensive testing and validation

**✅ Integration:**
- [ ] Seamless Electron ↔ Core system communication
- [ ] Reliable MCP server with development tools
- [ ] Fallback handling for offline/failed models
- [ ] Comprehensive error handling and user feedback

---

## 🔐 **SECURITY CONSIDERATIONS**

**API Key Protection:**
- AES-256-GCM encryption for stored keys
- OS keychain integration for master key
- No plaintext keys in logs or memory dumps
- Key rotation capabilities

**Network Security:**
- Certificate pinning for API endpoints
- Request/response validation
- Rate limiting to prevent abuse
- Secure proxy support

**Code Security:**
- Input sanitization for all prompts
- Output validation and filtering
- Sandboxed execution for custom providers
- Security audit trails

---

## 🔍 **MONITORING & OBSERVABILITY**

**Metrics to Track:**
- Model success/failure rates
- Response times by provider
- Token usage and costs
- User satisfaction scores
- Vetting pipeline effectiveness

**Alerting:**
- Model performance degradation
- Unusual cost spikes
- Authentication failures
- Vetting pipeline failures

**Dashboards:**
- Real-time model performance
- Cost tracking and budgets
- Vetting status overview
- User adoption metrics

---

## 🚦 **RISK MITIGATION**

**Technical Risks:**
- **API Changes**: Implement adapter pattern for provider APIs
- **Model Deprecation**: Maintain fallback models for each use case
- **Performance Issues**: Implement caching and request batching
- **Security Breaches**: Regular security audits and penetration testing

**Business Risks:**
- **Cost Overruns**: Implement hard budget limits and alerting
- **Quality Degradation**: Continuous monitoring and rollback capabilities
- **User Experience**: Comprehensive testing and user feedback loops
- **Vendor Lock-in**: Multi-provider architecture with easy switching

---

## 📚 **REFERENCE IMPLEMENTATION**

**Build on Existing Systems:**
- Leverage narrative-studio's LLM architecture patterns
- Extend @humanizer/core's ConfigManager
- Follow humanizer-gm's agent patterns
- Integrate with established MCP server framework

**Key Dependencies:**
- `@humanizer/core` - Agent infrastructure
- `electron` - Desktop application framework  
- `node:crypto` - Encryption capabilities
- MCP SDK - Claude Code integration
- Existing provider libraries (OpenAI SDK, etc.)

---

**Next Step**: Begin Phase 1 implementation with enhanced ConfigManager and encrypted storage.