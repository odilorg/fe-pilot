# fe-pilot Usage Guide

> AI-powered autonomous frontend testing tool with action batching and self-healing capabilities

## Table of Contents
1. [Quick Start](#quick-start)
2. [Testing Modes](#testing-modes)
3. [Common Scenarios](#common-scenarios)
4. [Action Types Reference](#action-types-reference)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Basic Command Structure
```bash
node dist/index.js explore <URL> --goal "<your-goal>" [options]
```

### Your First Test
```bash
# Simple navigation test
node dist/index.js explore https://example.com \
  --goal "Navigate to contact page and fill out form" \
  --max-steps 20 \
  --headless
```

---

## Testing Modes

### 1. Autonomous Exploration Mode
AI autonomously navigates and interacts with your application based on a high-level goal.

**When to use:**
- Exploratory testing
- Finding unexpected bugs
- Testing complex user journeys
- Rapid prototyping of test scenarios

**Example:**
```bash
node dist/index.js explore https://myapp.com \
  --goal "Complete user registration and create first project" \
  --max-steps 50 \
  --headless
```

### 2. Manual Drive Mode (Action Injection)
You manually create action files to control the exact flow. Best for precise, repeatable tests.

**When to use:**
- Regression testing
- Known bug reproduction
- Precise step-by-step workflows
- CI/CD integration

**Example:**
```bash
# Start exploration
node dist/index.js explore https://myapp.com \
  --goal "Login and navigate to dashboard" \
  --max-steps 30 \
  --headless

# Manually create action.json in the session folder
# fe-pilot will execute your actions
```

---

## Common Scenarios

### Scenario 1: Testing Authentication Flow

**Goal:** Test login with valid credentials

```bash
node dist/index.js explore https://staging.myapp.com \
  --goal "Login with test@example.com:password123" \
  --max-steps 15 \
  --headless
```

**Manual action.json example:**
```json
{
  "reasoning": "Login flow: Open modal, enter credentials, submit",
  "actions": [
    {
      "action": "click",
      "selector": "text=Login",
      "description": "Click login button"
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
      "selector": "button:has-text('Submit')",
      "description": "Submit login form"
    }
  ]
}
```

### Scenario 2: Multi-Step Form Wizard

**Goal:** Complete a multi-step form (e.g., property listing, checkout)

```bash
node dist/index.js explore https://staging.myapp.com \
  --goal "Complete property listing: fill all 6 steps and submit" \
  --max-steps 80 \
  --headless
```

**Tips:**
- Use action batching for faster execution
- Let AI auto-detect step progress
- Include screenshots for visual verification

**Action batching example:**
```json
{
  "reasoning": "Step 1: Select property type and listing type",
  "actions": [
    {"action": "click", "selector": "text=Apartment", "description": "Select apartment"},
    {"action": "wait", "duration": 500},
    {"action": "click", "selector": "text=For Sale", "description": "Select sale type"},
    {"action": "click", "selector": "text=Next", "description": "Go to step 2"}
  ]
}
```

### Scenario 3: File Upload Testing

**Goal:** Test file upload functionality

```bash
node dist/index.js explore https://staging.myapp.com \
  --goal "Upload profile photo and save" \
  --max-steps 20 \
  --headless
```

**Upload action example:**
```json
{
  "reasoning": "Upload test file",
  "actions": [
    {
      "action": "upload",
      "selector": "input[type='file']",
      "value": "/path/to/test-image.jpg",
      "description": "Upload test image"
    },
    {
      "action": "wait",
      "duration": 2000,
      "description": "Wait for upload to process"
    },
    {
      "action": "click",
      "selector": "text=Save",
      "description": "Save uploaded file"
    }
  ]
}
```

### Scenario 4: Registration + Login + Complex Flow

**Goal:** Complete end-to-end user journey

```bash
node dist/index.js explore https://staging.myapp.com \
  --goal "Register new account, login, and create first listing with photos" \
  --max-steps 100 \
  --headless
```

**Key Points:**
- Use higher `--max-steps` for complex flows
- AI will handle navigation between pages
- Authentication state is maintained across actions

### Scenario 5: Dropdown & Form Element Testing

**Goal:** Test complex form interactions

**Select dropdown example:**
```json
{
  "actions": [
    {
      "action": "select",
      "selector": "select:has(option:has-text('New York'))",
      "value": "New York",
      "description": "Select city"
    },
    {
      "action": "select",
      "selector": "select[name='category']",
      "value": "electronics",
      "description": "Select category"
    }
  ]
}
```

### Scenario 6: Error State Testing

**Goal:** Trigger and verify error handling

```bash
node dist/index.js explore https://staging.myapp.com \
  --goal "Submit form with invalid data and verify error messages appear" \
  --max-steps 25 \
  --headless
```

**Verification action example:**
```json
{
  "actions": [
    {
      "action": "type",
      "selector": "input[name='email']",
      "value": "invalid-email",
      "description": "Enter invalid email"
    },
    {
      "action": "click",
      "selector": "text=Submit",
      "description": "Submit form"
    },
    {
      "action": "verify",
      "expect": [
        {
          "type": "element_visible",
          "selector": "text=Invalid email format"
        }
      ],
      "description": "Verify error message appears"
    }
  ]
}
```

---

## Action Types Reference

### navigate
Navigate to a URL
```json
{
  "action": "navigate",
  "url": "https://example.com/page",
  "description": "Navigate to page"
}
```

### click
Click an element
```json
{
  "action": "click",
  "selector": "button:has-text('Submit')",
  "description": "Click submit button"
}
```

**Selector strategies:**
- Text-based: `text=Login`, `button:has-text('Save')`
- CSS: `#submit-btn`, `.primary-button`
- Attributes: `input[name='email']`, `button[type='submit']`
- Combined: `button:has-text('Next'), .next-button`

### type
Type text into input field
```json
{
  "action": "type",
  "selector": "input[type='email']",
  "value": "user@example.com",
  "description": "Enter email address"
}
```

**Note:** Automatically clears existing value before typing

### select
Select option from dropdown
```json
{
  "action": "select",
  "selector": "select[name='country']",
  "value": "United States",
  "description": "Select country"
}
```

### upload
Upload file(s)
```json
{
  "action": "upload",
  "selector": "input[type='file']",
  "value": "/path/to/file.pdf",
  "description": "Upload document"
}
```

**Multiple files:**
```json
{
  "action": "upload",
  "selector": "input[type='file']",
  "value": "/path/file1.jpg, /path/file2.jpg",
  "description": "Upload multiple photos"
}
```

### wait
Wait for duration or element
```json
{
  "action": "wait",
  "duration": 2000,
  "description": "Wait 2 seconds"
}
```

**Wait for element:**
```json
{
  "action": "wait",
  "selector": ".loading-complete",
  "duration": 30000,
  "description": "Wait for loading to complete"
}
```

### screenshot
Capture screenshot
```json
{
  "action": "screenshot",
  "description": "Capture current state"
}
```

### scroll
Scroll page or element
```json
{
  "action": "scroll",
  "selector": ".content-area",
  "description": "Scroll to element"
}
```

**Scroll by amount:**
```json
{
  "action": "scroll",
  "value": "500",
  "description": "Scroll down 500px"
}
```

### hover
Hover over element
```json
{
  "action": "hover",
  "selector": ".dropdown-trigger",
  "description": "Hover over dropdown"
}
```

### verify
Verify expectations
```json
{
  "action": "verify",
  "expect": [
    {
      "type": "element_visible",
      "selector": ".success-message"
    },
    {
      "type": "url_changed",
      "pattern": "/dashboard"
    },
    {
      "type": "element_text",
      "selector": "h1",
      "contains": "Welcome"
    }
  ],
  "description": "Verify success state"
}
```

---

## Best Practices

### 1. Writing Effective Goals

**Good goals:**
- ✅ "Login with valid credentials and navigate to dashboard"
- ✅ "Complete checkout: add item, fill shipping, pay with test card"
- ✅ "Register new account with email testuser123@test.com"

**Poor goals:**
- ❌ "Test the website" (too vague)
- ❌ "Click buttons" (not outcome-focused)
- ❌ "Do stuff" (no clear objective)

**Goal Formula:**
```
[Action Verb] + [Specific Target] + [Expected Outcome]
```

### 2. Action Batching for Speed

**Without batching (slower):**
```bash
# Each action waits for AI checkpoint
Action 1 → Checkpoint → Action 2 → Checkpoint → Action 3
```

**With batching (6-10x faster):**
```json
{
  "actions": [
    {"action": "click", "selector": "..."},
    {"action": "type", "selector": "...", "value": "..."},
    {"action": "click", "selector": "..."}
  ]
}
```

**When to batch:**
- Sequential form fills
- Multi-step wizards
- Login flows
- Repetitive actions

**When NOT to batch:**
- Waiting for page navigation
- Complex conditional logic
- Error-prone interactions

### 3. Selector Best Practices

**Priority order:**
1. **Text-based** (most resilient): `text=Login`, `button:has-text('Save')`
2. **Semantic** (good): `button[type='submit']`, `input[name='email']`
3. **Data attributes** (stable): `[data-testid='submit-btn']`
4. **CSS classes** (fragile): `.btn-primary` (avoid if possible)
5. **IDs** (can change): `#submit` (use cautiously)

**Normalized selectors:**
fe-pilot auto-fixes common mistakes:
- `text=A, text=B` → `button:has-text('A'), button:has-text('B')`
- `input:has-text(...)` → `input[placeholder*='...']`

### 4. Handling Authentication

**Option 1: Include in goal**
```bash
--goal "Login with user@example.com:password123, then create listing"
```

**Option 2: Separate login action**
```json
{
  "reasoning": "Authenticate first",
  "actions": [
    {"action": "click", "selector": "text=Login"},
    {"action": "type", "selector": "input[type='email']", "value": "user@example.com"},
    {"action": "type", "selector": "input[type='password']", "value": "password123"},
    {"action": "click", "selector": "text=Submit"}
  ]
}
```

**Option 3: Use credentials flag** (if supported)
```bash
--credentials user@example.com:password123
```

### 5. Error Handling & Recovery

**Automatic features:**
- ✅ Action repetition detection (prevents infinite loops)
- ✅ Progress validation (detects stuck states)
- ✅ Selector normalization (fixes common mistakes)
- ✅ Console & network error tracking

**Manual recovery:**
```json
{
  "actions": [
    {
      "action": "click",
      "selector": "text=Submit, button[type='submit']",
      "description": "Try multiple selectors"
    }
  ]
}
```

### 6. Performance Optimization

**Max Steps Guidelines:**
- Simple flows: 10-20 steps
- Medium flows: 30-50 steps
- Complex flows: 60-100 steps
- Exploratory: 100+ steps

**Headless vs Headed:**
- **Headless** (`--headless`): 2-3x faster, CI/CD friendly
- **Headed**: Visual debugging, demo purposes

**Wait Strategy:**
- Use minimal waits (500ms for UI updates)
- Use element-based waits when possible
- Avoid hardcoded long waits (>5 seconds)

### 7. Screenshots for Documentation

**Strategic screenshot placement:**
```json
{
  "actions": [
    {"action": "navigate", "url": "..."},
    {"action": "screenshot", "description": "Initial state"},
    {"action": "click", "selector": "..."},
    {"action": "screenshot", "description": "After click"},
    {"action": "type", "selector": "...", "value": "..."},
    {"action": "screenshot", "description": "Form filled"}
  ]
}
```

### 8. Session Organization

**Session folder structure:**
```
fe-pilot-sessions/
└── exploration-{timestamp}/
    ├── observation.json    # Current page state (read by AI)
    ├── action.json         # Next actions (write by AI/you)
    ├── report.json         # Final test report
    └── screenshots/        # Visual captures
        ├── step-1-{timestamp}.png
        └── step-2-{timestamp}.png
```

**Naming conventions:**
- Use descriptive goal names
- Include timestamp for uniqueness
- Organize by feature area

---

## Troubleshooting

### Common Issues

#### Issue 1: Action Repetition Loop
**Symptom:** Same action repeats multiple times

**Solution:**
- Check if selector is too generic
- Verify element is actually clickable
- Use more specific selector
- Add wait between actions

**Fix:**
```json
{
  "actions": [
    {"action": "wait", "duration": 1000},
    {"action": "click", "selector": "button.specific-class:has-text('Exact Text')"}
  ]
}
```

#### Issue 2: Element Not Found
**Symptom:** "Element not visible" or timeout errors

**Solutions:**
1. Wait for element to appear:
```json
{"action": "wait", "selector": ".target-element", "duration": 5000}
```

2. Try alternative selectors:
```json
{"action": "click", "selector": "text=Submit, #submit-btn, button[type='submit']"}
```

3. Check if element is in iframe/shadow DOM

#### Issue 3: Upload Fails with 401
**Symptom:** File upload returns 401 Unauthorized

**Solution:** Ensure user is authenticated first
```json
{
  "actions": [
    // Login first
    {"action": "click", "selector": "text=Login"},
    {"action": "type", "selector": "input[type='email']", "value": "user@example.com"},
    {"action": "type", "selector": "input[type='password']", "value": "password"},
    {"action": "click", "selector": "text=Submit"},
    {"action": "wait", "duration": 2000},
    // Then upload
    {"action": "upload", "selector": "input[type='file']", "value": "/path/file.jpg"}
  ]
}
```

#### Issue 4: Form Validation Blocking Progress
**Symptom:** Can't proceed to next step

**Solution:** Ensure all required fields are filled
```json
{
  "actions": [
    {"action": "type", "selector": "input[required][name='title']", "value": "Test Title"},
    {"action": "type", "selector": "textarea[required]", "value": "Test description"},
    {"action": "screenshot", "description": "Before submit"},
    {"action": "click", "selector": "text=Next"}
  ]
}
```

#### Issue 5: Dynamic Content / SPA Issues
**Symptom:** Content changes after action, causing failures

**Solution:** Use appropriate waits
```json
{
  "actions": [
    {"action": "click", "selector": "text=Load More"},
    {"action": "wait", "selector": ".new-content-indicator", "duration": 5000},
    {"action": "screenshot", "description": "Content loaded"}
  ]
}
```

### Debugging Tips

1. **Enable headed mode** for visual debugging:
```bash
node dist/index.js explore ... --headed
```

2. **Check observation.json** to see what AI sees:
```bash
cat fe-pilot-sessions/exploration-*/observation.json | jq .domState
```

3. **Review screenshots** in session folder

4. **Check console/network errors** in observation:
```bash
cat observation.json | jq .consoleLogs
cat observation.json | jq .networkRequests
```

5. **Reduce max-steps** to isolate issues:
```bash
--max-steps 10  # Stop early to debug
```

---

## Advanced Tips

### 1. CI/CD Integration
```yaml
# .github/workflows/fe-tests.yml
name: Frontend Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - run: |
          node dist/index.js explore https://staging.myapp.com \
            --goal "Complete critical user journey" \
            --max-steps 50 \
            --headless
      - uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: fe-pilot-sessions/*/report.json
```

### 2. Parallel Test Execution
```bash
# Run multiple tests in parallel
node dist/index.js explore ... --goal "Test flow A" &
node dist/index.js explore ... --goal "Test flow B" &
node dist/index.js explore ... --goal "Test flow C" &
wait
```

### 3. Custom Test Data
```bash
# Use environment variables for dynamic data
EMAIL="test-$(date +%s)@example.com"
node dist/index.js explore ... --goal "Register with $EMAIL"
```

---

## Summary

**Key Takeaways:**
1. ✅ Use clear, outcome-focused goals
2. ✅ Batch actions for 6-10x speed improvement
3. ✅ Prefer text-based selectors for resilience
4. ✅ Handle authentication before protected actions
5. ✅ Use screenshots for documentation
6. ✅ Start with headless for speed, use headed for debugging

**Quick Reference Card:**
```bash
# Basic test
node dist/index.js explore <URL> --goal "<goal>" --max-steps 20

# With authentication
node dist/index.js explore <URL> --goal "Login as user@example.com, then <goal>"

# Headed mode (debugging)
node dist/index.js explore <URL> --goal "<goal>" --headed

# More steps for complex flows
node dist/index.js explore <URL> --goal "<goal>" --max-steps 100
```

For more examples, see the `/fe-pilot-sessions/` directory after running tests!
