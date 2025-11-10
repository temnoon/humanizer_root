 Ready to code?

 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Cloud Workbench M4 - Complete NPE Integration Plan

 Goal

 Wire Canvas → Tool Dock integration for all NPE transformations and analysis tools, with dual backend support (local FastAPI + remote Workers),
 conditional authentication, and comprehensive persistence/history management.

 ---
 Phase 1: Foundation - Canvas Context & Backend Toggle (3-4 hours)

 1.1 Create CanvasContext (1 hour)

 File: src/core/context/CanvasContext.tsx (~120 lines)

 State:
 - text: string - Full Canvas content
 - selectedText: string | null - User-highlighted portion
 - sourceType: 'full' | 'selection' - What gets sent to tools
 - setText(), setSelectedText(), clearSelection()

 Integration:
 - Add text selection handler to Canvas.tsx
 - "Send to Tool" button (appears on text selection)
 - Wire ArchiveBrowser "Load to Canvas" → setText()

 1.2 Dual Backend Support (2-3 hours)

 File: src/core/adapters/api.ts (+200 lines)

 Add local API implementation:
 const localAPI: WorkbenchAPI = {
   // Allegorical
   allegorical: (req) => localHttp.post('api/transformations/allegorical', { json: req }).json(),

   // Round-Trip
   roundTrip: (req) => localHttp.post('api/transformations/round-trip', { json: req }).json(),

   // AI Detection
   aiDetect: (req) => localHttp.post('api/ai-detection/detect', { json: req }).json(),

   // Personalizer (PRO+)
   personalizer: (req) => localHttp.post('api/transformations/personalizer', { json: req }).json(),

   // Quantum Reading
   quantumStart: (req) => localHttp.post('api/quantum-analysis/start', { json: req }).json(),
   quantumStep: (id) => localHttp.post(`api/quantum-analysis/${id}/step`).json(),

   // POVM/ρ
   evalPOVM: (req) => localHttp.post('api/povm/eval', { json: req }).json(),
   rhoInspect: (req) => localHttp.post('api/rho/inspect', { json: req }).json(),
 };

 const remoteAPI: WorkbenchAPI = {
   // Same methods, pointing to https://api.humanizer.com
 };

 // Runtime selection
 export const api = ApiConfig.processingTarget === 'local' ? localAPI : remoteAPI;

 Add API Toggle UI:
 - Component: src/components/ui/APIToggle.tsx (~80 lines)
 - Dropdown in header: "🌐 Remote (Cloud)" | "💻 Local (FastAPI)"
 - Connection status indicator: "✅ Connected" or "❌ Offline"
 - Persists choice in localStorage
 - Auto-detects local API availability (ping http://localhost:8000/health)

 FastAPI Endpoints (if missing): (~2-3 hours)
 - Create /api/transformations/allegorical route in Python
 - Create /api/transformations/round-trip route
 - Map to existing services (allegorical.py, round_trip.py)
 - Return same schema as Workers API

 ---
 Phase 2: Authentication & Authorization (2 hours)

 2.1 Create AuthContext (1 hour)

 File: src/core/context/AuthContext.tsx (~150 lines)

 State:
 - isAuthenticated: boolean
 - token: string | null
 - user: { email, role, tier } | null
 - login(email, password) - Calls /auth/login
 - logout() - Clear token + user
 - Persist token in localStorage

 Logic:
 - Auth required ONLY when processingTarget === 'remote'
 - Local mode: Skip auth entirely
 - Remote mode: Auto-inject Authorization: Bearer ${token} in all requests
 - 401 interceptor → trigger login modal

 2.2 Create LoginModal (1 hour)

 File: src/components/auth/LoginModal.tsx (~180 lines)

 Copy from cloud-frontend:
 - Email/password form
 - "Login Required for Cloud API" message
 - Register link (optional)
 - Error handling
 - Auto-close on successful login

 Trigger:
 - Switching to remote mode + not authenticated
 - API returns 401 error
 - Clicking protected tool (Personalizer) without auth

 ---
 Phase 3: Transformation Panels (12-15 hours)

 3.1 Allegorical Panel (4-5 hours)

 File: src/features/panels/allegorical/AllegoricalPanel.tsx (~350 lines)

 UI Components:
 1. Input Section:
   - Text input pre-populated from CanvasContext
   - "Use Canvas Text" / "Use Selection" buttons
   - Character counter (max 10k)
 2. Configuration:
   - Persona dropdown - Fetch from /config/personas (5 options)
   - Namespace dropdown - Fetch from /config/namespaces (6 options)
   - Style dropdown - Fetch from /config/styles (5 options)
   - Model selector - Cloudflare models (6) + external if API keys configured
   - Length preference - shorter/same/longer/much_longer
 3. Progress Indicator:
   - 5-stage progress bar: Deconstruct → Map → Reconstruct → Stylize → Reflect
   - Animated during processing
   - Show stage completion times
 4. Results Display:
   - Collapsible sections for each stage
   - Final projection (markdown-rendered with syntax highlighting)
   - Reflection commentary
   - "Load to Canvas" button
   - "Save to History" button (auto-saves, but manual button for clarity)
 5. Error Handling:
   - Quota exceeded messages (tier-based)
   - Network errors
   - Retry mechanism

 API Integration:
 - POST /transformations/allegorical
 - Auto-saves to transformation_history (Workers side)
 - Display transformation_id for reference

 3.2 Round-Trip Panel (2-3 hours)

 File: src/features/panels/round-trip/RoundTripPanel.tsx (~250 lines)

 UI:
 1. Text input (from CanvasContext)
 2. Language dropdown - 18 languages from /config/languages
 3. "Analyze Drift" button

 Results:
 - Forward translation (language name + text)
 - Backward translation with diff highlighting (react-diff-viewer)
 - Semantic drift gauge (0-100%, color-coded)
 - Preserved elements (green chips)
 - Lost elements (red chips with strikethrough)
 - Gained elements (blue chips)
 - "Load Backward Translation to Canvas" button

 API: POST /transformations/round-trip

 3.3 AI Detection Panel (2 hours)

 File: src/features/panels/ai-detection/AIDetectionPanel.tsx (~220 lines)

 UI:
 1. Text input (from CanvasContext)
 2. "Use API" toggle (PRO+ only, shows tier requirement)
 3. "Detect" button

 Results:
 - Verdict badge (HUMAN/AI/UNCERTAIN with color coding)
 - Confidence score (circular progress, 0-100%)
 - Explanation text
 - Tell-words highlighting (DOMPurify sanitized, category tags)
 - Signal breakdown chart (burstiness, tell-word score, readability, diversity)
 - Raw metrics accordion (Flesch, Gunning-Fog, word count, etc.)
 - "Check API Status" link

 API: POST /ai-detection/detect

 3.4 Personalizer Panel (PRO+ Only) (3-4 hours)

 File: src/features/panels/personalizer/PersonalizerPanel.tsx (~300 lines)

 Requirements Check:
 - Show upgrade prompt if not PRO+
 - Check for discovered personas/styles (GET /personal/personas, /personal/styles)
 - If none: Show "Upload Samples First" modal

 UI:
 1. Text Input (from CanvasContext)
 2. Voice Selection:
   - Persona dropdown (discovered + custom)
   - Style dropdown (discovered + custom)
   - "Manage Voices" button → opens VoiceManager modal
 3. Model Selector (optional override)
 4. Transform Button

 Results:
 - Output text (markdown-rendered)
 - Semantic similarity score (gauge: aim for 95%+)
 - "This sounds like me!" / "Not quite right" feedback buttons
 - "Load to Canvas" button

 Additional Modals:
 - SampleUploadModal - Upload writing samples (min 100 words)
 - VoiceManager - List/edit/delete personas and styles
 - VoiceDiscovery - Run discovery process (5k words required)

 API:
 - POST /transformations/personalizer
 - POST /personal/samples/upload
 - POST /personal/personas/discover-voices

 3.5 Maieutic Panel (2-3 hours)

 File: src/features/panels/maieutic/MaieuticPanel.tsx (~280 lines)

 UI (Chat-like Interface):
 1. Initial text input (from CanvasContext)
 2. Goal selector: Understand / Critique / Explore
 3. "Begin Dialogue" button

 Dialogue Display:
 - Chat bubbles (alternating user/assistant)
 - Depth level indicator (0-4 with color coding)
 - Turn number
 - "Respond" text input for each question
 - Insights accumulation sidebar (running list)
 - Final understanding summary (when complete)

 Session Management:
 - Resume interrupted sessions (if session_id stored)
 - "Save Session" / "New Session" buttons
 - Export dialogue transcript

 API:
 - POST /transformations/maieutic/start
 - POST /transformations/maieutic/:sessionId/respond
 - GET /transformations/maieutic/:sessionId

 ---
 Phase 4: Analysis Panels (8-10 hours)

 4.1 Enhanced Multi-Reading Panel (3 hours)

 File: src/features/panels/MultiReadingPanel.tsx (refactor)

 Current → Enhanced:
 - Remove hardcoded text input → use CanvasContext
 - Add "Use Canvas Text" button
 - Keep keyboard navigation (arrows, Enter)
 - Update ρ state in shared context (for RhoInspector)

 Future (Phase 5): Multi-axis support

 4.2 POVM Evaluator Panel (3-4 hours)

 File: src/features/panels/povm/POVMPanel.tsx (implement from stub)

 UI:
 1. Axis Selection:
   - Dropdown: Literalness / Formality / Affect / Ontology / Pragmatics
   - Description of each axis
   - "Evaluate" button
 2. Tetralemma Visualization:
   - 4-corner display (reuse TetralemmaViz component)
   - Probabilities for each corner
   - Evidence text for each corner
   - Visual emphasis on dominant corner
 3. Metrics:
   - Shannon entropy of distribution
   - Max probability (confidence)
   - Corner ranking

 API: POST /povm/eval (needs implementation in Workers)
 Request: { text: string, axis: string }
 Response: Same as quantum-analysis measurement format

 4.3 ρ Inspector Panel (2-3 hours)

 File: src/features/panels/rho/RhoInspector.tsx (implement from stub)

 UI:
 1. Auto-Compute:
   - Watches CanvasContext.text
   - Auto-computes ρ on text change (debounced 500ms)
   - Loading spinner during computation
 2. Visualizations:
   - Purity Gauge: Circular progress (0-100%, label: "Classical" to "Maximally Entangled")
   - Entropy: Bar chart (0 to ln(32) ≈ 3.47)
   - Eigenvalue Spectrum: Bar chart of top 5 eigenvalues
   - State Type: Badge (pure/mixed/maximally-mixed based on purity)
 3. Details Accordion:
   - Full 32 eigenvalues (collapsible)
   - Matrix statistics (trace, rank estimate)
   - "Export ρ as JSON" button

 API: POST /rho/inspect (needs implementation)
 Request: { text: string }
 Response: { purity, entropy, eigenvalues: number[] }

 ---
 Phase 5: Persistence & History Management (6-8 hours)

 5.1 History Panel (4-5 hours)

 File: src/features/history/HistoryPanel.tsx (~300 lines)

 UI:
 1. Filter Bar:
   - Type dropdown (All / Allegorical / Round-Trip / AI Detection / Personalizer / Maieutic)
   - Status filter (All / Completed / Failed)
   - Date range picker
   - Favorites toggle
   - Search input (searches input_text + output_data)
 2. List View:
   - Cards showing: Type icon, timestamp, input snippet, status badge
   - Hover: Show full input preview
   - Click: Expand to show full results
 3. Card Actions:
   - "Load to Canvas" (input_text → CanvasContext)
   - "View Results" (expand/collapse)
   - "Favorite" (star icon toggle)
   - "Delete" (with confirmation)
   - "Export" (JSON download)
 4. Pagination:
   - Load more (infinite scroll or button)
   - Show count: "Showing 20 of 156 transformations"

 API:
 - GET /transformation-history?type=&status=&limit=&offset=
 - POST /transformation-history/:id/favorite
 - DELETE /transformation-history/:id

 5.2 Quantum Session Browser (2-3 hours)

 File: src/features/quantum/SessionBrowser.tsx (~200 lines)

 UI:
 1. Session List:
   - Date, first sentence, sentence count, completion status
   - Progress bar (sentences completed / total)
   - "Resume" button (incomplete sessions)
   - "View Trace" button (completed sessions)
 2. Session Detail Modal:
   - Full narrative text
   - All measurements in table
   - ρ evolution chart (purity over time)
   - "Export Trace as JSON" button

 API (needs implementation):
 - GET /quantum-analysis/sessions - List all user sessions
 - GET /quantum-analysis/:id/trace - Full trace (already exists)
 - DELETE /quantum-analysis/:id - Delete session

 ---
 Phase 6: Advanced Features (6-8 hours)

 6.1 Multi-Axis POVM Support (3-4 hours)

 Backend (Workers): Create multi-axis measurement endpoint

 File: workers/npe-api/src/routes/quantum-analysis.ts (+100 lines)

 New Endpoint: POST /quantum-analysis/:id/step-multi
 Request: { axes: string[] } - e.g., ["literalness", "formality", "affect"]
 Response: Array of measurements, one per axis

 Frontend: Update MultiReadingPanel to support multiple axes
 - Checkbox selection (1-6 axes)
 - Parallel visualization (3 Tetralemma displays side-by-side)
 - ρ evolution for each axis

 6.2 POVM Pack Management (2-3 hours)

 Backend: Create POVM pack storage

 Tables (new migration):
 CREATE TABLE povm_axes (
   id TEXT PRIMARY KEY,
   name TEXT NOT NULL,
   description TEXT,
   corners TEXT NOT NULL, -- JSON: ["corner1", "corner2", "corner3", "corner4"]
   prompt_template TEXT NOT NULL,
   created_at INTEGER
 );

 CREATE TABLE povm_packs (
   id TEXT PRIMARY KEY,
   user_id TEXT,  -- NULL = system pack
   name TEXT NOT NULL,
   description TEXT,
   axes TEXT NOT NULL, -- JSON: ["axis_id_1", "axis_id_2", ...]
   created_at INTEGER
 );

 Seed Data: Tetralemma, Tone Pack, Ontology Pack, Pragmatics Pack

 Frontend: POVM Pack Manager
 - List available packs
 - Create custom packs (select axes)
 - Save/load pack configurations

 6.3 Export & Sharing (1-2 hours)

 Features:
 1. Bulk Export:
   - Select multiple history items
   - Export as JSON, CSV, or Markdown
 2. PDF Export:
   - Generate PDF with LaTeX equations rendered
   - Include all transformation stages
 3. Shareable Links:
   - POST /transformations/:id/share → generate public link
   - Expiry time (24h, 7d, 30d, never)
   - View count tracking

 ---
 Phase 7: Tool Registry Updates (30 min)

 File: src/core/tool-registry.tsx

 Add tools:
 const toolRegistry: ToolDef[] = [
   // Analysis
   { id: "multi-reading", kind: "analysis", icon: "◈", label: "Multi-Reading", panel: MultiReadingPanel },
   { id: "povm", kind: "analysis", icon: "◆", label: "POVM Eval", panel: POVMPanel },
   { id: "rho-inspect", kind: "analysis", icon: "↗︎", label: "ρ Inspector", panel: RhoInspector },
   { id: "ai-detect", kind: "analysis", icon: "🤖", label: "AI Detection", panel: AIDetectionPanel },

   // Transformations
   { id: "allegorical", kind: "transform", icon: "🎭", label: "Allegorical", panel: AllegoricalPanel },
   { id: "round-trip", kind: "transform", icon: "🔄", label: "Round-Trip", panel: RoundTripPanel },
   { id: "personalizer", kind: "transform", icon: "✨", label: "Personalizer", panel: PersonalizerPanel, requiresPro: true },
   { id: "maieutic", kind: "transform", icon: "💭", label: "Maieutic", panel: MaieuticPanel },

   // Management
   { id: "history", kind: "utility", icon: "📚", label: "History", panel: HistoryPanel },
   { id: "sessions", kind: "utility", icon: "🔬", label: "Sessions", panel: SessionBrowser },
 ];

 ---
 Summary of Changes

 New Files (18)

 Contexts:
 - src/core/context/CanvasContext.tsx (120 lines)
 - src/core/context/AuthContext.tsx (150 lines)

 Auth:
 - src/components/auth/LoginModal.tsx (180 lines)

 Transformation Panels:
 - src/features/panels/allegorical/AllegoricalPanel.tsx (350 lines)
 - src/features/panels/round-trip/RoundTripPanel.tsx (250 lines)
 - src/features/panels/ai-detection/AIDetectionPanel.tsx (220 lines)
 - src/features/panels/personalizer/PersonalizerPanel.tsx (300 lines)
 - src/features/panels/personalizer/SampleUploadModal.tsx (150 lines)
 - src/features/panels/personalizer/VoiceManager.tsx (200 lines)
 - src/features/panels/maieutic/MaieuticPanel.tsx (280 lines)

 Analysis Panels:
 - src/features/panels/povm/POVMPanel.tsx (250 lines) - implement from stub
 - src/features/panels/rho/RhoInspector.tsx (200 lines) - implement from stub

 History:
 - src/features/history/HistoryPanel.tsx (300 lines)
 - src/features/history/TransformationCard.tsx (150 lines)
 - src/features/quantum/SessionBrowser.tsx (200 lines)

 UI Components:
 - src/components/ui/APIToggle.tsx (80 lines)
 - src/components/ui/TierRequirement.tsx (60 lines) - Upgrade prompts
 - src/components/ui/ProgressBar.tsx (40 lines) - Stage progress

 Modified Files (8)

 - src/core/adapters/api.ts (+250 lines) - Dual backend + all endpoints
 - src/features/canvas/Canvas.tsx (+100 lines) - Text selection, CanvasContext
 - src/features/archive/ArchiveBrowser.tsx (+30 lines) - Load to Canvas
 - src/features/panels/MultiReadingPanel.tsx (+50 lines) - Use CanvasContext
 - src/core/tool-registry.tsx (+8 tools)
 - src/app/layout/WorkbenchLayout.tsx (+20 lines) - Add context providers
 - src/App.tsx (+10 lines) - AuthContext wrapper
 - .env (+2 vars) - VITE_PROCESSING_TARGET, VITE_LOCAL_API

 Backend Files (Python - if missing) (~3-4 hours)

 - humanizer/api/routes/transformations.py - Add allegorical, round-trip routes
 - humanizer/api/routes/povm.py - Add POVM eval endpoint
 - humanizer/api/routes/rho.py - Add ρ inspect endpoint

 Backend Files (Workers - new features) (~2-3 hours)

 - workers/npe-api/src/routes/povm.ts - POVM axis evaluation
 - workers/npe-api/src/routes/quantum-analysis.ts - Multi-axis support
 - workers/npe-api/migrations/0010_povm_packs.sql - POVM axes + packs tables

 ---
 Estimated Effort

 | Phase | Description                     | Hours         |
 |-------|---------------------------------|---------------|
 | 1     | Canvas Context + Backend Toggle | 3-4           |
 | 2     | Authentication                  | 2             |
 | 3     | Transformation Panels (5 tools) | 12-15         |
 | 4     | Analysis Panels (3 tools)       | 8-10          |
 | 5     | History & Sessions              | 6-8           |
 | 6     | Advanced Features               | 6-8           |
 | 7     | Tool Registry                   | 0.5           |
 | Total |                                 | 37-47.5 hours |

 Realistic Timeline: 5-6 full work days (8 hours each)

 ---
 Testing Plan

 Unit Tests

 1. CanvasContext text selection
 2. API adapter backend switching
 3. Auth token injection

 Integration Tests

 1. Archive → Canvas → Allegorical → History
 2. Local vs Remote API switching
 3. Login required for remote + PRO+ features
 4. Quota enforcement (tier-based)

 E2E Tests

 1. Full allegorical transformation workflow
 2. Multi-step maieutic dialogue
 3. Quantum reading session completion
 4. Voice discovery → personalizer → AI detection grading

 ---
 Success Criteria

 ✅ Canvas Integration:
 - Text flows from Canvas to any tool
 - Selected text can be sent to specific tools
 - Results flow back to Canvas

 ✅ Dual Backend:
 - Both local and remote APIs functional
 - Seamless switching without data loss
 - Connection status visible

 ✅ Authentication:
 - Login required only for remote API
 - PRO+ features properly gated
 - Token persistence across sessions

 ✅ All Transformations:
 - Allegorical (5 stages) ✅
 - Round-Trip (drift analysis) ✅
 - AI Detection (tell-words) ✅
 - Personalizer (voice-based) ✅
 - Maieutic (dialogue) ✅

 ✅ All Analysis:
 - Multi-Reading (quantum) ✅
 - POVM Evaluator (multi-axis) ✅
 - ρ Inspector (state visualization) ✅

 ✅ Persistence:
 - All transformations save to history
 - History panel CRUD functional
 - Quantum sessions resumable
 - Export/sharing working

 ✅ UX:
 - Professional UI matching cloud-frontend
 - Error handling graceful
 - Loading states clear
 - Tier upgrades discoverable
