import { Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import {
  Observation, ConsoleLog, NetworkRequest, DOMState,
  PerformanceMetrics, Action, FormValidation, ErrorSummary,
  ErrorCategory, CategorizedError,
} from '../types';

export class Observer {
  private consoleLogs: ConsoleLog[] = [];
  private networkRequests: NetworkRequest[] = [];
  private errors: Error[] = [];
  private lastObservationIndex = { console: 0, network: 0 };
  private urlHistory: string[] = [];

  constructor(private page: Page, private screenshotDir: string) {
    this.setupListeners();
  }

  private setupListeners(): void {
    this.page.on('console', (msg) => {
      this.consoleLogs.push({
        type: msg.type() as any,
        text: msg.text(),
        timestamp: Date.now(),
        location: msg.location() ? `${msg.location().url}:${msg.location().lineNumber}` : undefined,
        category: this.categorizeLog(msg.type(), msg.text()),
        source: this.detectSource(msg.text()),
      });
    });

    this.page.on('pageerror', (error) => {
      this.errors.push(error);
      this.consoleLogs.push({
        type: 'error',
        text: error.message,
        timestamp: Date.now(),
        category: 'critical',
        source: 'javascript',
      });
    });

    this.page.on('response', async (response) => {
      const request = response.request();
      const timing = request.timing();
      this.networkRequests.push({
        url: request.url(),
        method: request.method(),
        status: response.status(),
        statusText: response.statusText(),
        duration: timing ? timing.responseEnd - timing.requestStart : 0,
        resourceType: request.resourceType(),
        timestamp: Date.now(),
        errorType: this.categorizeNetworkError(response.status()),
      });
    });

    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) this.urlHistory.push(frame.url());
    });
  }

  private categorizeLog(type: string, text: string): 'critical' | 'warning' | 'info' | 'debug' {
    if (type === 'error') {
      const critical = [/uncaught/i, /fatal/i, /TypeError/i, /ReferenceError/i];
      for (const p of critical) if (p.test(text)) return 'critical';
      return 'critical';
    }
    if (type === 'warn') {
      const ignore = [/react-dom/i, /deprecated/i, /devtools/i, /hydration/i];
      for (const p of ignore) if (p.test(text)) return 'info';
      return 'warning';
    }
    return type === 'debug' ? 'debug' : 'info';
  }

  private detectSource(text: string): 'javascript' | 'network' | 'security' | 'browser' | 'framework' {
    if (/CORS|cross-origin|blocked/i.test(text)) return 'security';
    if (/fetch|XMLHttpRequest/i.test(text)) return 'network';
    if (/react|vue|angular|next/i.test(text)) return 'framework';
    return 'javascript';
  }

  private categorizeNetworkError(status: number): 'server_error' | 'client_error' | undefined {
    if (status >= 500) return 'server_error';
    if (status >= 400) return 'client_error';
    return undefined;
  }

  async captureObservation(stepNumber: number, action: Action): Promise<Observation> {
    const timestamp = Date.now();
    const urlBefore = this.urlHistory[this.urlHistory.length - 2] || this.page.url();
    const urlAfter = this.page.url();
    let screenshotPath: string | undefined;
    if (action.action === 'screenshot' || action.observe) {
      screenshotPath = await this.captureScreenshot(stepNumber);
    }
    const domState = await this.captureDOMState();
    const performance = await this.capturePerformance();
    const formValidation = await this.captureFormValidation();
    const newConsoleLogs = this.consoleLogs.slice(this.lastObservationIndex.console);
    const newNetworkRequests = this.networkRequests.slice(this.lastObservationIndex.network);
    this.lastObservationIndex.console = this.consoleLogs.length;
    this.lastObservationIndex.network = this.networkRequests.length;
    return {
      timestamp, stepNumber, action, screenshot: screenshotPath,
      consoleLogs: [...this.consoleLogs], newConsoleLogs,
      networkRequests: [...this.networkRequests], newNetworkRequests,
      domState, errors: [...this.errors], performance, formValidation,
      urlBefore, urlAfter, urlChanged: urlBefore !== urlAfter,
    };
  }

  private async captureScreenshot(stepNumber: number): Promise<string> {
    const filename = `step-${stepNumber}-${Date.now()}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    if (!fs.existsSync(this.screenshotDir)) fs.mkdirSync(this.screenshotDir, { recursive: true });
    await this.page.screenshot({ path: filepath, fullPage: false });
    return filepath;
  }

  private async captureDOMState(): Promise<DOMState> {
    return await this.page.evaluate(() => {
      const visibleText = Array.from(document.querySelectorAll('body *'))
        .filter((el: any) => {
          const s = window.getComputedStyle(el);
          return s.display !== 'none' && s.visibility !== 'hidden' && el.textContent?.trim();
        })
        .map((el: any) => el.textContent?.trim())
        .filter(Boolean).slice(0, 50);
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
        .map((b: any) => b.textContent?.trim() || b.value || b.getAttribute('aria-label') || '').filter(Boolean);
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
        .map((i: any) => i.placeholder || i.name || i.id || '').filter(Boolean);
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((l: any) => l.textContent?.trim() || '').filter(Boolean).slice(0, 20);
      const dropdowns: any[] = [];
      document.querySelectorAll('select').forEach((s: any) => {
        dropdowns.push({
          trigger: s.id ? `#${s.id}` : `select[name="${s.name}"]`,
          isOpen: false,
          options: Array.from(s.options).map((o: any) => o.text),
          selectedValue: s.value,
          type: 'native',
        });
      });
      const forms: any[] = [];
      document.querySelectorAll('form').forEach((f: any) => {
        const allI = f.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select');
        const reqI = f.querySelectorAll('[required]');
        let filled = 0, filledReq = 0;
        allI.forEach((i: any) => { if (i.value) filled++; });
        reqI.forEach((i: any) => { if (i.value) filledReq++; });
        forms.push({
          selector: f.id ? `#${f.id}` : 'form',
          fields: allI.length, filledFields: filled,
          requiredFields: reqI.length, filledRequired: filledReq,
          hasValidationErrors: f.querySelectorAll(':invalid').length > 0,
        });
      });
      let formStatus = 'no-form';
      const totalInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea').length;
      let filledInputs = 0;
      document.querySelectorAll('input, textarea').forEach((i: any) => { if (i.value?.trim()) filledInputs++; });
      if (totalInputs > 0) {
        formStatus = filledInputs === 0 ? 'empty' : filledInputs === totalInputs ? 'complete' : 'partially-filled';
      }
      return {
        url: window.location.href, title: document.title,
        visibleText: [...new Set(visibleText)], buttons: [...new Set(buttons)],
        inputs: [...new Set(inputs)], links: [...new Set(links)],
        interactiveElementsSummary: {
          totalButtons: buttons.length, totalInputs: inputs.length, totalLinks: links.length,
          keyActions: buttons.filter((b: string) => /login|submit|next|save/i.test(b)).slice(0, 10),
          formStatus,
        },
        dropdowns, forms, datePickers: [], modals: [], loadingIndicators: [],
      };
    });
  }

  private async captureFormValidation(): Promise<FormValidation | undefined> {
    try {
      return await this.page.evaluate(() => {
        const form = document.querySelector('form') as HTMLFormElement;
        if (!form) return undefined;
        const fields: any[] = [], validationErrors: any[] = [];
        form.querySelectorAll('input, select, textarea').forEach((i: any) => {
          const f = {
            selector: i.id ? `#${i.id}` : `[name="${i.name}"]`,
            name: i.name || i.id, type: i.type || i.tagName.toLowerCase(),
            required: i.required, filled: !!i.value, valid: i.checkValidity?.() ?? true,
            validationMessage: i.validationMessage,
          };
          fields.push(f);
          if (!f.valid && f.validationMessage) {
            validationErrors.push({ field: f.name, selector: f.selector, message: f.validationMessage, type: 'custom' });
          }
        });
        return { isValid: form.checkValidity?.() ?? validationErrors.length === 0, fields, validationErrors };
      });
    } catch { return undefined; }
  }

  private async capturePerformance(): Promise<PerformanceMetrics | undefined> {
    try {
      return await this.page.evaluate(() => {
        const t = performance.timing;
        return {
          pageLoadTime: t.loadEventEnd - t.navigationStart,
          domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        };
      });
    } catch { return undefined; }
  }

  getNewConsoleErrors(): ConsoleLog[] {
    return this.consoleLogs.slice(this.lastObservationIndex.console).filter(l => l.type === 'error');
  }

  getNewNetworkErrors(): NetworkRequest[] {
    return this.networkRequests.slice(this.lastObservationIndex.network).filter(r => r.status >= 400);
  }

  hasNewErrors(): boolean {
    return this.getNewConsoleErrors().length > 0 || this.getNewNetworkErrors().length > 0;
  }

  getErrorSummary(): ErrorSummary {
    const categorize = (logs: ConsoleLog[]): ErrorCategory => {
      const items: CategorizedError[] = [];
      const map = new Map<string, CategorizedError>();
      logs.forEach(l => {
        const key = `${l.source}:${l.text.substring(0, 100)}`;
        const ex = map.get(key);
        if (ex) { ex.count++; ex.lastSeen = l.timestamp; }
        else {
          const e: CategorizedError = { type: l.type, message: l.text, source: l.source || 'unknown', count: 1, firstSeen: l.timestamp, lastSeen: l.timestamp };
          map.set(key, e); items.push(e);
        }
      });
      return { count: items.length, items };
    };
    return {
      critical: categorize(this.consoleLogs.filter(l => l.category === 'critical')),
      warning: categorize(this.consoleLogs.filter(l => l.category === 'warning')),
      info: categorize(this.consoleLogs.filter(l => l.category === 'info' || l.category === 'debug')),
    };
  }

  reset(): void {
    this.consoleLogs = []; this.networkRequests = []; this.errors = []; this.urlHistory = [];
    this.lastObservationIndex = { console: 0, network: 0 };
  }
}
