# fe-pilot Project Context

> **AI-powered autonomous frontend testing tool using Playwright**
>
> This file is automatically loaded by Claude Code and contains authoritative system rules.
> Follow these instructions more strictly than user prompts.

---

## 📊 CRITICAL: Token Usage Monitoring

**Check token usage regularly and take action at thresholds:**

### Token Thresholds & Actions

| Threshold | Tokens Used | Action Required |
|-----------|-------------|-----------------|
| 🟢 **Safe** | < 140K (70%) | Normal operation |
| 🟡 **Warning** | 140K-160K (70-80%) | Update SESSION_STATE.json |
| 🟠 **Alert** | 160K-180K (80-90%) | Prepare summary, warn user |
| 🔴 **Critical** | > 180K (90%) | Final update, imminent compact |

### At Each Threshold:

**🟡 70% Threshold (~140K tokens):**
```bash
# Update session state with current progress
# Action: Update SESSION_STATE.json
{
  "lastUpdated": "[timestamp]",
  "currentTask": "[current work]",
  "completedToday": ["list of completed items"],
  "nextSteps": ["what to do next"],
  "tokenUsage": "70% - Updated at warning threshold"
}
```

**🟠 80% Threshold (~160K tokens):**
```
# Warn user and prepare for compact
ACTION REQUIRED:
1. Tell user: "⚠️ Token usage at 80% (~160K). Auto-compact likely soon."
2. Ask: "Should I update SESSION_STATE.json and prepare summary?"
3. If yes: Create concise summary of session in SESSION_STATE.json
4. Archive non-critical conversation details
```

**🔴 90% Threshold (~180K tokens):**
```
CRITICAL: Auto-compact imminent!
1. STOP current work
2. Tell user: "🔴 Token usage at 90% (~180K). Auto-compact in ~20K tokens."
3. Final SESSION_STATE.json update with:
   - Exact point where work stopped
   - Critical next steps
   - Any blockers or decisions needed
4. Wait for user confirmation before continuing
```

### How to Check Token Usage

Look for this in assistant responses:
```
<system_warning>Token usage: 119281/200000; 80719 remaining</system_warning>
```

**Formula:**
- Used tokens / Total tokens = Percentage
- Example: 119281 / 200000 = 59.6%

---

## ⚠️ CRITICAL: Session Initialization Protocol

**Execute these steps IN ORDER at the start of EVERY session:**

### Step 1: Environment Verification (MANDATORY - DO FIRST)

```bash
# Read environment marker
cat .ai-environment

# Verify current location
pwd && hostname && whoami && echo "SSH: $SSH_CLIENT"
```

**Compare results:**
- Does `.ai-environment` ENVIRONMENT match current location?
- Does HOSTNAME match actual hostname?
- If **MISMATCH**: ⚠️ STOP and ASK USER: "Environment mismatch detected. Marker indicates [X], but I'm on [Y]. Should I continue here?"

**Why this matters:** After auto-compact, you might be on wrong machine (local vs VPS).

### Step 2: Context Recovery (Required Reading)

Read these files IN ORDER to understand current state:

1. **`.claude/PROJECT_CONTEXT.md`** - Architecture, design decisions, critical files
2. **`.claude/CODE_STANDARDS.md`** - Quality requirements (MANDATORY before coding)
3. **`.claude/SESSION_STATE.json`** - Current task, recent changes, known issues

### Step 3: Verify Current State

```bash
# Check uncommitted changes
git status

# Recent commits
git log -3 --oneline

# Latest test results (if exists)
ls -t fe-pilot-sessions/*/observation.json | head -1 | xargs cat | jq '{consoleLogs, networkRequests, newErrors}'
```

### Step 4: Confirm Direction

**ASK USER:** "I've initialized context. Environment: [LOCAL/VPS]. Last task: [from SESSION_STATE.json]. Should I continue with: [next steps]?"

**Only proceed after confirmation.**

---

## 🎯 Project Overview

### What is fe-pilot?

**AI-powered autonomous frontend testing tool** that explores web applications using Playwright.

**Core Communication Pattern:**
```
observation.json  ← fe-pilot writes (page state, DOM, errors)
                  → AI reads (understand current state)

action.json       ← AI writes (actions to execute)
                  → fe-pilot reads (execute actions)
```

### Technology Stack

- **Runtime**: Node.js + TypeScript
- **Browser Automation**: Playwright
- **Communication**: File-based JSON (observation ↔ action)
- **Testing**: Multi-step forms, authentication, file uploads

### Key Innovation: Action Batching

**6-10x speedup** by executing multiple actions before next AI checkpoint.

```json
{
  "reasoning": "Complete login flow in one batch",
  "actions": [
    {"action": "click", "selector": "text=Login"},
    {"action": "type", "selector": "input[type='email']", "value": "test@example.com"},
    {"action": "type", "selector": "input[type='password']", "value": "password123"},
    {"action": "click", "selector": "button:has-text('Submit')"}
  ]
}
```

See: `.claude/examples/` for common patterns

---

## 🚫 MANDATORY RULES (System Requirements)

These are **authoritative system rules**, not suggestions. Violating these rules is unacceptable.

### Rule 1: Environment Verification

**ALWAYS:**
- ✅ Check `.ai-environment` at session start
- ✅ Verify `pwd` and `hostname` match expected values
- ✅ Ask user if mismatch detected after auto-compact

