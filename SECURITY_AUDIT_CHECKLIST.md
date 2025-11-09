# Security Audit Checklist (Post-Handoff)

**Priority**: 🔴 CRITICAL before V2 production deployment
**Last Updated**: Nov 9, 2025
**Status**: ⏳ PENDING

## Authentication & Authorization

### Workbench Auth
- [ ] Verify workbench requires authentication before API calls
- [ ] Test JWT token validation on all V1/V2 endpoints
- [ ] Check token expiration handling
- [ ] Verify logout clears all sensitive state (localStorage, sessionStorage)
- [ ] Test session hijacking resistance
- [ ] Verify CORS policy is restrictive (not `*`)

### WebAuthn Security
- [ ] Re-audit WebAuthn implementation (already deployed, but verify)
- [ ] Check credential storage security
- [ ] Verify challenge randomness
- [ ] Test device revocation flow

## Input Validation

### V2 API Endpoints
- [ ] All text inputs: max length enforcement
- [ ] JSON payloads: schema validation with Zod
- [ ] File uploads: type validation, size limits
- [ ] Query parameters: whitelist validation
- [ ] Regex inputs: DoS protection (ReDoS)

### Frontend Inputs
- [ ] XSS prevention in all user-generated content
  - [ ] Voice input transcripts
  - [ ] Transformation results
  - [ ] History panel content
  - [ ] Gem Vault titles/snippets
- [ ] HTML sanitization (DOMPurify) on all dynamic content
- [ ] Markdown rendering: verify remark-gfm doesn't allow XSS

## Output Encoding

- [ ] API responses: proper Content-Type headers
- [ ] Error messages: no sensitive info leakage
- [ ] Stack traces disabled in production
- [ ] JSON responses: proper escaping

## CSRF Protection

- [ ] Verify all state-changing endpoints require CSRF tokens
- [ ] Check SameSite cookie attributes
- [ ] Test CORS preflight for sensitive operations

## Rate Limiting

- [ ] Implement rate limiting on V2 endpoints
  - [ ] /v2/eval/povm: X requests/min per user
  - [ ] /v2/eval/rho: X requests/min per user
  - [ ] /v2/transform/rho-move: X requests/min per user
- [ ] Test quota enforcement (FREE/MEMBER/PRO/PREMIUM)
- [ ] Verify graceful degradation on limit reached

## Data Protection

### Sensitive Data
- [ ] Verify JWT secrets are in Wrangler secrets (not env vars)
- [ ] Check API keys are encrypted at rest in D1
- [ ] Verify password hashing is PBKDF2 (already deployed)
- [ ] No secrets in git history
- [ ] No secrets in logs

### localStorage Security
- [ ] TransformationStateContext: contains no secrets
- [ ] Voice transcripts: user aware of browser storage
- [ ] Clear localStorage on logout
- [ ] Test private browsing mode compatibility

## Dependency Security

### NPM Audit
- [ ] Run `npm audit` in cloud-frontend: 0 vulnerabilities
- [ ] Run `npm audit` in cloud-workbench: 0 vulnerabilities
- [ ] Run `pnpm audit` in workbench: 0 vulnerabilities
- [ ] Review React 19 security advisories
- [ ] Review Vite 7 security advisories
- [ ] Review Tailwind 4.1 security advisories

### Workers Dependencies
- [ ] Check Wrangler 4.46.0 advisories
- [ ] Review Hono framework vulnerabilities
- [ ] Check @simplewebauthn 13.2.2 advisories

## API Security

### V2 Endpoint Hardening
- [ ] SQL injection: verify parameterized queries
- [ ] NoSQL injection: validate D1 query builders
- [ ] Command injection: no shell commands from user input
- [ ] Path traversal: validate file paths
- [ ] SSRF: validate external URL fetching

### Error Handling
- [ ] Proper error status codes (not 200 for errors)
- [ ] Error messages don't leak system info
- [ ] Stack traces only in dev mode
- [ ] Rate limit on error responses

## Voice Feature Security

### Web Speech API
- [ ] Verify microphone permissions are explicit
- [ ] No voice data sent to external servers (browser-local only)
- [ ] Test malicious transcript injection
- [ ] Verify transcript sanitization before storage

### Text-to-Speech
- [ ] Test SSML injection attacks
- [ ] Verify no sensitive data in spoken output
- [ ] Check voice output content filtering

## Workbench-Specific

### Adapter Layer
- [ ] Verify V1/V2 toggle doesn't bypass auth
- [ ] Test VITE_API_VERSION tampering resistance
- [ ] Check adapter error handling doesn't leak info

### Tool Dock Panels
- [ ] POVM Panel: input validation
- [ ] ρ Inspector: output sanitization
- [ ] Gem Vault: verify user can only see own gems
- [ ] Canvas: test content isolation

## Infrastructure

### Cloudflare Workers
- [ ] Verify Workers secrets are set (not in code)
- [ ] Check D1 database permissions
- [ ] Verify KV namespace isolation
- [ ] Test Durable Objects state security

### Deployment
- [ ] HTTPS enforced on all domains
- [ ] Security headers (CSP, X-Frame-Options, etc.)
- [ ] Cookie security (HttpOnly, Secure, SameSite)
- [ ] Subdomain isolation (api.humanizer.com vs humanizer.com)

## Penetration Testing

### Automated Scans
- [ ] Run OWASP ZAP against production
- [ ] Run npm audit on all projects
- [ ] Check Content Security Policy with CSP Evaluator
- [ ] Scan for mixed content warnings

### Manual Testing
- [ ] Test authentication bypass
- [ ] Test authorization bypass (access other users' data)
- [ ] Test session fixation
- [ ] Test XSS in all input fields
- [ ] Test CSRF on all state-changing operations
- [ ] Test SQL injection on all inputs
- [ ] Test file upload vulnerabilities

## Compliance

- [ ] GDPR: user data deletion flow
- [ ] Privacy policy: voice data disclosure
- [ ] Terms of service: API usage limits
- [ ] Cookie consent: localStorage usage

## Monitoring

- [ ] Set up security event logging
- [ ] Alert on repeated auth failures
- [ ] Alert on unusual API usage patterns
- [ ] Monitor for abnormal error rates

## Documentation

- [ ] Document V2 API security model
- [ ] Update CLAUDE.md with security findings
- [ ] Document adapter layer security assumptions
- [ ] Create incident response plan

---

## Execution Plan

1. **Week 1**: Authentication + Input Validation
2. **Week 2**: API hardening + Rate limiting
3. **Week 3**: Dependency audit + Workbench review
4. **Week 4**: Penetration testing + Remediation
5. **Week 5**: Final audit + Sign-off

**Sign-Off Required**: Security lead + Dev lead before V2 production deployment

**Tools Needed**:
- OWASP ZAP
- Burp Suite (optional)
- npm audit
- CSP Evaluator
- SSL Labs

**Budget**: Estimate 40-60 hours for comprehensive audit
