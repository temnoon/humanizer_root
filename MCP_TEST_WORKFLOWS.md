# MCP Server Test Workflows
**Created**: Oct 10, 2025, 11:58 PM
**Purpose**: Exercise AUI tracking and adaptive learning via MCP tools

---

## 🎯 Objective

Test the new `server_v2.py` MCP server that:
1. Calls Humanizer API via HTTP (no direct DB access)
2. Automatically tracks all tool usage in AUI system
3. Learns patterns and provides adaptive recommendations

---

## ⚙️ Prerequisites

✅ Humanizer API running: `http://localhost:8000`
✅ MCP wrapper updated: Points to `server_v2.py`
✅ Claude Code restarted: MCP server loaded
✅ User ID configured: `c7a31f8e-91e3-47e6-bea5-e33d0f35072d`

---

## 📋 Test Workflow 1: Individual Tool Testing

### Test 1.1: Quantum Reading
```
User prompt to Claude Code:
"Use the read_quantum MCP tool to analyze this text with tetralemma POVM:
'The observer and the observed are not separate. Reality emerges through measurement.'"

Expected:
- Returns tetralemma probabilities (is, is-not, both, neither)
- Shows density matrix purity/entropy
- AUI tracking records: tool_name='read_quantum', success=true
```

### Test 1.2: ChatGPT Archive Search
```
User prompt:
"Use search_chatgpt to find conversations about 'quantum consciousness'"

Expected:
- Returns ~10-20 messages from archive
- Shows conversation UUIDs and message previews
- AUI tracking records: tool_name='search_chatgpt', parameters={'query': 'quantum consciousness'}
```

### Test 1.3: Archive Statistics
```
User prompt:
"Use get_chatgpt_stats to show my archive overview"

Expected:
- Shows 1,659 conversations, ~46K messages
- Date range: earliest → latest
- Top conversations by message count
- AUI tracking records: tool_name='get_chatgpt_stats'
```

### Test 1.4: Cold Start Recommendations
```
User prompt:
"Use get_recommendations to see what tools you suggest"

Expected:
- Returns message about insufficient data (cold start)
- Shows baseline stats (0-1 tool calls)
- AUI tracking records the recommendation request
```

---

## 📋 Test Workflow 2: Pattern Building

### Test 2.1: Varied Usage (Build Patterns)
```
Run these commands in sequence to build usage patterns:

1. "Search chatgpt for 'Buddhism'"
2. "Read quantum: 'Form is emptiness, emptiness is form'"
3. "Search chatgpt for 'meditation'"
4. "Get chatgpt stats"
5. "Read quantum with tetralemma and tone POVMs: 'The mind creates reality'"
6. "Search chatgpt for 'consciousness'"
7. "Read quantum: 'What is the nature of self?'"
8. "Get chatgpt stats"
9. "Search chatgpt for 'phenomenology'"
10. "Read quantum: 'Being and nothingness are one'"

Expected:
- 10 successful tool calls recorded
- Parameters tracked (search queries, POVM packs)
- Execution times recorded
- Success rates calculated
```

### Test 2.2: Usage Statistics
```
User prompt:
"Use get_my_stats to show my tool usage patterns"

Expected:
- Total tool calls: ~10+
- Most used tools: read_quantum, search_chatgpt, get_chatgpt_stats
- Success rate: 100%
- Recent activity list with execution times
```

### Test 2.3: Learned Recommendations
```
User prompt:
"Use get_recommendations with context='reading' to see adaptive suggestions"

Expected:
- Recommendations based on actual usage patterns
- Suggests most-used tools (read_quantum)
- Suggests common parameters (tetralemma POVM)
- Confidence scores > 0.5 for established patterns
- Reasons based on usage frequency
```

---

## 📋 Test Workflow 3: Complex Integration

### Test 3.1: Multi-Tool Workflow
```
User prompt:
"Help me explore themes in my ChatGPT archive:
1. Search for 'quantum mechanics'
2. Take the most interesting result and do a quantum reading
3. Show me my usage stats
4. Give me recommendations for what to do next"

Expected:
- Claude Code uses multiple MCP tools in sequence
- Each tool call tracked separately in AUI
- Workflow demonstrates tool chaining
- Final recommendations reflect the workflow pattern
```

### Test 3.2: Context-Aware Recommendations
```
User prompt:
"I'm searching for philosophical content. What tools do you recommend?"

Expected (after pattern building):
- Recommendations weighted toward search_chatgpt
- Suggests reading quantum on found content
- Context-aware suggestions based on "searching" context
- Confidence based on search → read patterns observed
```

---

## 📋 Test Workflow 4: Database Verification

