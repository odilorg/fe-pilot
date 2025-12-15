/**
 * Claude Code API - Programmatic Interface
 *
 * This is the API that Claude Code (me!) uses to test forms
 * and automatically fix issues.
 *
 * Design Philosophy:
 * - Streaming updates (so I can report progress to user)
 * - Auto-fix suggestions (actionable code patches)
 * - Conversational output (natural language, not just JSON)
 * - Integration-ready (works with Read/Edit/Write tools)
 */

import { FormTester } from './form-tester';
import { FormTestResult, Issue, FieldTestResult } from './types';

export interface StreamingCallback {
  onProgress?: (message: string) => void;
  onFieldTested?: (field: FieldTestResult) => void;
  onIssueFound?: (issue: Issue) => void;
  onComplete?: (result: FormTestResult) => void;
}

export interface AutoFixSuggestion {
  issue: Issue;
  fileToEdit: string;
  oldCode: string;
  newCode: string;
  explanation: string;
  confidence: number; // 0-1
}

/**
 * Claude Code Form Testing API
 *
 * Usage by Claude Code:
 *
 * const api = new ClaudeCodeFormAPI();
 *
 * // Test a form with streaming updates
 * await api.testForm('https://example.com/contact', {
 *   onProgress: (msg) => console.log(msg),
 *   onIssueFound: (issue) => {
 *     // Report to user in conversation
 *     console.log(`Found ${issue.severity} issue: ${issue.message}`);
 *   }
 * });
 *
 * // Get auto-fix suggestions
 * const fixes = await api.getAutoFixSuggestions(result);
 *
 * // Apply fixes using my Edit tool
 * for (const fix of fixes) {
 *   await applyFix(fix); // Using my Edit tool
 * }
 */
export class ClaudeCodeFormAPI {
  constructor(private options?: { headless?: boolean }) {}

  private createTester(callbacks?: StreamingCallback): FormTester {
    return new FormTester({
      headless: this.options?.headless ?? true,
      aiMode: 'hybrid',
      callbacks: callbacks ? {
        onProgress: callbacks.onProgress,
        onFieldTested: callbacks.onFieldTested,
        onIssueFound: callbacks.onIssueFound,
      } : undefined,
    });
  }

  /**
   * Test a form with streaming updates
   * Perfect for Claude Code's conversational workflow
   */
  async testFormWithStreaming(
    url: string,
    options: {
      credentials?: { username: string; password: string };
      mode?: 'quick' | 'standard' | 'full';
      callbacks?: StreamingCallback;
    } = {}
  ): Promise<FormTestResult> {
    const { callbacks } = options;

    // Create tester with callbacks
    const tester = this.createTester(callbacks);

    // Run test (callbacks will stream progress)
    const result = await tester.testForm(url, {
      mode: options.mode || 'standard',
      credentials: options.credentials,
    });

    // Report final results
    callbacks?.onProgress?.(
      `\n✅ Test complete!\n` +
      `   Pass Rate: ${result.summary.passRate}%\n` +
      `   Critical Issues: ${result.summary.criticalIssues}\n` +
      `   Warnings: ${result.summary.warnings}`
    );

    // Notify completion
    callbacks?.onComplete?.(result);

    return result;
  }

