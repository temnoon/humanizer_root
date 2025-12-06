# Technical Debt Tracker - Narrative Studio

**Last Updated**: 2025-12-05
**Total Items**: 35
**Status**: Pre-Launch Audit

---

## Summary

This document tracks technical debt across the narrative-studio codebase. Items are categorized by severity and organized by system area.

**By Severity**:
- **Critical** (Blocking Launch): 8 items
- **High** (Launch Risk): 12 items
- **Medium** (Post-Launch): 10 items
- **Low** (Polish): 5 items

---

## Critical (Blocking Launch)

### DEBT-001: Hardcoded localhost URLs Throughout Codebase
- **Location**: Multiple files (19 occurrences)
- **Type**: Hardcoded configuration
- **Severity**: Critical
- **Created**: Unknown
- **Effort**: Medium (4-6 hours)
- **Description**: Multiple hardcoded localhost URLs in source files instead of using environment variables
- **Files**:
  - `src/services/embeddingService.ts:8` - `http://localhost:3002`
  - `src/services/ollamaService.ts:8` - `http://localhost:11434`
  - `src/services/gptzeroService.ts:9` - `http://localhost:8787`
  - `src/components/archive/FacebookFeedView.tsx:4`
  - `src/components/archive/ArchiveSelector.tsx:3`
  - `src/components/panels/ArchivePanel.tsx:18,151`
  - `src/components/archive/ImportArchiveButton.tsx:4`
  - `src/components/panels/StudioToolsPanel.tsx:52`
  - And 11+ more files
- **Why**: Development convenience
- **Fix**: Create environment variable configuration system, centralize all URLs in config file

### DEBT-002: Duplicate API Base URL Definitions
- **Location**: 8 files
- **Type**: Code duplication
- **Severity**: Critical
- **Created**: Unknown
- **Effort**: Small (1-2 hours)
- **Description**: API base URL fallback pattern repeated in 8 different files
- **Pattern**: `import.meta.env.VITE_API_BASE_URL || 'https://npe-api.tem-527.workers.dev'`
- **Files**:
  - `src/services/booksService.ts:8`
  - `src/components/tools/AdminProfilesPane.tsx:14`
  - `src/utils/api.ts:15`
  - `src/components/tools/ProfileFactoryPane.tsx:17`
  - `src/components/tools/FeedbackWidget.tsx:236`
  - `src/components/auth/LoginPage.tsx:5`
- **Why**: No centralized configuration
- **Fix**: Create `src/config/api.ts` with single source of truth for API URLs

### DEBT-003: Feedback System Incomplete (localStorage Only)
- **Location**: `src/services/transformationPipeline.ts:414`
- **Type**: Stub implementation
- **Severity**: Critical
- **Created**: Unknown
- **Effort**: Medium (4-6 hours)
- **Description**: User feedback only logged to console with TODO to send to backend
- **Code**: `// TODO: Send to feedbackService.storeFeedback(feedback)`
- **Also**: `src/components/tools/FeedbackWidget.tsx:95` - Stores in localStorage with comment "will be synced to backend later"
- **Why**: Backend feedback endpoint not implemented
- **Fix**:
  1. Create `feedbackService.ts` with API integration
  2. Implement backend `/api/feedback` endpoint
  3. Add sync mechanism for offline feedback
  4. Add admin dashboard to review feedback

### DEBT-004: Production Console Logging (100+ instances)
- **Location**: Throughout codebase
- **Type**: Debug code
- **Severity**: Critical
- **Created**: Unknown
- **Effort**: Medium (3-4 hours)
- **Description**: console.log/warn/error statements in production code
- **Examples**:
  - `src/services/transformationPipeline.ts:122,252,298,412`
  - `src/services/archiveService.ts:153,199`
  - `src/services/exportService.ts:87,89,119,121,290,334,337,425,427`
  - `src/services/modelProfileRegistry.ts:304,320`
  - Many more throughout codebase
- **Why**: Debugging during development
- **Fix**:
  1. Replace with proper logging service
  2. Add log levels (debug, info, warn, error)
  3. Implement environment-based filtering
  4. Consider using a logger library (e.g., pino, winston)

