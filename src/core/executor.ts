import { Page, Locator } from 'playwright';
import { Action, Expectation, WaitForOptions, AssertionType, AssertionResult, FormValidation, WaitCondition } from '../types';

export class ActionExecutor {
  private lastUrl: string = '';
  private lastProgressIndicator: string = '';
  private sameStateCount: number = 0;
  private lastAction: string = '';
  private actionRepeatCount: number = 0;
  private readonly MAX_ACTION_REPEATS = 3;
  private readonly DEFAULT_TIMEOUT = 10000;

  constructor(private page: Page) {}

  async execute(action: Action): Promise<void> {
    const actionKey = `${action.action}:${action.selector || ''}:${action.value || ''}`;
    if (actionKey === this.lastAction) {
      this.actionRepeatCount++;
      if (this.actionRepeatCount >= this.MAX_ACTION_REPEATS) {
        throw new Error(`Action repeated ${this.MAX_ACTION_REPEATS} times: ${action.action}`);
      }
    } else {
      this.lastAction = actionKey;
      this.actionRepeatCount = 1;
    }

    const maxAttempts = action.retry?.maxAttempts || 1;
    const backoff = action.retry?.backoff || 1000;

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.executeOnce(action);
        if (action.wait_for) {
          await this.handleWaitFor(action.wait_for);
        }
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts) {
          console.log(`Attempt ${attempt}/${maxAttempts} failed, retrying...`);
          await this.page.waitForTimeout(backoff);
        }
      }
    }
    throw new Error(`Action failed after ${maxAttempts} attempts: ${lastError?.message}`);
  }

  private async handleWaitFor(waitFor: WaitForOptions | WaitForOptions[]): Promise<void> {
    const conditions = Array.isArray(waitFor) ? waitFor : [waitFor];
    for (const condition of conditions) {
      const timeout = condition.timeout || this.DEFAULT_TIMEOUT;
      switch (condition.condition) {
        case 'network_idle':
          await this.page.waitForLoadState('networkidle', { timeout });
          break;
        case 'element_visible':
          if (condition.selector) await this.page.waitForSelector(condition.selector, { state: 'visible', timeout });
          break;
        case 'element_hidden':
          if (condition.selector) await this.page.waitForSelector(condition.selector, { state: 'hidden', timeout });
          break;
        case 'url_contains':
          if (condition.value) await this.page.waitForURL(`**/*${condition.value}*`, { timeout });
          break;
        case 'text_visible':
          if (condition.value) await this.page.waitForSelector(`text=${condition.value}`, { state: 'visible', timeout });
          break;
        case 'no_loading':
          const loadingSelectors = ['.loading', '.spinner', '[class*="loading"]', '[aria-busy="true"]'];
          for (const sel of loadingSelectors) {
            try {
              if (await this.page.locator(sel).isVisible()) {
                await this.page.waitForSelector(sel, { state: 'hidden', timeout: 5000 });
              }
            } catch {}
          }
          break;
      }
    }
  }

  private async executeOnce(action: Action): Promise<void> {
    const timeout = action.timeout || this.DEFAULT_TIMEOUT;
    switch (action.action) {
      case 'navigate':
        await this.navigate(action);
        break;
      case 'click':
        await this.click(action);
        break;
      case 'type':
        await this.type(action);
        break;
      case 'select':
        await this.select(action);
        break;
      case 'select_option':
        await this.selectOption(action);
        break;
      case 'fill_date':
        await this.fillDate(action);
        break;
      case 'upload':
        await this.upload(action);
        break;
      case 'wait':
        await this.wait(action);
        break;
      case 'scroll':
        await this.scroll(action);
        break;
      case 'hover':
        await this.hover(action);
        break;
      case 'assert':
        await this.assert(action);
        break;
      case 'check_form':
        await this.checkForm(action);
        break;
      case 'press_key':
        await this.pressKey(action);
        break;
    }
    if (action.wait_after) {
      await this.page.waitForTimeout(action.wait_after);
    }
  }

  private async selectOption(action: Action): Promise<void> {
    const dropdown = action.dropdown || action.selector;
    if (!dropdown) throw new Error('select_option requires dropdown or selector');
    await this.page.click(dropdown, { timeout: action.timeout || this.DEFAULT_TIMEOUT });
    await this.page.waitForTimeout(300);
    if (action.option) {
      const optionSelectors = [
        `text="${action.option}"`,
        `[role="option"]:has-text("${action.option}")`,
        `li:has-text("${action.option}")`,
        `[class*="option"]:has-text("${action.option}")`,
      ];
      for (const optSel of optionSelectors) {
        try {
          const opt = this.page.locator(optSel).first();
          if (await opt.isVisible({ timeout: 1000 })) {
            await opt.click({ timeout: 2000 });
            return;
          }
        } catch {}
      }
      throw new Error(`Could not find option "${action.option}"`);
    } else if (action.option_index !== undefined) {
      const opts = this.page.locator('[role="option"], li, .option');
      await opts.nth(action.option_index).click();
    }
  }

  private async fillDate(action: Action): Promise<void> {
    if (!action.selector) throw new Error('fill_date requires selector');
    const dateValue = action.date || action.value!;
    const element = this.page.locator(action.selector);
    const inputType = await element.getAttribute('type');
    if (inputType === 'date') {
      await element.fill(dateValue);
    } else {
      await element.click();
      await element.fill('');
      await element.type(dateValue, { delay: 50 });
      await element.press('Enter');
      await this.page.keyboard.press('Escape');
    }
  }

  private async assert(action: Action): Promise<void> {
    if (!action.assert_type) throw new Error('assert requires assert_type');
    const result = await this.runAssertion(action.assert_type, action);
    if (!result.passed) throw new Error(`Assertion failed: ${result.message}`);
  }

  async runAssertion(type: AssertionType, action: Action, timeout: number = 10000): Promise<AssertionResult> {
    const result: AssertionResult = { type, passed: false, expected: action.expected };
    try {
      switch (type) {
        case 'element_visible':
          result.passed = await this.page.locator(action.selector!).isVisible({ timeout });
          result.message = result.passed ? 'Element visible' : `Element not visible: ${action.selector}`;
          break;
        case 'element_hidden':
          result.passed = !(await this.page.locator(action.selector!).isVisible({ timeout: 1000 }).catch(() => false));
          result.message = result.passed ? 'Element hidden' : `Element still visible: ${action.selector}`;
          break;
        case 'element_text':
          const text = await this.page.locator(action.selector!).textContent({ timeout });
          result.actual = text;
          result.passed = action.expected ? text?.includes(String(action.expected)) ?? false : !!text;
          result.message = result.passed ? 'Text matches' : `Expected "${action.expected}", got "${text}"`;
          break;
        case 'url_contains':
          const url = this.page.url();
          result.actual = url;
          result.passed = action.expected ? url.includes(String(action.expected)) : true;
          result.message = result.passed ? 'URL contains expected' : `URL "${url}" missing "${action.expected}"`;
          break;
        case 'url_is':
          const currentUrl = this.page.url();
          result.actual = currentUrl;
          result.passed = currentUrl === action.expected;
          result.message = result.passed ? 'URL matches' : `Expected "${action.expected}", got "${currentUrl}"`;
          break;
        case 'no_console_errors':
          result.passed = true;
          result.message = 'No console errors (checked in observer)';
          break;
        case 'no_validation_errors':
          const errors = await this.detectValidationErrors();
          result.passed = errors.length === 0;
          result.message = result.passed ? 'No validation errors' : `Errors: ${errors.join(', ')}`;
          break;
        case 'form_valid':
          const form = await this.checkFormValidity(action.selector || 'form');
          result.passed = form.isValid;
          result.message = result.passed ? 'Form valid' : `Form errors: ${form.validationErrors.map(e => e.message).join(', ')}`;
          break;
        case 'localstorage_has':
          const hasKey = await this.page.evaluate((key: string) => localStorage.getItem(key) !== null, action.expected);
          result.passed = hasKey;
          result.message = result.passed ? `Key "${action.expected}" exists` : `Key "${action.expected}" missing`;
          break;
      }
    } catch (error) {
      result.message = `Assertion error: ${error instanceof Error ? error.message : 'Unknown'}`;
    }
    return result;
  }

  async detectValidationErrors(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const errors: string[] = [];
      document.querySelectorAll(':invalid').forEach((input: any) => {
        if (input.validationMessage) errors.push(input.validationMessage);
      });
      const errorSels = ['.error', '.error-message', '[class*="error"]', '.invalid-feedback', '[role="alert"]'];
      errorSels.forEach(sel => {
        document.querySelectorAll(sel).forEach((el: any) => {
          if (el.textContent && el.offsetParent !== null) errors.push(el.textContent.trim());
        });
      });
      return [...new Set(errors)].filter(e => e.length > 0);
    });
  }

  private async checkForm(action: Action): Promise<void> {
    const form = await this.checkFormValidity(action.selector || 'form');
    if (!form.isValid) {
      console.log('Form validation errors:');
      form.validationErrors.forEach(e => console.log(`  - ${e.field}: ${e.message}`));
    }
  }

  async checkFormValidity(selector: string = 'form'): Promise<FormValidation> {
    return await this.page.evaluate((sel) => {
      const form = document.querySelector(sel) as HTMLFormElement;
      if (!form) return { isValid: true, fields: [], validationErrors: [] };
      const fields: any[] = [];
      const validationErrors: any[] = [];
      form.querySelectorAll('input, select, textarea').forEach((input: any) => {
        const field = {
          selector: input.id ? `#${input.id}` : `[name="${input.name}"]`,
          name: input.name || input.id,
          type: input.type || input.tagName.toLowerCase(),
          required: input.required,
          filled: !!input.value,
          valid: input.checkValidity ? input.checkValidity() : true,
          validationMessage: input.validationMessage,
        };
        fields.push(field);
        if (!field.valid && field.validationMessage) {
          validationErrors.push({
            field: field.name,
            selector: field.selector,
            message: field.validationMessage,
            type: field.required && !field.filled ? 'required' : 'custom',
          });
        }
      });
      return {
        isValid: form.checkValidity ? form.checkValidity() : validationErrors.length === 0,
        fields,
        validationErrors,
      };
    }, selector);
  }

  private async pressKey(action: Action): Promise<void> {
    const key = action.key || action.value!;
    if (action.selector) {
      await this.page.locator(action.selector).press(key);
    } else {
      let combo = key;
      if (action.modifiers?.length) combo = action.modifiers.join('+') + '+' + key;
      await this.page.keyboard.press(combo);
    }
  }

  private async navigate(action: Action): Promise<void> {
    if (!action.url) throw new Error('Navigate requires url');
    await this.page.goto(action.url, { waitUntil: 'networkidle', timeout: action.timeout || 30000 });
  }

  private async click(action: Action): Promise<void> {
    if (!action.selector) throw new Error('Click requires selector');
    await this.page.click(action.selector, { timeout: action.timeout || this.DEFAULT_TIMEOUT });
  }

  private async type(action: Action): Promise<void> {
    if (!action.selector) throw new Error('Type requires selector');
    if (!action.value) throw new Error('Type requires value');
    await this.page.fill(action.selector, '');
    await this.page.type(action.selector, action.value, { delay: 50 });
  }

  private async select(action: Action): Promise<void> {
    if (!action.selector || !action.value) throw new Error('Select requires selector and value');
    await this.page.selectOption(action.selector, action.value);
  }

  private async upload(action: Action): Promise<void> {
    if (!action.selector || !action.value) throw new Error('Upload requires selector and value');
    await this.page.locator(action.selector).setInputFiles(action.value.split(',').map(p => p.trim()));
  }

  private async wait(action: Action): Promise<void> {
    if (action.selector) {
      await this.page.waitForSelector(action.selector, { state: 'visible', timeout: action.timeout || 30000 });
    } else if (action.duration) {
      await this.page.waitForTimeout(action.duration);
    }
  }

  private async scroll(action: Action): Promise<void> {
    if (action.selector) {
      await this.page.locator(action.selector).scrollIntoViewIfNeeded();
    } else {
      await this.page.evaluate((amount) => {
        if (amount > 0) window.scrollBy(0, amount);
        else window.scrollTo(0, document.body.scrollHeight);
      }, action.value ? parseInt(action.value) : 0);
    }
  }

  private async hover(action: Action): Promise<void> {
    if (!action.selector) throw new Error('Hover requires selector');
    await this.page.hover(action.selector);
  }

  async verifyExpectations(expectations: Expectation[]): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = [];
    for (const exp of expectations) {
      try {
        switch (exp.type) {
          case 'element_visible':
            if (exp.selector && !(await this.page.isVisible(exp.selector))) {
              failures.push(`Element not visible: ${exp.selector}`);
            }
            break;
          case 'element_hidden':
            if (exp.selector && (await this.page.isVisible(exp.selector))) {
              failures.push(`Element still visible: ${exp.selector}`);
            }
            break;
          case 'url_changed':
            if (exp.pattern && !new RegExp(exp.pattern).test(this.page.url())) {
              failures.push(`URL doesn't match: ${exp.pattern}`);
            }
            break;
          case 'element_text':
            if (exp.selector) {
              const text = await this.page.locator(exp.selector).textContent();
              if (exp.contains && !text?.includes(exp.contains)) {
                failures.push(`Text doesn't contain "${exp.contains}"`);
              }
            }
            break;
          case 'no_validation_errors':
            const errors = await this.detectValidationErrors();
            if (errors.length > 0) failures.push(`Validation errors: ${errors.join(', ')}`);
            break;
        }
      } catch (e) {
        failures.push(`Check failed: ${exp.type}`);
      }
    }
    return { passed: failures.length === 0, failures };
  }
}
