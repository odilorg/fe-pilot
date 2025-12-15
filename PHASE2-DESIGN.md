# Phase 2: AI Integration Design

## Autonomous Mode Architecture

### Communication Protocol

**File-Based AI Loop** (Simple, reliable, works with Claude Code)

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code (AI)                         │
│  - Reads observations                                        │
│  - Analyzes bugs, UI, performance                            │
│  - Decides next action                                       │
│  - Can modify source code to fix bugs                        │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │  Communication Files    │
        │  - observation.json     │
        │  - action.json          │
        │  - status.txt           │
        └────────────┬────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    fe-pilot                                  │
│  - Executes actions                                          │
│  - Captures observations                                     │
│  - Waits for AI at checkpoints                               │
└─────────────────────────────────────────────────────────────┘
```

### Flow

1. **Start**: `fe-pilot explore <url> --goal "test login"`
2. **Initial State**:
   - Navigate to URL
   - Capture observation
   - Write `observation.json`
   - Write `status: WAITING_FOR_AI`
3. **AI Analysis** (Claude Code):
   - Read `observation.json`
   - Analyze screenshot, console, network, DOM
   - Decide next action
   - Write `action.json`
4. **Execute**:
   - Read `action.json`
   - Execute action (click, type, etc.)
   - Capture new observation
   - Check for errors
5. **Bug Detection**:
   - If error found → write `bug-report.json`
   - AI reads bug report
   - AI modifies source code to fix
   - AI writes `action: { type: "rerun" }`
6. **Loop** until:
   - Goal achieved
   - Error can't be fixed
   - Max steps reached

## File Formats

### observation.json
```json
{
  "stepNumber": 3,
  "timestamp": 1765642499567,
  "goal": "Test login functionality",
  "currentUrl": "https://staging.jahongir-app.uz/auth/login",
  "screenshot": "/path/to/screenshot.png",
  "domState": {
    "title": "Login - RealEstate",
    "buttons": ["Login", "Sign Up", "Forgot Password"],
    "inputs": ["Email address", "Password"],
    "links": ["Home", "About", "Contact"],
    "visibleText": ["Welcome back", "Sign in to continue", ...]
  },
  "consoleLogs": [
    {"type": "error", "text": "Failed to load resource", "timestamp": ...}
  ],
  "networkRequests": [
    {"url": "/api/auth/login", "status": 500, "duration": 123}
  ],
  "newErrors": {
    "consoleErrors": 1,
    "networkErrors": 1
  },
  "performance": {
    "pageLoadTime": 1234,
    "domContentLoaded": 567
  },
  "previousActions": [
    {"action": "navigate", "url": "..."},
    {"action": "type", "selector": "#email", "value": "user@example.com"}
  ]
}
```

### action.json (AI Response)
```json
{
  "decision": "continue",
  "reasoning": "Login form is visible, I'll fill it out and submit",
  "action": {
    "action": "type",
    "selector": "#password",
    "value": "testpass123",
    "description": "Enter password"
  },
  "concerns": [
    "API returned 500 on previous request - might fail again"
  ],
  "nextCheckpoint": true
}
```

### bug-report.json
```json
{
  "bugFound": true,
  "severity": "high",
  "type": "network_error",
  "description": "Login API returning 500 Internal Server Error",
  "evidence": {
    "request": "POST /api/auth/login",
    "response": {"status": 500, "body": "Internal server error"},
    "consoleError": "TypeError: Cannot read property 'token' of undefined",
    "stackTrace": "at auth.js:45:12"
  },
  "suggestedFix": {
    "file": "/path/to/auth.js",
    "issue": "Attempting to access response.token without null check",
    "fix": "Add null check before accessing response.token"
  }
}
```

## New Commands

### Autonomous Exploration
```bash
fe-pilot explore <url> --goal "<objective>" [options]
```

**Example:**
```bash
fe-pilot explore https://staging.jahongir-app.uz \
  --goal "Test login with user@example.com:password123" \
  --auto-fix \
  --max-steps 20
```

**Options:**
- `--goal` - What to achieve (required)
- `--credentials` - Login credentials if needed
- `--auto-fix` - Let AI fix bugs automatically
- `--max-steps` - Maximum steps before giving up
- `--checkpoint-interval` - How often to pause for AI

### Interactive Mode
```bash
fe-pilot interactive <url>
```

AI has full control, decides every action based on observations.

## Smart Element Selection

Instead of brittle CSS selectors, use natural descriptions:

```yaml
# Old way (brittle)
- action: click
  selector: "button.auth-form__submit-btn.primary"

# New way (smart)
- action: click
  element: "the login button"
  # OR
  element: "button containing 'Sign In'"
  # OR
  element: "primary submit button in the form"
```

**Implementation:**
```typescript
async findElement(description: string): Promise<ElementHandle> {
  // Get all elements with text/aria labels
  const candidates = await this.page.$$('[role], button, a, input');

  // Use AI to match description to element
  // For Phase 2: simple text matching
  // For Phase 3: AI-powered semantic matching

  return bestMatch;
}
```

## Visual Regression Detection

```typescript
async compareScreenshots(before: string, after: string): Promise<DiffResult> {
  // Use pixelmatch or similar library
  const diff = await pixelmatch(beforeImage, afterImage);

  return {
    changed: diff.pixelsDifferent > threshold,
    percentage: diff.percentageDifferent,
    diffImage: diff.outputPath,
    regions: diff.changedRegions
  };
}
```

**Usage:**
```bash
fe-pilot explore <url> --goal "test checkout" --visual-regression
```

If unexpected visual changes detected:
- Capture diff image
- Send to AI for analysis
- AI decides if it's a bug or expected

## Auto-Fix Integration

When bug detected:

1. **Capture Bug Context**:
   - Error message
   - Stack trace
   - Network request/response
   - Code location

2. **AI Analysis**:
   - Read source file
   - Understand the bug
   - Generate fix

3. **Apply Fix**:
   - Edit source file
   - Save changes

4. **Verify**:
   - Re-run the scenario
   - Check if bug is fixed
   - If fixed: continue
   - If not: try different fix or escalate

**Example Flow:**
```
Step 1: Click login → 500 error
Step 2: AI detects bug in auth.js:45
Step 3: AI reads auth.js
Step 4: AI finds: `const token = response.token` (no null check)
Step 5: AI writes fix: `const token = response?.token ?? null`
Step 6: AI applies fix to /path/to/auth.js
Step 7: Re-run login → Success!
Step 8: Continue testing
```

## Implementation Priority

### Phase 2.1 (Now)
1. ✅ Autonomous explore command
2. ✅ File-based AI communication
3. ✅ Enhanced observations with context
4. ✅ AI decision loop

### Phase 2.2 (Next)
5. Smart element selection
6. Auto-fix integration
7. Enhanced error reporting

### Phase 2.3 (After)
8. Visual regression detection
9. Network mocking
10. Advanced AI analysis

Let's start with Phase 2.1!
