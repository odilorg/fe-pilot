import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { Scenario, TestReport, StepResult, Observation, ErrorSummary, AssertionResult } from '../types';
import { Observer } from './observer';
import { ActionExecutor } from './executor';

export interface PilotOptions {
  headless?: boolean;
  outputDir?: string;
  aiCheckpoints?: boolean;
  onCheckpoint?: (observation: Observation) => Promise<void>;
}

export class Pilot {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private observer: Observer | null = null;
  private executor: ActionExecutor | null = null;
  private outputDir: string;
  private screenshotDir: string;

  constructor(private options: PilotOptions = {}) {
    this.outputDir = options.outputDir || path.join(process.cwd(), 'fe-pilot-results');
    this.screenshotDir = path.join(this.outputDir, 'screenshots');
    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    if (!fs.existsSync(this.screenshotDir)) fs.mkdirSync(this.screenshotDir, { recursive: true });
  }

  async execute(scenario: Scenario): Promise<TestReport> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let overallStatus: 'passed' | 'failed' | 'warning' = 'passed';
    const config = scenario.config || {};
    let skipped = 0, assertionsPassed = 0, assertionsFailed = 0, retriedSteps = 0;

    try {
      await this.launch(scenario);
      console.log(`\n🚀 Starting scenario: ${scenario.name}`);
      if (scenario.description) console.log(`📝 ${scenario.description}`);
      console.log(`📍 Base URL: ${scenario.url}\n`);

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        const stepNumber = i + 1;
        console.log(`\n📍 Step ${stepNumber}: ${step.action} ${step.description || ''}`);
        const stepStart = Date.now();
        let status: 'success' | 'failed' | 'warning' | 'skipped' = 'success';
        let error: string | undefined;
        let retryCount = 0;
        const stepAssertions: AssertionResult[] = [];
        const maxRetries = config.retryFailedSteps || 0;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          if (attempt > 0) { console.log(`   🔄 Retry ${attempt}/${maxRetries}`); retryCount++; retriedSteps++; }
          try {
            await this.executor!.execute(step);
            const obs = await this.observer!.captureObservation(stepNumber, step);

            if (step.action === 'assert' && step.assert_type) {
              const res = await this.executor!.runAssertion(step.assert_type, step);
              stepAssertions.push(res);
              if (res.passed) { assertionsPassed++; console.log(`   ✅ Assertion: ${res.message}`); }
              else { assertionsFailed++; status = 'failed'; error = res.message; overallStatus = 'failed'; console.log(`   ❌ Assertion: ${res.message}`); }
            }

            if (step.expect?.length) {
              const v = await this.executor!.verifyExpectations(step.expect);
              if (!v.passed) { status = 'failed'; error = v.failures.join('; '); overallStatus = 'failed'; console.log(`   ❌ ${error}`); }
            }

            if (config.detectValidationErrors && obs.formValidation && !obs.formValidation.isValid) {
              const ve = obs.formValidation.validationErrors;
              if (ve.length) {
                console.log(`   ⚠️  Form validation errors:`);
                ve.forEach(e => console.log(`      - ${e.field}: ${e.message}`));
                if (status === 'success') { status = 'warning'; if (overallStatus === 'passed') overallStatus = 'warning'; }
              }
            }

            if (step.observe && this.observer!.hasNewErrors()) {
              const ce = this.observer!.getNewConsoleErrors();
              const ne = this.observer!.getNewNetworkErrors();
              if (ce.length) console.log(`   ⚠️  Console errors: ${ce.length}`);
              if (ne.length) console.log(`   ⚠️  Network errors: ${ne.length}`);
              if (status === 'success') { status = 'warning'; if (overallStatus === 'passed') overallStatus = 'warning'; }
            }

            if (this.options.aiCheckpoints && this.options.onCheckpoint) await this.options.onCheckpoint(obs);

            steps.push({ step: stepNumber, action: step, status, observations: obs, duration: Date.now() - stepStart, error, retryCount, assertions: stepAssertions.length ? stepAssertions : undefined, formValidation: obs.formValidation });
            if (status === 'success') console.log(`✅ Step completed`);
            else if (status === 'warning') console.log(`⚠️  Step completed with warnings`);
            break;
          } catch (e) {
            if (attempt < maxRetries) { console.log(`   ⚠️  Failed, retrying...`); await this.page?.waitForTimeout(1000); continue; }
            status = 'failed'; overallStatus = 'failed'; error = (e as Error).message;
            console.log(`❌ Step failed: ${error.substring(0, 200)}`);
            if (config.screenshotOnError) try { await this.observer!.captureObservation(stepNumber, { ...step, action: 'screenshot' }); } catch {}
            try {
              const obs = await this.observer!.captureObservation(stepNumber, step);
              steps.push({ step: stepNumber, action: step, status, observations: obs, duration: Date.now() - stepStart, error, retryCount });
            } catch {
              steps.push({ step: stepNumber, action: step, status, observations: {} as any, duration: Date.now() - stepStart, error, retryCount });
            }
            if (config.stopOnFirstFailure) {
              for (let j = i + 1; j < scenario.steps.length; j++) {
                skipped++;
                steps.push({ step: j + 1, action: scenario.steps[j], status: 'skipped', observations: {} as any, duration: 0 });
              }
            }
          }
        }
        if (status === 'failed' && config.stopOnFirstFailure) break;
      }
      console.log(`\n${'='.repeat(80)}\n✨ Scenario completed: ${scenario.name}\n📊 Status: ${overallStatus.toUpperCase()}`);
    } finally {
      await this.cleanup();
    }

    const report = this.generateReport(scenario, steps, overallStatus, startTime, Date.now(), { skipped, assertionsPassed, assertionsFailed, retriedSteps });
    this.saveReport(report);
    this.printSummary(report);
    return report;
  }

  private async launch(scenario: Scenario): Promise<void> {
    const cfg = scenario.config || {};
    this.browser = await chromium.launch({ headless: this.options.headless !== false && cfg.headless !== false });
    this.context = await this.browser.newContext({ viewport: cfg.viewport || { width: 1280, height: 720 } });
    this.page = await this.context.newPage();
    this.observer = new Observer(this.page, this.screenshotDir);
    this.executor = new ActionExecutor(this.page);
  }

  private async cleanup(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  private generateReport(scenario: Scenario, steps: StepResult[], status: 'passed' | 'failed' | 'warning', startTime: number, endTime: number, extras: any): TestReport {
    const passed = steps.filter(s => s.status === 'success').length;
    const failed = steps.filter(s => s.status === 'failed').length;
    const warnings = steps.filter(s => s.status === 'warning').length;
    const skipped = steps.filter(s => s.status === 'skipped').length;
    const consoleErrors = steps.reduce((s, st) => s + (st.observations?.newConsoleLogs?.filter(l => l.type === 'error').length || 0), 0);
    const networkErrors = steps.reduce((s, st) => s + (st.observations?.newNetworkRequests?.filter(r => r.status >= 400).length || 0), 0);
    const validationErrors = steps.reduce((s, st) => s + (st.formValidation?.validationErrors?.length || 0), 0);
    const screenshots = steps.map(s => s.observations?.screenshot).filter((s): s is string => !!s);
    const errorSummary = this.observer?.getErrorSummary();
    return {
      scenario: scenario.name, status, duration: endTime - startTime, startTime, endTime, steps,
      summary: { totalSteps: steps.length, passed, failed, warnings, skipped, bugsFound: 0, bugsFixed: 0, screenshots, consoleErrors, networkErrors, validationErrors, assertionsPassed: extras.assertionsPassed, assertionsFailed: extras.assertionsFailed, retriedSteps: extras.retriedSteps },
      errorSummary,
    };
  }

  private saveReport(report: TestReport): void {
    const filename = `report-${Date.now()}.json`;
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved: ${filepath}`);
  }

  private printSummary(report: TestReport): void {
    console.log(`\n${'='.repeat(80)}\n📊 SUMMARY\n`);
    console.log(`Total Steps: ${report.summary.totalSteps}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    if (report.summary.skipped) console.log(`⏭️  Skipped: ${report.summary.skipped}`);
    if (report.summary.assertionsPassed || report.summary.assertionsFailed) {
      console.log(`\n📋 Assertions: ✅ ${report.summary.assertionsPassed} ❌ ${report.summary.assertionsFailed}`);
    }
    if (report.summary.retriedSteps) console.log(`🔄 Retried: ${report.summary.retriedSteps}`);
    console.log(`Console Errors: ${report.summary.consoleErrors}`);
    console.log(`Network Errors: ${report.summary.networkErrors}`);
    if (report.summary.validationErrors) console.log(`📝 Validation Errors: ${report.summary.validationErrors}`);
    console.log(`Screenshots: ${report.summary.screenshots.length}`);
    console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s\n${'='.repeat(80)}\n`);
  }
}
