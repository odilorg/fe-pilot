/**
 * Form Tester - Main Orchestrator
 * Coordinates form discovery, testing, and reporting
 */

import { chromium, Browser, Page } from 'playwright';
import { FormDiscovery } from './form-discovery';
import { EdgeCaseHandler } from './edge-case-handler';
import { FormTestConfig, FormTestResult, MultiFormTestResult, FieldTestResult, Issue, DiscoveredForm } from './types';
import * as path from 'path';
import * as fs from 'fs';

export interface StreamingCallbacks {
  onProgress?: (message: string) => void;
  onFieldTested?: (result: FieldTestResult) => void;
  onIssueFound?: (issue: Issue) => void;
}

export interface FormTesterOptions {
  headless?: boolean;
  outputDir?: string;
  aiMode?: 'disabled' | 'fallback' | 'hybrid' | 'always';
  callbacks?: StreamingCallbacks;
}

export class FormTester {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private outputDir: string;

  constructor(private options: FormTesterOptions = {}) {
    this.outputDir = options.outputDir || path.join(process.cwd(), 'form-test-results');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Main entry: Test a form at given URL
   */
  async testForm(url: string, config: Partial<FormTestConfig> = {}): Promise<FormTestResult> {
    const startTime = Date.now();

    // Merge config with defaults
    const fullConfig: FormTestConfig = {
      mode: config.mode || 'standard',
      aiMode: this.options.aiMode || config.aiMode || 'hybrid',
      wcagLevel: config.wcagLevel || 'AA',
      maxAICost: config.maxAICost || 0.50,
      credentials: config.credentials,
    };

    const { callbacks } = this.options;

    callbacks?.onProgress?.(`🚀 Starting form test: ${url}`);
    callbacks?.onProgress?.(`📊 Mode: ${fullConfig.mode}`);
    callbacks?.onProgress?.(`🧠 AI Mode: ${fullConfig.aiMode}`);

    try {
      // Launch browser
      this.browser = await chromium.launch({ headless: this.options.headless !== false });
      this.page = await this.browser.newPage();

      // Navigate to URL
      callbacks?.onProgress?.(`🌐 Navigating to ${url}...`);
      await this.page.goto(url, { waitUntil: 'networkidle' });

      // Handle edge cases (popups, modals, etc.)
      const edgeCaseHandler = new EdgeCaseHandler(this.page, fullConfig);
      const obstaclesCleared = await edgeCaseHandler.handleObstacles();

      if (!obstaclesCleared) {
        throw new Error('Could not clear obstacles blocking form access');
      }

      // Discover forms
      callbacks?.onProgress?.(`🔍 Discovering forms...`);
      const discovery = new FormDiscovery(this.page);
      const forms = await discovery.detectForms();

      if (forms.length === 0) {
        throw new Error('No forms found on page');
      }

      callbacks?.onProgress?.(`✓ Found ${forms.length} form(s)`);

      // Test ALL forms on the page
      const allResults: FormTestResult[] = [];

      for (let formIndex = 0; formIndex < forms.length; formIndex++) {
        const form = forms[formIndex];
        callbacks?.onProgress?.(`\n📋 Testing form ${formIndex + 1}/${forms.length}: ${form.id || 'unnamed'} (${form.fields.length} fields)`);

        const formResult = await this.testSingleForm(form, fullConfig, edgeCaseHandler);
        allResults.push(formResult);
      }

      // Calculate overall summary
      const overallSummary = {
        totalForms: allResults.length,
        formsWithIssues: allResults.filter(r => r.summary.criticalIssues > 0 || r.summary.warnings > 0).length,
        totalFields: allResults.reduce((sum, r) => sum + r.summary.totalFields, 0),
        fieldsPassed: allResults.reduce((sum, r) => sum + r.summary.fieldsPassed, 0),
        totalCriticalIssues: allResults.reduce((sum, r) => sum + r.summary.criticalIssues, 0),
        totalWarnings: allResults.reduce((sum, r) => sum + r.summary.warnings, 0),
        overallPassRate: 0,
      };
      overallSummary.overallPassRate = Math.round((overallSummary.fieldsPassed / overallSummary.totalFields) * 100);

      const multiFormResult: MultiFormTestResult = {
        forms: allResults,
        overallSummary,
        duration: Date.now() - startTime,
        totalAICost: edgeCaseHandler.getAIStats().totalAICost,
      };

      // Save results
      await this.saveMultiFormResults(multiFormResult);

      // For backward compatibility, return first form result
      return allResults[0];
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Test a single form
   */
  private async testSingleForm(
    form: DiscoveredForm,
    config: FormTestConfig,
    edgeCaseHandler: EdgeCaseHandler
  ): Promise<FormTestResult> {
    const startTime = Date.now();
    const { callbacks } = this.options;

    // Test each field
    const fieldResults: FieldTestResult[] = [];
    const issues: Issue[] = [];
    const screenshots: string[] = [];

    for (let i = 0; i < form.fields.length; i++) {
      const field = form.fields[i];
      callbacks?.onProgress?.(`Testing field ${i + 1}/${form.fields.length}: ${field.label}`);

      const fieldResult = await this.testField(field, config);
      fieldResults.push(fieldResult);
      issues.push(...fieldResult.issues);
      screenshots.push(...fieldResult.screenshots);

      // Notify callbacks
      callbacks?.onFieldTested?.(fieldResult);

      // Report issues
      if (fieldResult.issues.length > 0) {
        fieldResult.issues.forEach(issue => {
          callbacks?.onIssueFound?.(issue);
        });
      }

      // Log result
      const statusIcon = fieldResult.status === 'passed' ? '✅' :
                        fieldResult.status === 'failed' ? '❌' : '⚠️';
      callbacks?.onProgress?.(`   ${statusIcon} ${fieldResult.status.toUpperCase()}`);
    }

    // Calculate summary
    const summary = {
      totalFields: form.fields.length,
      fieldsPassed: fieldResults.filter(r => r.status === 'passed').length,
      fieldsFailed: fieldResults.filter(r => r.status === 'failed').length,
      fieldsWarning: fieldResults.filter(r => r.status === 'warning').length,
      criticalIssues: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length,
      warnings: issues.filter(i => i.severity === 'medium' || i.severity === 'low').length,
      passRate: 0,
    };
    summary.passRate = Math.round((summary.fieldsPassed / summary.totalFields) * 100);

    return {
      form,
      fieldResults,
      obstaclesEncountered: [],
      aiDecisionsMade: [],
      summary,
      screenshots,
      duration: Date.now() - startTime,
      aiCost: edgeCaseHandler.getAIStats().totalAICost,
    };
  }

  /**
   * Test form submission with valid data
   */
  private async testFormSubmission(form: DiscoveredForm, config: FormTestConfig): Promise<any> {
    const startTime = Date.now();
    const networkRequests: Array<{url: string; method: string; status: number; timing: number}> = [];
    const consoleErrors: string[] = [];

    try {
      // Monitor network requests
      this.page!.on('request', request => {
        const reqStart = Date.now();
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          status: 0,
          timing: 0,
        });
      });

      this.page!.on('response', async response => {
        const req = networkRequests.find(r => r.url === response.url() && r.status === 0);
        if (req) {
          req.status = response.status();
          req.timing = Date.now() - startTime;
        }
      });

      // Monitor console errors
      this.page!.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Fill form with valid test data
      const formData: Record<string, any> = {};
      for (const field of form.fields) {
        const testData = this.generateTestData(field);
        const validValue = testData.valid[0];

        try {
          const fieldType = field.type as string;
          if (fieldType === 'select-one' || fieldType === 'select-multiple' || field.type === 'select' || field.type === 'multiselect') {
            await this.page!.selectOption(field.selector, { index: 1 }); // Select first non-empty option
          } else {
            await this.page!.fill(field.selector, validValue);
          }
          formData[field.id] = validValue;
        } catch (err) {
          // Field might be disabled or not interactive
        }
      }

      // Find and click submit button
      const submitButton = form.submitButton?.selector || 'button[type="submit"]';
      const initialUrl = this.page!.url();

      await this.page!.click(submitButton);

      // Wait for navigation or network idle
      await Promise.race([
        this.page!.waitForLoadState('networkidle', { timeout: 5000 }),
        this.page!.waitForTimeout(2000),
      ]).catch(() => {});

      const responseTime = Date.now() - startTime;
      const redirectUrl = this.page!.url();
      const submitted = redirectUrl !== initialUrl || networkRequests.some(r => r.method === 'POST');

      // Find the main submission request
      const submissionRequest = networkRequests.find(r =>
        r.method === 'POST' && (r.url.includes('/api/') || r.url.includes(form.action || ''))
      );

      return {
        validSubmission: {
          passed: submitted && (submissionRequest?.status || 0) < 400,
          message: submitted ? 'Form submitted successfully' : 'Form did not submit',
        },
        invalidSubmission: { passed: true, message: 'Not tested' },
        errorHandling: {
          passed: consoleErrors.length === 0,
          message: consoleErrors.length > 0 ? `${consoleErrors.length} console errors during submission` : 'No console errors',
        },
        loadingIndicator: { passed: true, message: 'Not tested' },
        duplicatePrevention: { passed: true, message: 'Not tested' },
        submitted,
        statusCode: submissionRequest?.status,
        redirectUrl: redirectUrl !== initialUrl ? redirectUrl : undefined,
        responseTime,
        networkRequests: networkRequests.slice(0, 10), // Limit to first 10
        consoleErrors,
        formData,
      };
    } catch (error) {
      return {
        validSubmission: { passed: false, message: `Submission test failed: ${error}` },
        invalidSubmission: { passed: true, message: 'Not tested' },
        errorHandling: { passed: false, message: `Error: ${error}` },
        loadingIndicator: { passed: true, message: 'Not tested' },
        duplicatePrevention: { passed: true, message: 'Not tested' },
        submitted: false,
        consoleErrors,
        networkRequests,
      };
    }
  }

  /**
   * Test a single field
   */
  private async testField(field: any, config: FormTestConfig): Promise<FieldTestResult> {
    const issues: Issue[] = [];
    const screenshots: string[] = [];

    // Test 1: Required validation (if field is required)
    let requiredTest;
    if (field.required) {
      requiredTest = await this.testRequiredValidation(field);
      if (!requiredTest.passed) {
        issues.push({
          severity: 'high',
          category: 'validation',
          field: field.label,
          message: `Required validation failed: ${requiredTest.message}`,
          recommendation: 'Ensure required field shows error when left empty',
        });
      } else if (requiredTest.details?.errorMessage) {
        // Validate error message quality
        const errorQuality = this.validateErrorMessageQuality(requiredTest.details.errorMessage, field);
        if (errorQuality.issues.length > 0) {
          issues.push({
            severity: 'medium',
            category: 'validation',
            field: field.label,
            message: `Error message quality issues: ${errorQuality.issues.join(', ')}`,
            recommendation: errorQuality.recommendation,
          });
        }
      }
    }

    // Test 2: Format validation (for email, tel, etc.)
    let formatTest;
    if (field.type === 'email' || field.type === 'tel' || field.type === 'url') {
      formatTest = await this.testFormatValidation(field);
      if (!formatTest.passed) {
        issues.push({
          severity: 'medium',
          category: 'validation',
          field: field.label,
          message: `Format validation failed: ${formatTest.message}`,
          recommendation: `Add ${field.type} validation to this field`,
        });
      }
    }

    // Test 3: Accessibility
    const accessibilityTest = await this.testAccessibility(field, config);
    if (!accessibilityTest.passed) {
      issues.push({
        severity: 'critical',
        category: 'accessibility',
        field: field.label,
        message: accessibilityTest.message,
        recommendation: accessibilityTest.details?.recommendation || 'Fix accessibility issues',
        wcagCriteria: accessibilityTest.details?.wcagCriteria,
      });
    }

    // Determine overall status
    const hasCritical = issues.some(i => i.severity === 'critical' || i.severity === 'high');
    const hasWarnings = issues.some(i => i.severity === 'medium' || i.severity === 'low');
    const status = hasCritical ? 'failed' : (hasWarnings ? 'warning' : 'passed');

    return {
      field: { ...field, testData: this.generateTestData(field), accessibility: {} },
      tests: {
        requiredValidation: requiredTest,
        formatValidation: formatTest,
        accessibility: accessibilityTest,
      },
      status,
      issues,
      screenshots,
    };
  }

  /**
   * Test required field validation
   */
  private async testRequiredValidation(field: any) {
    try {
      // Check if field is disabled
      const isDisabled = await this.page!.evaluate((selector) => {
        const el = document.querySelector(selector);
        return el ? (el as HTMLInputElement | HTMLSelectElement).disabled : false;
      }, field.selector);

      if (isDisabled) {
        return { passed: false, message: 'Field is disabled (likely depends on another field)' };
      }

      // Handle select elements differently
      if (field.type === 'select-one' || field.type === 'select-multiple') {
        // For select, try to select empty/first option then blur
        await this.page!.focus(field.selector);

        // Try to select the first (usually empty/placeholder) option
        const hasEmptyOption = await this.page!.evaluate((selector) => {
          const select = document.querySelector(selector) as HTMLSelectElement;
          if (!select) return false;
          return select.options.length > 0 && (!select.options[0].value || select.options[0].value === '');
        }, field.selector);

        if (hasEmptyOption) {
          await this.page!.selectOption(field.selector, { index: 0 });
        }

        await this.page!.keyboard.press('Tab'); // Blur to trigger validation
      } else {
        // For input/textarea fields
        await this.page!.focus(field.selector);
        await this.page!.fill(field.selector, ''); // Ensure empty
        await this.page!.keyboard.press('Tab'); // Blur to trigger validation
      }

      // Wait a bit for error message
      await this.page!.waitForTimeout(500);

      // Check if error message appeared and capture it
      const errorData = await this.page!.evaluate(() => {
        // Look for common error message patterns
        const errorElements = document.querySelectorAll('.error, .invalid, [class*="error"], [role="alert"]');
        const errorTexts: string[] = [];
        errorElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 0) errorTexts.push(text);
        });
        return {
          hasError: errorElements.length > 0,
          messages: errorTexts,
        };
      });

