# fe-pilot Testing & Verification Checklist

> Step-by-step protocols for testing features and fixing bugs

---

## ⚠️ MANDATORY: Bug Fixing Protocol (6 Steps)

**Follow this protocol for ALL bug fixes. NO exceptions.**

### Step 1: Reproduce the Bug

**Create action.json to trigger the bug:**
```json
{
  "reasoning": "Reproducing reported bug: [description]",
  "actions": [
    {"action": "navigate", "url": "https://staging.app.com"},
    {"action": "screenshot", "description": "Initial state before bug trigger"},
    // ... actions that should trigger the bug
  ]
}
```

**Run fe-pilot:**
```bash
node dist/index.js explore https://staging.app.com \
  --goal "Reproduce [bug description]" \
  --max-steps 20 \
  --headless
```

**Expected:** Bug occurs and is visible in observation.json or screenshot

---

### Step 2: Capture Evidence

**Before attempting ANY fix, capture complete evidence:**

#### A. Take Screenshot
```bash
# Find latest session
SESSION=$(ls -td fe-pilot-sessions/*/ | head -1)

# View latest screenshot
ls -t $SESSION/screenshots/ | head -1
```

**Document:** Screenshot path showing bug state

#### B. Check Console Logs
```bash
cat $SESSION/observation.json | jq '.consoleLogs[] | select(.type == "error")'
```

**Document:** All console errors with timestamps and text

#### C. Check Network Requests
```bash
cat $SESSION/observation.json | jq '.networkRequests[] | select(.status >= 400)'
```

**Document:** Failed requests (status, URL, method)

#### D. Check Error Counters
```bash
cat $SESSION/observation.json | jq '.newErrors'
```

**Document:**
```json
{
  "consoleErrors": 2,
  "networkErrors": 1
}
```

**Evidence Template:**
```
Bug Evidence Captured:
---
Screenshot: [path/to/screenshot.png]
Description: [what the screenshot shows]

Console Errors:
- [timestamp] [error message 1]
- [timestamp] [error message 2]

Network Errors:
- POST /api/upload/images → 401 Unauthorized
- Duration: 245ms

Error Counts:
- Console errors: 2
- Network errors: 1

Current URL: [URL where bug occurs]
DOM State: [relevant visible text or buttons]
```

---

### Step 3: Identify Root Cause

**Analyze the evidence to determine WHY the bug occurs:**

#### Console Errors Analysis

| Error Pattern | Likely Cause | Solution |
|---------------|--------------|----------|
| "Failed to load resource: 401" | Not authenticated | Login before action |
| "Failed to load resource: 404" | Wrong URL/endpoint | Check API endpoint |
| "Failed to load resource: 500" | Server error | Backend issue, check logs |
| "Cannot read property of undefined" | JavaScript error | Fix frontend code |
| "Network error" | Connection issue | Check network/CORS |

#### Network Error Analysis

| Status Code | Meaning | Action |
|-------------|---------|--------|
| 401 | Unauthorized | Ensure login before action |
| 403 | Forbidden | Check permissions |
| 400 | Bad Request | Validate request data |
| 422 | Validation Failed | Fix form data |
| 404 | Not Found | Check URL/endpoint |
| 500 | Server Error | Backend issue |

#### Element Not Found Analysis

**If "element not found" or "timeout":**
1. Check if selector is correct
2. Check if element appears after page load
3. Check if need to wait for animation
4. Try alternative selectors

**Root Cause Template:**
```
Root Cause Analysis:
---
Error: [specific error message]
Source: [console/network/observation.json]
Why: [explanation of why error occurs]

Examples:
- Error: "Failed to load resource: 401"
  Source: networkRequests[0].status
  Why: Upload endpoint requires authenticated session. User not logged in before upload action.

- Error: "Element not visible: input[type='file']"
  Source: Playwright timeout error
  Why: File input is hidden until "Upload Photo" button is clicked.
```

---

### Step 4: Implement Fix

**Based on root cause, implement the fix:**

