# 🤖 Claude Code Workflow - Form Testing & Auto-Fix

> **This guide is for ME (Claude Code) to use when testing and fixing web forms.**

## 🎯 Primary Use Case

**User says:** "Test the contact form on example.com and fix any issues"

**My workflow:**
1. Test the form (programmatically)
2. Report findings conversationally
3. Auto-fix issues using my Edit tool
4. Re-test to verify
5. Report success

---

## 📦 Quick Reference

### **Import the API**

```typescript
import { ClaudeCodeFormAPI } from './src/core/form/claude-code-api';

const api = new ClaudeCodeFormAPI({ headless: true });
```

### **Quick Test (Conversational Output)**

```typescript
const summary = await api.quickTest('https://example.com/contact');

// summary contains human-readable text like:
// "I tested the form at contact-form and here's what I found:
//  ❌ Critical Issues Found (2):
//  1. Email: Missing aria-label
//     - Fix: Add aria-label="Email Address"
//  Would you like me to fix these issues automatically?"
```

### **Full Test with Streaming**

```typescript
const result = await api.testFormWithStreaming('https://example.com/contact', {
  callbacks: {
    onProgress: (msg) => {
      // I can report this to user in real-time
      console.log(msg);
    },
    onIssueFound: (issue) => {
      console.log(`Found ${issue.severity} issue: ${issue.message}`);
    }
  }
});
```

### **Get Auto-Fix Suggestions**

```typescript
// First, I need to find source files
// Using my Grep tool:
const files = await Grep({ pattern: 'contact.*form', output_mode: 'files_with_matches' });

// Read the source files
const sourceFiles = [];
for (const file of files) {
  const content = await Read({ file_path: file });
  sourceFiles.push({ path: file, content });
}

// Get fix suggestions
const fixes = await api.getAutoFixSuggestions(result, sourceFiles);

// fixes = [
//   {
//     issue: { message: 'Missing aria-label', field: 'email', ... },
//     fileToEdit: 'src/components/ContactForm.tsx',
//     oldCode: '<input id="email"',
//     newCode: '<input id="email" aria-label="Email Address"',
//     explanation: 'Add aria-label to make field accessible...',
//     confidence: 0.95
//   }
// ]
```

### **Apply Fixes Using My Edit Tool**

```typescript
for (const fix of fixes) {
  if (fix.confidence >= 0.8) {
    await Edit({
      file_path: fix.fileToEdit,
      old_string: fix.oldCode,
      new_string: fix.newCode
    });

    console.log(`✅ Fixed: ${fix.explanation}`);
  }
}
```

---

## 🔄 Complete Workflow Example

### **Scenario: User asks me to test and fix a form**

**User:** "Test the signup form on https://myapp.com/signup and fix any accessibility issues"

**My steps:**

```typescript
// Step 1: Test the form
const api = new ClaudeCodeFormAPI();

console.log("🤖 Testing the signup form...");

const result = await api.testFormWithStreaming('https://myapp.com/signup', {
  mode: 'full',
  callbacks: {
    onProgress: (msg) => console.log(msg),
    onIssueFound: (issue) => {
      if (issue.severity === 'critical') {
        console.log(`⚠️ Found critical issue: ${issue.message}`);
      }
    }
  }
});

// Step 2: Generate conversational summary
const summary = api.generateConversationalSummary(result);

// Step 3: Report to user
console.log(summary);
// Output: "I tested the form and found 3 accessibility issues:
//          1. Email field missing aria-label
//          2. Password field missing aria-required
//          3. Submit button has low contrast
//          Would you like me to fix these?"

// Step 4: Find source files (using my Grep tool)
const formFiles = await Glob({ pattern: '**/signup*.{tsx,jsx,ts,js}' });

const sourceFiles = [];
for (const file of formFiles) {
  const content = await Read({ file_path: file });
  sourceFiles.push({ path: file, content });
}

// Step 5: Get auto-fix suggestions
const fixes = await api.getAutoFixSuggestions(result, sourceFiles);

console.log(`\n🔧 Found ${fixes.length} auto-fix suggestions. Applying...`);

// Step 6: Apply fixes
let fixedCount = 0;
for (const fix of fixes) {
  if (fix.confidence >= 0.8) {
    await Edit({
      file_path: fix.fileToEdit,
      old_string: fix.oldCode,
      new_string: fix.newCode
    });

    console.log(`✅ ${fix.explanation}`);
    fixedCount++;
  }
}

// Step 7: Re-test to verify
console.log(`\n🔄 Re-testing to verify fixes...`);

const verifyResult = await api.quickTest('https://myapp.com/signup');

console.log(verifyResult);
// Output: "✅ All tests passed! (3 fields tested)
//          The form is now fully accessible."

// Step 8: Final report to user
console.log(`\n✅ **Fixed ${fixedCount} issues!** The signup form now passes all accessibility tests.`);
```

