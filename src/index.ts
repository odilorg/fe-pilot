#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { Pilot } from './core/pilot';
import { Explorer } from './core/explorer';
import { ScenarioParser } from './utils/scenario-parser';
import { Scenario } from './types';
import { ExplorationGoal } from './types/ai';

const program = new Command();

program
  .name('fe-pilot')
  .description('AI-driven frontend testing and debugging tool')
  .version('1.0.0');

// Run command - execute a scenario
program
  .command('run <scenario>')
  .description('Run a test scenario from a YAML file')
  .option('--headless', 'Run in headless mode (default: true)', true)
  .option('--headed', 'Run in headed mode (show browser)')
  .option('-o, --output <dir>', 'Output directory for results')
  .option('--ai-checkpoints', 'Enable AI checkpoints for analysis')
  .option('--credentials <user:pass>', 'Override credentials (format: username:password)')
  .action(async (scenarioPath: string, options) => {
    try {
      console.log('🤖 fe-pilot - AI-driven frontend testing\n');
      console.log(`📂 Loading scenario: ${scenarioPath}\n`);

      // Load scenario
      let scenario = ScenarioParser.loadFromFile(scenarioPath);

      // Override credentials if provided
      if (options.credentials) {
        const [username, password] = options.credentials.split(':');
        if (!username || !password) {
          console.error('❌ Invalid credentials format. Use: username:password');
          process.exit(1);
        }
        scenario.credentials = { username, password };
      }

      // Substitute variables
      scenario = ScenarioParser.substituteVariables(scenario);

      // Validate scenario
      const validation = ScenarioParser.validate(scenario);
      if (!validation.valid) {
        console.error('❌ Scenario validation failed:');
        validation.errors.forEach((error) => console.error(`  - ${error}`));
        process.exit(1);
      }

      // Create pilot
      const pilot = new Pilot({
        headless: options.headed ? false : options.headless,
        outputDir: options.output,
        aiCheckpoints: options.aiCheckpoints,
        onCheckpoint: options.aiCheckpoints
          ? async (observation) => {
              // For Phase 1, just log that checkpoint was reached
              // Phase 2+ will integrate with Claude Code
              console.log(`\n🤖 AI Checkpoint reached (Step ${observation.stepNumber})`);
              if (observation.newConsoleLogs.length > 0) {
                console.log(`   New console logs: ${observation.newConsoleLogs.length}`);
              }
              if (observation.newNetworkRequests.length > 0) {
                console.log(`   New network requests: ${observation.newNetworkRequests.length}`);
              }
            }
          : undefined,
      });

      // Execute scenario
      const report = await pilot.execute(scenario);

      // Print summary
      console.log('\n' + '='.repeat(80));
      console.log('\n📊 SUMMARY\n');
      console.log(`Total Steps: ${report.summary.totalSteps}`);
      console.log(`✅ Passed: ${report.summary.passed}`);
      console.log(`❌ Failed: ${report.summary.failed}`);
      console.log(`⚠️  Warnings: ${report.summary.warnings}`);
      console.log(`Console Errors: ${report.summary.consoleErrors}`);
      console.log(`Network Errors: ${report.summary.networkErrors}`);
      console.log(`Screenshots: ${report.summary.screenshots.length}`);
      console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
      console.log('\n' + '='.repeat(80));

      // Exit with appropriate code
      process.exit(report.status === 'failed' ? 1 : 0);
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Test command - quick test without full scenario
program
  .command('test <url>')
  .description('Quick test a URL (navigate and capture state)')
  .option('--credentials <user:pass>', 'Credentials (format: username:password)')
  .option('--headless', 'Run in headless mode (default: true)', true)
  .option('--headed', 'Run in headed mode (show browser)')
  .option('-o, --output <dir>', 'Output directory for results')
  .action(async (url: string, options) => {
    try {
      console.log(`🤖 Quick testing: ${url}\n`);

      // Create a simple scenario
      const scenario: Scenario = {
        name: 'Quick Test',
        url,
        steps: [
          {
            action: 'navigate',
            url,
            observe: true,
          },
          {
            action: 'screenshot',
            description: 'Initial page state',
          },
          {
            action: 'wait',
            duration: 2000,
          },
        ],
      };

      if (options.credentials) {
        const [username, password] = options.credentials.split(':');
        if (username && password) {
          scenario.credentials = { username, password };
        }
      }

      const pilot = new Pilot({
        headless: options.headed ? false : options.headless,
        outputDir: options.output,
      });

      const report = await pilot.execute(scenario);

      console.log(`\n✅ Test completed: ${report.status}`);
      process.exit(report.status === 'failed' ? 1 : 0);
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Explore command - autonomous AI-driven exploration
program
  .command('explore <url>')
  .description('Autonomous AI-driven exploration (requires AI interaction)')
  .requiredOption('--goal <objective>', 'What to achieve (e.g., "test login functionality")')
  .option('--credentials <user:pass>', 'Credentials (format: username:password)')
  .option('--auto-fix', 'Enable automatic bug fixing')
  .option('--max-steps <number>', 'Maximum steps before stopping', '50')
  .option('--checkpoint-interval <number>', 'Steps between AI checkpoints', '5')
  .option('--headless', 'Run in headless mode (default: true)', true)
  .option('--headed', 'Run in headed mode (show browser)')
  .option('--debug', 'Enable debug logging (shows observation paths, wait times, step details)')
  .option('-o, --output <dir>', 'Output directory for session')
  .action(async (url: string, options) => {
    try {
      // Parse credentials
      let credentials;
      if (options.credentials) {
        const [username, password] = options.credentials.split(':');
        if (!username || !password) {
          console.error('❌ Invalid credentials format. Use: username:password');
          process.exit(1);
        }
        credentials = { username, password };
      }

      // Create exploration goal
      const goal: ExplorationGoal = {
        objective: options.goal,
        credentials,
        maxSteps: parseInt(options.maxSteps),
        autoFix: options.autoFix || false,
        checkpointInterval: parseInt(options.checkpointInterval),
      };

      // Create explorer
      const explorer = new Explorer({
        headless: options.headed ? false : options.headless,
        outputDir: options.output,
        debug: options.debug || false,
      });

      // Start exploration
      const session = await explorer.explore(url, goal);

      // Exit with appropriate code
      process.exit(session.status === 'completed' ? 0 : 1);
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
