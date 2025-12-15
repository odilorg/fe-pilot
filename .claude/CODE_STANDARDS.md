# fe-pilot Code Quality Standards

> Mandatory requirements for all code changes. These are SYSTEM RULES, not suggestions.

---

## ⚠️ CRITICAL: Before Claiming "Done"

**NEVER say a task is complete without ALL of these checks:**

### 1. Build Verification
```bash
npm run build
```
- ✅ Must exit with code 0
- ✅ Zero TypeScript errors
- ✅ Zero warnings (treat warnings as errors)

### 2. Actual Testing
```bash
# Run the actual feature/fix
node dist/index.js explore <URL> --goal "<test goal>" --max-steps 20
```
- ✅ Must execute without crashes
- ✅ Must achieve intended behavior
- ❌ Don't assume code works - TEST IT

### 3. observation.json Verification
```bash
# Check latest observation
cat $(ls -td fe-pilot-sessions/*/ | head -1)/observation.json | jq '{consoleLogs, networkRequests, newErrors}'
```

**Required:**
- ✅ `consoleLogs` array has NO errors (type: "error")
- ✅ `networkRequests` all successful (status 200-299)
- ✅ `newErrors.consoleErrors` = 0
- ✅ `newErrors.networkErrors` = 0

### 4. Screenshot Evidence
```bash
# Take final screenshot
ls -t $(ls -td fe-pilot-sessions/*/ | head -1)/screenshots/
```
- ✅ Screenshot shows expected behavior
- ✅ Visual confirmation of success

### 5. Verification Report
```
Task Completion Verification:
✅ npm run build: SUCCESS (0 errors)
✅ Actual test executed: [describe what you tested]
✅ observation.json consoleLogs: 0 errors
✅ observation.json networkRequests: All 200 OK
✅ newErrors: {consoleErrors: 0, networkErrors: 0}
✅ Screenshot: [path] shows [expected behavior]

TASK COMPLETE ✅
```

**If ANY check fails:**
```
Verification FAILED ❌
- Build: [SUCCESS/FAILED]
- Console errors: [count]
- Network errors: [count]
- Screenshot: [does not show expected behavior]

Attempting fix...
```

---

## TypeScript Standards

### Rule 1: No `any` Type

**NEVER:**
```typescript
❌ function doSomething(data: any) { ... }
❌ const result: any = await someFunction();
❌ let value: any;
```

**ALWAYS:**
```typescript
✅ function doSomething(data: Action) { ... }
✅ const result: string = await someFunction();
✅ import { Action, ActionType } from './types';
```

**Why**: Type safety catches errors at compile time

### Rule 2: Explicit Return Types

**NEVER:**
```typescript
❌ async function execute(action) { ... }
❌ function getSelector(el) { ... }
```

**ALWAYS:**
```typescript
✅ async function execute(action: Action): Promise<void> { ... }
✅ function getSelector(el: Element): string { ... }
```

**Why**: Documents function contracts, catches return type errors

### Rule 3: No @ts-ignore

**NEVER:**
```typescript
❌ // @ts-ignore
   someFunction();
```

**ALWAYS:**
```typescript
✅ // Fix the actual type error
   const result = someFunction() as ExpectedType;

✅ // Or add proper types
   interface SomeInterface { ... }
   const result: SomeInterface = someFunction();
```

**Why**: @ts-ignore hides real problems

### Rule 4: Use Existing Types

**ALWAYS use types from `src/types/index.ts`:**

```typescript
✅ import { Action, ActionType, Observation } from './types';

// For new action types
✅ type ActionType = 'navigate' | 'click' | ... | 'your-new-type';

// For action parameters
✅ interface Action {
     action: ActionType;
     selector?: string;
     ...
   }
```

**DO NOT:**
```typescript
❌ type MyAction = 'navigate' | 'click';  // Duplicate
❌ interface MyOwnAction { ... }          // Use existing Action interface
```

---

## Error Handling

### Rule 1: Meaningful Error Messages

**NEVER:**
```typescript
❌ throw new Error('Error');
❌ throw new Error('Failed');
❌ console.error('Something went wrong');
```

**ALWAYS:**
```typescript
✅ throw new Error(`Action ${action.action} failed: element "${action.selector}" not found`);
✅ throw new Error(`Upload failed: ${error.message}. Ensure user is authenticated.`);
✅ console.error(`[Executor] Failed to execute ${action.action} on ${action.selector}:`, error);
```

**Include:**
- What failed (action type, method name)
- Why it failed (element not found, timeout, etc.)
- Context (selector, URL, step number)
- Suggestions (if applicable)

### Rule 2: Graceful Playwright Timeouts

