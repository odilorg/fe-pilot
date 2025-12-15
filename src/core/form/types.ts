/**
 * Form Testing Types
 * Based on deep research of form testing best practices
 */

export interface DiscoveredField {
  id: string;
  type: FieldType;
  selector: string;
  label: string;
  required: boolean;
  validationRules: ValidationRule[];
  placeholder?: string;
  ariaLabel?: string;
  ariaRequired?: boolean;
  autocomplete?: string;
}

export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'tel'
  | 'url'
  | 'number'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'checkbox-group'
  | 'radio'
  | 'file'
  | 'date'
  | 'time'
  | 'datetime'
  | 'range'
  | 'color'
  | 'rich-text'
  | 'autocomplete'
  | 'custom';

export interface ValidationRule {
  type: 'required' | 'email' | 'pattern' | 'minLength' | 'maxLength' | 'min' | 'max';
  value?: string | number;
  message?: string;
}

export interface DiscoveredForm {
  id: string;
  name?: string;
  action?: string;
  method?: string;
  fields: DiscoveredField[];
  submitButton?: {
    text: string;
    selector: string;
  };
  isWizard: boolean;
  wizardInfo?: {
    currentStep: number;
    totalSteps: number;
    hasNext: boolean;
    hasPrevious: boolean;
    navigationSelectors: {
      next?: string;
      previous?: string;
    };
  };
}

export interface FieldTestData {
  valid: string[];
  invalid: string[];
  edge: string[]; // Edge cases like empty, very long, special chars
}

export interface FieldAnalysis extends DiscoveredField {
  testData: FieldTestData;
  accessibility: {
    hasLabel: boolean;
    hasAriaLabel: boolean;
    hasPlaceholder: boolean;
    keyboardAccessible: boolean;
    contrastRatio?: number;
    wcagIssues: string[];
  };
}

export interface Obstacle {
  type: 'modal' | 'popup' | 'redirect' | 'timeout' | 'captcha' | 'cookie-consent' | 'login' | 'unknown';
  description: string;
  element?: string; // Selector
  screenshot?: Buffer;
  timestamp: number;
}

export interface AIDecision {
  action: 'close_modal' | 'fill_login' | 'dismiss_popup' | 'accept_cookies' | 'wait' | 'report_blocker';
  reasoning: string;
  steps: AIActionStep[];
  confidence: number;
  fallback?: AIDecision;
}

export interface AIActionStep {
  type: 'click' | 'type' | 'wait' | 'press';
  selector?: string;
  value?: string;
  key?: string;
  duration?: number;
}

export interface FormTestResult {
  form: DiscoveredForm;
  fieldResults: FieldTestResult[];
  submissionResult?: SubmissionTestResult;
  obstaclesEncountered: Obstacle[];
  aiDecisionsMade: AIDecision[];
  summary: {
    totalFields: number;
    fieldsPassed: number;
    fieldsFailed: number;
    fieldsWarning: number;
    criticalIssues: number;
    warnings: number;
    passRate: number;
  };
  screenshots: string[];
  duration: number;
  aiCost: number;
}

export interface MultiFormTestResult {
  forms: FormTestResult[];
  overallSummary: {
    totalForms: number;
    formsWithIssues: number;
    totalFields: number;
    fieldsPassed: number;
    totalCriticalIssues: number;
    totalWarnings: number;
    overallPassRate: number;
  };
  duration: number;
  totalAICost: number;
}

export interface FieldTestResult {
  field: FieldAnalysis;
  tests: {
    requiredValidation?: TestResult;
    formatValidation?: TestResult;
    accessibility?: TestResult;
    visual?: TestResult;
  };
  status: 'passed' | 'failed' | 'warning';
  issues: Issue[];
  screenshots: string[];
}

export interface TestResult {
  passed: boolean;
  message: string;
  details?: any;
}

export interface SubmissionTestResult {
  validSubmission: TestResult;
  invalidSubmission: TestResult;
  errorHandling: TestResult;
  loadingIndicator: TestResult;
  duplicatePrevention: TestResult;
}

export interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'accessibility' | 'validation' | 'visual' | 'functional' | 'performance';
  field?: string;
  message: string;
  recommendation: string;
  wcagCriteria?: string; // e.g., "1.3.1 Info and Relationships (Level A)"
}

export interface FormTestConfig {
  mode: 'quick' | 'standard' | 'full';
  aiMode: 'disabled' | 'fallback' | 'hybrid' | 'always';
  wcagLevel?: 'A' | 'AA' | 'AAA';
  browsers?: string[];
  viewports?: string[];
  maxAICost?: number;
  credentials?: {
    username: string;
    password: string;
  };
}
