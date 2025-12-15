import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { ExplorationGoal, ExplorationSession, AIAction } from '../types/ai';
import { Observer } from './observer';
import { ActionExecutor } from './executor';
import { AICommunicator } from './ai-communicator';
import { Action } from '../types';

export interface ExplorerOptions {
  headless?: boolean;
  outputDir?: string;
  debug?: boolean;
}

/**
 * Autonomous Explorer - AI-driven frontend testing
 */
export class Explorer {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private observer: Observer | null = null;
  private executor: ActionExecutor | null = null;
  private communicator: AICommunicator | null = null;
  private session: ExplorationSession | null = null;

  constructor(private options: ExplorerOptions = {}) {}

  /**
   * Start autonomous exploration
   */
  async explore(url: string, goal: ExplorationGoal): Promise<ExplorationSession> {
    console.log(`\n🤖 fe-pilot - Autonomous Exploration Mode\n`);
    console.log(`🎯 Goal: ${goal.objective}`);
    console.log(`📍 Starting URL: ${url}`);
    console.log(`🔧 Auto-fix: ${goal.autoFix ? 'Enabled' : 'Disabled'}`);
    console.log(`📊 Max steps: ${goal.maxSteps || 50}\n`);

    // Initialize session
    this.session = this.createSession(url, goal);
    this.communicator = new AICommunicator(this.session, this.options.debug || false);

    // Launch browser
    await this.launch();

    const previousActions: Action[] = [];

    try {
      // Initial navigation
      console.log(`📍 Step 1: Navigate to ${url}\n`);
      await this.executor!.execute({ action: 'navigate', url });

      // Capture initial observation
      const initialObservation = await this.observer!.captureObservation(1, {
        action: 'navigate',
        url,
        description: 'Initial navigation',
      });

      previousActions.push({ action: 'navigate', url });

      // Prepare for AI
      const aiObservation = this.communicator!.prepareObservation(
        initialObservation,
        previousActions,
      );
      this.session!.observations.push(aiObservation);

      // Send to AI and wait for first action
      const firstAction = await this.communicator!.sendObservation(aiObservation);
      this.session!.actions.push(firstAction);

      // Main exploration loop
      let currentStep = 2;
      let currentAction = firstAction;

      while (currentStep <= (goal.maxSteps || 50)) {
        // Check if goal achieved or should abort
        if (currentAction.decision === 'goal_achieved') {
          console.log(`\n🎉 Goal achieved!`);
          this.session!.status = 'completed';
          break;
        }

        if (currentAction.decision === 'abort' || currentAction.decision === 'stuck') {
          console.log(`\n⚠️  Exploration aborted: ${currentAction.reasoning}`);
          this.session!.status = 'failed';
          break;
        }

        // Execute AI's action(s) - supports both single and batched
        const actionsToExecute = currentAction.actions || (currentAction.action ? [currentAction.action] : []);

        if (actionsToExecute.length > 0) {
          const stopOnError = currentAction.stopOnError !== false; // Default true

          if (actionsToExecute.length > 1) {
            console.log(`\n📦 Batch: Executing ${actionsToExecute.length} actions${stopOnError ? ' (stop on error)' : ''}...`);
          }

          // Execute batch of actions
          for (let i = 0; i < actionsToExecute.length; i++) {
            const action = actionsToExecute[i];
            console.log(
              `\n📍 Step ${currentStep}: ${action.action} ${action.description || ''}`,
            );

            try {
              await this.executor!.execute(action as Action);
              previousActions.push(action as Action);
              currentStep++;
            } catch (error) {
              console.log(`❌ Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

              if (stopOnError) {
                console.log(`🛑 Stopping batch due to error`);
                break;
              } else {
                console.log(`⏭️  Continuing with next action despite error`);
              }
            }
          }

          // Capture observation after batch completes
          const lastAction = actionsToExecute[actionsToExecute.length - 1];
          const observation = await this.observer!.captureObservation(
            currentStep,
            lastAction as Action,
          );

          // Check for errors
          if (observation.newConsoleLogs.some((l) => l.type === 'error')) {
            console.log(
              `⚠️  Console errors detected: ${observation.newConsoleLogs.filter((l) => l.type === 'error').length}`,
            );
          }

          if (observation.newNetworkRequests.some((r) => r.status >= 400)) {
            console.log(
              `⚠️  Network errors detected: ${observation.newNetworkRequests.filter((r) => r.status >= 400).length}`,
            );
          }

          // Prepare for AI
          const aiObs = this.communicator!.prepareObservation(
            observation,
            previousActions,
          );
          this.session!.observations.push(aiObs);

          // ALWAYS get next action from AI (checkpoint just adds more detail)
          currentAction = await this.communicator!.sendObservation(aiObs);
          this.session!.actions.push(currentAction);

          // Handle bug fixes
          if (currentAction.bugReport && goal.autoFix) {
            console.log(`\n🔧 Bug detected - initiating auto-fix...`);
            this.communicator!.reportBug(currentAction.bugReport);
            this.session!.bugsFound++;
            // AI will fix the bug and write next action
          }
        } else {
          console.log(`\n⚠️  No action provided by AI, requesting next action...`);

          // Request next action from AI
          const lastObs = this.session!.observations[this.session!.observations.length - 1];
          currentAction = await this.communicator!.sendObservation(lastObs);
          this.session!.actions.push(currentAction);
        }

        // Save session state periodically
        this.communicator!.saveSession();
      }

      if (currentStep > (goal.maxSteps || 50)) {
        console.log(`\n⚠️  Max steps reached (${goal.maxSteps || 50})`);
        this.session!.status = 'failed';
      }
    } catch (error) {
      console.error(`\n❌ Exploration failed:`, error);
      this.session!.status = 'failed';
    } finally {
      await this.cleanup();
    }

    // Final session save
    this.communicator!.saveSession();
    this.session!.currentStep = this.session!.observations.length;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n✨ Exploration completed`);
    console.log(`📊 Status: ${this.session!.status}`);
    console.log(`📈 Steps: ${this.session!.currentStep}`);
    console.log(`🐛 Bugs found: ${this.session!.bugsFound}`);
    console.log(`🔧 Bugs fixed: ${this.session!.bugsFixed}`);
    console.log(`📁 Session: ${this.communicator!.getSessionDir()}`);
    console.log(`\n${'='.repeat(80)}\n`);

    return this.session!;
  }

  /**
   * Create exploration session
   */
  private createSession(url: string, goal: ExplorationGoal): ExplorationSession {
    const sessionId = `exploration-${Date.now()}`;
    const outputDir = this.options.outputDir || path.join(process.cwd(), 'fe-pilot-sessions');
    const sessionDir = path.join(outputDir, sessionId);

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    return {
      sessionId,
      sessionDir,
      goal,
      currentStep: 0,
      status: 'running',
      startTime: Date.now(),
      observations: [],
      actions: [],
      bugsFound: 0,
      bugsFixed: 0,
    };
  }

  /**
   * Launch browser
   */
  private async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.options.headless !== false,
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    this.page = await this.context.newPage();

    const screenshotDir = path.join(this.session!.sessionDir, 'screenshots');
    this.observer = new Observer(this.page, screenshotDir);
    this.executor = new ActionExecutor(this.page);
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
    }
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}