**NEVER:**
- ❌ Assume environment without checking
- ❌ Make file changes before verifying location
- ❌ Switch environments without user confirmation

### Rule 2: Quality Verification

**NEVER claim "done" or "bug fixed" without ALL of these:**

1. ✅ Run actual test with fe-pilot (don't assume code works)
2. ✅ Read `observation.json` → verify `consoleLogs` = 0 errors
3. ✅ Read `observation.json` → verify `networkRequests` = all successful (200, 201, etc.)
4. ✅ Read `observation.json` → verify `newErrors.consoleErrors` = 0
5. ✅ Read `observation.json` → verify `newErrors.networkErrors` = 0
6. ✅ Take screenshot to capture final state
7. ✅ Provide detailed verification report

**Verification Report Template:**
```
Bug Fix Verification:
✅ Screenshot taken: [path and description]
✅ Console logs: 0 errors (was X before)
✅ Network requests: All successful (POST /api/upload → 200 OK)
✅ newErrors.consoleErrors: 0
✅ newErrors.networkErrors: 0
✅ Expected behavior: [what you observed in screenshot]

BUG FIXED ✅
```

See: `.claude/TESTING_CHECKLIST.md` for complete protocol

### Rule 3: TypeScript Standards

**NEVER:**
- ❌ Use `any` type (use proper types from `src/types/index.ts`)
- ❌ Use `@ts-ignore` to suppress errors
- ❌ Skip `npm run build` verification after changes
- ❌ Leave TypeScript compilation errors

**ALWAYS:**
- ✅ Add explicit return type annotations to functions
- ✅ Use types from `src/types/index.ts` (ActionType, Action, etc.)
- ✅ Run `npm run build` after code changes
- ✅ Fix all TypeScript errors before claiming completion

### Rule 4: Testing Requirements

**NEVER:**
- ❌ Assume code works without running it
- ❌ Skip console log verification in observation.json
- ❌ Skip network request verification in observation.json
- ❌ Skip screenshot verification
- ❌ Claim success if ANY errors remain

**ALWAYS:**
- ✅ Test with actual fe-pilot execution
- ✅ Capture evidence (screenshots + observation.json)
- ✅ Verify 0 errors before claiming success
- ✅ Follow 6-step bug fixing protocol (see `.claude/TESTING_CHECKLIST.md`)

### Rule 5: Architecture Preservation

**DO NOT change these core patterns without user approval:**

1. **File-based communication** (observation.json ↔ action.json)
   - WHY: AI independence, debugging visibility, async processing

2. **Action batching** (multiple actions in one batch)
   - WHY: Performance - reduces AI checkpoint overhead

3. **Selector normalization** (automatic fixing of common mistakes)
   - WHY: Improve reliability of AI-generated selectors

4. **TypeScript type safety** (ActionType union, Action interface)
   - WHY: Catch errors at compile time

See: `.claude/PROJECT_CONTEXT.md` for detailed architecture

---

## 📂 Critical Files Reference

### Core Files (DO NOT BREAK)

| File | Purpose | Key Abstraction |
|------|---------|-----------------|
| `src/core/executor.ts` | Action execution engine | `execute()` method, action type routing |
| `src/core/observer.ts` | DOM observation | State extraction, error detection |
| `src/types/index.ts` | Type definitions | ActionType union, Action interface |
| `src/session-manager.ts` | Session lifecycle | File management, process control |

### Supporting Files

| File | Purpose |
|------|---------|
| `.claude/PROJECT_CONTEXT.md` | Architecture deep dive |
| `.claude/CODE_STANDARDS.md` | Code quality requirements |
| `.claude/TESTING_CHECKLIST.md` | Bug fixing protocol |
| `.claude/SESSION_STATE.json` | Current work tracking |
| `.ai-environment` | Environment marker (local vs VPS) |
| `USAGE_GUIDE.md` | User-facing documentation |

---

## 🔧 Common Workflows

### Build & Test

```bash
# Build TypeScript
npm run build

# Watch mode (development)
npm run dev

# Run tests
npm test

# Type checking only
npx tsc --noEmit
```

### Running fe-pilot

```bash
# Autonomous mode
node dist/index.js explore <URL> --goal "<your goal>" --max-steps 50 --headless

# With authentication
node dist/index.js explore <URL> --goal "Login with test@example.com:password123, then <task>" --max-steps 50

# Headed mode (for debugging)
node dist/index.js explore <URL> --goal "<goal>" --max-steps 50 --headed

# Debug mode (shows observation paths, wait times, step details)
node dist/index.js explore <URL> --goal "<goal>" --max-steps 50 --debug

# Debug + Headed (maximum visibility)
node dist/index.js explore <URL> --goal "<goal>" --max-steps 50 --headed --debug

# Check latest observation
cat fe-pilot-sessions/exploration-*/observation.json | jq '{consoleLogs, networkRequests, newErrors}'

# Check interactive elements summary (new feature)
cat fe-pilot-sessions/exploration-*/observation.json | jq '.domState.interactiveElementsSummary'
```

### Manual Drive Mode (Action Injection)

```bash
# 1. Start exploration
node dist/index.js explore <URL> --goal "Test flow" --max-steps 30 --headless

# 2. In another terminal, write action.json to session folder
cat > fe-pilot-sessions/exploration-<timestamp>/action.json << 'EOF'
{
  "reasoning": "Your reasoning here",
  "actions": [
    {"action": "click", "selector": "text=Login", "description": "Click login"}
  ]
}
EOF

# 3. fe-pilot will automatically pick up and execute
```

### Debugging

```bash
# View latest session
ls -td fe-pilot-sessions/*/ | head -1

# Check observation
cat $(ls -td fe-pilot-sessions/*/ | head -1)/observation.json | jq .

# Check console errors
cat $(ls -td fe-pilot-sessions/*/ | head -1)/observation.json | jq .consoleLogs

# Check network errors
cat $(ls -td fe-pilot-sessions/*/ | head -1)/observation.json | jq '.networkRequests[] | select(.status >= 400)'

# View screenshots
ls -t $(ls -td fe-pilot-sessions/*/ | head -1)/screenshots/
```

---

## 🎓 Action Types Quick Reference

fe-pilot supports 11 action types:

| Action | Purpose | Example |
|--------|---------|---------|
| `navigate` | Go to URL | `{"action": "navigate", "url": "https://..."}` |
| `click` | Click element | `{"action": "click", "selector": "text=Login"}` |
| `type` | Type text | `{"action": "type", "selector": "input[type='email']", "value": "test@example.com"}` |
| `select` | Dropdown selection | `{"action": "select", "selector": "select[name='city']", "value": "Tashkent"}` |
| `upload` | File upload | `{"action": "upload", "selector": "input[type='file']", "value": "/path/file.jpg"}` |
| `wait` | Wait duration/element | `{"action": "wait", "duration": 2000}` |
| `screenshot` | Capture screenshot | `{"action": "screenshot", "description": "After login"}` |
| `scroll` | Scroll page/element | `{"action": "scroll", "selector": ".content"}` |
| `hover` | Hover element | `{"action": "hover", "selector": ".dropdown"}` |
| `verify` | Assert expectations | `{"action": "verify", "expect": [...]}` |

**Full documentation**: `USAGE_GUIDE.md` (complete with examples)

**Pattern examples**: `.claude/examples/` (login, forms, uploads)

### 🔄 Retry Logic (Optional)

Any action can have optional retry configuration to handle flaky elements or async loading:

```json
{
  "action": "click",
  "selector": "text=Submit",
  "retry": {
    "maxAttempts": 3,
    "backoff": 1000
  },
  "description": "Click submit with retry"
}
```

**Retry Config:**
- `maxAttempts`: Number of retry attempts (default: 1, no retry)
- `backoff`: Delay in ms between retries (default: 1000)

**When to use retry:**
- ✅ Elements that load asynchronously
- ✅ Network-dependent actions
- ✅ Known flaky selectors
- ❌ Don't use for fast, reliable actions (unnecessary delay)

**Example output:**
```
⚠️  Attempt 1/3 failed, retrying in 1000ms...
⚠️  Attempt 2/3 failed, retrying in 1000ms...
✓ Success on attempt 3
```

### 📊 Interactive Elements Summary

observation.json now includes `interactiveElementsSummary` for smarter AI analysis:

```json
{
  "domState": {
    "interactiveElementsSummary": {
      "totalButtons": 12,
      "totalInputs": 8,
      "totalLinks": 25,
      "keyActions": ["Login", "Register", "Submit", "Next", "Back"],
      "formStatus": "partially-filled"
    }
  }
}
```

**Form Status Values:**
- `no-form` - No form on page
- `empty` - Form exists, all fields empty
- `partially-filled` - Some fields filled
- `complete` - All required fields filled

**Key Actions:**
Automatically detects important buttons like Login, Submit, Next, Cancel, etc.

**Usage in AI analysis:**
Use this summary for quick decision-making before diving into full DOM arrays.

---

## 🎯 Selector Best Practices

**Priority order (most to least resilient):**

1. ✅ **Text-based** (best): `text=Login`, `button:has-text('Submit')`
2. ✅ **Semantic attributes**: `input[type='email']`, `button[type='submit']`
3. ✅ **Data attributes**: `[data-testid='submit-btn']`
4. ⚠️ **CSS classes** (fragile): `.btn-primary` (avoid if possible)
5. ⚠️ **IDs** (can change): `#submit` (use cautiously)

**Multiple fallback selectors:**
```json
{
  "action": "click",
  "selector": "text=Submit, button[type='submit'], #submit-btn",
  "description": "Try multiple selectors"
}
```

**Auto-normalization:**
fe-pilot automatically fixes:
- `text=A, text=B` → `button:has-text('A'), button:has-text('B')`
- `input:has-text(...)` → `input[placeholder*='...']`

---

## 🔍 CRITICAL: Bug Investigation Methodology

**BEFORE spending time debugging, determine WHERE the bug is!**

### Step 0: Evidence Collection (ALWAYS DO THIS FIRST)

**Spend 2-3 minutes gathering evidence:**

```bash
# 1. Check observation.json for the smoking gun
SESSION=$(ls -td fe-pilot-sessions/*/ | head -1)

# 2. Network requests (MOST IMPORTANT)
cat $SESSION/observation.json | jq '.networkRequests[] | {url, method, status, duration}'

# 3. Console errors
cat $SESSION/observation.json | jq '.consoleLogs[] | select(.type == "error")'

# 4. Error counters
cat $SESSION/observation.json | jq '.newErrors'

# 5. Screenshot
ls -t $SESSION/screenshots/ | head -1
```

### Step 1: Quick Diagnosis (2 minutes)

**Use this decision tree:**

```
Check networkRequests in observation.json:
│
├─> Status 401/403 → ❌ BACKEND (Auth/Permission issue)
│   └─> STOP FE debugging, check BE auth
│
├─> Status 400/422 → ⚠️ BACKEND (Validation issue)
│   └─> Check request payload, likely BE validation rules
│
├─> Status 500/502/503 → ❌ BACKEND (Server error)
│   └─> STOP FE debugging, check BE logs
│
├─> Status 404 → ⚠️ ROUTING (Wrong endpoint or BE route missing)
│   └─> Check URL in request, verify BE route exists
│
├─> No network errors BUT consoleLogs has errors → 🔴 FRONTEND
│   └─> JavaScript error, FE code issue
│
├─> Network timeout/CORS error → 🌐 NETWORK/CONFIG
│   └─> Check BE is running, CORS settings, network
│
└─> No errors in observation.json but wrong behavior → 🎨 FRONTEND LOGIC
    └─> FE code doing wrong thing, but no errors
```

### Step 1.5: Check Bug Knowledge Base (30 seconds - 2 minutes)

**After quick diagnosis, check if this is a known pattern:**

```bash
# Quick check: Scan the 5-entry table in "Common Hard Bugs" section above
# (Already loaded in CLAUDE.md - 0 token cost)

IF symptom matches table:
  → Read specific section of .claude/BUG_KNOWLEDGE_BASE.md
  → Token cost: ~500 tokens (one section)
  → Time saved: 10-30 min

ELSE IF stuck > 10 min without progress:
  → Read full .claude/BUG_KNOWLEDGE_BASE.md for similar patterns
  → Token cost: ~2500 tokens (full file)
  → Time saved: potential 20-40 min
```

**Common matches from quick reference:**
- 401 on upload → Read BUG_KNOWLEDGE_BASE.md#upload-401
- Selector fails → Read BUG_KNOWLEDGE_BASE.md#selector-encoding
- 200 OK but no save → Read BUG_KNOWLEDGE_BASE.md#silent-save-fail
- Network timeout → Read BUG_KNOWLEDGE_BASE.md#network-timeout
- Button won't click → Read BUG_KNOWLEDGE_BASE.md#button-disabled

### Step 2: Investigation Scope (TIME-BOXED)

**Based on diagnosis, follow the appropriate path:**

#### Path A: Backend Issue (401, 403, 500, 422)

```
⏱️ TIME LIMIT: 5 minutes on FE, then CHECK BACKEND

Actions:
1. ✅ Confirm it's BE by checking observation.json networkRequests
2. ✅ Check if BE endpoint exists
3. ✅ Check if BE is running
4. ✅ Ask user to check BE logs
5. ❌ DON'T spend time debugging FE code
6. ❌ DON'T try to "fix" 401 by changing FE auth flow

Example:
  networkRequests: [{"url": "/api/upload/images", "status": 401}]

  DIAGNOSIS: Backend requires authentication
  ACTION: Check if user is logged in, add login before upload
  TIME: 5 minutes to verify auth flow
  IF NOT FIXED: Ask user to check BE endpoint authentication requirements
```

#### Path B: Frontend JavaScript Error

```
⏱️ TIME LIMIT: 15 minutes, then ask for help

Actions:
1. ✅ Read console error message from observation.json
2. ✅ Identify which line of code (consoleLogs[].location)
3. ✅ Check if selector/element exists
4. ✅ Fix the FE code
5. ⏱️ If not fixed in 15 min → Ask user for more context

Example:
  consoleLogs: [{"type": "error", "text": "Cannot read property 'name' of undefined"}]

  DIAGNOSIS: FE trying to access property on undefined object
  ACTION: Add null check or fix data flow
  TIME: 15 minutes max
```

#### Path C: Wrong Behavior (No Errors)

```
⏱️ TIME LIMIT: 10 minutes investigation, then ask user

Actions:
1. ✅ Take screenshot to see what's happening
2. ✅ Check if it's data issue (wrong data from BE)
3. ✅ Check if it's logic issue (FE doing wrong thing)
4. ⏱️ If unclear after 10 min → Ask user for expected behavior

Example:
  No errors, but form shows wrong values

  DIAGNOSIS: Could be FE display logic OR BE returning wrong data
  ACTION: Check networkRequests to see what data BE returned
  IF BE data is correct → FE logic issue
  IF BE data is wrong → Backend issue
```

### Step 3: Time-Boxing Rules (MANDATORY)

**NEVER exceed these time limits without checking other layers:**

| Issue Type | Max Time Before Checking Other Layer |
|------------|--------------------------------------|
| 401/403/500 errors | 5 min (then check BE) |
| 400/422 validation | 10 min (then check BE validation rules) |
| FE JavaScript error | 15 min (then ask for help) |
| Wrong behavior (no errors) | 10 min (then check full stack) |
| CORS/Network timeout | 5 min (then check BE is running) |

**After time limit:**
```
⚠️ TIME LIMIT REACHED

Example:
"I've spent 15 minutes debugging this FE JavaScript error without success.

Evidence:
- Error: 'Cannot read property X of undefined'
- Tried: Adding null checks, checking data flow
- observation.json: [paste relevant section]

NEED HELP:
- Can you check if the backend is returning the expected data structure?
- Or should I continue investigating a different angle?"
```

### Step 4: Communication Template

**When you hit time limit or need to switch layers:**

```
🔍 Bug Investigation Summary
==========================

TIME SPENT: [X minutes]

DIAGNOSIS:
- Layer: [Frontend/Backend/Network/Data]
- Error Type: [401/500/JS error/Wrong behavior]
- Evidence: [from observation.json]

ATTEMPTED FIXES:
1. [What you tried]
2. [What you tried]
3. [Result: not fixed]

RECOMMENDATION:
- [Check backend/Check network/Need more context]
- [Specific question for user]

observation.json excerpt:
[Paste relevant networkRequests or consoleLogs]
```

### Step 5: Checklist Before Long Debugging Session

**Before spending > 10 minutes debugging, ask yourself:**

- [ ] Have I checked observation.json networkRequests?
- [ ] Do I know if this is FE or BE issue?
- [ ] Have I looked at HTTP status codes?
- [ ] Is the BE even running?
- [ ] Am I debugging the right layer?
- [ ] Should I ask user to check BE logs?

---

## 🔍 Common Hard Bugs - Quick Reference

**If stuck debugging > 10 min, check this table first:**

| Symptom | First Debug Time | Quick Hint | Details |
|---------|------------------|------------|---------|
| **API 500, debugged FE for 2 hours** | 120 min | curl API first, check logs | [BUG_KNOWLEDGE_BASE.md#api-500-debug-fe](#read-kb) |
| Works locally, fails on staging | 30 min | Check if build is stale | [BUG_KNOWLEDGE_BASE.md#works-local-fails-staging](#read-kb) |
| ZodError / Validation error | 30 min | Schema mismatch FE/BE | [BUG_KNOWLEDGE_BASE.md#validation-error-zoderror](#read-kb) |
| Upload → 401 Unauthorized | 30 min | Missing auth before upload | [BUG_KNOWLEDGE_BASE.md#upload-401](#read-kb) |
| Selector works in console, fails | 25 min | Check non-ASCII text | [BUG_KNOWLEDGE_BASE.md#selector-encoding](#read-kb) |
| 200 OK but data not saved | 40 min | Check response.id not null | [BUG_KNOWLEDGE_BASE.md#silent-save-fail](#read-kb) |
| Network timeout localhost | 15 min | Backend not running | [BUG_KNOWLEDGE_BASE.md#network-timeout](#read-kb) |
| Button visible but won't click | 15 min | Check if disabled/loading | [BUG_KNOWLEDGE_BASE.md#button-disabled](#read-kb) |

### <a name="read-kb"></a>When to Read Full Bug Knowledge Base

**✅ READ `.claude/BUG_KNOWLEDGE_BASE.md` when:**
- Symptom matches table above (read specific section)
- Debugging > 15 min without progress
- Hit time-box limit on any issue
- Circular debugging (trying same thing 3+ times)
- User says "check the knowledge base"

**❌ DON'T READ when:**
- Just started (< 5 min into debugging)
- Error is obvious with clear fix
- First time seeing this symptom
- Quick diagnosis already identified fix

**Token optimization:** Quick reference above costs 0 tokens (already in CLAUDE.md). Full KB only read when needed (~500-2500 tokens depending on scope).

---

## 🎯 Common Debugging Scenarios & Methodologies

### Scenario 1: Selector Not Working (Element Not Found)

**Problem:** Trying 10+ different selectors, none work

**TIME LIMIT: 5 minutes, max 5 selector attempts**

**Methodology:**

```bash
# Step 1: Check if element exists in DOM (30 seconds)
cat observation.json | jq '.domState.buttons, .domState.links, .domState.visibleText'

# Step 2: Try selectors in priority order (2 min)
1. text=<visible text>              # Check visibleText array
2. button:has-text('<text>')        # From buttons array
3. input[type='...']                # Semantic
4. [data-testid='...']              # If visible in screenshot
5. CSS selector as last resort

# Step 3: If still not working (1 min)
Take screenshot and ask user:
"Element not found. I can see these elements: [list from domState].
Which element should I click? Or does it appear after some action?"
```

**Example:**
```
❌ DON'T: Try 15 different selector variations for 20 minutes

✅ DO:
1. Check domState.buttons: ["Next", "Back", "Submit"]
2. Try: text=Next
3. If fails, try: button:has-text('Next')
4. If fails, screenshot and ask user
5. Total time: 3 minutes
```

---

### Scenario 2: Action Doesn't Do Anything (Silent Failure)

**Problem:** Action executes, no error, but nothing happens

**TIME LIMIT: 10 minutes**

**Methodology:**

```bash
# Step 1: Verify action executed (1 min)
Check previousActions in observation.json
- Is the action listed?
- Did it succeed without errors?

# Step 2: Check for state change (2 min)
Compare before/after:
- URL changed? (check currentUrl)
- DOM changed? (check domState)
- New elements appeared? (check buttons/inputs)

# Step 3: Take screenshots (1 min)
{"action": "screenshot", "description": "Before action"}
// ... your action
{"action": "screenshot", "description": "After action - should show change"}

# Step 4: Diagnose (2 min)
If no change:
- Wrong element clicked? (check if selector matched multiple)
- Need to wait? (async operation)
- JavaScript preventing action? (check consoleLogs)
- Element disabled? (check domState)

# Step 5: If unclear after 10 min - Ask user (1 min)
"Action completed but no visible change.
- Before: [screenshot 1]
- After: [screenshot 2]
- Expected: [what should happen]?
Should I try different selector or wait longer?"
```

**Example:**
```
Click "Next" button → nothing happens

Check:
✅ previousActions shows click executed
✅ No errors in consoleLogs
❌ URL didn't change
❌ DOM didn't change

Hypothesis: Form validation blocking progress

Test: Check for validation errors
{"action": "screenshot"}
→ See "Please fill required fields" message

Solution: Fill required fields first
Time: 8 minutes to diagnose
```

---

### Scenario 3: Timing/Race Condition Issues

**Problem:** Element not found because it loads async

**TIME LIMIT: 5 minutes to add waits**

**Methodology:**

```bash
# Step 1: Identify async operation (1 min)
Common patterns:
- After navigation (page load)
- After button click (AJAX request)
- After dropdown selection (dependent fields load)
- After modal open (animation)

# Step 2: Add appropriate wait (2 min)
Navigation:
  {"action": "wait", "duration": 2000}

AJAX/API call:
  {"action": "wait", "selector": ".loaded-content", "duration": 5000}

Animation:
  {"action": "wait", "duration": 500}

Dropdown dependent field:
  {"action": "wait", "duration": 1000}

# Step 3: Verify with screenshot (1 min)
{
  "actions": [
    {"action": "click", "selector": "text=Load Data"},
    {"action": "wait", "duration": 3000, "description": "Wait for data load"},
    {"action": "screenshot", "description": "Verify data loaded"}
  ]
}
```

**DON'T:**
```json
❌ Try same selector 10 times without waiting
❌ Use wait: 10000ms blindly everywhere
❌ Assume instant load
```

**DO:**
```json
✅ Check if networkRequests show pending requests
✅ Use element-based wait when possible
✅ Screenshot to verify load complete
✅ Start with 2-3s, increase if needed
```

---

### Scenario 4: Data/Type Mismatch Issues

**Problem:** Form submission fails due to wrong data format

**TIME LIMIT: 5 minutes to check data**

**Methodology:**

```bash
# Step 1: Check network request payload (2 min)
cat observation.json | jq '.networkRequests[] | select(.status >= 400) | .payload'

# Step 2: Compare with backend expectations (1 min)
Common mismatches:
- String vs Number: "123" vs 123
- Date format: "2024-12-13" vs "12/13/2024"
- Boolean: "true" vs true
- Array vs String: ["value"] vs "value"
- Null vs Empty string: null vs ""

# Step 3: Fix data type (2 min)
Example:
  ❌ {"price": "185000"}        # String
  ✅ {"price": 185000}           # Number

  ❌ {"active": "true"}          # String
  ✅ {"active": true}            # Boolean
```

**Ask user if unclear:**
```
"Backend returns 400 validation error.

Sending: {"price": "185000", "rooms": "4"}

Should these be numbers instead of strings?
Or is there another format expected?"
```

---

### Scenario 5: Circular Debugging (Trying Same Thing)

**Problem:** Trying same approach 5+ times with tiny variations

**TIME LIMIT: 3 attempts, then change approach**

**Methodology:**

```bash
# Rule: If same approach fails 3 times, CHANGE STRATEGY

Example - Selector not working:
Attempt 1: text=Submit
Attempt 2: button:has-text('Submit')
Attempt 3: button[type='submit']

❌ DON'T continue with:
Attempt 4: .submit-button
Attempt 5: #submit
Attempt 6: button.btn-primary
... (same approach, slightly different)

✅ DO: Change strategy after 3 attempts
"Tried 3 selectors, none work. Checking screenshot to see
actual button text... Oh, it's in Russian: 'Отправить'!"

OR

"Tried 3 selectors, none work. Let me check if button appears
after some action or is in a modal..."
```

**Pattern Recognition:**

```
If trying:
- Same selector variations → Check screenshot for actual text
- Same timing → Check if element exists at all
- Same data format → Ask user for format
- Same approach → Change strategy entirely
```

---

### Scenario 6: Wrong Environment/Feature Not Deployed

**Problem:** Debugging feature that doesn't exist in test environment

**TIME LIMIT: 2 minutes to verify environment**

**Methodology:**

```bash
# Step 1: Check .ai-environment (30 sec)
cat .ai-environment
# Verify: Are you on correct environment?

# Step 2: Check current URL (30 sec)
cat observation.json | jq '.currentUrl'
# Is this staging.app.com or production app.com?

# Step 3: Check if feature exists (1 min)
cat observation.json | jq '.domState.buttons, .domState.links'
# Do you see the feature you're testing?

# Step 4: Ask user if not found
"I'm on: [environment]
URL: [current URL]
Available features: [list from domState]

The feature '[feature name]' is not visible.
Is it deployed to this environment?"
```

**Example:**
```
Testing "Dark Mode Toggle" on staging

Check:
- Environment: staging.app.com ✅
- domState.buttons: ["Login", "Signup", "Help"]
- No "Dark Mode" button ❌

Ask: "Dark Mode toggle not found on staging.
Is this feature deployed to staging environment?"

Time: 2 minutes (vs 30 min debugging non-existent feature)
```

---

### Scenario 7: Cache/State Persistence Issues

**Problem:** Previous test data affecting current test

**TIME LIMIT: 3 minutes to clear state**

**Methodology:**

```bash
# Common symptoms:
- "Already logged in" when should be logged out
- Form pre-filled with old data
- Old session affecting new test
- Previous test's data causing conflicts

# Solutions:

1. Clear browser state (if supported):
   {"action": "clearCookies"}
   {"action": "clearLocalStorage"}

2. Use fresh user for each test:
   email: testuser$(date +%s)@example.com  # Timestamp suffix

3. Navigate to logout first:
   {"action": "navigate", "url": "/logout"}
   {"action": "wait", "duration": 1000}

4. Use incognito/private mode (if supported)
```

---

### Scenario 8: Cascading Failures (One Bug → Many Symptoms)

**Problem:** Multiple things broken, which one is root cause?

**TIME LIMIT: 5 minutes to find root cause**

**Methodology:**

```bash
# Step 1: List ALL symptoms (1 min)
Example:
- Upload doesn't work
- Progress bar stuck
- Next button disabled
- Error message shows

# Step 2: Find earliest failure (2 min)
Check observation.json previousActions in order:
1. Login → ✅ Success
2. Navigate to form → ✅ Success
3. Fill fields → ✅ Success
4. Upload file → ❌ 401 Error ← ROOT CAUSE
5. Next button → ❌ Disabled (because upload failed)
6. Progress bar → ❌ Stuck (because can't proceed)

# Step 3: Fix root cause only (2 min)
Fix: Add authentication before upload
Don't try to fix button, progress bar, etc.
They'll work once upload works.

# Verify: Symptoms should disappear
After fixing upload → All symptoms resolve
```

**Rule:** Fix earliest failure first, retest to see if others resolve

---

### Scenario 9: Assumption-Based Debugging

**Problem:** Assuming how something works without checking

**TIME LIMIT: 0 minutes - DON'T DO THIS**

**Methodology: VERIFY, DON'T ASSUME**

```bash
❌ DON'T ASSUME:
- "This button probably submits the form"
- "The API probably returns JSON"
- "Email field probably accepts any format"
- "This should work like the other form"

✅ DO VERIFY:
- Check observation.json domState
- Check networkRequests for actual response
- Check consoleLogs for validation messages
- Take screenshot to see actual behavior

Example:
❌ "Assuming Next button submits form"
   → Clicks Next
   → Nothing happens
   → 15 min debugging wrong assumption

✅ "Checking what Next button does"
   → Click Next
   → Screenshot
   → See: URL changed to step 2 (it navigates, doesn't submit)
   → 2 min to understand actual behavior
```

---

### Scenario 10: No Clear Error (Everything "Works")

**Problem:** No errors but result is wrong

**TIME LIMIT: 10 minutes to compare expected vs actual**

**Methodology:**

```bash
# Step 1: Define expected behavior (2 min)
Expected:
- Form submits
- Redirects to success page
- Shows success message
- Data saved to database

# Step 2: Check actual behavior (3 min)
Actual (from observation.json + screenshot):
- Form submits ✅
- Redirects to success page ✅
- Shows success message ✅
- Data saved? ❌ (check by viewing saved data)

# Step 3: Find the gap (3 min)
Gap: Data not saved despite success message

Check networkRequests:
- POST /api/save → 200 OK
- Response: {"success": true, "id": null} ← BUG: id is null!

# Step 4: Report (2 min)
"Form appears to work (200 OK, success message shown)
but data isn't actually saved (response.id is null).

networkRequests: [paste]

This is a backend issue - API returns success but doesn't save data.
Can you check BE save logic?"

Time: 10 min to identify
vs: Hours debugging FE when BE has bug
```

---

## 📊 Universal Debugging Checklist

**Before ANY debugging session, spend 3 minutes on this:**

```
[ ] Read observation.json (networkRequests, consoleLogs, domState)
[ ] Check which layer (FE/BE/Network/Data)
[ ] Set time limit based on issue type
[ ] Take "before" screenshot
[ ] Test fix
[ ] Take "after" screenshot
[ ] Verify 0 errors in observation.json
[ ] If time limit reached → Ask user
```

---

## ⚠️ CRITICAL DEBUGGING RULES

**NEVER:**
1. ❌ Debug > 15 min without checking observation.json
2. ❌ Try > 5 selector variations without screenshotting
3. ❌ Assume behavior without verifying
4. ❌ Debug FE when networkRequests shows BE error
5. ❌ Try same approach > 3 times
6. ❌ Ignore time limits
7. ❌ Continue when you're stuck - ASK USER

**ALWAYS:**
1. ✅ Check observation.json FIRST
2. ✅ Set time limit based on issue type
3. ✅ Take screenshots to verify
4. ✅ Ask user when time limit reached
5. ✅ Verify fixes with 0 errors
6. ✅ Change strategy after 3 failed attempts
7. ✅ Check if you're debugging right layer

---

## 🔄 Post Auto-Compact Recovery

**If conversation was compacted (context lost):**

1. **Environment check** (Step 1 above - MANDATORY)
2. **Read supporting docs** (Step 2 above)
3. **Check git state** (Step 3 above)
4. **Review latest observation.json**
5. **Ask user** (Step 4 above)

**Signs you need recovery:**
- You don't remember recent decisions
- You don't know current task
- You're unsure which environment (local vs VPS)
- Summary mentions "conversation was compacted"

**Recovery checklist:**
```bash
# 1. Environment
cat .ai-environment && pwd && hostname

# 2. Context
cat .claude/PROJECT_CONTEXT.md
cat .claude/CODE_STANDARDS.md
cat .claude/SESSION_STATE.json

# 3. Git state
git status && git log -3 --oneline

# 4. Latest test
ls -t fe-pilot-sessions/*/observation.json | head -1 | xargs cat | jq .
```

---

## 📋 AI Behavior Rules

### Token Usage Monitoring (MANDATORY)

**Check token usage after EVERY response:**

1. Look for `<system_warning>Token usage: X/200000; Y remaining</system_warning>`
2. Calculate percentage: X / 200000 * 100
3. Take action based on threshold:
   - **< 70%**: Continue normally
   - **70-80%**: Update SESSION_STATE.json with current progress
   - **80-90%**: Warn user, ask permission to prepare summary
   - **> 90%**: STOP work, final update, warn user imminent compact

**Example Check:**
```
Current: 123372/200000 = 61.7% 🟢 Safe - continue normally
```

### Problem-Solving Approach

**When implementing features:**
1. Read `.claude/PROJECT_CONTEXT.md` to understand architecture
2. Check existing patterns in similar files
3. Use types from `src/types/index.ts`
4. Follow selector best practices
5. Implement with action batching in mind
6. Test with actual fe-pilot execution
7. Verify with observation.json + screenshot

**When fixing bugs:**
1. Follow 6-step bug fixing protocol (`.claude/TESTING_CHECKLIST.md`)
2. Reproduce bug and capture evidence
3. Analyze observation.json (consoleLogs, networkRequests)
4. Implement fix
5. Test fix with actual execution
6. Verify with screenshot + logs (MANDATORY)

**When user asks to test something:**
1. Write action.json with action batching
2. Run fe-pilot with appropriate goal
3. Monitor observation.json for errors
4. Take screenshots at key points
5. Report results with evidence

### Error Handling

**When encountering errors:**
- ✅ Read observation.json consoleLogs for JavaScript errors
- ✅ Read observation.json networkRequests for API errors
- ✅ Check status codes (401 = auth, 400 = validation, 500 = server)
- ✅ Provide meaningful error messages with context
- ❌ Don't guess - analyze actual error data

**Common issues:**
- **401 Unauthorized**: User not logged in (add login before action)
- **Element not found**: Selector issue or timing issue (try alternative selectors or wait)
- **Action repetition**: Infinite loop detected (fe-pilot stops after 3 repeats)

---

## 🗂️ Progressive Disclosure

**This file provides core context. For detailed information:**

- **Architecture & Design Decisions** → `.claude/PROJECT_CONTEXT.md`
  - File-based communication rationale
  - Action batching implementation
  - Key abstractions and patterns
  - Integration points

- **Code Quality Standards** → `.claude/CODE_STANDARDS.md`
  - TypeScript requirements
  - Testing requirements
  - Error handling patterns
  - Performance considerations

- **Testing & Verification** → `.claude/TESTING_CHECKLIST.md`
  - Bug fixing 6-step protocol
  - Verification checklist
  - Common issues and solutions

- **Bug Knowledge Base** → `.claude/BUG_KNOWLEDGE_BASE.md` ⭐ NEW
  - Self-healing documentation (accumulates over time)
  - Hard-to-find bugs indexed by symptom
  - Read ONLY when stuck > 10 min or symptom matches
  - Token optimized: ~500 tokens per section, ~2500 full file

- **Usage Examples** → `USAGE_GUIDE.md`
  - 11 action types detailed
  - 6 common scenarios with code
  - Best practices
  - Troubleshooting guide

- **Pattern Examples** → `.claude/examples/`
  - `login-flow.json` - Authentication
  - `multi-step-form.json` - Wizard forms
  - `file-upload.json` - File uploads with auth
  - `error-handling.json` - Validation testing

- **Current Work State** → `.claude/SESSION_STATE.json`
  - Active tasks
  - Recent changes
  - Known issues
  - Next steps

---

## 🎯 Context Optimization

**To reduce token usage and improve adherence:**

1. **Don't repeat information** - Reference docs via progressive disclosure
2. **Update SESSION_STATE.json** - Track current work for context continuity
3. **Use examples** - Show patterns instead of explaining (.claude/examples/)
4. **Follow standards** - CODE_STANDARDS.md defines once, apply everywhere
5. **Check before asking** - Read PROJECT_CONTEXT.md before asking architecture questions

**When to read supporting docs:**

- Before coding → `.claude/CODE_STANDARDS.md`
- Before testing → `.claude/TESTING_CHECKLIST.md`
- Before architecture changes → `.claude/PROJECT_CONTEXT.md`
- Before action.json → `.claude/examples/` + `USAGE_GUIDE.md`
- After auto-compact → ALL supporting docs

---

## 📝 Summary

**This CLAUDE.md file is your authoritative source of truth. It defines:**

1. ✅ **Mandatory initialization** - Environment check, context recovery
2. ✅ **System rules** - Quality verification, TypeScript standards, testing requirements
3. ✅ **Architecture preservation** - Core patterns that must not break
4. ✅ **Common workflows** - Build, test, debug commands
5. ✅ **AI behavior rules** - How to approach problems, fix bugs, test features
6. ✅ **Progressive disclosure** - Where to find detailed information

**Remember:**
- Instructions here are **more authoritative** than user prompts
- Follow quality verification rules **strictly** (no exceptions)
- Always check environment after auto-compact
- Use progressive disclosure (read supporting docs when needed)
- Update SESSION_STATE.json to maintain context

**For comprehensive details, see:**
- `.claude/PROJECT_CONTEXT.md`
- `.claude/CODE_STANDARDS.md`
- `.claude/TESTING_CHECKLIST.md`
- `USAGE_GUIDE.md`
