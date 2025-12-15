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

// ============================================================================
// FORM TESTING COMMANDS (NEW)
// ============================================================================

const formCommand = program
  .command('form')
  .description('Form testing and validation (AI-powered)');

// form analyze - Discover and analyze form structure
formCommand
  .command('analyze <url>')
  .description('Analyze form structure and generate schema')
  .option('--output <file>', 'Save schema to JSON file')
  .option('--credentials <user:pass>', 'Credentials for login (format: username:password)')
  .action(async (url: string, options) => {
    try {
      const { FormDiscovery } = await import('./core/form/form-discovery');
      const { EdgeCaseHandler } = await import('./core/form/edge-case-handler');
      const { chromium } = await import('playwright');

      console.log(`🔍 Analyzing forms at: ${url}\n`);

      // Parse credentials if provided
      let credentials;
      if (options.credentials) {
        const [username, password] = options.credentials.split(':');
        if (username && password) {
          credentials = { username, password };
        }
      }

      // Launch browser
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      // Handle obstacles
      const edgeHandler = new EdgeCaseHandler(page, {
        mode: 'standard',
        aiMode: 'hybrid',
        credentials,
      });
      await edgeHandler.handleObstacles();

      // Discover forms
      const discovery = new FormDiscovery(page);
      const forms = await discovery.detectForms();

      if (forms.length === 0) {
        console.log('❌ No forms found on page');
        await browser.close();
        process.exit(1);
      }

      console.log(`✓ Found ${forms.length} form(s)\n`);

      // Display analysis
      forms.forEach((form, index) => {
        console.log(`📋 Form ${index + 1}: ${form.id || 'unnamed'}`);
        console.log(`   Fields: ${form.fields.length}`);
        console.log(`   Wizard: ${form.isWizard ? 'Yes' : 'No'}`);
        console.log(`   Action: ${form.action || 'N/A'}`);
        console.log(`   Method: ${form.method || 'N/A'}\n`);

        console.log('   Fields:');
        form.fields.forEach((field, i) => {
          console.log(`   ${i + 1}. ${field.label || field.id}`);
          console.log(`      Type: ${field.type}`);
          console.log(`      Required: ${field.required ? 'Yes' : 'No'}`);
          console.log(`      Selector: ${field.selector}`);
          if (field.validationRules.length > 0) {
            console.log(`      Validation: ${field.validationRules.map(r => r.type).join(', ')}`);
          }
          console.log('');
        });
      });

      // Save to file if requested
      if (options.output) {
        const fs = await import('fs');
        fs.writeFileSync(options.output, JSON.stringify(forms, null, 2));
        console.log(`\n✓ Schema saved to ${options.output}`);
      }

      await browser.close();
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// form test - Automatically test a form
formCommand
  .command('test <url>')
  .description('Automatically test a form (AI-powered)')
  .option('--mode <type>', 'Test mode: quick|standard|full', 'standard')
  .option('--ai-mode <type>', 'AI mode: disabled|fallback|hybrid|always', 'hybrid')
  .option('--credentials <user:pass>', 'Credentials for login (format: username:password)')
  .option('--output <dir>', 'Output directory for results')
  .option('--headless', 'Run in headless mode (default: true)', true)
  .option('--headed', 'Show browser')
  .action(async (url: string, options) => {
    try {
      const { FormTester } = await import('./core/form/form-tester');

      console.log('🤖 fe-pilot Form Testing\n');

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

      // Create tester
      const tester = new FormTester({
        headless: options.headed ? false : options.headless,
        outputDir: options.output,
        aiMode: options.aiMode,
      });

      // Run test
      const result = await tester.testForm(url, {
        mode: options.mode,
        credentials,
      });

      // Display summary
      console.log('\n' + '='.repeat(80));
      console.log('\n📊 FORM TEST SUMMARY\n');
      console.log(`Form: ${result.form.id || 'Unnamed'}`);
      console.log(`✅ Pass Rate: ${result.summary.passRate}%`);
      console.log(`❌ Critical Issues: ${result.summary.criticalIssues}`);
      console.log(`⚠️  Warnings: ${result.summary.warnings}`);
      console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
      console.log(`💰 AI Cost: $${result.aiCost.toFixed(4)}`);
      console.log('\n' + '='.repeat(80));

      process.exit(result.summary.criticalIssues > 0 ? 1 : 0);
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
