import * as fs from 'fs';
import * as path from 'path';
import { AIObservation, AIAction, ExplorationSession } from '../types/ai';
import { Observation } from '../types';

/**
 * Handles communication between fe-pilot and AI (Claude Code)
 * Uses file-based protocol for simplicity and reliability
 */
export class AICommunicator {
  private sessionDir: string;
  private observationFile: string;
  private actionFile: string;
  private statusFile: string;
  private bugReportFile: string;

  constructor(private session: ExplorationSession, private debug: boolean = false) {
    this.sessionDir = session.sessionDir;
    this.observationFile = path.join(this.sessionDir, 'observation.json');
    this.actionFile = path.join(this.sessionDir, 'action.json');
    this.statusFile = path.join(this.sessionDir, 'status.txt');
    this.bugReportFile = path.join(this.sessionDir, 'bug-report.json');

    // Ensure session directory exists
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    if (this.debug) {
      console.log(`\n🔍 DEBUG MODE ENABLED`);
      console.log(`📁 Session directory: ${this.sessionDir}`);
      console.log(`📄 Observation file: ${this.observationFile}`);
      console.log(`📝 Action file: ${this.actionFile}\n`);
    }
  }

  /**
   * Convert Observation to AIObservation format
   */
  prepareObservation(
    observation: Observation,
    previousActions: any[],
  ): AIObservation {
    return {
      stepNumber: observation.stepNumber,
      timestamp: observation.timestamp,
      goal: this.session.goal.objective,
      currentUrl: observation.domState.url,
      screenshot: observation.screenshot || '',
      domState: {
        title: observation.domState.title,
        buttons: observation.domState.buttons,
        inputs: observation.domState.inputs,
        links: observation.domState.links,
        visibleText: observation.domState.visibleText,
        interactiveElementsSummary: observation.domState.interactiveElementsSummary,
      },
      consoleLogs: observation.newConsoleLogs.map((log) => ({
        type: log.type,
        text: log.text,
        timestamp: log.timestamp,
        location: log.location,
      })),
      networkRequests: observation.newNetworkRequests.map((req) => ({
        url: req.url,
        method: req.method,
        status: req.status,
        duration: req.duration,
      })),
      newErrors: {
        consoleErrors: observation.newConsoleLogs.filter((l) => l.type === 'error')
          .length,
        networkErrors: observation.newNetworkRequests.filter((r) => r.status >= 400)
          .length,
      },
      performance: observation.performance,
      previousActions: previousActions.map((a) => ({
        action: a.action,
        selector: a.selector,
        value: a.value,
        url: a.url,
        description: a.description,
      })),
    };
  }

  /**
   * Send observation to AI and wait for response
   */
  async sendObservation(observation: AIObservation): Promise<AIAction> {
    console.log(`\n🤖 AI Checkpoint (Step ${observation.stepNumber})`);
    console.log(`📍 Current URL: ${observation.currentUrl}`);
    console.log(`📊 New Errors: ${observation.newErrors.consoleErrors} console, ${observation.newErrors.networkErrors} network`);

    // Write observation to file
    fs.writeFileSync(this.observationFile, JSON.stringify(observation, null, 2));

    // Write status
    this.setStatus('WAITING_FOR_AI');

    console.log(`\n⏳ Waiting for AI analysis...`);
    console.log(`📄 Observation saved: ${this.observationFile}`);
    console.log(`📸 Screenshot: ${observation.screenshot}`);
    console.log(
      `\n💡 For AI to continue, create: ${this.actionFile}`,
    );

    // Wait for AI response
    const action = await this.waitForAction();

    console.log(`\n✅ AI Decision: ${action.decision}`);
    console.log(`💭 Reasoning: ${action.reasoning}`);

    if (action.concerns && action.concerns.length > 0) {
      console.log(`\n⚠️  Concerns:`);
      action.concerns.forEach((concern) => console.log(`   - ${concern}`));
    }

    return action;
  }

  /**
   * Wait for AI to create action.json file
   */
  private async waitForAction(timeout: number = 300000): Promise<AIAction> {
    const startTime = Date.now();
    const pollInterval = 1000; // Check every second
    let pollCount = 0;

    if (this.debug) {
      console.log(`\n⏳ DEBUG: Waiting for action.json (timeout: ${timeout / 1000}s)...`);
      console.log(`📍 Polling ${this.actionFile} every ${pollInterval}ms`);
    }

    while (Date.now() - startTime < timeout) {
      pollCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (this.debug && pollCount % 10 === 0) {
        // Log every 10 seconds
        console.log(`⏳ Still waiting... (${elapsed}s elapsed, ${pollCount} polls)`);
      }

      if (fs.existsSync(this.actionFile)) {
        const content = fs.readFileSync(this.actionFile, 'utf8');
        const action: AIAction = JSON.parse(content);

        // Delete action file after reading
        fs.unlinkSync(this.actionFile);

        this.setStatus('RUNNING');

        if (this.debug) {
          console.log(`\n✅ DEBUG: Action received after ${elapsed}s (${pollCount} polls)`);
          console.log(`📋 Action type: ${action.decision}`);
          console.log(`📝 Actions to execute: ${action.actions?.length || 0}\n`);
        }

        return action;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(
      `AI response timeout after ${timeout / 1000}s. No action.json created.\n` +
      `Expected file: ${this.actionFile}\n` +
      `Waited ${pollCount} times (${pollInterval}ms intervals)`
    );
  }

  /**
   * Set current status
   */
  setStatus(status: string): void {
    fs.writeFileSync(this.statusFile, status);
  }

  /**
   * Report bug to AI
   */
  reportBug(bugReport: any): void {
    fs.writeFileSync(this.bugReportFile, JSON.stringify(bugReport, null, 2));
    console.log(`\n🐛 Bug reported: ${this.bugReportFile}`);
  }

  /**
   * Save session state
   */
  saveSession(): void {
    const sessionFile = path.join(this.sessionDir, 'session.json');
    fs.writeFileSync(sessionFile, JSON.stringify(this.session, null, 2));
  }

  /**
   * Get session directory
   */
  getSessionDir(): string {
    return this.sessionDir;
  }
}