### DEBT-005: Mock Path in SetupWizard
- **Location**: `src/components/onboarding/SetupWizard.tsx:39`
- **Type**: Mock/fallback
- **Severity**: Critical
- **Created**: Unknown
- **Effort**: Small (1 hour)
- **Description**: Browser test mode uses mock path instead of proper handling
- **Code**: `// Browser test mode - use mock path`
- **Why**: Development testing without Electron
- **Fix**: Either properly handle browser mode or disable wizard in browser builds

### DEBT-006: Legacy/Deprecated Code Still Active
- **Location**: Multiple files
- **Type**: Legacy code
- **Severity**: Critical
- **Created**: Unknown
- **Effort**: Large (8+ hours)
- **Description**: Multiple legacy code paths and deprecated functions still in use
- **Items**:
  - `src/services/ollamaService.ts:347` - `stripThinkingPreamble` marked DEPRECATED but still used
  - `src/services/transformationService.ts:793` - Allegorical transformation "Legacy support - will be removed"
  - `src/components/workspace/MainWorkspace.tsx:45,86,89,102,159` - "Legacy for non-session workflow"
- **Why**: Backwards compatibility during migration
- **Fix**:
  1. Complete migration to new systems
  2. Remove all legacy code paths
  3. Update documentation
  4. Test all workflows with new implementations

### DEBT-007: Incomplete Facebook Reactions Implementation
- **Location**: `src/services/facebook/DatabaseImporter.ts:128`
- **Type**: Incomplete feature
- **Severity**: Critical (if Facebook import is launch feature)
- **Created**: Unknown
- **Effort**: Large (8+ hours)
- **Description**: Reactions require linking phase, currently skipped
- **Code**: `// Skipping reactions for now - they require a linking phase to match`
- **Also**: `src/services/facebook/ReactionsParser.ts:82,86` - content_item_id set to empty string "Will be set during linking phase"
- **Why**: Complex matching logic not yet implemented
- **Fix**:
  1. Implement linking algorithm to match reactions to posts/comments
  2. Add reaction indexing after linking
  3. Test with real Facebook export data

### DEBT-008: Placeholder Anchor Visualization
- **Location**: `src/contexts/ExploreContext.tsx:281`
- **Type**: Stub implementation
- **Severity**: High (if Explore tab is launch feature)
- **Created**: Unknown
- **Effort**: Large (12+ hours)
- **Description**: t-SNE/UMAP projection not implemented, only placeholder
- **Code**: `// TODO: Implement t-SNE/UMAP projection via backend API`
- **Why**: Complex ML feature deferred
- **Fix**:
  1. Implement backend projection endpoint
  2. Add frontend 2D/3D visualization
  3. Consider using Three.js or similar library

---

## High (Launch Risk)

### DEBT-009: Error Handling - Silent Failures
- **Location**: Multiple files
- **Type**: Poor error handling
- **Severity**: High
- **Created**: Unknown
- **Effort**: Medium (4-6 hours)
- **Description**: Several catch blocks that swallow errors or provide minimal context
- **Examples**:
  - `src/services/gptzeroService.ts:75` - `catch(() => ({}))`
  - `src/services/booksService.ts:40` - `catch(() => ({ error: response.statusText }))`
  - `src/services/modelProfileRegistry.ts:304,320` - Catches errors and only warns
  - `src/services/ollamaService.ts:412` - Returns null on error
- **Why**: Quick error suppression during development
- **Fix**: Implement proper error handling strategy with user feedback

### DEBT-010: localStorage Persistence Without Migration Strategy
- **Location**: 20+ files
- **Type**: Data management risk
- **Severity**: High
- **Created**: Unknown
- **Effort**: Medium (4-6 hours)
- **Description**: Extensive use of localStorage without version control or migration
- **Files**:
  - `src/services/modelProfileRegistry.ts:292,318`
  - `src/App.tsx:55,59,63,76,106,111,115,120,277`
  - `src/data/sampleNarratives.ts:90,92`
  - `src/contexts/ThemeContext.tsx:20,34`
  - `src/utils/api.ts:31,60,61,68`