#### Fix Example 1: Authentication Required
```typescript
// Before: Direct upload (fails with 401)
{
  "actions": [
    {"action": "upload", "selector": "input[type='file']", "value": "/path/file.jpg"}
  ]
}

// After: Login first, then upload
{
  "actions": [
    {"action": "click", "selector": "text=Login"},
    {"action": "type", "selector": "input[type='email']", "value": "test@example.com"},
    {"action": "type", "selector": "input[type='password']", "value": "password123"},
    {"action": "click", "selector": "text=Submit"},
    {"action": "wait", "duration": 2000, "description": "Wait for login to complete"},
    {"action": "upload", "selector": "input[type='file']", "value": "/path/file.jpg"}
  ]
}
```

#### Fix Example 2: Selector Issue
```typescript
// Before: Wrong selector (element not found)
{
  "action": "click",
  "selector": "text=Submit"  // Actual text is "Отправить" (Russian)
}

// After: Correct selector
{
  "action": "click",
  "selector": "text=Отправить, button[type='submit']",  // Try Russian text, fallback to button type
  "description": "Submit form"
}
```

#### Fix Example 3: Timing Issue
```typescript
// Before: Click before element loads (timeout)
{
  "actions": [
    {"action": "click", "selector": "text=Next"},
    {"action": "click", "selector": "#dynamic-content"}  // Not loaded yet!
  ]
}

// After: Wait for element
{
  "actions": [
    {"action": "click", "selector": "text=Next"},
    {"action": "wait", "selector": "#dynamic-content", "duration": 5000},
    {"action": "click", "selector": "#dynamic-content"}
  ]
}
```

**After implementing fix:**
```bash
# Rebuild
npm run build

# Verify build succeeds
echo "Build exit code: $?"  # Should be 0
```

---

### Step 5: Test the Fix ⚠️ CRITICAL

**IMPORTANT: You MUST test the fix before claiming it's resolved!**

```bash
# Run fe-pilot with the fix
node dist/index.js explore https://staging.app.com \
  --goal "Test fix for [bug description]" \
  --max-steps 30 \
  --headless
```

**Execute the SAME actions that previously caused the bug.**

**Expected:** Bug no longer occurs, operation succeeds

**Take screenshot during test:**
```json
{
  "actions": [
    // ... actions that previously failed
    {"action": "screenshot", "description": "VERIFICATION: Bug should be fixed"},
    {"action": "wait", "duration": 1000}
  ]
}
```

---

### Step 6: Verify Fix ⚠️ MANDATORY

**NEVER say a bug is fixed without completing ALL of these checks:**

#### Checklist:

```bash
# 1. Find latest test session
SESSION=$(ls -td fe-pilot-sessions/*/ | head -1)

# 2. Check console logs (MUST be 0 errors)
cat $SESSION/observation.json | jq '.consoleLogs[] | select(.type == "error")'
# Expected: No output (no errors)

# 3. Check network requests (MUST be successful)
cat $SESSION/observation.json | jq '.networkRequests[] | select(.status >= 400)'
# Expected: No output (no failed requests)

# 4. Check error counters (MUST be 0)
cat $SESSION/observation.json | jq '.newErrors'
# Expected: {"consoleErrors": 0, "networkErrors": 0}

# 5. View verification screenshot
ls -t $SESSION/screenshots/ | head -1
# Expected: Shows successful operation
```

#### Verification Report Template:

```
Bug Fix Verification Report
============================

Fix Tested: [describe what you tested]
Session: [session ID/path]

✅ CHECKS PASSED:

1. Screenshot Evidence:
   - Path: fe-pilot-sessions/exploration-1234567890/screenshots/step-X.png
   - Shows: [describe expected behavior visible in screenshot]
   - Status: ✅ SUCCESS

2. Console Logs:
   - Before fix: 2 errors ("Failed to load resource: 401")
   - After fix: 0 errors
   - Status: ✅ CLEAN

3. Network Requests:
   - Before fix: POST /api/upload/images → 401
   - After fix: POST /api/upload/images → 200 OK (Duration: 1245ms)
   - Status: ✅ SUCCESS

4. Error Counters:
   - consoleLogs: 0 (was 2)
   - networkErrors: 0 (was 1)
   - Status: ✅ ZERO ERRORS

5. Expected Behavior:
   - Upload successful
   - File visible in UI
   - No error messages displayed
   - Status: ✅ CONFIRMED

============================
BUG FIXED ✅
============================
```

