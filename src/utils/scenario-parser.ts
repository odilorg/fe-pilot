import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { Scenario, Action } from '../types';

const faker = {
  person: {
    firstName: () => ['John', 'Jane', 'Alex', 'Maria', 'Michael', 'Sarah'][Math.floor(Math.random() * 6)],
    lastName: () => ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'][Math.floor(Math.random() * 6)],
    fullName: () => `${faker.person.firstName()} ${faker.person.lastName()}`,
  },
  internet: {
    email: () => `${faker.person.firstName().toLowerCase()}${Math.floor(Math.random() * 1000)}@test.com`,
    password: () => 'Test' + Math.random().toString(36).substring(2, 10) + '!',
    username: () => faker.person.firstName().toLowerCase() + Math.floor(Math.random() * 1000),
  },
  phone: { number: () => `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}` },
  location: {
    city: () => ['New York', 'Los Angeles', 'Chicago', 'Tashkent'][Math.floor(Math.random() * 4)],
    address: () => `${Math.floor(Math.random() * 9999)} Main St`,
    zipCode: () => String(Math.floor(Math.random() * 90000 + 10000)),
  },
  company: { name: () => ['Global', 'Tech', 'Alpha'][Math.floor(Math.random() * 3)] + ' ' + ['Corp', 'Inc', 'LLC'][Math.floor(Math.random() * 3)] },
  lorem: {
    word: () => ['lorem', 'ipsum', 'dolor', 'sit', 'amet'][Math.floor(Math.random() * 5)],
    sentence: () => Array(8).fill(0).map(() => faker.lorem.word()).join(' ') + '.',
  },
  date: {
    future: (years = 1) => { const d = new Date(); d.setFullYear(d.getFullYear() + Math.ceil(Math.random() * years)); return d.toISOString().split('T')[0]; },
    past: (years = 1) => { const d = new Date(); d.setFullYear(d.getFullYear() - Math.ceil(Math.random() * years)); return d.toISOString().split('T')[0]; },
  },
  number: {
    int: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
    float: (min = 0, max = 100, dec = 2) => Number((Math.random() * (max - min) + min).toFixed(dec)),
  },
  datatype: {
    uuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }),
    boolean: () => Math.random() > 0.5,
  },
};

const random = {
  int: (min: number, max: number) => faker.number.int(min, max),
  float: (min: number, max: number, dec?: number) => faker.number.float(min, max, dec),
  boolean: () => faker.datatype.boolean(),
  uuid: () => faker.datatype.uuid(),
};

export class ScenarioParser {
  static loadFromFile(filePath: string): Scenario {
    try {
      const abs = path.resolve(filePath);
      const data = yaml.load(fs.readFileSync(abs, 'utf8')) as any;
      return this.parseScenario(data);
    } catch (e) {
      throw new Error(`Failed to load scenario: ${(e as Error).message}`);
    }
  }

  private static parseScenario(data: any): Scenario {
    if (!data.name) throw new Error('Missing "name" field');
    if (!data.url) throw new Error('Missing "url" field');
    if (!Array.isArray(data.steps) || !data.steps.length) throw new Error('Missing "steps" field');
    return {
      name: data.name,
      description: data.description,
      url: data.url,
      credentials: data.credentials,
      variables: data.variables || {},
      steps: data.steps,
      config: {
        headless: data.config?.headless !== false,
        viewport: data.config?.viewport,
        timeout: data.config?.timeout || 30000,
        slowMo: data.config?.slowMo || 0,
        screenshotOnError: data.config?.screenshotOnError !== false,
        screenshotOnStep: data.config?.screenshotOnStep || false,
        stopOnFirstFailure: data.config?.stopOnFirstFailure !== false,
        retryFailedSteps: data.config?.retryFailedSteps || 0,
        detectValidationErrors: data.config?.detectValidationErrors !== false,
      },
    };
  }

  static substituteVariables(scenario: Scenario): Scenario {
    const vars: Record<string, any> = {
      url: scenario.url,
      credentials: scenario.credentials,
      ...scenario.variables,
      faker, random,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
    };

    const substitute = (value: any): any => {
      if (typeof value === 'string') {
        return value.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
          const trimmed = expr.trim();
          const funcMatch = trimmed.match(/^(\w+(?:\.\w+)*)\(([^)]*)\)$/);
          if (funcMatch) {
            const [, funcPath, argsStr] = funcMatch;
            const fn = this.getNestedValue(vars, funcPath);
            if (typeof fn === 'function') {
              const args = argsStr ? argsStr.split(',').map(a => {
                const t = a.trim();
                const n = Number(t);
                if (!isNaN(n)) return n;
                if (t === 'true') return true;
                if (t === 'false') return false;
                return t.replace(/^['"]|['"]$/g, '');
              }) : [];
              try { return fn(...args); } catch { return match; }
            }
          }
          const result = this.getNestedValue(vars, trimmed);
          if (typeof result === 'function') try { return result(); } catch { return match; }
          return result !== undefined ? result : match;
        });
      }
      if (Array.isArray(value)) return value.map(substitute);
      if (value && typeof value === 'object') {
        const obj: any = {};
        for (const [k, v] of Object.entries(value)) obj[k] = substitute(v);
        return obj;
      }
      return value;
    };

    return { ...scenario, steps: scenario.steps.map(substitute) };
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  static validate(scenario: Scenario): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    scenario.steps.forEach((step, i) => {
      const n = i + 1;
      if (!step.action) { errors.push(`Step ${n}: missing action`); return; }
      switch (step.action) {
        case 'navigate': if (!step.url) errors.push(`Step ${n}: navigate needs url`); break;
        case 'click': case 'type': case 'hover': if (!step.selector) errors.push(`Step ${n}: ${step.action} needs selector`); break;
        case 'select': if (!step.selector || !step.value) errors.push(`Step ${n}: select needs selector and value`); break;
        case 'select_option': if (!step.selector && !step.dropdown) errors.push(`Step ${n}: select_option needs selector/dropdown`); if (!step.option && step.option_index === undefined) errors.push(`Step ${n}: select_option needs option/option_index`); break;
        case 'fill_date': if (!step.selector) errors.push(`Step ${n}: fill_date needs selector`); if (!step.date && !step.value) errors.push(`Step ${n}: fill_date needs date/value`); break;
        case 'wait': if (!step.duration && !step.selector) errors.push(`Step ${n}: wait needs duration or selector`); break;
        case 'assert': if (!step.assert_type) errors.push(`Step ${n}: assert needs assert_type`); break;
        case 'press_key': if (!step.key && !step.value) errors.push(`Step ${n}: press_key needs key/value`); break;
      }
    });
    return { valid: errors.length === 0, errors };
  }
}
