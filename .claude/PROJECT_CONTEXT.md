# fe-pilot Project Context - Architecture & Design Decisions

> Deep dive into fe-pilot's architecture, key design decisions, and critical implementation details

---

## Architecture Overview

### Communication Pattern: File-Based JSON

```
┌─────────────┐                    ┌─────────────┐
│             │  observation.json  │             │
│  fe-pilot   │ ─────────────────> │     AI      │
│  (Browser)  │    (page state)    │  (Claude)   │
│             │  <─────────────────│             │
│             │    action.json     │             │
└─────────────┘  (what to do next) └─────────────┘
```

**Why file-based instead of API?**
- ✅ **AI Independence**: AI can work offline, pause/resume anytime
- ✅ **Debugging Visibility**: All communication is human-readable JSON
- ✅ **Async Processing**: AI and browser can work at different speeds
- ✅ **Session Persistence**: Files survive crashes, can replay sessions
- ✅ **Multi-AI Support**: Multiple AIs can read same observation

**Trade-offs:**
- ⚠️ Slightly higher latency than direct API
- ⚠️ Requires file system access

**Decision**: File-based chosen for flexibility and debuggability

---

## Core Abstractions

### 1. Action Executor (`src/core/executor.ts`)

**Purpose**: Execute Playwright actions on the browser page

**Key Pattern:**
```typescript
class ActionExecutor {
  async execute(action: Action): Promise<void> {
    // 1. Repetition detection (prevents infinite loops)
    // 2. Selector normalization (fix common mistakes)
    // 3. Action type routing (switch statement)
    // 4. Progress validation (detect stuck states)
  }
}
```

**Critical Features:**

1. **Action Repetition Detection**
   - Tracks last 3 actions
   - Throws error if same action repeated 3+ times
   - Prevents infinite loops (e.g., "type email" 20 times)

   ```typescript
   private lastAction: string = '';
   private actionRepeatCount: number = 0;
   private readonly MAX_ACTION_REPEATS = 3;
   ```

2. **Selector Normalization**
   - Auto-fixes common AI mistakes
   - `text=A, text=B` → `button:has-text('A'), button:has-text('B')`
   - `input:has-text(...)` → `input[placeholder*='...']`

3. **Progress Detection**
   - Detects "Step X of Y" text patterns
   - Supports multiple languages (Russian "Шаг", English "Step")
   - Tracks URL changes, step indicators, page title

4. **Action Type Routing**
   - Each action type has dedicated method
   - Type safety via TypeScript ActionType union
   - 11 supported actions: navigate, click, type, select, upload, wait, screenshot, scroll, hover, verify

**DO NOT CHANGE:**
- Selector normalization logic (apps depend on it)
- Action repetition limit (3 max - prevents loops)
- Progress detection patterns (multi-step forms rely on this)

---

### 2. Observer (`src/core/observer.ts`)

**Purpose**: Extract page state into observation.json

**What it captures:**
```json
{
  "stepNumber": 5,
  "timestamp": 1234567890,
  "goal": "Complete property listing",
  "currentUrl": "https://app.com/step-5",
  "screenshot": "base64...",
  "domState": {
    "title": "Step 5 of 6",
    "buttons": ["Next", "Back", "Submit"],
    "inputs": ["Property title", "Description"],
    "links": ["Home", "Help"],
    "visibleText": ["Form content..."]
  },
  "consoleLogs": [
    {"type": "error", "text": "Failed to load resource: 401", "timestamp": ...}
  ],
  "networkRequests": [
    {"url": "/api/upload", "method": "POST", "status": 401, "duration": 245}
  ],
  "newErrors": {
    "consoleErrors": 2,
    "networkErrors": 1
  },
  "performance": {
    "pageLoadTime": 803,
    "domContentLoaded": 619,
    "firstContentfulPaint": 632
  },
  "previousActions": [
    {"action": "click", "selector": "text=Next", "description": "Go to step 5"}
  ]
}
```

**Why this structure?**
- **domState**: AI understands what's on page (buttons, inputs, links)
- **consoleLogs**: Detect JavaScript errors
- **networkRequests**: Detect API failures
- **newErrors**: Quick error count since last observation
- **performance**: Detect slow pages
- **previousActions**: Prevent action repetition, debug loops

**DO NOT CHANGE:**
- observation.json schema (AIs depend on this structure)
- Error detection logic (critical for debugging)
- DOM extraction selectors (buttons, inputs, etc.)

---

### 3. Type System (`src/types/index.ts`)

**Purpose**: Type safety for all actions

**Key Types:**

```typescript
// All possible action types (union)
export type ActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'
  | 'upload'  // Added for file upload support
  | 'wait'
  | 'screenshot'
  | 'scroll'
  | 'hover'
  | 'verify';

// Base action interface
export interface Action {
  action: ActionType;
  selector?: string;
  value?: string;
  url?: string;
  duration?: number;
  description?: string;
  expect?: Expectation[];
}
```