**If ANY check fails:**
```
Bug Fix Verification FAILED
============================

❌ FAILURES:

1. Console Errors: 1 error still present
   - Error: "Cannot read property 'name' of undefined"
   - Location: app.js:234

2. Network Requests: Still failing
   - POST /api/upload/images → 401 Unauthorized

Root Cause: User session expires too quickly. Need longer session timeout.

Attempting alternative fix...
```

---

## Feature Completion Checklist

**Before claiming a feature is complete:**

### 1. Happy Path Testing

```bash
# Test the feature works in ideal conditions
node dist/index.js explore https://staging.app.com \
  --goal "Complete [feature name] successfully" \
  --max-steps 50 \
  --headless
```

**Verify:**
- ✅ Feature executes without errors
- ✅ observation.json shows 0 console errors
- ✅ observation.json shows 0 network errors
- ✅ Screenshot shows expected result

### 2. Error Handling Testing

**Test failure scenarios:**

#### A. Invalid Input
```json
{
  "actions": [
    {"action": "type", "selector": "input[type='email']", "value": "invalid-email"},
    {"action": "click", "selector": "text=Submit"},
    {"action": "screenshot", "description": "Should show validation error"}
  ]
}
```

**Verify:** Error message appears, form doesn't submit

#### B. Missing Required Fields
```json
{
  "actions": [
    {"action": "click", "selector": "text=Submit", "description": "Submit empty form"},
    {"action": "screenshot", "description": "Should show required field errors"}
  ]
}
```

**Verify:** Validation errors displayed

#### C. Network Failure (if applicable)
- Test with slow network
- Test with timeout
- Test with 500 server error

### 3. Code Quality Checks

```bash
# Build verification
npm run build
# Exit code must be 0

# Type checking
npx tsc --noEmit
# No errors

# Code review
git diff
# Review all changes
```

**Verify:**
- ✅ No TypeScript errors
- ✅ No `any` types used
- ✅ Explicit return types added
- ✅ Meaningful error messages
- ✅ Code follows standards (CODE_STANDARDS.md)

### 4. Documentation Updates

**Update these files:**

- ✅ `USAGE_GUIDE.md` - Add usage example if new action type
- ✅ `.claude/examples/` - Add example JSON if common pattern
- ✅ `.claude/SESSION_STATE.json` - Update with completed work
- ✅ `README.md` - Update if user-facing feature

### 5. Final Verification

```bash
# Run comprehensive test
node dist/index.js explore https://staging.app.com \
  --goal "Complete end-to-end test of [feature]" \
  --max-steps 100 \
  --headless

# Check results
SESSION=$(ls -td fe-pilot-sessions/*/ | head -1)
cat $SESSION/observation.json | jq '{consoleLogs, networkRequests, newErrors}'
ls -t $SESSION/screenshots/
```

**Feature Completion Report:**
```
Feature Completion Verification
================================

Feature: [feature name]
Implementation Date: [date]

✅ Testing Results:

1. Happy Path: ✅ SUCCESS
   - All steps completed without errors
   - Expected behavior confirmed in screenshots

2. Error Handling: ✅ ROBUST
   - Invalid input handled gracefully
   - Missing fields show validation errors
   - Network failures handled appropriately

3. Code Quality: ✅ HIGH
   - TypeScript: 0 errors
   - No `any` types used
   - All standards followed (CODE_STANDARDS.md)

4. Documentation: ✅ UPDATED
   - USAGE_GUIDE.md: Added example
   - .claude/examples/: Added pattern
   - SESSION_STATE.json: Updated

5. Performance: ✅ ACCEPTABLE
   - Action execution: < 5s per action
   - Screenshots: < 1s
   - Session folder: [size] < 50MB

================================
FEATURE COMPLETE ✅
================================
```

