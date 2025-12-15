import { Page, Locator } from 'playwright';
import { Action, Expectation, WaitForOptions, AssertionType, AssertionResult, FormValidation, WaitCondition } from '../types';

interface FieldInfo {
  selector: string;
  name: string;
  type: string;
  tagName: string;
  required: boolean;
  disabled: boolean;
  readonly: boolean;
  hidden: boolean;
  value: string;
  placeholder?: string;
  options?: string[];
}

export class ActionExecutor {
  private lastUrl: string = '';
  private lastProgressIndicator: string = '';
  private sameStateCount: number = 0;
  private lastAction: string = '';
  private actionRepeatCount: number = 0;
  private readonly MAX_ACTION_REPEATS = 3;
  private readonly DEFAULT_TIMEOUT = 10000;
  private selectorCache: Map<string, string> = new Map();

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
    // Run independent waits in parallel for speed
    await Promise.all(conditions.map(condition => this.handleSingleWait(condition)));
  }

  private async handleSingleWait(condition: WaitForOptions): Promise<void> {
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
        await this.waitForNoLoading(timeout);
        break;
      case 'form_ready':
        await this.waitForFormReady(condition.selector || 'form', timeout);
        break;
    }
  }

  private async waitForNoLoading(timeout: number = 5000): Promise<void> {
    const loadingSelectors = [
      '.loading', '.spinner', '.loader',
      '[class*="loading"]', '[class*="spinner"]', '[class*="loader"]',
      '[aria-busy="true"]', '[data-loading="true"]',
      '.MuiCircularProgress-root', '.ant-spin',
      '[role="progressbar"]'
    ];
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      let anyLoading = false;
      for (const sel of loadingSelectors) {
        try {
          if (await this.page.locator(sel).first().isVisible({ timeout: 100 })) {
            anyLoading = true;
            break;
          }
        } catch {}
      }
      if (!anyLoading) return;
      await this.page.waitForTimeout(100);
    }
  }

  private async waitForFormReady(selector: string, timeout: number): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
    // Wait for form inputs to be interactive
    await this.page.waitForFunction(
      (sel) => {
        const form = document.querySelector(sel);
        if (!form) return false;
        const inputs = form.querySelectorAll('input, select, textarea');
        return inputs.length > 0 && Array.from(inputs).some(i => !(i as HTMLInputElement).disabled);
      },
      selector,
      { timeout }
    );
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
      // NEW: Universal form actions
      case 'fill_field':
        await this.fillField(action);
        break;
      case 'auto_fill_form':
        await this.autoFillForm(action);
        break;
      case 'toggle':
        await this.toggle(action);
        break;
      case 'clear':
        await this.clear(action);
        break;
      case 'focus':
        await this.focus(action);
        break;
      case 'blur':
        await this.blur(action);
        break;
    }
    if (action.wait_after) {
      await this.page.waitForTimeout(action.wait_after);
    }
  }

  // ==================== UNIVERSAL FORM HANDLING ====================

  /**
   * Smart field filler - auto-detects field type and fills appropriately
   */
  private async fillField(action: Action): Promise<void> {
    if (!action.selector) throw new Error('fill_field requires selector');
    if (action.value === undefined && action.option === undefined) {
      throw new Error('fill_field requires value or option');
    }

    const element = this.page.locator(action.selector).first();
    const fieldInfo = await this.getFieldInfo(element);

    // Skip disabled/readonly/hidden fields
    if (fieldInfo.disabled && !action.force) {
      console.log(`   ⏭️  Skipping disabled field: ${fieldInfo.name}`);
      return;
    }
    if (fieldInfo.readonly && !action.force) {
      console.log(`   ⏭️  Skipping readonly field: ${fieldInfo.name}`);
      return;
    }
    if (fieldInfo.hidden && !action.force) {
      console.log(`   ⏭️  Skipping hidden field: ${fieldInfo.name}`);
      return;
    }

    // Auto-detect and fill based on type
    switch (fieldInfo.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
      case 'search':
      case 'password':
      case 'number':
        await this.smartType(element, action.value!, action.clear !== false);
        break;

      case 'textarea':
        await this.smartType(element, action.value!, action.clear !== false);
        break;

      case 'select':
      case 'select-one':
      case 'select-multiple':
        await this.smartSelect(element, action.value || action.option!, fieldInfo);
        break;

      case 'checkbox':
        await this.smartCheckbox(element, action.value === 'true' || action.value === '1' || action.checked === true);
        break;

      case 'radio':
        await element.check({ force: action.force });
        break;

      case 'date':
      case 'datetime-local':
      case 'time':
      case 'month':
      case 'week':
        await this.smartDate(element, action.value || action.date!, fieldInfo.type);
        break;

      case 'file':
        await element.setInputFiles(action.value!.split(',').map(p => p.trim()));
        break;

      case 'range':
        await element.fill(action.value!);
        break;

      case 'color':
        await element.fill(action.value!);
        break;

      default:
        // For custom components, try multiple strategies
        await this.smartFillUnknown(element, action, fieldInfo);
    }
  }

  private async getFieldInfo(element: Locator): Promise<FieldInfo> {
    return await element.evaluate((el: any) => {
      const tagName = el.tagName.toLowerCase();
      let type = el.type || tagName;
      if (tagName === 'select') type = 'select';
      if (tagName === 'textarea') type = 'textarea';

      const options: string[] = [];
      if (tagName === 'select') {
        Array.from(el.options || []).forEach((opt: any) => {
          if (opt.value) options.push(opt.text || opt.value);
        });
      }

      return {
        selector: el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : tagName),
        name: el.name || el.id || el.placeholder || 'unknown',
        type,
        tagName,
        required: el.required || false,
        disabled: el.disabled || false,
        readonly: el.readOnly || false,
        hidden: el.type === 'hidden' || el.offsetParent === null,
        value: el.value || '',
        placeholder: el.placeholder,
        options,
      };
    });
  }

  private async smartType(element: Locator, value: string, clear: boolean = true): Promise<void> {
    if (clear) {
      await element.fill('');
    }
    // Use fill for speed, type for realistic behavior
    await element.fill(value);
  }

  private async smartSelect(element: Locator, value: string, fieldInfo: FieldInfo): Promise<void> {
    // Try by label first
    try {
      await element.selectOption({ label: value });
      return;
    } catch {}
    // Try by value
    try {
      await element.selectOption(value);
      return;
    } catch {}
    // Try partial match
    const matchingOption = fieldInfo.options?.find(opt =>
      opt.toLowerCase().includes(value.toLowerCase())
    );
    if (matchingOption) {
      await element.selectOption({ label: matchingOption });
    }
  }

  private async smartCheckbox(element: Locator, shouldBeChecked: boolean): Promise<void> {
    const isChecked = await element.isChecked();
    if (isChecked !== shouldBeChecked) {
      await element.click();
    }
  }

  private async smartDate(element: Locator, value: string, type: string): Promise<void> {
    // Normalize date format for different input types
    let formattedValue = value;
    if (type === 'date' && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Try to parse and format
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        formattedValue = date.toISOString().split('T')[0];
      }
    }
    await element.fill(formattedValue);
  }

  private async smartFillUnknown(element: Locator, action: Action, fieldInfo: FieldInfo): Promise<void> {
    // Try click + type for custom components
    try {
      await element.click({ timeout: 2000 });
      await element.fill(action.value!);
      return;
    } catch {}

    // Try finding inner input
    try {
      const innerInput = element.locator('input, textarea').first();
      if (await innerInput.isVisible({ timeout: 1000 })) {
        await innerInput.fill(action.value!);
        return;
      }
    } catch {}

    // Last resort: keyboard input
    await element.focus();
    await this.page.keyboard.type(action.value!);
  }

  /**
   * Auto-fill entire form with provided data
   */
  private async autoFillForm(action: Action): Promise<void> {
    const formSelector = action.selector || 'form';
    const data = action.data || {};

    // Get all fillable fields in the form
    const fields = await this.page.evaluate((sel) => {
      const form = document.querySelector(sel);
      if (!form) return [];

      const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
      return Array.from(inputs).map((input: any) => ({
        selector: input.id ? `#${input.id}` : `[name="${input.name}"]`,
        name: input.name || input.id,
        type: input.type || input.tagName.toLowerCase(),
        required: input.required,
        disabled: input.disabled,
        readonly: input.readOnly,
      })).filter(f => f.name && !f.disabled && !f.readonly);
    }, formSelector);

    // Fill fields that have matching data
    for (const field of fields) {
      const value = data[field.name];
      if (value !== undefined) {
        try {
          await this.fillField({
            action: 'fill_field',
            selector: field.selector,
            value: String(value),
          });
        } catch (e) {
          console.log(`   ⚠️  Could not fill ${field.name}: ${(e as Error).message}`);
        }
      }
    }
  }

  /**
   * Toggle checkbox/switch/radio
   */
  private async toggle(action: Action): Promise<void> {
    if (!action.selector) throw new Error('toggle requires selector');
    const element = this.page.locator(action.selector).first();

    // Detect toggle type
    const tagInfo = await element.evaluate((el: any) => ({
      tagName: el.tagName.toLowerCase(),
      type: el.type,
      role: el.getAttribute('role'),
      ariaChecked: el.getAttribute('aria-checked'),
    }));

    if (tagInfo.type === 'checkbox' || tagInfo.type === 'radio') {
      if (action.value === 'true' || action.checked === true) {
        await element.check();
      } else if (action.value === 'false' || action.checked === false) {
        await element.uncheck();
      } else {
        await element.click(); // Toggle
      }
    } else if (tagInfo.role === 'switch' || tagInfo.role === 'checkbox') {
      // Custom switch component
      await element.click();
    } else {
      // Generic toggle
      await element.click();
    }
  }

  private async clear(action: Action): Promise<void> {
    if (!action.selector) throw new Error('clear requires selector');
    await this.page.locator(action.selector).fill('');
  }

  private async focus(action: Action): Promise<void> {
    if (!action.selector) throw new Error('focus requires selector');
    await this.page.locator(action.selector).focus();
  }

  private async blur(action: Action): Promise<void> {
    if (!action.selector) throw new Error('blur requires selector');
    await this.page.locator(action.selector).blur();
  }

  // ==================== ENHANCED EXISTING ACTIONS ====================

  private async selectOption(action: Action): Promise<void> {
    const dropdown = action.dropdown || action.selector;
    if (!dropdown) throw new Error('select_option requires dropdown or selector');

    const element = this.page.locator(dropdown).first();

    // Wait for element to be interactive
    await element.waitFor({ state: 'visible', timeout: action.timeout || this.DEFAULT_TIMEOUT });

    // Check if disabled
    const isDisabled = await element.evaluate((el: any) => el.disabled);
    if (isDisabled && !action.force) {
      throw new Error(`Dropdown ${dropdown} is disabled`);
    }

    // Auto-detect element type
    const tagName = await element.evaluate(el => el.tagName.toLowerCase());

    if (tagName === 'select') {
      await this.handleNativeSelect(element, action);
    } else {
      await this.handleCustomDropdown(element, dropdown, action);
    }
  }

  private async handleNativeSelect(element: Locator, action: Action): Promise<void> {
    if (action.option) {
      // Try label first, then value
      try {
        await element.selectOption({ label: action.option });
        return;
      } catch {
        try {
          await element.selectOption(action.option);
          return;
        } catch {
          // Try partial match
          const options = await element.locator('option').all();
          for (const opt of options) {
            const text = await opt.textContent();
            if (text?.toLowerCase().includes(action.option.toLowerCase())) {
              const value = await opt.getAttribute('value');
              if (value) {
                await element.selectOption(value);
                return;
              }
            }
          }
        }
      }
      throw new Error(`Could not find option "${action.option}" in native select`);
    } else if (action.option_index !== undefined) {
      const options = await element.locator('option').all();
      if (options[action.option_index]) {
        const value = await options[action.option_index].getAttribute('value');
        if (value !== null) {
          await element.selectOption(value);
          return;
        }
      }
      throw new Error(`Option index ${action.option_index} out of range`);
    } else if (action.value) {
      await element.selectOption(action.value);
    } else {
      throw new Error('select_option requires option, option_index, or value');
    }
  }

  private async handleCustomDropdown(element: Locator, dropdown: string, action: Action): Promise<void> {
    // Click to open
    await element.click({ timeout: action.timeout || this.DEFAULT_TIMEOUT });
    await this.page.waitForTimeout(300);

    // Wait for dropdown to appear
    await this.waitForDropdownOpen();

    if (action.option) {
      const optionSelectors = [
        `text="${action.option}"`,
        `[role="option"]:has-text("${action.option}")`,
        `[role="listbox"] >> text="${action.option}"`,
        `li:has-text("${action.option}")`,
        `[class*="option"]:has-text("${action.option}")`,
        `[class*="item"]:has-text("${action.option}")`,
        `[data-value="${action.option}"]`,
        `.dropdown-item:has-text("${action.option}")`,
        `.menu-item:has-text("${action.option}")`,
        // Material UI
        `.MuiMenuItem-root:has-text("${action.option}")`,
        // Ant Design
        `.ant-select-item:has-text("${action.option}")`,
        // Headless UI
        `[id*="listbox-option"]:has-text("${action.option}")`,
      ];

      for (const optSel of optionSelectors) {
        try {
          const opt = this.page.locator(optSel).first();
          if (await opt.isVisible({ timeout: 500 })) {
            await opt.click({ timeout: 2000 });
            return;
          }
        } catch {}
      }

      // Try keyboard navigation as fallback
      try {
        await this.page.keyboard.type(action.option.substring(0, 3));
        await this.page.waitForTimeout(200);
        await this.page.keyboard.press('Enter');
        return;
      } catch {}

      throw new Error(`Could not find option "${action.option}" in custom dropdown`);
    } else if (action.option_index !== undefined) {
      const optionLocators = [
        '[role="option"]',
        '[role="listbox"] > *',
        'li',
        '.option',
        '.dropdown-item',
      ];

      for (const locator of optionLocators) {
        try {
          const opts = this.page.locator(locator);
          const count = await opts.count();
          if (count > action.option_index) {
            await opts.nth(action.option_index).click();
            return;
          }
        } catch {}
      }
      throw new Error(`Option index ${action.option_index} out of range`);
    }
  }

  private async waitForDropdownOpen(timeout: number = 3000): Promise<void> {
    const dropdownIndicators = [
      '[role="listbox"]',
      '[role="menu"]',
      '.dropdown-menu:visible',
      '[class*="dropdown"][class*="open"]',
      '[class*="select"][class*="open"]',
      '.MuiMenu-paper',
      '.ant-select-dropdown',
    ];

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      for (const indicator of dropdownIndicators) {
        try {
          if (await this.page.locator(indicator).first().isVisible({ timeout: 100 })) {
            return;
          }
        } catch {}
      }
      await this.page.waitForTimeout(100);
    }
  }

  private async fillDate(action: Action): Promise<void> {
    if (!action.selector) throw new Error('fill_date requires selector');
    const dateValue = action.date || action.value!;
    const element = this.page.locator(action.selector).first();

    const fieldInfo = await element.evaluate((el: any) => ({
      type: el.type,
      tagName: el.tagName.toLowerCase(),
      hasDatepicker: el.classList.contains('datepicker') ||
                     el.hasAttribute('data-datepicker') ||
                     !!el.closest('.react-datepicker-wrapper, .flatpickr-input, [class*="date-picker"]'),
    }));

    if (fieldInfo.type === 'date') {
      // Native date input
      let formattedDate = dateValue;
      if (!dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          formattedDate = date.toISOString().split('T')[0];
        }
      }
      await element.fill(formattedDate);
    } else if (fieldInfo.hasDatepicker || action.datepicker) {
      // Custom datepicker
      await element.click();
      await element.fill('');
      await element.type(dateValue, { delay: 30 });
      await this.page.waitForTimeout(300);

      // Try to close datepicker
      try {
        // Press Enter to confirm
        await element.press('Enter');
      } catch {}
      try {
        // Click outside to close
        await this.page.keyboard.press('Escape');
      } catch {}
      try {
        // Click a "Done" or "OK" button if exists
        const doneBtn = this.page.locator('button:has-text("Done"), button:has-text("OK"), button:has-text("Apply")').first();
        if (await doneBtn.isVisible({ timeout: 500 })) {
          await doneBtn.click();
        }
      } catch {}
    } else {
      // Regular text input
      await element.fill(dateValue);
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
        case 'element_value':
          const value = await this.page.locator(action.selector!).inputValue({ timeout });
          result.actual = value;
          result.passed = action.expected ? value === String(action.expected) : !!value;
          result.message = result.passed ? 'Value matches' : `Expected "${action.expected}", got "${value}"`;
          break;
        case 'element_enabled':
          result.passed = await this.page.locator(action.selector!).isEnabled({ timeout });
          result.message = result.passed ? 'Element enabled' : `Element disabled: ${action.selector}`;
          break;
        case 'element_disabled':
          result.passed = await this.page.locator(action.selector!).isDisabled({ timeout });
          result.message = result.passed ? 'Element disabled' : `Element enabled: ${action.selector}`;
          break;
        case 'element_checked':
          result.passed = await this.page.locator(action.selector!).isChecked({ timeout });
          result.message = result.passed ? 'Element checked' : `Element unchecked: ${action.selector}`;
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
        case 'url_matches':
          const urlToMatch = this.page.url();
          result.actual = urlToMatch;
          result.passed = action.expected ? new RegExp(String(action.expected)).test(urlToMatch) : true;
          result.message = result.passed ? 'URL matches pattern' : `URL "${urlToMatch}" doesn't match "${action.expected}"`;
          break;
        case 'title_contains':
          const title = await this.page.title();
          result.actual = title;
          result.passed = action.expected ? title.includes(String(action.expected)) : !!title;
          result.message = result.passed ? 'Title contains expected' : `Title "${title}" missing "${action.expected}"`;
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
        case 'form_complete':
          const formComplete = await this.checkFormCompleteness(action.selector || 'form');
          result.passed = formComplete.allFilled;
          result.message = result.passed ? 'All required fields filled' : `Missing: ${formComplete.emptyRequired.join(', ')}`;
          break;
        case 'localstorage_has':
          const hasKey = await this.page.evaluate((key: string) => localStorage.getItem(key) !== null, String(action.expected));
          result.passed = hasKey;
          result.message = result.passed ? `Key "${action.expected}" exists` : `Key "${action.expected}" missing`;
          break;
        case 'cookie_has':
          const cookies = await this.page.context().cookies();
          result.passed = cookies.some(c => c.name === action.expected);
          result.message = result.passed ? `Cookie "${action.expected}" exists` : `Cookie "${action.expected}" missing`;
          break;
        case 'count':
          const count = await this.page.locator(action.selector!).count();
          result.actual = String(count);
          result.passed = count === Number(action.expected);
          result.message = result.passed ? `Count matches: ${count}` : `Expected ${action.expected} elements, got ${count}`;
          break;
      }
    } catch (error) {
      result.message = `Assertion error: ${error instanceof Error ? error.message : 'Unknown'}`;
    }
    return result;
  }

  private async checkFormCompleteness(selector: string = 'form'): Promise<{ allFilled: boolean; emptyRequired: string[] }> {
    return await this.page.evaluate((sel) => {
      const form = document.querySelector(sel);
      if (!form) return { allFilled: true, emptyRequired: [] };

      const emptyRequired: string[] = [];
      form.querySelectorAll('[required]').forEach((input: any) => {
        if (!input.value || (input.type === 'checkbox' && !input.checked)) {
          emptyRequired.push(input.name || input.id || 'unknown');
        }
      });

      return {
        allFilled: emptyRequired.length === 0,
        emptyRequired,
      };
    }, selector);
  }

  async detectValidationErrors(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const errors: string[] = [];
      // Native validation
      document.querySelectorAll(':invalid').forEach((input: any) => {
        if (input.validationMessage && input.type !== 'hidden') {
          errors.push(input.validationMessage);
        }
      });
      // Custom error elements
      const errorSels = [
        '.error', '.error-message', '.field-error',
        '[class*="error"]:not([class*="no-error"])',
        '.invalid-feedback', '.form-error',
        '[role="alert"]', '[aria-invalid="true"]',
        '.MuiFormHelperText-error', '.ant-form-explain',
      ];
      errorSels.forEach(sel => {
        document.querySelectorAll(sel).forEach((el: any) => {
          if (el.textContent && el.offsetParent !== null && el.textContent.trim().length > 0) {
            errors.push(el.textContent.trim());
          }
        });
      });
      return [...new Set(errors)].filter(e => e.length > 0 && e.length < 500);
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
        if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') return;
        const field = {
          selector: input.id ? `#${input.id}` : `[name="${input.name}"]`,
          name: input.name || input.id,
          type: input.type || input.tagName.toLowerCase(),
          required: input.required,
          disabled: input.disabled,
          filled: !!input.value || (input.type === 'checkbox' && input.checked),
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
    await this.page.goto(action.url, {
      waitUntil: action.wait_until || 'networkidle',
      timeout: action.timeout || 30000
    });
  }

  private async click(action: Action): Promise<void> {
    if (!action.selector) throw new Error('Click requires selector');
    const element = this.page.locator(action.selector).first();

    // Wait for element to be clickable
    await element.waitFor({ state: 'visible', timeout: action.timeout || this.DEFAULT_TIMEOUT });

    // Check if element is disabled
    const isDisabled = await element.evaluate((el: any) => el.disabled || el.getAttribute('aria-disabled') === 'true');
    if (isDisabled && !action.force) {
      throw new Error(`Element ${action.selector} is disabled`);
    }

    // Scroll into view if needed
    await element.scrollIntoViewIfNeeded();

    await element.click({
      timeout: action.timeout || this.DEFAULT_TIMEOUT,
      force: action.force,
    });
  }

  private async type(action: Action): Promise<void> {
    if (!action.selector) throw new Error('Type requires selector');
    if (action.value === undefined) throw new Error('Type requires value');

    const element = this.page.locator(action.selector).first();
    await element.waitFor({ state: 'visible', timeout: action.timeout || this.DEFAULT_TIMEOUT });

    if (action.clear !== false) {
      await element.fill('');
    }

    if (action.delay) {
      await element.type(action.value, { delay: action.delay });
    } else {
      await element.fill(action.value);
    }
  }

  private async select(action: Action): Promise<void> {
    if (!action.selector || !action.value) throw new Error('Select requires selector and value');
    await this.page.selectOption(action.selector, action.value);
  }

  private async upload(action: Action): Promise<void> {
    if (!action.selector || !action.value) throw new Error('Upload requires selector and value');
    const files = action.value.split(',').map(p => p.trim());
    await this.page.locator(action.selector).setInputFiles(files);
  }

  private async wait(action: Action): Promise<void> {
    if (action.selector) {
      await this.page.waitForSelector(action.selector, { state: 'visible', timeout: action.timeout || 30000 });
    } else if (action.duration) {
      await this.page.waitForTimeout(action.duration);
    } else if (action.condition) {
      await this.handleSingleWait({ condition: action.condition as WaitCondition, timeout: action.timeout });
    }
  }

  private async scroll(action: Action): Promise<void> {
    if (action.selector) {
      await this.page.locator(action.selector).scrollIntoViewIfNeeded();
    } else if (action.direction === 'bottom') {
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } else if (action.direction === 'top') {
      await this.page.evaluate(() => window.scrollTo(0, 0));
    } else {
      const amount = action.value ? parseInt(action.value) : 500;
      await this.page.evaluate((a) => window.scrollBy(0, a), amount);
    }
  }

  private async hover(action: Action): Promise<void> {
    if (!action.selector) throw new Error('Hover requires selector');
    await this.page.hover(action.selector);
  }

  async verifyExpectations(expectations: Expectation[]): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = [];
    // Run verifications in parallel for speed
    const results = await Promise.all(
      expectations.map(async (exp) => {
        try {
          switch (exp.type) {
            case 'element_visible':
              if (exp.selector && !(await this.page.isVisible(exp.selector))) {
                return `Element not visible: ${exp.selector}`;
              }
              break;
            case 'element_hidden':
              if (exp.selector && (await this.page.isVisible(exp.selector))) {
                return `Element still visible: ${exp.selector}`;
              }
              break;
            case 'url_changed':
              if (exp.pattern && !new RegExp(exp.pattern).test(this.page.url())) {
                return `URL doesn't match: ${exp.pattern}`;
              }
              break;
            case 'element_text':
              if (exp.selector) {
                const text = await this.page.locator(exp.selector).textContent();
                if (exp.contains && !text?.includes(exp.contains)) {
                  return `Text doesn't contain "${exp.contains}"`;
                }
              }
              break;
            case 'no_validation_errors':
              const errors = await this.detectValidationErrors();
              if (errors.length > 0) return `Validation errors: ${errors.join(', ')}`;
              break;
          }
          return null;
        } catch (e) {
          return `Check failed: ${exp.type}`;
        }
      })
    );

    results.forEach(r => { if (r) failures.push(r); });
    return { passed: failures.length === 0, failures };
  }
}