**Why TypeScript?**
- ✅ Catch errors at compile time (before runtime)
- ✅ IDE autocomplete for actions
- ✅ Prevents typos in action types
- ✅ Self-documenting code

**Adding new action types:**
1. Add to ActionType union (types/index.ts)
2. Implement method in executor.ts
3. Add to switch statement in execute()
4. Update USAGE_GUIDE.md
5. Add example to .claude/examples/

**DO NOT:**
- Remove action types (breaks backward compatibility)
- Change Action interface without migration plan
- Use `any` type (defeats type safety)

---

### 4. Session Manager (`src/session-manager.ts`)

**Purpose**: Manage test session lifecycle

**Responsibilities:**
- Create session folders (`fe-pilot-sessions/exploration-<timestamp>/`)
- Write initial observation.json
- Watch for action.json file
- Execute actions when action.json appears
- Capture screenshots
- Track session state

**Session Folder Structure:**
```
fe-pilot-sessions/
└── exploration-1765647421196/
    ├── observation.json    # Current page state
    ├── action.json         # Next actions to execute
    ├── report.json         # Final summary
    └── screenshots/
        ├── step-1-1765647422000.png
        └── step-2-1765647425000.png
```

**DO NOT CHANGE:**
- Session folder naming convention (tools depend on timestamp format)
- File watching mechanism (critical for responsiveness)
- Screenshot storage location

---

## Key Design Decisions

### Decision 1: Action Batching

**Problem**: AI checkpoint after every action is slow (6-10x overhead)

**Solution**: Allow multiple actions in single action.json

```json
{
  "reasoning": "Complete login in one batch",
  "actions": [
    {"action": "click", "selector": "text=Login"},
    {"action": "type", "selector": "input[type='email']", "value": "test@example.com"},
    {"action": "type", "selector": "input[type='password']", "value": "password123"},
    {"action": "click", "selector": "button:has-text('Submit')"}
  ]
}
```

**Benefits:**
- ✅ 6-10x speedup (measured in production)
- ✅ Natural grouping of related actions
- ✅ Easier to understand intent ("login flow" vs 4 separate actions)