---

## Common Issues & Solutions

### Issue 1: Upload Returns 401

**Symptoms:**
- `POST /api/upload/images → 401`
- Console error: "Сессия истекла" (Session expired)

**Root Cause:** User not authenticated

**Solution:**
```json
{
  "actions": [
    // Login first
    {"action": "click", "selector": "text=Login"},
    {"action": "type", "selector": "input[type='email']", "value": "test@example.com"},
    {"action": "type", "selector": "input[type='password']", "value": "password123"},
    {"action": "click", "selector": "text=Submit"},
    {"action": "wait", "duration": 2000},
    // Then upload
    {"action": "upload", "selector": "input[type='file']", "value": "/path/file.jpg"}
  ]
}
```

### Issue 2: Element Not Found / Timeout

**Symptoms:**
- Playwright timeout error
- "Element not visible: [selector]"

**Common Causes:**

1. **Wrong selector:**
   ```json
   // Try multiple fallbacks
   {"action": "click", "selector": "text=Submit, button[type='submit'], #submit-btn"}
   ```

2. **Element loads async:**
   ```json
   {
     "actions": [
       {"action": "wait", "selector": ".target-element", "duration": 5000},
       {"action": "click", "selector": ".target-element"}
     ]
   }
   ```

3. **Hidden until interaction:**
   ```json
   {
     "actions": [
       {"action": "click", "selector": ".dropdown-trigger", "description": "Open dropdown"},
       {"action": "wait", "duration": 500},
       {"action": "click", "selector": ".dropdown-item"}
     ]
   }
   ```

### Issue 3: Form Validation Blocking Progress

**Symptoms:**
- Can't proceed to next step
- "Required field" errors
- Submit button disabled

**Solution:**
```json
{
  "actions": [
    // Fill ALL required fields
    {"action": "type", "selector": "input[required][name='title']", "value": "Test Title"},
    {"action": "type", "selector": "textarea[required]", "value": "Test description with sufficient length (50+ chars)"},
    {"action": "select", "selector": "select[required]", "value": "Option 1"},
    {"action": "screenshot", "description": "Verify all required fields filled"},
    {"action": "click", "selector": "text=Next"}
  ]
}
```

### Issue 4: Action Repetition Loop

**Symptoms:**
- Same action executed 20+ times
- "type Enter email" repeated endlessly
- fe-pilot hits max steps without progress

**Root Cause:**
- Selector matches wrong element
- Form doesn't change state after action
- Progress detection not working

**Solution:**
```json
{
  "actions": [
    // Use more specific selector
    {"action": "type", "selector": "input[type='email'][name='email']", "value": "test@example.com"},
    // Add explicit wait
    {"action": "wait", "duration": 500},
    // Verify with screenshot
    {"action": "screenshot", "description": "Email field should be filled"},
    // Proceed
    {"action": "click", "selector": "text=Next"}
  ]
}
```

---

## Summary: The Rules

### Before Claiming "Bug Fixed":

1. ✅ Reproduce bug and capture evidence
2. ✅ Analyze observation.json (console logs, network requests)
3. ✅ Identify root cause
4. ✅ Implement fix
5. ✅ Test fix with actual execution
6. ✅ Verify: screenshot + 0 errors in observation.json

### Before Claiming "Feature Complete":

1. ✅ Happy path testing (works in ideal conditions)
2. ✅ Error handling testing (graceful failures)
3. ✅ Code quality checks (TypeScript, standards)
4. ✅ Documentation updates (USAGE_GUIDE, examples)
5. ✅ Final verification (screenshot + 0 errors)

### NEVER:

- ❌ Say "bug fixed" without testing
- ❌ Skip verification screenshot
- ❌ Ignore console logs in observation.json
- ❌ Assume code works without evidence
- ❌ Mark complete if ANY errors remain

**These protocols are MANDATORY. Non-compliance is unacceptable.**