---

## 🎯 Common Scenarios

### **Scenario 1: Test form behind login**

```typescript
// User provides credentials
const result = await api.testFormWithStreaming('https://app.example.com/settings', {
  credentials: {
    username: 'test@example.com',
    password: 'TestPass123'
  },
  callbacks: {
    onProgress: (msg) => console.log(msg)
  }
});
```

### **Scenario 2: Quick health check (no auto-fix)**

```typescript
// Just test and report
const summary = await api.quickTest('https://example.com/contact');

console.log(summary);
// I report findings to user in conversation
```

### **Scenario 3: Test and fix in one go**

```typescript
// Full automated workflow
async function testAndFix(url: string) {
  const api = new ClaudeCodeFormAPI();

  // Test
  const result = await api.testFormWithStreaming(url);

  // Find source
  const sourceFiles = await findSourceFiles(url); // My helper

  // Get fixes
  const fixes = await api.getAutoFixSuggestions(result, sourceFiles);

  // Apply all high-confidence fixes
  for (const fix of fixes.filter(f => f.confidence >= 0.85)) {
    await Edit({
      file_path: fix.fileToEdit,
      old_string: fix.oldCode,
      new_string: fix.newCode
    });
  }

  // Verify
  return await api.quickTest(url);
}

// Usage
const finalSummary = await testAndFix('https://example.com/contact');
console.log(finalSummary);
```

---

## 🧠 Integration with My Tools

### **Finding Source Files (using Grep)**