**NEVER:**
```typescript
❌ await page.click(selector);  // Throws on timeout
❌ const element = await page.locator(selector);  // No error handling
```

**ALWAYS:**
```typescript
✅ try {
     await page.click(selector, { timeout: 5000 });
   } catch (error) {
     throw new Error(`Click failed on "${selector}": ${error.message}`);
   }

✅ const element = page.locator(selector);
   if (!await element.isVisible({ timeout: 5000 })) {
     throw new Error(`Element "${selector}" not visible after 5s`);
   }
```

### Rule 3: Never Swallow Errors

**NEVER:**
```typescript
❌ try { ... } catch (e) { /* silent */ }
❌ try { ... } catch { return; }
```

**ALWAYS:**
```typescript
✅ try {
     await action();
   } catch (error) {
     console.error('[Module] Action failed:', error);
     throw error;  // Re-throw or handle properly
   }

✅ catch (error) {
     // Log with context
     console.error(`[Executor] Failed at step ${stepNum}:`, error);
     // Provide recovery suggestion
     throw new Error(`Step ${stepNum} failed. Try: ${suggestion}`);
   }
```

---

## Selector Best Practices

### Priority Order (Most to Least Resilient)

1. **Text-based** (BEST - survives UI changes)
   ```typescript
   ✅ text=Login
   ✅ button:has-text('Submit')
   ✅ a:has-text('Next')
   ```

2. **Semantic attributes** (GOOD - meaningful)
   ```typescript
   ✅ input[type='email']
   ✅ button[type='submit']
   ✅ select[name='country']
   ```

3. **Data attributes** (GOOD - stable)
   ```typescript
   ✅ [data-testid='submit-btn']
   ✅ [data-test='login-form']
   ```

4. **CSS classes** (FRAGILE - avoid if possible)
   ```typescript
   ⚠️ .btn-primary  (might change in redesign)
   ⚠️ .form-input   (non-specific)
   ```

5. **IDs** (FRAGILE - can change)
   ```typescript
   ⚠️ #submit       (might be auto-generated)
   ⚠️ #user-123     (dynamic ID)
   ```

### Multiple Fallback Selectors

```typescript
✅ selector: "text=Submit, button[type='submit'], #submit-btn"
   // Try text first, then attribute, then ID as last resort
```

---

## Testing Requirements

### Rule 1: Test Every New Action Type

**When adding new action type:**

1. Add to ActionType union (types/index.ts)
2. Implement method in executor.ts
3. Add test case:
   ```bash
   node dist/index.js explore https://test-site.com \
     --goal "Test new action type" --max-steps 10
   ```
4. Verify in observation.json
5. Add example to .claude/examples/

### Rule 2: Integration Test for Multi-Step Flows

**For complex features (multi-step forms, wizards):**

```bash
# Test complete flow
node dist/index.js explore https://staging.app.com \
  --goal "Complete 6-step property listing with upload" \
  --max-steps 80 --headless

# Verify each step in observation.json
cat fe-pilot-sessions/exploration-*/observation.json | jq '.stepNumber, .domState.visibleText' | grep "Step"
```

### Rule 3: Error Case Testing

**Test failure scenarios:**

- Element not found (invalid selector)
- Timeout (slow page)
- 401 Unauthorized (upload without login)
- 400 Bad Request (invalid form data)
- Network failure

**Example:**
```bash
# Test upload without auth (should fail gracefully)
node dist/index.js explore https://app.com \
  --goal "Upload file without logging in" --max-steps 5

# Verify error is captured in observation.json
cat observation.json | jq .networkRequests
# Should show: {"status": 401, "url": "/api/upload/images"}
```

---

## Performance Requirements

### Action Execution

- ✅ Action execution < 5s (excluding explicit waits)
- ✅ Screenshot capture < 1s
- ✅ DOM observation < 2s
- ✅ Session initialization < 3s

**If slower:**
- Profile with `console.time()` / `console.timeEnd()`
- Check network requests (slow API?)
- Check DOM size (too large?)
- Optimize selectors (too complex?)

### Memory Usage

- ✅ Session folder < 50MB (compress screenshots if needed)
- ✅ observation.json < 500KB (truncate if necessary)
- ✅ No memory leaks (browser should be closed after session)

---

## Code Organization

### File Size Limits

- ✅ Single file < 500 lines
- ✅ Single function < 100 lines
- ✅ Single class < 300 lines

**If exceeded:**
- Extract helper functions
- Split into multiple files
- Create utility modules

### Naming Conventions

**Files:**
```typescript
✅ executor.ts        (lowercase, hyphen-separated for multi-word)
✅ session-manager.ts
❌ Executor.ts        (no PascalCase for files)
❌ session_manager.ts (no snake_case)
```