- **Why**: Simple state persistence
- **Fix**:
  1. Add version field to all localStorage schemas
  2. Implement migration system
  3. Add validation for corrupt/old data
  4. Document all localStorage keys

### DEBT-011: Temporary Workarounds and "For Now" Comments
- **Location**: 19+ instances
- **Type**: Temporary solutions
- **Severity**: High
- **Created**: Various
- **Effort**: Large (depends on items)
- **Description**: Multiple "for now" comments indicating temporary solutions
- **Items**:
  - `src/services/transformationPipeline.ts:411` - "For now, log to console - will be stored properly later"
  - `src/services/facebook/FileOrganizer.ts:62` - "all in one file for now"
  - `src/services/facebook/test-with-database.ts:75,76` - "Empty for now"
  - `src/services/parser/OpenAIParser.ts:90` - "For now, return null"
  - `src/components/archive/ImportArchiveButton.tsx:45` - Simple refresh instead of proper state update
  - Many more
- **Why**: Incremental development
- **Fix**: Review each item, implement proper solutions

### DEBT-012: Inconsistent Timeout Values
- **Location**: `src/services/transformationService.ts`
- **Type**: Configuration inconsistency
- **Severity**: High
- **Created**: Unknown
- **Effort**: Small (1-2 hours)
- **Description**: Hardcoded timeout values vary widely (60s, 90s, 120s, 300s, 600s)
- **Examples**:
  - AI Detection: 60 seconds (line 264)
  - GPTZero: 90 seconds (line 378)
  - Computer Humanizer: 120 seconds (line 135)
  - Persona/Style: 300 seconds (lines 498, 587)
  - Round-trip: 600 seconds (line 747)
- **Why**: Ad-hoc timeout selection per feature
- **Fix**:
  1. Create timeout configuration object
  2. Document timeout rationale
  3. Make timeouts configurable per user tier

### DEBT-013: Provider Health Check Hardcoded
- **Location**: `src/contexts/ProviderContext.tsx:61`
- **Type**: Hardcoded URL
- **Severity**: High
- **Created**: Unknown
- **Effort**: Small (1 hour)
- **Description**: Health check URL hardcoded to localhost:8787
- **Code**: `fetch('http://localhost:8787/health', { signal: AbortSignal.timeout(2000) })`
- **Why**: Quick implementation
- **Fix**: Use centralized API configuration

### DEBT-014: Comment Content Item ID Placeholder
- **Location**: `src/services/facebook/ReactionsParser.tsx:86`
- **Type**: Incomplete implementation
- **Severity**: High
- **Created**: Unknown
- **Effort**: Part of DEBT-007
- **Description**: content_item_id set to empty string pending linking phase
- **Code**: `content_item_id: '', // Will be set during linking phase`
- **Why**: Linking algorithm not yet implemented
- **Fix**: See DEBT-007

### DEBT-015: Archive Server Reload Instead of State Update
- **Location**: `src/components/archive/ImportArchiveButton.tsx:45`
- **Type**: Workaround
- **Severity**: High
- **Created**: Unknown
- **Effort**: Small (2 hours)
- **Description**: Uses window.location.reload() instead of proper state update
- **Code**: `window.location.reload(); // Simple refresh for now`
- **Why**: Quick solution to refresh UI after import
- **Fix**: Implement proper state synchronization and UI update

### DEBT-016: Error Messages Reference Specific Backends
- **Location**: `src/components/tools/ToolPanes.tsx`
- **Type**: Configuration coupling
- **Severity**: High
- **Created**: Unknown
- **Effort**: Small (1 hour)
- **Description**: Error messages hardcode "localhost:8787" in user-facing text
- **Lines**: 86, 306, 519, 711
- **Example**: `'Local backend (localhost:8787) is not available. Start it with: npx wrangler dev --local'`
- **Why**: Development-focused error messages
- **Fix**: Use environment-aware error messages