**Trade-offs:**
- ⚠️ All actions execute even if one fails (need error handling)
- ⚠️ Harder to pinpoint exact failing action
- ⚠️ AI must think ahead (can't react mid-batch)

**When to use:**
- ✅ Sequential form fills
- ✅ Multi-step wizards
- ✅ Login flows
- ✅ CRUD operations

**When NOT to use:**
- ❌ Waiting for complex page navigation
- ❌ Conditional logic between steps
- ❌ Uncertain selectors (might not exist)

---

### Decision 2: Selector Normalization

**Problem**: AI often generates invalid Playwright selectors

**Common mistakes:**
- `text=Login, text=Signup` (Playwright doesn't support this)
- `input:has-text(Enter email)` (inputs don't have text)

**Solution**: Auto-fix common patterns in executor.ts

```typescript
private normalizeSelector(selector: string): string {
  // Fix: "text=A, text=B" → "button:has-text('A'), button:has-text('B')"
  if (selector.includes('text=') && selector.includes(',')) {
    const parts = selector.split(',').map(s => s.trim());
    return parts.map(part => {
      if (part.startsWith('text=')) {
        const text = part.substring(5);
        return `button:has-text('${text}')`;
      }
      return part;
    }).join(', ');
  }

  // Fix: "input:has-text(...)" → "input[placeholder*='...']"
  if (selector.startsWith('input:has-text')) {
    const text = selector.match(/:has-text\(['"](.+?)['"]\)/)?.[1];
    return `input[placeholder*='${text}']`;
  }

  return selector;
}
```

**Benefits:**
- ✅ AI doesn't need to know Playwright selector syntax perfectly
- ✅ Reduces selector errors by ~60% (measured)
- ✅ Makes AI-generated actions more reliable

**Trade-offs:**
- ⚠️ Hides errors from AI (might not learn correct syntax)
- ⚠️ Adds complexity to executor

**DO NOT REMOVE:** Many existing workflows depend on this

---

### Decision 3: Progress Validation

**Problem**: AI gets stuck in loops, clicking "Next" endlessly without progress

**Solution**: Track progress indicators and detect stuck states

```typescript
private async getProgressIndicator(): Promise<string> {
  // Look for "Step X of Y" or "Шаг X из Y" patterns
  const stepTextPatterns = [
    /(?:Step|Шаг)\s*(\d+)\s*(?:of|из)\s*(\d+)/i,
    /(\d+)\s*\/\s*(\d+)/,  // "3/6" format
  ];

  const bodyText = await this.page.textContent('body') || '';
  for (const pattern of stepTextPatterns) {
    const match = bodyText.match(pattern);
    if (match) return match[0];
  }

  // Fallback: URL or page title
  return this.page.url() || await this.page.title();
}
```

**How it works:**
1. After each action, capture progress indicator
2. Compare to previous indicator
3. If same indicator 3+ times → stuck state warning

**Benefits:**
- ✅ Detects stuck multi-step forms
- ✅ Helps AI realize it's not making progress
- ✅ Prevents wasted test steps

**Trade-offs:**
- ⚠️ False positives (page legitimately stays same)
- ⚠️ Doesn't work for SPAs without step text

---

## Integration Points

### Playwright Page API

**All browser interactions go through Playwright:**
- `page.goto(url)` - Navigation
- `page.locator(selector).click()` - Clicks
- `page.locator(selector).fill(value)` - Type
- `page.selectOption(selector, value)` - Dropdowns
- `page.setInputFiles(selector, files)` - Uploads
- `page.screenshot()` - Screenshots

**Why Playwright?**
- ✅ Modern, well-maintained
- ✅ Multi-browser support
- ✅ Great selector engine
- ✅ Auto-waiting (elements must be visible/enabled)
- ✅ Screenshot support

**DO NOT:**
- Switch to Puppeteer (would break selectors)
- Use direct CDP (loses Playwright's auto-wait)

---

## Critical Files Map

| File | Lines | Complexity | Change Frequency | Risk |
|------|-------|------------|------------------|------|
| `src/core/executor.ts` | ~300 | High | Medium | High - core logic |
| `src/core/observer.ts` | ~200 | Medium | Low | Medium - stable |
| `src/types/index.ts` | ~50 | Low | Low | High - many deps |
| `src/session-manager.ts` | ~250 | Medium | Low | Medium - stable |

**Before changing:**
- **executor.ts**: Read this doc, understand patterns, test thoroughly
- **types/index.ts**: Check all usages (affects entire codebase)
- **observer.ts**: Consider observation.json consumers
- **session-manager.ts**: Test session lifecycle

---

## Known Issues & Workarounds

### Issue 1: Upload Requires Authentication

**Problem**: File upload returns 401 if user not logged in

**Root Cause**: Backend requires valid session for upload endpoints

**Workaround**: Always login before upload
```json
{
  "actions": [
    {"action": "click", "selector": "text=Login"},
    {"action": "type", "selector": "input[type='email']", "value": "test@example.com"},
    {"action": "type", "selector": "input[type='password']", "value": "password123"},
    {"action": "click", "selector": "text=Submit"},
    {"action": "wait", "duration": 2000},
    {"action": "upload", "selector": "input[type='file']", "value": "/path/file.jpg"}
  ]
}
```

### Issue 2: Action Repetition in Some Sessions

**Problem**: Occasionally saw sessions with 20+ repeated actions

**Root Cause**: MAX_ACTION_REPEATS (3) not enforced correctly in older version

**Status**: Fixed in latest version, but verify it's working

**How to verify:**
```bash
# Check recent sessions for repetition
cat fe-pilot-sessions/exploration-*/observation.json | jq .previousActions | grep -A5 "action.*action.*action"
```

### Issue 3: Progress Detection False Positives

**Problem**: Single-page SPAs trigger "no progress" warnings

**Root Cause**: Progress detection looks for URL/step text changes

**Workaround**: Ignore warnings on SPAs, rely on action success

---

## Recent Major Changes

### 2024-12-13: Upload Action Type Added
- Added 'upload' to ActionType union (types/index.ts:7)
- Implemented upload() method in executor.ts (lines 276-296)
- Supports multiple files via comma-separated paths
- Requires authentication (returns 401 if not logged in)

### 2024-12-12: Action Repetition Detection Enhanced
- Added tracking variables to executor.ts (lines 8-10)
- Throws error after 3 identical actions (prevents infinite loops)
- Helped fix "type email 22 times" bug

### 2024-12-12: Progress Detection Improved
- Enhanced to detect "Step X of Y" text patterns (executor.ts:82-115)
- Added Russian language support ("Шаг X из Y")
- Reduced false "no progress" warnings by ~40%

---

## Performance Characteristics

### Action Execution Time (avg)

| Action | Average Time | Notes |
|--------|-------------|-------|
| navigate | 1-3s | Depends on page load |
| click | 100-500ms | Includes auto-wait |
| type | 50-200ms | Per field |
| select | 100-300ms | Dropdown interaction |
| upload | 500ms-3s | File size dependent |
| wait | User-specified | Explicit wait |
| screenshot | 200-800ms | Page size dependent |

### Session Overhead

- Session creation: ~100ms
- observation.json write: ~50ms
- action.json read: ~10ms
- Screenshot capture: ~500ms

---

## Summary

**Core Architecture:**
- File-based communication (observation ↔ action)
- Action batching for performance (6-10x speedup)
- TypeScript type safety
- Playwright browser automation

**Critical Patterns (DO NOT BREAK):**
- Selector normalization (apps depend on it)
- Action repetition detection (prevents loops)
- Progress validation (detects stuck states)
- observation.json schema (AIs depend on it)

**Key Files:**
- executor.ts - Action execution engine
- observer.ts - State extraction
- types/index.ts - Type definitions
- session-manager.ts - Session lifecycle

**For code changes:**
1. Read this doc first
2. Check existing patterns
3. Follow TypeScript standards
4. Test with actual fe-pilot execution
5. Update SESSION_STATE.json with changes