**Classes:**
```typescript
✅ class ActionExecutor { ... }
✅ class SessionManager { ... }
❌ class actionExecutor { ... }
```

**Functions:**
```typescript
✅ async function executeAction(...) { ... }
✅ function normalizeSelector(...) { ... }
❌ async function ExecuteAction(...) { ... }
```

**Constants:**
```typescript
✅ const MAX_ACTION_REPEATS = 3;
✅ const DEFAULT_TIMEOUT = 5000;
❌ const max_action_repeats = 3;
```

---

## Git Workflow

### Commit Messages

**Format:**
```
<type>: <short description>

<optional detailed description>

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Types:**
- `feat`: New feature (e.g., "feat: add upload action type")
- `fix`: Bug fix (e.g., "fix: handle 401 upload errors")
- `refactor`: Code restructure (e.g., "refactor: extract selector normalization")
- `docs`: Documentation (e.g., "docs: update USAGE_GUIDE with upload examples")
- `test`: Testing (e.g., "test: add multi-step form integration test")

**Examples:**
```bash
feat: add upload action type

- Added 'upload' to ActionType union (types/index.ts)
- Implemented upload() method using setInputFiles()
- Supports multiple files via comma-separated paths
- Requires authentication (returns 401 if not logged in)

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Before Committing

```bash
# 1. Build check
npm run build

# 2. Git status
git status

# 3. Review changes
git diff

# 4. Stage files
git add <files>

# 5. Commit
git commit -m "$(cat <<'EOF'
feat: your feature

Details here...

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

**DO NOT:**
- ❌ Commit with build errors
- ❌ Commit without testing
- ❌ Commit sensitive data (.env, credentials)
- ❌ Use `--no-verify` (skip hooks)

---

## Documentation Requirements

### Code Comments

**WHEN to comment:**
- ✅ Complex algorithms (explain WHY, not WHAT)
- ✅ Non-obvious behavior (e.g., selector normalization logic)
- ✅ Workarounds (e.g., "Delay needed for animation to complete")
- ✅ TODOs (with issue number if applicable)

**WHEN NOT to comment:**
```typescript
❌ // Increment counter
   counter++;

❌ // Get user name
   const name = user.getName();
```

**Good comments:**
```typescript
✅ // Normalize "text=A, text=B" → "button:has-text('A'), button:has-text('B')"
   // because Playwright doesn't support comma-separated text selectors
   if (selector.includes('text=') && selector.includes(',')) { ... }

✅ // Wait for upload animation to complete before checking status
   // Backend processes uploads async, need 2s minimum
   await this.page.waitForTimeout(2000);
```

### JSDoc for Public Methods

```typescript
/**
 * Execute a single action on the page
 *
 * @param action - Action to execute (from action.json)
 * @throws Error if action fails (timeout, element not found, etc.)
 * @example
 * await executor.execute({
 *   action: 'click',
 *   selector: 'text=Login'
 * });
 */
public async execute(action: Action): Promise<void> {
  ...
}
```

---

## Security Considerations

### Rule 1: No Hardcoded Secrets

**NEVER:**
```typescript
❌ const password = 'password123';
❌ const apiKey = 'sk-1234567890';
❌ const dbConnection = 'postgresql://user:pass@localhost';
```

**ALWAYS:**
```typescript
✅ const password = process.env.TEST_PASSWORD || 'default-test-pwd';
✅ const apiKey = process.env.API_KEY;
✅ const dbConnection = process.env.DATABASE_URL;
```

### Rule 2: Sanitize User Input

**When accepting URLs from command line:**
```typescript
✅ if (!url.startsWith('http://') && !url.startsWith('https://')) {
     throw new Error('URL must start with http:// or https://');
   }
```

### Rule 3: No Arbitrary Code Execution

**NEVER:**
```typescript
❌ eval(userInput);
❌ new Function(userInput)();
❌ child_process.exec(userInput);
```

---

## Summary

**Before claiming "done":**
1. ✅ `npm run build` succeeds (0 errors)
2. ✅ Actual test executed (feature/fix works)
3. ✅ observation.json verified (0 console/network errors)
4. ✅ Screenshot captured (visual evidence)
5. ✅ Verification report provided

**Code quality:**
- NO `any` types
- Explicit return types
- NO `@ts-ignore`
- Use types from types/index.ts
- Meaningful error messages

**Testing:**
- Test new action types
- Integration test for multi-step flows
- Error case testing

**Performance:**
- Action execution < 5s
- Screenshot < 1s
- Session folder < 50MB

**Documentation:**
- Comment complex logic
- JSDoc for public methods
- Update SESSION_STATE.json

**These are MANDATORY. Non-compliance is unacceptable.**