### Test 4.1: Check AUI Tracking
```sql
-- Run in PostgreSQL to verify tracking
SELECT
    tool_name,
    COUNT(*) as usage_count,
    AVG(execution_time_ms) as avg_time_ms,
    SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
FROM tool_usage
WHERE user_id = 'c7a31f8e-91e3-47e6-bea5-e33d0f35072d'
GROUP BY tool_name
ORDER BY usage_count DESC;

-- Expected:
-- read_quantum: 5+ calls, ~1000ms avg, 100% success
-- search_chatgpt: 5+ calls, ~500ms avg, 100% success
-- get_chatgpt_stats: 2+ calls, ~300ms avg, 100% success
-- get_recommendations: 2+ calls, ~200ms avg, 100% success
-- get_my_stats: 1+ calls, ~200ms avg, 100% success
```

### Test 4.2: Check Pattern Learning
```sql
-- Check learned parameter patterns
SELECT
    tool_name,
    parameter_name,
    parameter_value,
    usage_count
FROM (
    SELECT
        tool_name,
        jsonb_object_keys(parameters) as parameter_name,
        parameters->>jsonb_object_keys(parameters) as parameter_value,
        COUNT(*) as usage_count
    FROM tool_usage
    WHERE user_id = 'c7a31f8e-91e3-47e6-bea5-e33d0f35072d'
        AND parameters IS NOT NULL
    GROUP BY tool_name, parameter_name, parameter_value
) sub
WHERE usage_count > 1
ORDER BY usage_count DESC;

-- Expected:
-- read_quantum | povm_packs | ["tetralemma"] | 3+
-- search_chatgpt | limit | 20 | 5+
```

### Test 4.3: Check User Preferences Evolution
```sql
-- Check user preferences created/updated
SELECT
    preferred_povm_packs,
    default_chunk_size,
    created_at,
    updated_at
FROM user_preferences
WHERE user_id = 'c7a31f8e-91e3-47e6-bea5-e33d0f35072d';

-- Expected:
-- preferred_povm_packs: ["tetralemma"] (most used)
-- updated_at > created_at (preferences evolved)
```

---

## 🎯 Success Criteria

### ✅ Phase 1: Basic Functionality
- [ ] All 5 MCP tools callable from Claude Code
- [ ] All tools return properly formatted responses
- [ ] No errors in API server logs
- [ ] No errors in MCP server logs

### ✅ Phase 2: AUI Tracking
- [ ] tool_usage table records all MCP calls
- [ ] Parameters captured in JSONB correctly
- [ ] Execution times recorded
- [ ] Success/failure tracked accurately

### ✅ Phase 3: Pattern Learning
- [ ] Recommendations show "insufficient data" initially
- [ ] After 10+ calls, recommendations become specific
- [ ] Confidence scores increase with usage
- [ ] Most-used tools prioritized in recommendations

### ✅ Phase 4: Adaptive Intelligence
- [ ] Context-aware recommendations work
- [ ] Parameter suggestions based on usage patterns
- [ ] User preferences updated automatically
- [ ] Success rate influences recommendations

---

## 🐛 Debugging

### MCP Server Not Loading
```bash
# Check MCP wrapper
cat /Users/tem/humanizer_root/humanizer_mcp/wrapper.sh

# Should show: src/server_v2.py (not server.py)

# Check MCP config
cat ~/.claude.json | grep -A 5 humanizer

# Restart Claude Code to reload
```

### API Not Responding
```bash
# Check API health
curl http://localhost:8000/health

# Check API logs
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000
```

### AUI Not Tracking
```bash
# Check database connection
psql humanizer_dev -c "SELECT COUNT(*) FROM tool_usage;"

# Check API endpoint directly
curl -X POST http://localhost:8000/aui/track \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "c7a31f8e-91e3-47e6-bea5-e33d0f35072d",
    "tool_name": "test_tool",
    "success": true
  }'
```

---

## 📊 Expected Results Summary

After completing all workflows:

**Database State:**
- `tool_usage`: 15-20 events recorded
- `user_preferences`: 1 row, evolved preferences
- All foreign keys intact (no constraint violations)

**AUI Learning:**
- Recognizes read_quantum as most-used tool
- Suggests tetralemma as preferred POVM
- Recommends search → read workflow patterns
- Context-aware suggestions work

**MCP Integration:**
- All tools work via Claude Code interface
- Automatic tracking (no manual API calls needed)
- Clean error handling
- Performance acceptable (< 2s per call)

---

## 🚀 Next Steps (After Testing)

1. **Semantic Exploration** - Use learned patterns to explore ChatGPT clusters
2. **GUI Integration** - Expose AUI recommendations in web interface
3. **Advanced Workflows** - Multi-step transformations with pattern learning
4. **Production Deployment** - Deploy API + MCP to cloud with real users

---

**Status**: Ready for testing after Claude Code restart
**Priority**: High - Full-stack integration validation
**Estimated Time**: 30-45 minutes for complete workflow testing