### DEBT-017: Clustering Service Index Placeholder
- **Location**: `src/services/embeddings/ClusteringService.ts:271`
- **Type**: Workaround
- **Severity**: Medium (upgrade if clustering is critical)
- **Created**: Unknown
- **Effort**: Small (2 hours)
- **Description**: Comment indicates using raw update instead of proper method
- **Code**: `// (Would need a method for this, using raw update for now)`
- **Why**: Quick implementation
- **Fix**: Implement proper update method in database layer

### DEBT-018: Sentence Index Same as Chunk Index
- **Location**: `src/services/embeddings/ArchiveIndexer.ts:323`
- **Type**: Simplification
- **Severity**: Medium
- **Created**: Unknown
- **Effort**: Medium (4 hours)
- **Description**: sentence_index set to same value as chunk_index
- **Code**: `i,  // sentence_index same as chunk_index for now`
- **Why**: Simplified chunking strategy
- **Fix**: Implement proper sentence-level indexing if needed for features

### DEBT-019: Facebook Test Database Placeholder
- **Location**: `src/services/facebook/test-with-database.ts:75-76`
- **Type**: Stub
- **Severity**: Medium
- **Created**: Unknown
- **Effort**: Medium (depends on requirements)
- **Description**: Empty embeddings array with comment about needing EmbeddingGenerator
- **Code**: `[],  // Empty for now - would need EmbeddingGenerator`
- **Why**: Test file
- **Fix**: Either complete the test or remove the file if not needed

### DEBT-020: OpenAI Parser Null Return
- **Location**: `src/services/parser/OpenAIParser.ts:90`
- **Type**: Incomplete error handling
- **Severity**: Medium
- **Created**: Unknown
- **Effort**: Small (2 hours)
- **Description**: Returns null with comment "caller should handle this differently"
- **Code**: `// For now, return null - caller should handle this differently`
- **Why**: Unclear error handling strategy
- **Fix**: Define proper error handling contract and implement

---

## Medium (Post-Launch)

### DEBT-021: Temporary Working Directory
- **Location**: `src/services/parser/ConversationParser.ts:48`
- **Type**: Resource management
- **Severity**: Medium
- **Created**: Unknown
- **Effort**: Small (2 hours)
- **Description**: Creates temporary working directory, cleanup required
- **Code**: Comments about "temporary working directory" and "Cleanup temporary directory"
- **Why**: File processing workflow
- **Fix**: Ensure cleanup always happens (use try/finally), consider using OS temp directory

### DEBT-022: Default User ID Fallback in API
- **Location**: `src/utils/api.ts:171`
- **Type**: Fallback logic
- **Severity**: Medium
- **Created**: Unknown
- **Effort**: Small (1 hour)
- **Description**: Comment indicates loading from localStorage "for now"
- **Code**: `// For now, load from localStorage`
- **Why**: Simple state management
- **Fix**: Clarify if this is permanent or should use different source

### DEBT-023: Comprehensive Media Matcher Simplified Logic
- **Location**: `src/services/parser/IncrementalImporter.ts:375`
- **Type**: Simplification
- **Severity**: Medium
- **Created**: Unknown
- **Effort**: Medium (4 hours)
- **Description**: Comment about tracking usage for multiple same-size files "simplified for now"
- **Code**: `// (for multiple same-size files, we'd need to track usage - simplified for now)`
- **Why**: Edge case handling deferred
- **Fix**: Implement proper tracking if users report issues with media matching

### DEBT-024: Anchor Manager Display-Only
- **Location**: `src/components/archive/AnchorManagerView.tsx:623`
- **Type**: Incomplete feature
- **Severity**: Medium
- **Created**: Unknown
- **Effort**: Medium (4-6 hours)
- **Description**: Comment "For now just display" suggests missing functionality
- **Code**: `// For now just display`
- **Why**: Incremental feature development
- **Fix**: Determine required functionality and implement

### DEBT-025: Facebook Reactions in Single File
- **Location**: `src/services/facebook/FileOrganizer.ts:62`
- **Type**: Simplification
- **Severity**: Medium
- **Created**: Unknown
- **Effort**: Medium (4 hours)
- **Description**: All reactions in one file instead of organized by timestamp
- **Code**: `// Organize reactions (all in one file for now, they don't have reliable timestamps)`
- **Why**: Lack of timestamp data
- **Fix**: Implement smarter organization strategy or accept single-file approach