      if (errorData.hasError) {
        return {
          passed: true,
          message: 'Required validation works correctly',
          details: { errorMessage: errorData.messages[0] || '' },
        };
      } else {
        return { passed: false, message: 'No error shown when required field is empty' };
      }
    } catch (error) {
      return { passed: false, message: `Test failed: ${error}` };
    }
  }

  /**
   * Test format validation (email, tel, url)
   */
  private async testFormatValidation(field: any) {
    try {
      // Skip format validation for select elements
      if (field.type === 'select-one' || field.type === 'select-multiple') {
        return { passed: true, message: 'Select elements do not have format validation' };
      }

      // Check if field is disabled
      const isDisabled = await this.page!.evaluate((selector) => {
        const el = document.querySelector(selector);
        return el ? (el as HTMLInputElement).disabled : false;
      }, field.selector);

      if (isDisabled) {
        return { passed: true, message: 'Field is disabled, skipping format validation' };
      }

      const invalidData = field.type === 'email' ? 'notanemail' :
                         field.type === 'tel' ? 'abc123' :
                         field.type === 'url' ? 'notaurl' : 'invalid';

      await this.page!.fill(field.selector, invalidData);
      await this.page!.keyboard.press('Tab'); // Blur
      await this.page!.waitForTimeout(500);

      // Check if error shown for invalid format
      const errorVisible = await this.page!.evaluate(() => {
        const errors = document.querySelectorAll('.error, .invalid, [aria-invalid="true"]');
        return errors.length > 0;
      });

      if (errorVisible) {
        // Clear the invalid data
        await this.page!.fill(field.selector, '');
        return { passed: true, message: 'Format validation works correctly' };
      } else {
        return { passed: false, message: 'No error shown for invalid format' };
      }
    } catch (error) {
      return { passed: false, message: `Test failed: ${error}` };
    }
  }

  /**
   * Test accessibility (WCAG compliance)
   */
  private async testAccessibility(field: any, config: FormTestConfig) {
    const issues: string[] = [];

    // Check 0: Skip detailed checks for disabled fields (but report they're disabled)
    const isDisabled = await this.page!.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? (el as HTMLInputElement | HTMLSelectElement).disabled : false;
    }, field.selector);

    if (isDisabled) {
      issues.push('Field is disabled (may be accessibility issue if not properly indicated)');
    }

    // Check 1: Has label
    if (!field.label && !field.ariaLabel) {
      issues.push('Missing label or aria-label');
    }

    // Check 2: Keyboard accessible (only if not disabled)
    if (!isDisabled) {
      try {
        await this.page!.focus(field.selector);
        const focused = await this.page!.evaluate((selector) => {
          return document.activeElement === document.querySelector(selector);
        }, field.selector);

        if (!focused) {
          issues.push('Not keyboard accessible (cannot focus with Tab)');
        }
      } catch {
        issues.push('Cannot focus field');
      }
    }

    // Check 3: ARIA attributes (if required)
    if (field.required && !field.ariaRequired) {
      issues.push('Missing aria-required="true" attribute');
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: `Accessibility issues: ${issues.join(', ')}`,
        details: {
          wcagCriteria: '1.3.1 Info and Relationships (Level A)',
          recommendation: 'Add proper labels and ARIA attributes',
        },
      };
    }

    return { passed: true, message: 'All accessibility checks passed' };
  }

  /**
   * Validate error message quality
   */
  private validateErrorMessageQuality(errorMessage: string, field: any): {
    issues: string[];
    recommendation: string;
  } {
    const issues: string[] = [];

    // Check 1: Message is too short (vague)
    if (errorMessage.length < 10) {
      issues.push('Error message too vague (< 10 characters)');
    }

    // Check 2: Message doesn't mention the field name
    if (!errorMessage.toLowerCase().includes(field.label.toLowerCase().slice(0, 5))) {
      issues.push(`Error doesn't mention field name "${field.label}"`);
    }

    // Check 3: Message is just "Error" or "Required" or "Invalid"
    const vagueMessages = ['error', 'required', 'invalid', 'wrong', 'incorrect'];
    if (vagueMessages.includes(errorMessage.toLowerCase().trim())) {
      issues.push('Error message is too generic');
    }

    // Check 4: Message doesn't explain what's wrong
    const hasExplanation = errorMessage.toLowerCase().includes('must') ||
                          errorMessage.toLowerCase().includes('should') ||
                          errorMessage.toLowerCase().includes('please') ||
                          errorMessage.toLowerCase().includes('required') ||
                          errorMessage.toLowerCase().includes('valid');
    if (!hasExplanation && errorMessage.length < 20) {
      issues.push('Error message doesn\'t explain what\'s wrong');
    }

    const recommendation = issues.length > 0
      ? `Improve error message to be specific and helpful. Good example: "${field.label} is required" or "${field.label} must be a valid email address"`
      : 'Error message quality is good';

    return { issues, recommendation };
  }

  /**
   * Generate test data for field
   */
  private generateTestData(field: any): any {
    switch (field.type) {
      case 'email':
        return {
          valid: ['test@example.com', 'user+tag@domain.co.uk'],
          invalid: ['notanemail', '@domain.com', ''],
          edge: ['a@b.c', 'very.long.email.address@subdomain.example.com'],
        };
      case 'tel':
        return {
          valid: ['+998901234567', '998901234567'],
          invalid: ['abc', '123'],
          edge: ['+1234567890123456789', '0000000000'],
        };
      case 'password':
        return {
          valid: ['SecurePass123!', 'MyP@ssw0rd'],
          invalid: ['123', 'abc'],
          edge: ['a', 'A'.repeat(100)],
        };
      default:
        return {
          valid: ['Valid text'],
          invalid: [''],
          edge: ['A'.repeat(1000)],
        };
    }
  }

  /**
   * Save test results to files
   */
  private async saveResults(result: FormTestResult): Promise<void> {
    // Save JSON
    const jsonPath = path.join(this.outputDir, 'report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    // Save Markdown summary
    const mdPath = path.join(this.outputDir, 'report.md');
    const markdown = this.generateMarkdownReport(result);
    fs.writeFileSync(mdPath, markdown);

    console.log(`\n📄 Reports generated:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   Markdown: ${mdPath}`);
  }

  /**
   * Save multi-form test results to files
   */
  private async saveMultiFormResults(result: MultiFormTestResult): Promise<void> {
    // Save JSON (all forms)
    const jsonPath = path.join(this.outputDir, 'multi-form-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    // Save Markdown summary (all forms)
    const mdPath = path.join(this.outputDir, 'multi-form-report.md');
    const markdown = this.generateMultiFormMarkdownReport(result);
    fs.writeFileSync(mdPath, markdown);

    // Also save individual form reports for backward compatibility
    result.forms.forEach((formResult, index) => {
      const formJsonPath = path.join(this.outputDir, `report-form-${index + 1}.json`);
      const formMdPath = path.join(this.outputDir, `report-form-${index + 1}.md`);
      fs.writeFileSync(formJsonPath, JSON.stringify(formResult, null, 2));
      fs.writeFileSync(formMdPath, this.generateMarkdownReport(formResult));
    });

    console.log(`\n📄 Reports generated:`);
    console.log(`   Multi-form JSON: ${jsonPath}`);
    console.log(`   Multi-form Markdown: ${mdPath}`);
    console.log(`   Individual reports: ${result.forms.length} forms`);
  }

  /**
   * Generate simple markdown report
   */
  private generateMarkdownReport(result: FormTestResult): string {
    return `# Form Test Report

**Form:** ${result.form.id || 'Unnamed'}
**Pass Rate:** ${result.summary.passRate}%
**Duration:** ${(result.duration / 1000).toFixed(2)}s
**AI Cost:** $${result.aiCost.toFixed(4)}

## Summary

- ✅ Passed: ${result.summary.fieldsPassed}/${result.summary.totalFields}
- ❌ Failed: ${result.summary.fieldsFailed}/${result.summary.totalFields}
- ⚠️  Warnings: ${result.summary.fieldsWarning}/${result.summary.totalFields}
- 🔴 Critical Issues: ${result.summary.criticalIssues}
- 🟡 Warnings: ${result.summary.warnings}

## Field Results

${result.fieldResults.map((fr, i) => `
### ${i + 1}. ${fr.field.label} (${fr.field.type})

**Status:** ${fr.status === 'passed' ? '✅ Passed' : fr.status === 'failed' ? '❌ Failed' : '⚠️ Warning'}

${fr.issues.length > 0 ? `**Issues:**\n${fr.issues.map(issue => `- [${issue.severity.toUpperCase()}] ${issue.message}\n  - Recommendation: ${issue.recommendation}`).join('\n')}` : ''}
`).join('\n')}

## Recommendations

${result.fieldResults.flatMap(fr => fr.issues).filter(i => i.severity === 'critical' || i.severity === 'high').map((issue, i) => `${i + 1}. **[${issue.category}]** ${issue.recommendation}`).join('\n') || 'No critical recommendations'}

---

*Generated by fe-pilot Form Testing*
`;
  }

  /**
   * Generate multi-form markdown report
   */
  private generateMultiFormMarkdownReport(result: MultiFormTestResult): string {
    const { overallSummary } = result;

    return `# Multi-Form Test Report

**Forms Tested:** ${overallSummary.totalForms}
**Overall Pass Rate:** ${overallSummary.overallPassRate}%
**Total Duration:** ${(result.duration / 1000).toFixed(2)}s
**Total AI Cost:** $${result.totalAICost.toFixed(4)}

## Overall Summary

- 📋 Total Forms: ${overallSummary.totalForms}
- ⚠️  Forms with Issues: ${overallSummary.formsWithIssues}
- ✅ Forms Clean: ${overallSummary.totalForms - overallSummary.formsWithIssues}
- 🔢 Total Fields: ${overallSummary.totalFields}
- ✅ Fields Passed: ${overallSummary.fieldsPassed}
- 🔴 Critical Issues: ${overallSummary.totalCriticalIssues}
- 🟡 Warnings: ${overallSummary.totalWarnings}

---

${result.forms.map((formResult, index) => `
## Form ${index + 1}: ${formResult.form.id || 'Unnamed'}

**Pass Rate:** ${formResult.summary.passRate}%
**Fields:** ${formResult.summary.totalFields} (${formResult.summary.fieldsPassed} passed, ${formResult.summary.fieldsFailed} failed)
**Critical Issues:** ${formResult.summary.criticalIssues}
**Warnings:** ${formResult.summary.warnings}

### Field Results

${formResult.fieldResults.map((fr, i) => `
**${i + 1}. ${fr.field.label}** (${fr.field.type})
Status: ${fr.status === 'passed' ? '✅ Passed' : fr.status === 'failed' ? '❌ Failed' : '⚠️ Warning'}
${fr.issues.length > 0 ? `\nIssues:\n${fr.issues.map(issue => `- [${issue.severity.toUpperCase()}] ${issue.message}`).join('\n')}` : ''}
`).join('\n')}

---
`).join('\n')}

## All Critical Issues

${result.forms.flatMap(f => f.fieldResults.flatMap(fr => fr.issues.filter(i => i.severity === 'critical' || i.severity === 'high'))).length > 0 ?
  result.forms.flatMap((f, fi) => f.fieldResults.flatMap(fr => fr.issues.filter(i => i.severity === 'critical' || i.severity === 'high').map(issue => ({formIndex: fi, formId: f.form.id, field: fr.field.label, issue})))).map((item, i) => `${i + 1}. **Form ${item.formIndex + 1} (${item.formId})** - ${item.field}: ${item.issue.message}\n   - Recommendation: ${item.issue.recommendation}`).join('\n')
  : 'No critical issues found! 🎉'}

---

*Generated by fe-pilot Form Testing (Multi-Form Mode)*
`;
  }
}