  /**
   * Generate auto-fix suggestions
   * Claude Code can apply these using Edit tool
   */
  async getAutoFixSuggestions(
    result: FormTestResult,
    sourceFiles: { path: string; content: string }[]
  ): Promise<AutoFixSuggestion[]> {
    const suggestions: AutoFixSuggestion[] = [];

    for (const fieldResult of result.fieldResults) {
      for (const issue of fieldResult.issues) {
        const suggestion = await this.generateFixForIssue(issue, sourceFiles);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate a fix suggestion for a specific issue using Grep to find exact location
   */
  private async generateFixForIssue(
    issue: Issue,
    sourceFiles: { path: string; content: string }[]
  ): Promise<AutoFixSuggestion | null> {
    const fieldName = issue.field || '';
    if (!fieldName) return null;

    // Example: Missing aria-label
    if (issue.message.includes('Missing aria-label')) {
      // Find the file containing this field using pattern matching
      for (const file of sourceFiles) {
        // Search for the input element with this field's placeholder/name/id
        const patterns = [
          `placeholder="${fieldName}"`,
          `placeholder="{${fieldName}}"`,
          `id="${fieldName.toLowerCase()}"`,
          `name="${fieldName.toLowerCase()}"`,
          fieldName,
        ];

        let matchedPattern: string | null = null;
        let lineNumber = 0;

        for (const pattern of patterns) {
          const lines = file.content.split('\n');
          const foundLine = lines.findIndex(line => line.includes(pattern));
          if (foundLine >= 0) {
            matchedPattern = pattern;
            lineNumber = foundLine + 1;
            break;
          }
        }

        if (matchedPattern) {
          // Extract the actual line of code
          const lines = file.content.split('\n');
          const oldCode = lines[lineNumber - 1].trim();

          // Generate fix by adding aria-label
          const newCode = oldCode.includes('aria-label')
            ? oldCode  // Already has aria-label
            : oldCode.replace(/(<input[^>]*)(\/?>)/, `$1 aria-label="${fieldName}"$2`);

          if (oldCode !== newCode) {
            return {
              issue,
              fileToEdit: file.path,
              oldCode,
              newCode,
              explanation: `Add aria-label="${fieldName}" at ${file.path}:${lineNumber} for screen reader accessibility (WCAG 2.1 Level A)`,
              confidence: 0.95,
            };
          }
        }
      }
    }

    // Example: Missing aria-required
    if (issue.message.includes('Missing aria-required')) {
      const fieldName = issue.field || '';

      for (const file of sourceFiles) {
        if (file.content.includes(`id="${fieldName}"`)) {
          const oldCode = `<input id="${fieldName}" required`;
          const newCode = `<input id="${fieldName}" required aria-required="true"`;

          return {
            issue,
            fileToEdit: file.path,
            oldCode,
            newCode,
            explanation: `Add aria-required="true" to match the required attribute (WCAG 2.1 compliance)`,
            confidence: 0.9,
          };
        }
      }
    }

    return null;
  }

  /**
   * Conversational summary for Claude Code to report to user
   */
  generateConversationalSummary(result: FormTestResult): string {
    const { summary } = result;
    const criticalIssues = result.fieldResults.flatMap(fr =>
      fr.issues.filter(i => i.severity === 'critical' || i.severity === 'high')
    );

    let message = `I tested the form at **${result.form.id}** and here's what I found:\n\n`;

    if (summary.passRate === 100) {
      message += `✅ **All tests passed!** (${summary.totalFields} fields tested)\n\n`;
      message += `The form is working correctly:\n`;
      message += `- All required field validations work\n`;
      message += `- Format validations are correct\n`;
      message += `- No accessibility issues detected\n`;
    } else {
      message += `📊 **Pass Rate: ${summary.passRate}%** (${summary.fieldsPassed}/${summary.totalFields} fields passed)\n\n`;

      if (criticalIssues.length > 0) {
        message += `❌ **Critical Issues Found (${criticalIssues.length}):**\n\n`;
        criticalIssues.forEach((issue, i) => {
          message += `${i + 1}. **${issue.field}**: ${issue.message}\n`;
          message += `   - **Fix:** ${issue.recommendation}\n`;
          if (issue.wcagCriteria) {
            message += `   - **WCAG:** ${issue.wcagCriteria}\n`;
          }
          message += `\n`;
        });

        message += `\n**Would you like me to fix these issues automatically?**\n`;
      } else if (summary.warnings > 0) {
        message += `⚠️ **Minor Warnings (${summary.warnings}):**\n`;
        message += `The form works but has some accessibility improvements recommended.\n`;
      }
    }

    return message;
  }

  /**
   * Quick test (for Claude Code to use in agent workflow)
   * Returns conversational summary immediately
   */
  async quickTest(url: string, credentials?: { username: string; password: string }): Promise<string> {
    console.log(`🤖 Testing form at ${url}...`);

    const result = await this.testFormWithStreaming(url, {
      credentials,
      mode: 'quick',
      callbacks: {
        onProgress: (msg) => console.log(msg),
      },
    });

    return this.generateConversationalSummary(result);
  }

  /**
   * Group fixes by file for efficient batching
   * This is key for Claude Code's efficiency
   */
  groupFixesByFile(fixes: AutoFixSuggestion[]): Map<string, AutoFixSuggestion[]> {
    const byFile = new Map<string, AutoFixSuggestion[]>();

    for (const fix of fixes) {
      if (!byFile.has(fix.fileToEdit)) {
        byFile.set(fix.fileToEdit, []);
      }
      byFile.get(fix.fileToEdit)!.push(fix);
    }

    return byFile;
  }

  /**
   * Apply batched fixes to a single file
   * ONE Read + multiple replacements + ONE Write
   */
  async applyBatchedFixesToFile(
    filePath: string,
    fixes: AutoFixSuggestion[],
    readFileFn: (path: string) => Promise<string>,
    writeFileFn: (path: string, content: string) => Promise<void>
  ): Promise<{ applied: number; failed: number }> {
    try {
      // Read file once
      let content = await readFileFn(filePath);
      let applied = 0;
      let failed = 0;

      // Apply all fixes sequentially
      for (const fix of fixes) {
        const before = content;
        content = content.replace(fix.oldCode, fix.newCode);

        if (content !== before) {
          applied++;
          console.log(`   ✅ ${fix.explanation}`);
        } else {
          failed++;
          console.log(`   ⚠️  Could not apply: ${fix.explanation} (code not found)`);
        }
      }

      // Write once
      if (applied > 0) {
        await writeFileFn(filePath, content);
      }

      return { applied, failed };
    } catch (error) {
      console.error(`   ❌ Error applying fixes to ${filePath}:`, error);
      return { applied: 0, failed: fixes.length };
    }
  }

  /**
   * Complete workflow: Test → Batch Fixes → Verify
   * This is what Claude Code calls when user says "test and fix the form"
   */
  async testAndFixForm(
    url: string,
    options: {
      credentials?: { username: string; password: string };
      sourceFiles: Array<{ path: string; content: string }>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<void>;
      autoApplyThreshold?: number; // Confidence threshold (default: 0.85)
    }
  ): Promise<{
    testResult: FormTestResult;
    fixesApplied: number;
    verifyResult?: string;
  }> {
    const { credentials, sourceFiles, readFile, writeFile, autoApplyThreshold = 0.85 } = options;

    console.log(`🤖 Testing and fixing form at ${url}...`);

    // PHASE 1: Test with streaming
    console.log(`\n📊 Phase 1: Testing form...`);
    const testResult = await this.testFormWithStreaming(url, {
      credentials,
      mode: 'full',
      callbacks: {
        onProgress: (msg) => console.log(msg),
        onIssueFound: (issue) => {
          if (issue.severity === 'critical' || issue.severity === 'high') {
            console.log(`   ⚠️  ${issue.severity.toUpperCase()}: ${issue.message}`);
          }
        },
      },
    });

    // If no issues, we're done
    if (testResult.summary.criticalIssues === 0) {
      console.log(`\n✅ No issues found! Form is working correctly.`);
      return { testResult, fixesApplied: 0 };
    }

    // PHASE 2: Generate fix suggestions
    console.log(`\n🔧 Phase 2: Generating fix suggestions...`);
    const allFixes = await this.getAutoFixSuggestions(testResult, sourceFiles);
    const highConfidenceFixes = allFixes.filter(f => f.confidence >= autoApplyThreshold);

    console.log(`   Found ${allFixes.length} potential fixes`);
    console.log(`   ${highConfidenceFixes.length} high-confidence (>= ${(autoApplyThreshold * 100).toFixed(0)}%)`);

    if (highConfidenceFixes.length === 0) {
      console.log(`\n⚠️  No high-confidence fixes available. Manual review needed.`);
      return { testResult, fixesApplied: 0 };
    }

    // PHASE 3: Batch and apply fixes
    console.log(`\n🔧 Phase 3: Applying fixes (batched by file)...`);
    const byFile = this.groupFixesByFile(highConfidenceFixes);
    let totalApplied = 0;

    for (const [file, fileFixes] of byFile) {
      console.log(`\n   📝 ${file} (${fileFixes.length} fixes):`);
      const { applied } = await this.applyBatchedFixesToFile(file, fileFixes, readFile, writeFile);
      totalApplied += applied;
    }

    console.log(`\n✅ Applied ${totalApplied} fixes across ${byFile.size} file(s)`);

    // PHASE 4: Verify
    console.log(`\n🔄 Phase 4: Re-testing to verify fixes...`);
    const verifyResult = await this.quickTest(url, credentials);

    return {
      testResult,
      fixesApplied: totalApplied,
      verifyResult,
    };
  }
}

/**
 * Helper: Apply a fix using Claude Code's Edit tool
 *
 * Claude Code would call this like:
 *
 * const api = new ClaudeCodeFormAPI();
 * const result = await api.testForm(url);
 * const fixes = await api.getAutoFixSuggestions(result, sourceFiles);
 *
 * for (const fix of fixes) {
 *   await applyFixWithEdit(fix);
 * }
 */
export async function applyFixWithEdit(fix: AutoFixSuggestion): Promise<void> {
  // This would be called by Claude Code using the Edit tool
  console.log(`Applying fix to ${fix.fileToEdit}:`);
  console.log(`  ${fix.explanation}`);
  console.log(`  Confidence: ${(fix.confidence * 100).toFixed(0)}%`);

  // In actual usage, Claude Code would do:
  // await Edit({
  //   file_path: fix.fileToEdit,
  //   old_string: fix.oldCode,
  //   new_string: fix.newCode
  // });
}

/**
 * Example: Claude Code Workflow
 *
 * User: "Test the contact form and fix any issues"
 *
 * Claude Code:
 * 1. const api = new ClaudeCodeFormAPI();
 * 2. const summary = await api.quickTest('https://example.com/contact');
 * 3. // Report to user
 *    "I found 2 accessibility issues. Let me fix them..."
 * 4. const result = await api.testForm(...);
 * 5. const sourceFiles = await findSourceFiles(); // Using Grep
 * 6. const fixes = await api.getAutoFixSuggestions(result, sourceFiles);
 * 7. for (const fix of fixes) {
 *      await Edit({ ... }); // Apply fix
 *    }
 * 8. // Re-test to verify
 * 9. const summary2 = await api.quickTest('https://example.com/contact');
 * 10. // Report: "✅ All issues fixed! Form now passes all tests."
 */