### DEBT-026: Skipped Hidden Folders
- **Location**: `src/services/embeddings/ConversationWalker.ts:48`
- **Type**: Assumption
- **Severity**: Low (upgrade if users need hidden files)
- **Created**: Unknown
- **Effort**: Trivial (5 minutes)
- **Description**: Skips folders starting with '.'
- **Code**: `if (entry.name.startsWith('.')) continue;  // Skip hidden folders`
- **Why**: Standard practice
- **Fix**: Add configuration option if users need hidden file support

### DEBT-027: Unicode Decoding Note
- **Location**: `src/services/facebook/PostsParser.ts:189-190`
- **Type**: Documentation
- **Severity**: Low
- **Created**: Unknown
- **Effort**: N/A (informational)
- **Description**: Comment about Facebook Latin-1 encoding
- **Code**: `* Facebook uses \u00XX for Latin-1 characters which should be decoded`
- **Why**: Documentation
- **Fix**: None needed, but verify decoding works correctly

### DEBT-028: Cluster Name Labeling Deferred
- **Location**: `src/services/embeddings/ClusteringService.ts:259`
- **Type**: Incomplete feature
- **Severity**: Low
- **Created**: Unknown
- **Effort**: Medium (4-6 hours)
- **Description**: Cluster names set to null "Will be labeled later"
- **Code**: `name: null,  // Will be labeled later`
- **Why**: Automatic labeling complex
- **Fix**: Implement LLM-based cluster naming or allow manual naming

### DEBT-029: Skipped Archive Folders
- **Location**: `src/services/embeddings/ConversationWalker.ts:61`
- **Type**: Error handling
- **Severity**: Low
- **Created**: Unknown
- **Effort**: Small (1 hour)
- **Description**: Skips folders without valid conversation.json
- **Code**: `// Skip folders without valid conversation.json`
- **Why**: Data validation
- **Fix**: Add logging for skipped folders to help users debug

### DEBT-030: Media Matching Ambiguity Skipped
- **Location**: `src/services/parser/ComprehensiveMediaMatcher.ts:239,241`
- **Type**: Conservative matching
- **Severity**: Low
- **Created**: Unknown
- **Effort**: Medium (6+ hours)
- **Description**: Skips ambiguous size matches instead of attempting to resolve
- **Code**: `this.log(\`    Skipping ambiguous size match: ${sizeBytes} bytes - ${candidateFiles.length} candidates\`)`
- **Why**: Risk of incorrect matches
- **Fix**: Implement advanced heuristics (metadata, timestamps, etc.) to resolve ambiguity

---

## Low (Polish)

### DEBT-031: Fallback to Alphabetical Sorting
- **Location**: `src/components/panels/ArchivePanel.tsx:611`
- **Type**: Fallback behavior
- **Severity**: Low
- **Created**: Unknown
- **Effort**: Trivial
- **Description**: Comment "Fallback to alphabetical"
- **Why**: Default sorting
- **Fix**: None needed unless better default desired

### DEBT-032: Skip Noise in Clustering
- **Location**: `src/services/embeddings/ClusteringService.ts:129`
- **Type**: Algorithm behavior
- **Severity**: Low
- **Created**: Unknown
- **Effort**: N/A
- **Description**: Skips noise points (label === -1)
- **Code**: `if (label === -1) continue; // Skip noise`
- **Why**: Standard HDBSCAN behavior
- **Fix**: None needed, but consider UI to show noise points

### DEBT-033: Skipped Sampled Points
- **Location**: `src/services/embeddings/ClusteringService.ts:190`
- **Type**: Algorithm implementation
- **Severity**: Low
- **Created**: Unknown
- **Effort**: N/A
- **Description**: Skips already-sampled points during anchor selection
- **Code**: `if (sampledSet.has(i)) continue; // Skip sampled points`
- **Why**: Correct algorithm behavior
- **Fix**: None needed

