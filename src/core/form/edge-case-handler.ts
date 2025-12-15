/**
 * Edge Case Handler - AI-in-the-Loop
 * Handles unpredictable obstacles using hybrid approach:
 * 1. Rules-based (fast, cheap) for common cases
 * 2. AI-powered (intelligent, adaptive) for unknown cases
 *
 * Research-backed edge cases:
 * - Login popups (with/without credentials) ← USER REQUEST
 * - Cookie consent banners
 * - Age verification
 * - Newsletter popups
 * - CAPTCHA detection
 * - Session timeouts
 * - A/B testing variations
 */

import { Page } from 'playwright';
import { Obstacle, AIDecision, AIActionStep, FormTestConfig } from './types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class EdgeCaseHandler {
  private aiCallsCount: number = 0;
  private totalAICost: number = 0;

  constructor(
    private page: Page,
    private config: FormTestConfig
  ) {}

  /**
   * Main entry: Detect and handle obstacles
   * Returns true if handled successfully, false if blocker
   */
  async handleObstacles(): Promise<boolean> {
    let attemptCount = 0;
    const maxAttempts = 5; // Prevent infinite loops

    while (attemptCount < maxAttempts) {
      const obstacle = await this.detectObstacle();

      if (!obstacle) {
        // No obstacles, clear to proceed
        return true;
      }

      console.log(`⚠️  Obstacle detected: ${obstacle.description}`);

      // Try to handle the obstacle
      const handled = await this.handleObstacle(obstacle);

      if (!handled) {
        console.log(`❌ Could not handle obstacle: ${obstacle.type}`);
        return false; // Blocker - cannot proceed
      }

      console.log(`✓ Obstacle cleared: ${obstacle.type}`);

      // Wait a bit for page to settle
      await this.page.waitForTimeout(500);

      attemptCount++;
    }

    console.log(`⚠️  Too many obstacles (${maxAttempts}), aborting`);
    return false;
  }

  /**
   * Detect obstacles on the page
   */
  private async detectObstacle(): Promise<Obstacle | null> {
    // Check for common obstacles (rules-based, fast)
    const commonObstacle = await this.detectCommonObstacles();
    if (commonObstacle) return commonObstacle;

    // If AI mode allows, use AI vision for unknown obstacles
    if (this.config.aiMode === 'always' || this.config.aiMode === 'hybrid') {
      return await this.detectWithAI();
    }

    return null;
  }

  /**
   * Detect common obstacles using rules (fast, no AI cost)
   */
  private async detectCommonObstacles(): Promise<Obstacle | null> {
    return await this.page.evaluate(() => {
      // 1. Cookie Consent
      const cookieElements = document.querySelectorAll(
        '[class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]'
      );
      for (const el of Array.from(cookieElements)) {
        if (el.clientHeight > 0 && el.clientWidth > 0) {
          const id = el.id;
          const className = el.className;
          const selector = id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : 'div');
          return {
            type: 'cookie-consent',
            description: 'Cookie consent banner',
            element: selector,
            timestamp: Date.now(),
          };
        }
      }

      // 2. Login/Auth Modal
      const loginElements = document.querySelectorAll(
        '[class*="login" i], [class*="auth" i], [class*="signin" i], [aria-label*="login" i]'
      );
      for (const el of Array.from(loginElements)) {
        const parent = el.closest('[class*="modal" i], [role="dialog"]');
        if (parent && (parent as HTMLElement).style.display !== 'none') {
          const id = parent.id;
          const className = parent.className;
          const selector = id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : '[role="dialog"]');
          return {
            type: 'login',
            description: 'Login/auth modal',
            element: selector,
            timestamp: Date.now(),
          };
        }
      }

      // 3. Generic Modal/Popup
      const modals = document.querySelectorAll(
        '[class*="modal" i], [role="dialog"], [class*="popup" i], [class*="overlay" i]'
      );
      for (const modal of Array.from(modals)) {
        const el = modal as HTMLElement;
        if (el.style.display !== 'none' && el.clientHeight > 100 && el.clientWidth > 100) {
          const id = el.id;
          const className = el.className;
          const selector = id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : '[role="dialog"]');
          return {
            type: 'modal',
            description: 'Generic modal/popup',
            element: selector,
            timestamp: Date.now(),
          };
        }
      }

      // 4. Newsletter Popup
      const newsletter = document.querySelector('[class*="newsletter" i], [class*="subscribe" i]');
      if (newsletter && (newsletter as HTMLElement).clientHeight > 0) {
        const id = newsletter.id;
        const className = newsletter.className;
        const selector = id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : 'div');
        return {
          type: 'popup',
          description: 'Newsletter subscription popup',
          element: selector,
          timestamp: Date.now(),
        };
      }

      // 5. CAPTCHA
      const captcha = document.querySelector('.g-recaptcha, iframe[src*="recaptcha"], .h-captcha');
      if (captcha) {
        const id = captcha.id;
        const className = captcha.className;
        const selector = id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : '.g-recaptcha');
        return {
          type: 'captcha',
          description: 'CAPTCHA detected',
          element: selector,
          timestamp: Date.now(),
        };
      }

      return null;
    });
  }

  /**
   * Handle an obstacle (hybrid: rules + AI)
   */
  private async handleObstacle(obstacle: Obstacle): Promise<boolean> {
    // Try rules-based handling first (unless AI-always mode)
    if (this.config.aiMode !== 'always') {
      const handled = await this.handleWithRules(obstacle);
      if (handled) {
        console.log(`   ✓ Handled with rules: ${obstacle.type}`);
        return true;
      }
    }

    // Fallback to AI (if enabled)
    if (this.config.aiMode !== 'disabled') {
      console.log(`   🤖 Attempting AI resolution...`);
      return await this.handleWithAI(obstacle);
    }

    return false;
  }

  /**
   * Handle obstacle using predefined rules
   */
  private async handleWithRules(obstacle: Obstacle): Promise<boolean> {
    switch (obstacle.type) {
      case 'cookie-consent':
        return await this.handleCookieConsent(obstacle);

      case 'login':
        return await this.handleLoginModal(obstacle);

      case 'modal':
      case 'popup':
        return await this.handleGenericModal(obstacle);

      case 'captcha':
        console.log(`⚠️  CAPTCHA detected. Cannot proceed automatically.`);
        console.log(`   💡 Recommendation: Disable CAPTCHA in test environment`);
        return false; // Cannot handle CAPTCHA automatically

      default:
        return false;
    }
  }

  /**
   * Handle cookie consent banner
   */
  private async handleCookieConsent(obstacle: Obstacle): Promise<boolean> {
    // Look for "Accept" or "OK" button
    const acceptButton = await this.page.$(
      'button:has-text("Accept"), button:has-text("OK"), button:has-text("I agree"), ' +
      'button:has-text("Agree"), [class*="accept" i]'
    );

    if (acceptButton) {
      await acceptButton.click();
      await this.page.waitForTimeout(500);
      return true;
    }

    // Try close button
    const closeButton = await this.page.$(obstacle.element + ' .close, ' + obstacle.element + ' [aria-label="Close"]');
    if (closeButton) {
      await closeButton.click();
      await this.page.waitForTimeout(500);
      return true;
    }

    return false;
  }

  /**
   * Handle login modal intelligently based on credentials
   * USER REQUEST: Support login with credentials
   */
  private async handleLoginModal(obstacle: Obstacle): Promise<boolean> {
    const hasCredentials = this.config.credentials &&
      this.config.credentials.username &&
      this.config.credentials.password;

    if (hasCredentials) {
      console.log(`   🔑 Credentials provided, attempting login...`);
      return await this.fillLoginForm(obstacle);
    } else {
      console.log(`   👤 No credentials, looking for skip/guest option...`);
      return await this.skipLogin(obstacle);
    }
  }

  /**
   * Fill login form with provided credentials
   */
  private async fillLoginForm(obstacle: Obstacle): Promise<boolean> {
    try {
      // Find email/username field
      const emailField = await this.page.$(
        'input[type="email"], input[type="text"][name*="email"], input[name*="username"], input[placeholder*="email" i]'
      );
      if (emailField && this.config.credentials) {
        await emailField.fill(this.config.credentials.username);
      }

      // Find password field
      const passwordField = await this.page.$('input[type="password"]');
      if (passwordField && this.config.credentials) {
        await passwordField.fill(this.config.credentials.password);
      }

      // Find and click login/submit button
      const submitButton = await this.page.$(
        'button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), input[type="submit"]'
      );
      if (submitButton) {
        await submitButton.click();
        await this.page.waitForTimeout(2000); // Wait for login to complete
        return true;
      }

      return false;
    } catch (error) {
      console.log(`   ❌ Login failed: ${error}`);
      return false;
    }
  }

  /**
   * Try to skip login (guest mode, close button, etc.)
   */
  private async skipLogin(obstacle: Obstacle): Promise<boolean> {
    // Look for "Skip", "Guest", "Continue without account" buttons
    const skipButton = await this.page.$(
      'button:has-text("Skip"), button:has-text("Guest"), button:has-text("Continue as guest"), ' +
      'button:has-text("No thanks"), a:has-text("Skip")'
    );

    if (skipButton) {
      await skipButton.click();
      await this.page.waitForTimeout(500);
      return true;
    }

    // Try close button
    const closeButton = await this.page.$(
      obstacle.element + ' .close, ' +
      obstacle.element + ' button[aria-label="Close"], ' +
      obstacle.element + ' .modal-close, ' +
      obstacle.element + ' [data-dismiss="modal"]'
    );

    if (closeButton) {
      await closeButton.click();
      await this.page.waitForTimeout(500);
      return true;
    }

    // Try pressing Escape key
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);

    // Check if modal is still visible
    const stillVisible = await this.page.isVisible(obstacle.element);
    return !stillVisible;
  }

  /**
   * Handle generic modal/popup
   */
  private async handleGenericModal(obstacle: Obstacle): Promise<boolean> {
    // Try common close button patterns
    const closeSelectors = [
      '.close',
      '.modal-close',
      'button[aria-label="Close"]',
      '[data-dismiss="modal"]',
      'button:has-text("×")',
      'button:has-text("✕")',
    ];

    for (const selector of closeSelectors) {
      const button = await this.page.$(obstacle.element + ' ' + selector);
      if (button) {
        await button.click();
        await this.page.waitForTimeout(500);
        return true;
      }
    }

    // Try Escape key
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);

    const stillVisible = await this.page.isVisible(obstacle.element);
    return !stillVisible;
  }

  /**
   * Detect obstacles using AI vision (fallback)
   */
  private async detectWithAI(): Promise<Obstacle | null> {
    // TODO: Implement AI vision detection
    // For Phase 1, return null (rules-based only)
    // Phase 2 will add GPT-4 Vision / Gemini integration
    return null;
  }

  /**
   * Handle obstacle using AI reasoning
   */
  private async handleWithAI(obstacle: Obstacle): Promise<boolean> {
    // Check budget
    if (this.config.maxAICost && this.totalAICost >= this.config.maxAICost) {
      console.log(`⚠️  AI budget exceeded ($${this.totalAICost.toFixed(2)} >= $${this.config.maxAICost})`);
      return false;
    }

    let decision: AIDecision | null = null;

    try {
      decision = await this.getAIDecision(obstacle);

      console.log(`   💡 AI Decision: ${decision.action}`);
      console.log(`   📝 Reasoning: ${decision.reasoning}`);

      // Execute AI decision
      for (const step of decision.steps) {
        await this.executeAIStep(step);
      }

      // Increment AI cost tracking
      this.aiCallsCount++;
      this.totalAICost += 0.02; // Rough estimate: $0.02 per decision

      return true;
    } catch (error) {
      console.log(`   ❌ AI handling failed: ${error}`);

      // Try fallback if available
      if (decision && decision.fallback) {
        console.log(`   🔄 Trying fallback strategy...`);
        for (const step of decision.fallback.steps) {
          await this.executeAIStep(step);
        }
        return true;
      }

      return false;
    }
  }

  /**
   * Get AI decision for obstacle
   * Uses OpenAI GPT-4 (or fallback to rules if no API key)
   */
  private async getAIDecision(obstacle: Obstacle): Promise<AIDecision> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.log(`   ⚠️  OPENAI_API_KEY not set, falling back to rules`);
      throw new Error('No API key');
    }

    // Take screenshot for AI vision
    const screenshotBuffer = await this.page.screenshot();
    const screenshot = screenshotBuffer.toString('base64');

    // Get page context
    const url = this.page.url();
    const title = await this.page.title();

    // Build prompt for AI
    const prompt = `You are a form testing assistant. An obstacle is blocking access to a form.

**Context:**
- URL: ${url}
- Page Title: ${title}
- Obstacle Type: ${obstacle.type}
- Description: ${obstacle.description}
- Goal: Access the form to test it
${this.config.credentials ? `- Credentials Available: Yes (username: ${this.config.credentials.username})` : '- Credentials Available: No'}

**Question:**
How should I handle this obstacle to access the form?

**Options:**
1. Close the modal (find and click X/close button)
2. Fill login form (if credentials available and it's a login modal)
3. Dismiss popup (click outside, press Escape, find "No thanks" button)
4. Accept/skip (click Accept, Skip, Continue as guest)
5. Report blocker (cannot proceed automatically)

**Response Format (JSON):**
{
  "action": "close_modal" | "fill_login" | "dismiss_popup" | "accept_cookies" | "report_blocker",
  "reasoning": "Brief explanation of why this is the best approach",
  "steps": [
    { "type": "click", "selector": "button.close" },
    { "type": "wait", "duration": 500 }
  ],
  "confidence": 0.95
}`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cheap for decisions
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshot}` } }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3, // Low temperature for consistent decisions
      }),
    });

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Parse AI response (expecting JSON)
    const decision: AIDecision = JSON.parse(aiResponse);

    return decision;
  }

  /**
   * Execute a single AI action step
   */
  private async executeAIStep(step: AIActionStep): Promise<void> {
    switch (step.type) {
      case 'click':
        if (step.selector) {
          await this.page.click(step.selector);
        }
        break;

      case 'type':
        if (step.selector && step.value) {
          await this.page.fill(step.selector, step.value);
        }
        break;

      case 'wait':
        await this.page.waitForTimeout(step.duration || 1000);
        break;

      case 'press':
        if (step.key) {
          await this.page.keyboard.press(step.key);
        }
        break;
    }
  }

  /**
   * Get AI usage stats
   */
  getAIStats() {
    return {
      aiCallsCount: this.aiCallsCount,
      totalAICost: this.totalAICost,
    };
  }
}