```typescript
async function findSourceFiles(url: string): Promise<Array<{path: string; content: string}>> {
  // Extract form name from URL (e.g., "contact" from "/contact")
  const formName = url.split('/').pop() || 'form';

  // Find files containing this form
  const files = await Glob({
    pattern: `**/*${formName}*.{tsx,jsx,ts,js,html}`
  });

  // Read all matching files
  const sourceFiles = [];
  for (const file of files.slice(0, 10)) { // Limit to 10 files
    const content = await Read({ file_path: file });
    sourceFiles.push({ path: file, content });
  }

  return sourceFiles;
}
```

### **Applying Fixes (using Edit)**

```typescript
async function applyFix(fix: AutoFixSuggestion): Promise<void> {
  try {
    await Edit({
      file_path: fix.fileToEdit,
      old_string: fix.oldCode,
      new_string: fix.newCode
    });

    console.log(`✅ Applied fix: ${fix.explanation}`);
  } catch (error) {
    console.log(`⚠️ Could not auto-fix: ${fix.explanation}`);
    console.log(`   Manual fix needed in ${fix.fileToEdit}`);
  }
}
```

---

## 📊 Conversational Reporting

### **Template for reporting to users**

```typescript
function reportToUser(result: FormTestResult) {
  const api = new ClaudeCodeFormAPI();
  const summary = api.generateConversationalSummary(result);

  console.log(summary);

  // If issues found, offer to fix
  if (result.summary.criticalIssues > 0) {
    console.log("\n**Would you like me to:**");
    console.log("1. Show you the exact code changes needed");
    console.log("2. Automatically fix all issues");
    console.log("3. Fix only high-confidence issues");
  }
}
```

### **Progress updates during testing**

```typescript
const result = await api.testFormWithStreaming(url, {
  callbacks: {
    onProgress: (msg) => {
      // These messages go directly to user
      console.log(msg);
    },

    onFieldTested: (field) => {
      const status = field.status === 'passed' ? '✅' :
                    field.status === 'failed' ? '❌' : '⚠️';
      console.log(`${status} Tested: ${field.field.label}`);
    },

    onIssueFound: (issue) => {
      console.log(`   ⚠️ ${issue.severity.toUpperCase()}: ${issue.message}`);
    }
  }
});
```

---

## 🚀 Pro Tips (for me, Claude Code)

### **Tip 1: Always re-test after fixes**

```typescript
// Bad: Fix and assume it worked
await applyFixes(fixes);
console.log("Fixed!");

// Good: Fix and verify
await applyFixes(fixes);
const verifyResult = await api.quickTest(url);
console.log(verifyResult); // Shows if fixes actually worked
```

### **Tip 2: Use confidence thresholds**

```typescript
// Only apply high-confidence fixes automatically
const highConfidenceFixes = fixes.filter(f => f.confidence >= 0.9);
const mediumConfidenceFixes = fixes.filter(f => f.confidence >= 0.7 && f.confidence < 0.9);

// Auto-apply high confidence
for (const fix of highConfidenceFixes) {
  await applyFix(fix);
}

// Ask user about medium confidence
if (mediumConfidenceFixes.length > 0) {
  console.log(`\nFound ${mediumConfidenceFixes.length} fixes that might need review:`);
  mediumConfidenceFixes.forEach(f => {
    console.log(`- ${f.explanation} (confidence: ${(f.confidence * 100).toFixed(0)}%)`);
  });
  console.log("\nShould I apply these as well?");
}
```

### **Tip 3: Handle login credentials intelligently**

```typescript
// If user mentions login/auth, ask for credentials
if (url.includes('login') || url.includes('dashboard') || url.includes('admin')) {
  console.log("This page might require login. If needed, provide credentials with:");
  console.log("`--credentials username:password` or tell me the credentials.");
}
```

### **Tip 4: Integrate with existing debugging tools**

```typescript
// Before form testing, check for console errors
await Bash({ command: `fe-console ${url} --duration 3000` });

// If console has errors, report them first
// Then test the form

// After fixing, take screenshot to verify
await Bash({ command: `fe-snapshot ${url} --output after-fix.png` });
```

---

## 📝 CLI Wrapper (for backward compatibility)

The CLI commands still work for humans:

```bash
# Humans can use:
fe-pilot form test https://example.com/contact

# But I (Claude Code) use the API:
const api = new ClaudeCodeFormAPI();
await api.quickTest('https://example.com/contact');
```

---

## ✅ Checklist for Me (Claude Code)

When user asks me to test a form:

- [ ] Import ClaudeCodeFormAPI
- [ ] Run `quickTest()` or `testFormWithStreaming()` with callbacks
- [ ] Report findings conversationally to user
- [ ] If issues found, ask: "Should I fix these?"
- [ ] Find source files using Glob/Grep
- [ ] Get auto-fix suggestions
- [ ] Apply high-confidence fixes (>= 0.85)
- [ ] Re-test to verify
- [ ] Report final status to user

---

**Remember:** I'm the primary user, so this tool should:
- ✅ Give me actionable code changes
- ✅ Stream progress so I can update the user
- ✅ Work with my Read/Edit/Write tools
- ✅ Report conversationally, not just JSON
- ✅ Enable auto-fix workflow

This makes me **more effective** at helping users with form testing and accessibility fixes!