### DEBT-034: Non-existent Source Directory Log
- **Location**: `src/services/parser/ComprehensiveMediaIndexer.ts:118`
- **Type**: Logging
- **Severity**: Low
- **Created**: Unknown
- **Effort**: Trivial
- **Description**: Logs skipped directories
- **Code**: `this.log(\`Skipping non-existent source directory: ${sourceDir}\`)`
- **Why**: User feedback
- **Fix**: None needed

### DEBT-035: Already-organized Files Skipped
- **Location**: `src/services/parser/OpenAIParser.ts:64`
- **Type**: Optimization
- **Severity**: Low
- **Created**: Unknown
- **Effort**: N/A
- **Description**: Skips files that are already organized
- **Code**: `console.log(\`[OpenAIParser] Skipping already-organized: ${filePath}\`)`
- **Why**: Idempotent behavior
- **Fix**: None needed

---

## Patterns and Themes

### 1. Configuration Management
- **Issue**: Widespread hardcoding of URLs, timeouts, and configuration values
- **Impact**: Difficult to deploy to different environments
- **Solution**: Centralized configuration system with environment variables

### 2. Error Handling
- **Issue**: Inconsistent error handling, some silent failures, production console logging
- **Impact**: Difficult to debug issues in production
- **Solution**: Unified logging/error handling strategy

### 3. Incomplete Features
- **Issue**: Multiple "for now" placeholders and TODOs
- **Impact**: Features may not work as expected
- **Solution**: Complete or remove incomplete features before launch

### 4. Legacy Code
- **Issue**: Deprecated code paths still in use
- **Impact**: Maintenance burden, potential bugs
- **Solution**: Complete migration, remove old code

### 5. Data Persistence
- **Issue**: localStorage used extensively without migration strategy
- **Impact**: Risk of data corruption when schema changes
- **Solution**: Version all persisted data, implement migrations

---

## Launch Readiness Checklist

### Must Fix Before Launch (Critical)
- [ ] DEBT-001: Centralize URL configuration
- [ ] DEBT-002: Single source for API URLs
- [ ] DEBT-003: Complete feedback system or remove UI
- [ ] DEBT-004: Replace console.log with proper logging
- [ ] DEBT-005: Handle browser mode properly in SetupWizard
- [ ] DEBT-006: Remove all legacy code paths
- [ ] DEBT-007: Complete Facebook reactions or hide feature
- [ ] DEBT-008: Complete visualization or hide feature

### Should Fix Before Launch (High)
- [ ] DEBT-009: Improve error handling
- [ ] DEBT-010: Add localStorage versioning
- [ ] DEBT-011: Review all "for now" comments
- [ ] DEBT-012: Standardize timeout configuration
- [ ] DEBT-013: Fix provider health check
- [ ] DEBT-015: Proper state update after import
- [ ] DEBT-016: Environment-aware error messages

### Can Defer to Post-Launch (Medium/Low)
- All Medium and Low severity items can be addressed iteratively

---

## Recommendations

### Immediate Actions (Next 2-3 Days)
1. **Create configuration service** (`src/config/api.ts`, `src/config/timeouts.ts`)
2. **Implement logging service** (`src/services/logger.ts`)
3. **Audit and remove/complete** all TODO comments
4. **Review localStorage usage** and add versioning

### Short-term (Next 1-2 Weeks)
1. Complete or hide incomplete features (Facebook reactions, visualizations)
2. Remove all legacy code paths
3. Standardize error handling patterns
4. Add environment variable documentation

### Long-term (Post-Launch)
1. Implement proper backend feedback system
2. Add data migration framework
3. Enhance media matching algorithms
4. Add admin tools for debugging user issues

---

## Notes

- This audit was performed on 2025-12-05
- Codebase is in pre-launch state with 239 signups waiting
- Many items are intentional shortcuts that were acceptable during development
- No critical security issues found (no exposed credentials, no unsafe code)
- Overall code quality is good, just needs production hardening

**Next Steps**: Review this document with team, prioritize items, and assign owners.
