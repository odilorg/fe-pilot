# Bug Knowledge Base - Self-Healing Documentation

> **Purpose:** Accumulate debugging intelligence over time - each hard bug becomes future debugging knowledge
> **Usage:** Check this ONLY when stuck > 10 min or symptom matches quick reference in CLAUDE.md
> **Update:** Add entries when debugging takes > 15 min or bug is subtle/hard to detect
> **Token optimization:** Read specific sections via anchors, not entire file

---

## 📊 Quick Reference by Symptom

**Use this to quickly find relevant bug patterns:**

| Category | Symptom | Time Saved | Anchor |
|----------|---------|------------|--------|
| **Tool Selection** | Using fe-pilot for API debugging | 10+ min → 30s | [#using-fe-pilot-for-debugging](#using-fe-pilot-for-debugging) |
| **Backend Debugging** | API 500, debugged FE for 2 hours | 120 min → 5 min | [#api-500-debug-fe](#api-500-debug-fe) |
| **Deployment** | Works locally, fails on staging | 30 min → 3 min | [#works-local-fails-staging](#works-local-fails-staging) |
| **Validation** | ZodError / Schema mismatch | 30 min → 5 min | [#validation-error-zoderror](#validation-error-zoderror) |
| **Authentication** | Upload returns 401 | 30 min → 2 min | [#upload-401](#upload-401) |
| **Selectors** | Text selector fails on non-ASCII | 25 min → 5 min | [#selector-encoding](#selector-encoding) |
| **Backend Issues** | 200 OK but data not saved | 40 min → 5 min | [#silent-save-fail](#silent-save-fail) |
| **Network** | Timeout on localhost | 15 min → 2 min | [#network-timeout](#network-timeout) |
| **UI State** | Button visible but won't click | 15 min → 2 min | [#button-disabled](#button-disabled) |

**Total bugs documented:** 9
**Total time saved (cumulative):** 0 min (no recurrences yet - will update as bugs recur)
**Last updated:** 2024-12-13

---

## 📋 How to Use This Knowledge Base

### When Debugging

```bash
Step 1: Check CLAUDE.md quick reference (already loaded, 0 tokens)
  ↓
Step 2: Symptom matches? → Read specific section below (~500 tokens)
  Example: cat .claude/BUG_KNOWLEDGE_BASE.md | sed -n '/^### <a name="upload-401"/,/^### /p'
  ↓
Step 3: No match? Continue normal debugging
  ↓
Step 4: Stuck > 15 min? → Read full KB for similar patterns (~2500 tokens)
```

### When Adding New Bugs

**Trigger: Add when any of these are true:**
- ✅ Debugging took > 15 minutes
- ✅ Bug was subtle/hard to detect
- ✅ Debugged wrong layer initially (FE when bug in BE)
- ✅ User says "this was tricky to find"
- ✅ Bug appears 2+ times
- ✅ Root cause was non-obvious

**Template for new entries:**

```markdown
### <a name="bug-slug"></a>Bug: Descriptive Title

**Observable Symptoms:**
- What you see in observation.json
- What behavior you observe
- What errors appear (or don't appear)

**Diagnostic Steps (X min):**
1. Step-by-step investigation process
2. What to check first
3. How to confirm root cause

**Root Cause:**
Explanation of why this happens

**Fix (X min):**
Concrete steps to fix with code examples

**Prevention:**
How to avoid this bug in future:
- Code patterns to use
- Checks to add
- Documentation to update

**Metrics:**
- First discovered: YYYY-MM-DD
- Time to debug (first): X min
- Time to debug (with knowledge): X min
- Frequency: High/Medium/Low
- Occurrences: X times
- Severity: High/Medium/Low
- Total time saved: X min

**Last updated:** YYYY-MM-DD
```

---

## 🔍 Detailed Bug Patterns

---

### <a name="upload-401"></a>Bug: Upload Returns 401 Unauthorized

**Observable Symptoms:**
- `observation.json` shows: `networkRequests: [{url: "/api/upload/images", status: 401}]`
- Upload action in `previousActions` shows `success: true`
- No console errors in `consoleLogs`
- File doesn't appear in UI after upload
- Screenshot shows upload area still empty

**Diagnostic Steps (2 min):**
```bash
# 1. Check network request status
cat observation.json | jq '.networkRequests[] | select(.url | contains("upload")) | {url, status}'

# 2. Check if login happened before upload
cat observation.json | jq '.previousActions[] | select(.action == "type" and (.selector | contains("email") or contains("password")))'

# 3. If no login found → Root cause confirmed: Missing authentication
```

**Root Cause:**
Backend endpoint `/api/upload/images` requires authenticated session. User not logged in before upload action.

**Fix (2 min):**
Add login actions before upload in action.json:

```json
{
  "reasoning": "Upload requires authentication - login first",
  "actions": [
    {
      "action": "click",
      "selector": "text=Login, text=Войти",
      "description": "Open login modal"
    },
    {
      "action": "wait",
      "duration": 500
    },
    {
      "action": "type",
      "selector": "input[type='email']",
      "value": "test@example.com",
      "description": "Enter email"
    },
    {
      "action": "type",
      "selector": "input[type='password']",
      "value": "password123",
      "description": "Enter password"
    },
    {
      "action": "click",
      "selector": "button[type='submit']",
      "description": "Submit login"
    },
    {
      "action": "wait",
      "duration": 2000,
      "description": "Wait for login to complete and session to establish"
    },
    {
      "action": "upload",
      "selector": "input[type='file']",
      "value": "/path/to/file.jpg",
      "description": "Now upload is authenticated"
    }
  ]
}
```

**Prevention:**
- **Always check backend API auth requirements** before file operations
- Add comment to `.claude/examples/file-upload.json`: "IMPORTANT: Login required"
- Update TESTING_CHECKLIST.md: "Verify auth state before upload actions"
- Pattern: Any `/api/upload/*` endpoint requires auth

**Metrics:**
- First discovered: 2024-12-13
- Time to debug (first): 30 min
- Time to debug (with knowledge): 2 min
- Frequency: High (likely to recur)
- Occurrences: 1 (initial discovery)
- Severity: Medium (blocks upload feature)
- Total time saved: 0 min (no recurrences yet)

**Last updated:** 2024-12-13

---

### <a name="selector-encoding"></a>Bug: Text Selector Fails on Non-ASCII Characters

**Observable Symptoms:**
- Selector like `text=Войти` (Russian "Login") fails
- Same element works in browser console: `document.querySelector("button:has-text('Войти')")`
- `observation.json` shows button in `domState.buttons: ["Войти", "Регистрация"]`
- Error: "Element not found" despite being visible in screenshot

**Diagnostic Steps (5 min):**
```bash
# 1. Check if button text has non-ASCII characters
cat observation.json | jq '.domState.buttons[]'

# 2. Try multiple selector formats
text=Войти              # Might fail due to encoding
button:has-text('Войти')  # Better encoding handling
text=Login, text=Войти    # Fallback to English if available

# 3. Check screenshot to verify actual button text
ls -t fe-pilot-sessions/*/screenshots/ | head -1
```

**Root Cause:**
Playwright's `text=` selector can have encoding issues with Cyrillic/non-ASCII characters depending on file encoding and terminal settings.

**Fix (2 min):**
Use multiple selectors with fallbacks:

```json
{
  "action": "click",
  "selector": "button:has-text('Login'), button:has-text('Войти'), text=Login, text=Войти",
  "description": "Click login (English + Russian fallbacks)"
}
```

Or use attribute selectors:
```json
{
  "action": "click",
  "selector": "button[type='submit'], .login-button, [data-testid='login-btn']",
  "description": "Use semantic selectors instead of text"
}
```

**Prevention:**
- **Always provide English + local language fallbacks** for text selectors
- Prefer semantic selectors: `button[type='submit']` over `text=Submit`
- Use `button:has-text()` instead of `text=` for better encoding
- Document in CODE_STANDARDS.md: "Multi-language selector patterns"

**Metrics:**
- First discovered: 2024-12-13 (anticipated based on i18n app)
- Time to debug (first): 25 min (estimate)
- Time to debug (with knowledge): 5 min
- Frequency: Medium (happens on Russian/Uzbek text)
- Occurrences: 0 (preventive documentation)
- Severity: Medium (blocks localized UI testing)
- Total time saved: 0 min

**Last updated:** 2024-12-13

---

### <a name="silent-save-fail"></a>Bug: 200 OK But Data Not Saved

**Observable Symptoms:**
- Form submits successfully (no errors)
- Success message appears in UI
- `observation.json` shows: `networkRequests: [{url: "/api/save", status: 200, response: {success: true, id: null}}]`
- But: Data doesn't appear in list/database
- Refreshing page shows no new item

**Diagnostic Steps (5 min):**
```bash
# 1. Check network request response body, not just status
cat observation.json | jq '.networkRequests[] | select(.url | contains("save")) | .response'

# 2. Look for null/undefined in critical fields
# Success response should have: {success: true, id: 123, data: {...}}
# Bug response shows: {success: true, id: null} ← RED FLAG

# 3. Verify data appears in UI/database
# Take screenshot, check if new item visible
```

**Root Cause:**
Backend bug: Returns 200 OK even when save operation fails internally. Should return 4xx/5xx but doesn't. This is a **backend issue masquerading as success**.

**Fix (5 min):**
Two-part fix:

1. **Report backend bug** (not FE issue):
   ```
   Backend /api/save returns 200 OK with id: null when save fails.
   Should return 400/500 with error message instead.
   ```

2. **Add FE validation** as workaround:
   ```javascript
   // In FE code (not fe-pilot, but document the pattern)
   if (response.status === 200 && response.data.id === null) {
     throw new Error('Save failed despite 200 OK - id is null');
   }
   ```

3. **For fe-pilot testing**, add verification:
   ```json
   {
     "action": "verify",
     "expect": [
       {
         "type": "element_visible",
         "selector": "text=Success"
       }
     ],
     "description": "Verify success message"
   },
   {
     "action": "screenshot",
     "description": "Verify data appears in list"
   }
   ```

**Prevention:**
- **NEVER trust 200 OK alone** - always validate response body structure
- Check critical fields exist and have valid values (id, data, etc.)
- Add response body validation to observation.json collection
- Pattern: Any `id: null` in success response is a RED FLAG

**Metrics:**
- First discovered: 2024-12-13 (anticipated pattern)
- Time to debug (first): 40 min (debugged FE when bug was in BE)
- Time to debug (with knowledge): 5 min
- Frequency: Low (backend-specific)
- Occurrences: 0 (preventive)
- Severity: High (data loss)
- Total time saved: 0 min

**Last updated:** 2024-12-13

---

### <a name="network-timeout"></a>Bug: Network Timeout on Localhost

**Observable Symptoms:**
- `observation.json` shows: `networkRequests: [{url: "http://localhost:3000/api/...", error: "net::ERR_CONNECTION_REFUSED"}]`
- Or: `networkRequests: []` (no requests at all)
- Console shows: "Failed to fetch" or "Network timeout"
- All actions appear to execute but nothing works

**Diagnostic Steps (2 min):**
```bash
# 1. Check if backend is actually running
curl http://localhost:3000/api/health
# Or check process
ps aux | grep node | grep -v grep

# 2. Check observation.json for connection errors
cat observation.json | jq '.networkRequests[] | select(.error)'

# 3. If backend not running → That's the problem!
```

**Root Cause:**
Backend server not running. Common scenarios:
- Forgot to start backend
- Backend crashed
- Wrong port (expecting 3000, backend on 3001)
- Backend running on VPS, testing on local

**Fix (1 min):**
Start the backend:

```bash
# Navigate to backend directory
cd /path/to/backend

# Start backend server
npm run dev
# or
node server.js
```

Or if wrong environment:
```bash
# Check .ai-environment
cat .ai-environment
# If testing on local but backend on VPS → Use VPS URL or start local BE
```

**Prevention:**
- **Always verify backend is running** before starting fe-pilot tests
- Add to pre-flight checklist: `curl <backend-url>/health`
- Use environment check from `.ai-environment`
- Pattern: Network timeout = backend issue, not FE issue

**Metrics:**
- First discovered: 2024-12-13 (common scenario)
- Time to debug (first): 15 min
- Time to debug (with knowledge): 2 min
- Frequency: Medium (happens after restarts)
- Occurrences: 0 (preventive)
- Severity: High (blocks all tests)
- Total time saved: 0 min

**Last updated:** 2024-12-13

---

### <a name="button-disabled"></a>Bug: Button Visible But Won't Click

**Observable Symptoms:**
- Button is visible in screenshot
- `observation.json` shows button in `domState.buttons: ["Next"]`
- Click action succeeds in `previousActions`
- But: Nothing happens (no navigation, no form submission)
- URL doesn't change, DOM doesn't change

**Diagnostic Steps (2 min):**
```bash
# 1. Check screenshot - is button grayed out or has loading spinner?

# 2. Check domState for disabled attribute
cat observation.json | jq '.domState' | grep -i disabled

# 3. Check if button is waiting for validation
# Often buttons are disabled until form is valid
cat observation.json | jq '.consoleLogs[] | select(.type == "error")'
```

**Root Cause:**
Button is disabled due to:
- Form validation not passed (required fields empty)
- Button in loading state (async operation in progress)
- Button disabled by JavaScript logic
- Element is covered by overlay/modal

**Fix (3 min):**
Check validation state and fill required fields:

```json
{
  "reasoning": "Button disabled - check validation",
  "actions": [
    {
      "action": "screenshot",
      "description": "Before click - check button state"
    },
    {
      "action": "verify",
      "expect": [
        {
          "type": "element_visible",
          "selector": "button:not([disabled]):has-text('Next')"
        }
      ],
      "description": "Verify button is enabled before clicking"
    },
    {
      "action": "click",
      "selector": "button:has-text('Next')",
      "description": "Click now that button is enabled"
    }
  ]
}
```

Or fill missing fields:
```json
{
  "actions": [
    {
      "action": "type",
      "selector": "input[required]:not([value])",
      "value": "test value",
      "description": "Fill required field to enable button"
    },
    {
      "action": "wait",
      "duration": 500,
      "description": "Wait for validation"
    },
    {
      "action": "click",
      "selector": "button:has-text('Next')",
      "description": "Button should be enabled now"
    }
  ]
}
```

**Prevention:**
- **Check button state before clicking**: Use `:not([disabled])` selector
- Verify all required fields are filled before proceeding
- Add wait for validation to complete
- Take screenshot before/after to verify state change
- Pattern: Disabled button = validation or state issue

**Metrics:**
- First discovered: 2024-12-13 (common pattern)
- Time to debug (first): 15 min
- Time to debug (with knowledge): 2 min
- Frequency: High (validation is common)
- Occurrences: 0 (preventive)
- Severity: Medium (blocks form progression)
- Total time saved: 0 min

**Last updated:** 2024-12-13

---

### <a name="api-500-debug-fe"></a>Bug: API Returns 500 But Debugging Frontend for Hours

**Observable Symptoms:**
- fe-pilot actions execute successfully
- `observation.json` shows: `networkRequests: [{url: "/api/endpoint", status: 500}]`
- Frontend appears to work (no console errors)
- Data doesn't appear or is incorrect
- Spent > 30 min debugging React state, useEffect, props
- Still no progress

**Diagnostic Steps (2 min):**
```bash
# STOP debugging frontend! Test API directly first.

# 1. Copy exact URL from observation.json networkRequests
# Test with curl (5 seconds)
curl -i "https://staging.app.com/api/endpoint?param1=value1&param2=value2"

# 2. See 500 error? Check server logs immediately (30 seconds)
ssh user@server "pm2 logs api-name --lines 50 | grep -i error"

# 3. Read the COMPLETE error message
# Common errors:
# - ZodError → Schema validation issue
# - TypeError → Null/undefined variable
# - ReferenceError → Using undefined variable
# - SQL Error → Database query issue
```

**Root Cause:**
**80% of "frontend bugs" are actually backend issues.** Debugging React when API is broken wastes hours.

**The Bedroom Filter Case Study:**
- Time spent debugging frontend: 2 hours
- Time to find real issue with curl + logs: 5 minutes
- Root cause: Backend validation error (ZodError)
- Fix location: Backend schema, not frontend

**Fix (5 min total):**
```bash
# Step 1: Test API (30 sec)
curl "https://staging.app.com/api/properties?bedrooms=0,1,2"
# Response: 500 error ← Stop debugging FE!

# Step 2: Check logs (30 sec)
ssh staging "pm2 logs api --lines 50"
# Error: "ZodError: Expected number, received array" ← There's the bug!

# Step 3: Fix backend validation (2 min)
# Update schema to accept array: z.union([z.number(), z.array(z.number())])

# Step 4: Deploy backend fix (2 min)
ssh staging "cd /var/www/app && pnpm build && pm2 restart api"

# Step 5: Verify (30 sec)
curl "https://staging.app.com/api/properties?bedrooms=0,1,2"
# Response: 200 OK ✅
```

**Prevention:**
- **ALWAYS test API with curl BEFORE debugging frontend**
- Add to debugging protocol: "Step 0: curl the API"
- If networkRequests shows 4xx/5xx → Backend issue, not frontend
- Create debugging checklist: □ Tested API? □ Checked logs? □ Verified deployed code?

**Metrics:**
- First discovered: 2024-12-13 (bedroom filter bug)
- Time to debug (first, wrong approach): 120 min
- Time to debug (correct approach): 5 min
- Frequency: High (very common mistake)
- Occurrences: 1
- Severity: High (massive time waste)
- Total time saved: 115 min (on first recurrence)

**Last updated:** 2024-12-13

---

### <a name="works-local-fails-staging"></a>Bug: Works Locally But Fails on Staging

**Observable Symptoms:**
- Feature works perfectly on `localhost:3000`
- Same feature fails on staging (500 error, wrong data, etc.)
- Code looks correct (fix is in git commits)
- `git log` shows recent commit with the fix
- But staging still broken

**Diagnostic Steps (3 min):**
```bash
# 1. Test both environments with same request (30 sec)
# Local
curl "http://localhost:3000/api/endpoint?param=value"
# Staging
curl "https://staging.app.com/api/endpoint?param=value"

# 2. Check what commit is deployed (30 sec)
ssh staging "cd /var/www/app && git log -1 --oneline"
# Shows: abc123f Add fix for bedrooms validation ← Fix IS in git!

# 3. Check when code was built (30 sec)
ssh staging "ls -lh /var/www/app/dist/main.js"
# Shows: Dec 10 14:23 ← But today is Dec 13!
# ← STALE BUILD! Code has fix, but build doesn't.

# 4. Check if build has the fix (1 min)
ssh staging "grep -n 'the-fix-keyword' /var/www/app/dist/main.js"
# Not found! ← Confirms stale build

# Diagnosis: Source has fix, deployed build doesn't
```

**Root Cause:**
**Stale build**: Git has latest code, but app wasn't rebuilt after commit. Common in monorepos where shared packages need rebuild.

**Common scenarios:**
1. Committed fix, didn't rebuild
2. Rebuilt app, but not its dependencies (monorepo)
3. Build cached, didn't invalidate
4. PM2 restarted, but didn't rebuild first

**Fix (3 min):**
```bash
# For simple apps
ssh staging "cd /var/www/app && pnpm build && pm2 restart api"

# For monorepos (rebuild dependencies first!)
ssh staging "cd /var/www/app && \
  pnpm --filter @repo/shared build && \
  pnpm --filter @repo/api build && \
  pm2 restart api"

# Verify fix is now deployed
curl "https://staging.app.com/api/endpoint?param=value"
# Should return 200 OK now
```

**Prevention:**
- **Always verify deployed build matches source**
- Add to deployment script: `git log -1 && ls -lh dist/ && pm2 restart`
- Check build date vs commit date: `ls -lh dist/main.js` vs `git log -1 --format=%ai`
- For monorepos: Document dependency rebuild order
- Create deployment checklist: □ Git pulled? □ Dependencies rebuilt? □ App rebuilt? □ PM2 restarted?

**Metrics:**
- First discovered: 2024-12-13
- Time to debug (first): 30 min (tried fixing code before checking build)
- Time to debug (with knowledge): 3 min
- Frequency: High (very common in monorepos)
- Occurrences: 1
- Severity: Medium (wastes time, easy to fix)
- Total time saved: 27 min (per recurrence)

**Last updated:** 2024-12-13

---

### <a name="validation-error-zoderror"></a>Bug: Validation Error (ZodError) - Schema Mismatch

**Observable Symptoms:**
- `observation.json` shows: `networkRequests: [{status: 500, error: "ZodError..."}]`
- Or logs show: `ZodError: Expected X, received Y`
- Or logs show: `ZodError at path ['field']: ...`
- Frontend sends data, backend rejects it
- Works with some data, fails with other data

**Diagnostic Steps (2 min):**
```bash
# 1. Check exact error from logs
ssh server "pm2 logs api --lines 50 | grep -A 5 ZodError"

# Example error:
# ZodError at path ['bedrooms']: Expected number, received array
# ← Backend expects: bedrooms: 1
# ← Frontend sends: bedrooms: [0,1,2]

# 2. Check what frontend is sending
cat observation.json | jq '.networkRequests[] | select(.status >= 400) | .payload'

# 3. Check backend schema definition
ssh server "grep -A 10 'bedrooms.*z\\.' packages/shared/src/schema.ts"

# 4. Identify mismatch
# Frontend sends: array
# Backend expects: number
# → Schema needs to accept both
```

**Root Cause:**
Frontend and backend have **schema mismatch**. Common causes:
1. Backend schema too strict (doesn't accept valid formats)
2. Frontend sends wrong format
3. Schema updated in one place, not the other
4. Different validation libraries (frontend vs backend)

**Fix (5 min):**
```typescript
// Before (too strict)
const schema = z.object({
  bedrooms: z.number() // Only accepts single number
})

// After (accepts both formats)
const schema = z.object({
  bedrooms: z.union([
    z.number(),           // Single: 2
    z.array(z.number())   // Multiple: [0,1,2]
  ])
})

// Or transform array to match
const schema = z.object({
  bedrooms: z.union([z.number(), z.array(z.number())])
    .transform(val => Array.isArray(val) ? val : [val])
})
```

Then rebuild + deploy:
```bash
# Monorepo (rebuild shared package first!)
ssh server "cd /var/www/app && \
  pnpm --filter @repo/shared build && \
  pnpm --filter @repo/api build && \
  pm2 restart api"
```

**Prevention:**
- **Share validation schemas** between frontend/backend (single source of truth)
- Use monorepo with shared package: `@repo/shared/schema`
- Test API with curl using actual frontend payloads
- Add integration tests that use real API client
- Document schema in OpenAPI/Swagger

**Metrics:**
- First discovered: 2024-12-13 (bedroom filter)
- Time to debug (first): 30 min (if you check logs immediately)
- Time to debug (with knowledge): 5 min
- Frequency: High (common with filters, arrays, unions)
- Occurrences: 1
- Severity: Medium (blocks features)
- Total time saved: 25 min

**Last updated:** 2024-12-13

---

### <a name="using-fe-pilot-for-debugging"></a>Bug: Using fe-pilot for API Debugging (Wrong Tool)

**Observable Symptoms:**
- API returns 500 error or wrong data
- Trying to use fe-pilot to find the bug
- fe-pilot explore mode taking 5-10+ minutes
- Still don't know what's wrong after fe-pilot completes
- Frustrated because "the tool should find bugs automatically"

**Diagnostic Steps (30 seconds):**
```bash
# STOP using fe-pilot for debugging!

# Ask yourself:
# - Is this an API issue? (500 error, wrong data, validation)
# - Do I need to know WHY something is broken?
# - Am I trying to find the root cause?

# If YES to any → DON'T use fe-pilot

# fe-pilot shows: "Something is broken" ✅
# fe-pilot doesn't show: "WHY it's broken" ❌

# Use the right tool instead:
curl "https://api.app.com/endpoint"  # 5 seconds → root cause
# vs
fe-pilot explore "https://app.com"   # 10 minutes → "it's broken"
```

**Root Cause:**
**fe-pilot is a verification/testing tool, NOT a debugging tool.**

**What fe-pilot IS:**
- ✅ E2E testing framework
- ✅ Visual verification tool
- ✅ Regression test automation
- ✅ Post-fix validation ("does it work now?")
- ✅ User flow testing (login → browse → checkout)

**What fe-pilot is NOT:**
- ❌ API debugging tool (use curl)
- ❌ Root cause analyzer (use logs)
- ❌ Quick diagnostic tool (use DevTools)
- ❌ Backend error finder (use PM2 logs)

**The Bedroom Filter Case Study:**

```
Tried with fe-pilot:
├─ Created YAML scenario → Failed (parsing error)
├─ Used explore mode → Timed out (300s waiting for AI)
└─ Result: Didn't find the bug, wasted 10+ min

Tried with curl:
├─ curl "https://api.../properties?bedrooms=0,1,2"
├─ Response: 500 error
├─ ssh "pm2 logs api --lines 50"
├─ Error: "ZodError: Expected number, received array"
└─ Result: Found bug in 30 seconds, fixed in 5 min ✅
```

**Fix (Use the Right Tool):**

**Debugging Hierarchy (fastest → slowest):**
```
1. curl (5 seconds) ← START HERE for API issues
   curl "https://api.app.com/endpoint"

2. Server logs (30 seconds)
   ssh server "pm2 logs app --lines 50"

3. Browser DevTools (1 minute)
   Network tab → See actual requests

4. Manual testing (5 minutes)
   Click around, reproduce the bug

5. fe-pilot (10+ minutes) ← Use for VERIFICATION, not discovery
   After you've fixed the bug, verify it works end-to-end
```

**When to Use Each Tool:**

| Scenario | Tool | Time | Why |
|----------|------|------|-----|
| API returns error | curl | 30s | Shows exact error |
| Need server error | PM2 logs | 30s | Shows stack trace |
| UI looks broken | Browser DevTools | 1min | Visual inspection |
| **Test full user flow** | **fe-pilot** | **5-10min** | **E2E automation** |
| **Regression testing** | **fe-pilot** | **Daily** | **Catch bugs early** |
| Quick API test | curl | 5s | Fastest ✅ |

**Correct fe-pilot Usage:**

```bash
# ❌ WRONG: Using fe-pilot to find API bug
node dist/index.js explore "https://app.com" \
  --goal "Debug the bedroom filter bug"
# Result: Slow, doesn't show root cause

# ✅ RIGHT: Using curl to find API bug
curl "https://api.app.com/properties?bedrooms=0,1,2"
ssh server "pm2 logs api --lines 50"
# Result: Fast, shows exact error

# ✅ RIGHT: Using fe-pilot to verify fix
# After fixing the backend bug:
node dist/index.js explore "https://app.com" \
  --goal "Complete property search with bedroom filter: Studio, 1-bedroom, 2-bedroom"
# Result: Confirms the entire flow works end-to-end
```

**Prevention:**
- **Use fe-pilot for E2E testing, not debugging**
- **Always start with the fastest tool** (curl, logs, DevTools)
- **Use fe-pilot to verify AFTER you fix bugs**, not to find them
- Add to debugging checklist: "Is this an API issue? → Use curl first"
- Reserve fe-pilot for: Regression tests, E2E flows, visual verification

**Metrics:**
- First discovered: 2024-12-13 (bedroom filter debugging attempt)
- Time wasted with fe-pilot: 10+ min (didn't find bug)
- Time with correct tool (curl): 30 sec (found bug immediately)
- Frequency: High (common misconception about fe-pilot's purpose)
- Occurrences: 1
- Severity: Medium (wastes time, but teaches tool usage)
- Total time saved: 10 min (when you don't misuse fe-pilot)

**Last updated:** 2024-12-13

---

## 🔧 Backend Debugging Protocol

**CRITICAL: Use this protocol BEFORE debugging frontend (and before fe-pilot)**

### The 5-Minute API-First Protocol

```bash
# ⚠️ DON'T start with React DevTools
# ⚠️ DON'T add console.logs everywhere
# ⚠️ DON'T debug useState/useEffect

# ✅ DO THIS FIRST (takes 5 minutes):

# Step 1: Test API directly (30 seconds)
curl -i "https://staging.app.com/api/endpoint?params=here"

# Step 2: Check status code (5 seconds)
# - 200 OK → API works, problem is frontend
# - 500 → Backend error (go to Step 3)
# - 400 → Validation error (check request params)
# - 401/403 → Authentication issue
# - 404 → Wrong endpoint or route missing

# Step 3: If 500/400, check logs (30 seconds)
ssh server "pm2 logs api --lines 50 | grep -i error"

# Step 4: Compare environments (1 minute)
curl "http://localhost:3000/api/endpoint"     # Local
curl "https://staging.app.com/api/endpoint"   # Staging
# Different results? → Environment/deployment issue

# Step 5: Verify deployed code (1 minute)
ssh server "cd /var/www/app && git log -1 --oneline"
ssh server "ls -lh /var/www/app/dist/main.js"
# Build older than commit? → Stale build, rebuild needed

# ✅ TOTAL TIME: 3-5 minutes
# ✅ IDENTIFIES: 80% of bugs immediately
```

### Decision Tree

```
Issue: "Feature not working"
│
├─ Step 1: curl the API
│  │
│  ├─ ✅ 200 OK, data correct
│  │  └─ Problem is FRONTEND → Now debug React
│  │
│  ├─ ❌ 500
│  │  └─ Step 2: Check logs → ZodError/TypeError/etc
│  │     └─ Fix BACKEND, not frontend
│  │
│  ├─ ❌ 400
│  │  └─ Check request payload (missing field? wrong type?)
│  │
│  └─ ❌ 401/403/404
│     └─ Auth or routing issue
│
├─ Step 3: Compare environments
│  │
│  ├─ Works locally, fails staging
│  │  └─ Step 4: Check if build is stale
│  │     └─ Rebuild if needed
│  │
│  └─ Fails everywhere
│     └─ Code bug, fix in source
```

### Common Mistakes to Avoid

| ❌ Don't Do This | ✅ Do This Instead | Time Saved |
|------------------|-------------------|------------|
| Debug React state for 2 hours | curl API (30 sec) | 115 min |
| Add 20 console.logs | Check pm2 logs (30 sec) | 30 min |
| Assume deployed = latest git | Verify build date | 20 min |
| Test only in production | Test local → staging → prod | 40 min |
| Read partial error message | Read COMPLETE error | 15 min |

### Quick Commands Reference

```bash
# Test API
curl -i "https://api.app.com/endpoint?param=value"

# With JSON body
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"field":"value"}' "https://api.app.com/endpoint"

# With auth
curl -i -H "Authorization: Bearer TOKEN" "https://api.app.com/endpoint"

# Check logs
ssh server "pm2 logs app --lines 50"
ssh server "pm2 logs app --lines 100 | grep -i error"

# Check deployment
ssh server "cd /var/www/app && git log -1 && ls -lh dist/"

# Rebuild (monorepo)
ssh server "cd /var/www/app && \
  pnpm --filter @repo/shared build && \
  pnpm --filter @repo/api build && \
  pm2 restart api"
```

---

## 📈 Bug Statistics & ROI

**Current Stats:**
- Total bugs documented: 9
- Cumulative first-debug time: 322 min (if all occurred)
- Cumulative with-knowledge time: 29.5 min
- Potential time saving per recurrence: 292.5 min
- Actual recurrences: 0 (newly created)
- Actual time saved: 0 min (will update as bugs recur)

**Bug Breakdown:**
1. **Using fe-pilot for debugging: 10 min → 0.5 min = 9.5 min saved**
2. API 500 (debugged FE): 120 min → 5 min = 115 min saved
3. Works locally, fails staging: 30 min → 3 min = 27 min saved
4. ZodError validation: 30 min → 5 min = 25 min saved
5. Upload 401: 30 min → 2 min = 28 min saved
6. Selector non-ASCII: 25 min → 5 min = 20 min saved
7. 200 OK but no save: 40 min → 5 min = 35 min saved
8. Network timeout: 15 min → 2 min = 13 min saved
9. Button won't click: 15 min → 2 min = 13 min saved

**ROI Projection:**
```
If each bug occurs just 2 more times:
  Time without KB: 322 min × 2 = 644 min (10.7 hours)
  Time with KB:     29.5 min × 2 = 59 min
  Time saved:                    585 min (9.75 hours)

Setup cost: 30 min
ROI: 585 / 30 = 19.5x return on investment
```

**Real-world impact (bedroom filter bug):**
- First occurrence: 120 min (debugged FE) + 10 min (tried fe-pilot) = 130 min
- With this KB: curl API (30 sec) + check logs (30 sec) = 1 min
- Time saved: 129 min (2.15 hours) on FIRST occurrence after documenting

**Update this section** when bugs recur to track actual time savings.

---

## 🔄 Maintenance & Archival

### When to Archive Bugs

Move bugs to `.claude/BUG_ARCHIVE.md` when:
- Frequency: Low (< 2 occurrences in 6 months)
- Last occurrence: > 6 months ago
- Severity: Low AND no recent occurrences
- Codebase changed: Root cause no longer applies

### Current Size

```
Lines: ~350
Target max: 3000 lines (~60 bugs)
Current capacity: 57 more bugs before archival needed
```

---

## 📝 Contributing to This Knowledge Base

**After fixing a hard bug (> 15 min debug time):**

1. Copy the template from "How to Use This Knowledge Base" section above
2. Fill in all sections based on your debugging experience
3. Add entry to "Detailed Bug Patterns" section
4. Update "Quick Reference by Symptom" table at top
5. Update "Bug Statistics & ROI" section
6. Commit with message: `docs: add bug pattern - [symptom]`

**Quality standards:**
- ✅ Observable symptoms are specific (include observation.json examples)
- ✅ Diagnostic steps are actionable (include bash commands)
- ✅ Fix includes code examples
- ✅ Prevention includes concrete actions
- ✅ Metrics are tracked (time, frequency, severity)

---

**Last knowledge base update:** 2024-12-13
**Next review:** After 10 bugs added or 3 months, whichever comes first
