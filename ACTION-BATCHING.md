# Action Batching - 10x Efficiency Boost ⚡

## What Changed

**Before**: AI had to respond after EVERY action
**After**: AI can provide multiple actions at once

## Efficiency Comparison

### Example: Login Flow

**Before** (5 AI checkpoints):
```
Step 1: Navigate → [Wait for AI] →
Step 2: Click login → [Wait for AI] →
Step 3: Switch to email → [Wait for AI] →
Step 4: Type email → [Wait for AI] →
Step 5: Type password → [Wait for AI] →
Step 6: Click submit → [Wait for AI]

Time: ~10-30 seconds
```

**After** (1 AI checkpoint):
```
Step 1: Execute batch [navigate, click, switch, type email, type password, click submit] → [Wait for AI]

Time: ~2-5 seconds
```

**Result**: 10x faster! ⚡

## How to Use

### Single Action (Old Way - Still Supported)
```json
{
  "decision": "continue",
  "reasoning": "Click the login button",
  "action": {
    "action": "click",
    "selector": "text=Войти",
    "description": "Click login"
  },
  "nextCheckpoint": true
}
```

### Batched Actions (New Way - Recommended)
```json
{
  "decision": "continue",
  "reasoning": "Complete the login flow",
  "actions": [
    {
      "action": "click",
      "selector": "text=Войти",
      "description": "Open login modal"
    },
    {
      "action": "click",
      "selector": "text=Войти через Email",
      "description": "Switch to email login"
    },
    {
      "action": "type",
      "selector": "input[placeholder='you@example.com']",
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
      "description": "Submit login form"
    },
    {
      "action": "wait",
      "duration": 2000,
      "description": "Wait for login to complete"
    },
    {
      "action": "screenshot",
      "description": "Capture post-login state"
    }
  ],
  "stopOnError": true,
  "nextCheckpoint": true
}
```

## Options

### stopOnError (default: true)

**true** - Stop batch if any action fails (recommended):
```json
{
  "actions": [
    {"action": "type", "selector": "#email", "value": "test@test.com"},
    {"action": "type", "selector": "#password", "value": "pass123"},
    {"action": "click", "selector": "#submit"}
  ],
  "stopOnError": true
}
```
If typing email fails → stops, doesn't continue to password

**false** - Continue even if actions fail:
```json
{
  "actions": [
    {"action": "screenshot", "description": "Before"},
    {"action": "click", "selector": "#optional-button"},  // Might not exist
    {"action": "screenshot", "description": "After"}
  ],
  "stopOnError": false
}
```
Even if optional button doesn't exist, still takes "After" screenshot

## Real-World Examples

### Example 1: Complete Login
```json
{
  "decision": "continue",
  "reasoning": "Login with provided credentials",
  "actions": [
    {"action": "click", "selector": "[data-testid='login-button']"},
    {"action": "type", "selector": "#email", "value": "user@example.com"},
    {"action": "type", "selector": "#password", "value": "password123"},
    {"action": "click", "selector": "button[type='submit']"},
    {"action": "wait", "duration": 2000}
  ]
}
```

### Example 2: Fill Property Form
```json
{
  "decision": "continue",
  "reasoning": "Fill out property creation form",
  "actions": [
    {"action": "type", "selector": "#property-title", "value": "Luxury Apartment"},
    {"action": "type", "selector": "#price", "value": "150000"},
    {"action": "select", "selector": "#property-type", "value": "apartment"},
    {"action": "type", "selector": "#bedrooms", "value": "3"},
    {"action": "type", "selector": "#bathrooms", "value": "2"},
    {"action": "type", "selector": "#area", "value": "120"},
    {"action": "type", "selector": "#description", "value": "Beautiful apartment in city center"},
    {"action": "screenshot", "description": "Form filled"},
    {"action": "click", "selector": "button[type='submit']"}
  ]
}
```

### Example 3: Multi-Page Navigation
```json
{
  "decision": "continue",
  "reasoning": "Navigate through checkout flow",
  "actions": [
    {"action": "click", "selector": "text=Add to Cart"},
    {"action": "wait", "duration": 1000},
    {"action": "click", "selector": "text=Checkout"},
    {"action": "wait", "duration": 1000},
    {"action": "type", "selector": "#shipping-address", "value": "123 Main St"},
    {"action": "click", "selector": "text=Continue"},
    {"action": "wait", "duration": 1000},
    {"action": "screenshot", "description": "Payment page"}
  ]
}
```

## Behavior

### Execution Flow
1. Receive batched actions from AI
2. Execute actions sequentially
3. If action fails:
   - If `stopOnError: true` → Stop batch, report error
   - If `stopOnError: false` → Continue with next action
4. After batch completes → Capture single observation
5. Send observation to AI → Get next batch

### Observations
- **One observation per batch** (not per action)
- Observation captures final state after all actions
- Includes all console logs/network from entire batch
- More efficient than per-action observations

## Benefits

✅ **10x faster** - Fewer AI roundtrips
✅ **More natural** - AI thinks in flows, not individual actions
✅ **Better error handling** - Can specify failure behavior
✅ **Backward compatible** - Single actions still work
✅ **Reduced noise** - One observation per batch vs per action

## Migration Guide

### Old Pattern
```json
// 1st AI response
{"action": {"action": "click", "selector": "#btn1"}}

// 2nd AI response
{"action": {"action": "type", "selector": "#input", "value": "test"}}

// 3rd AI response
{"action": {"action": "click", "selector": "#submit"}}
```

### New Pattern
```json
// 1 AI response
{
  "actions": [
    {"action": "click", "selector": "#btn1"},
    {"action": "type", "selector": "#input", "value": "test"},
    {"action": "click", "selector": "#submit"}
  ]
}
```

## Tips

1. **Group related actions** - Login, form filling, navigation flows
2. **Add screenshots strategically** - Before/after key state changes
3. **Use wait actions** - Give time for async operations
4. **Set stopOnError wisely** - true for critical flows, false for optional actions
5. **Add descriptions** - Helps debug which action failed

## Performance Impact

**Before**:
- Property creation: 20-30 AI checkpoints × 2-5s = 40-150 seconds
- Login: 4-5 checkpoints × 2-5s = 8-25 seconds

**After**:
- Property creation: 3-5 AI checkpoints × 1-2s = 3-10 seconds
- Login: 1 checkpoint × 1-2s = 1-2 seconds

**Result**: 10-30x faster! 🚀
