// Core action types - ENHANCED with new actions
export type ActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'           // Native <select> dropdowns
  | 'select_option'    // NEW: Custom dropdown (click to open, click option)
  | 'fill_date'        // NEW: Date picker support
  | 'upload'
  | 'wait'
  | 'wait_for'         // NEW: Smart wait strategies
  | 'screenshot'
  | 'scroll'
  | 'hover'
  | 'verify'
  | 'assert'           // NEW: Assertion steps
  | 'check_form'       // NEW: Form validation check
  | 'press_key';       // NEW: Keyboard actions

// Smart wait conditions
export type WaitCondition = 
  | 'network_idle'
  | 'element_visible'
  | 'element_hidden'
  | 'element_enabled'
  | 'url_contains'
  | 'url_matches'
  | 'text_visible'
  | 'no_loading'
  | 'dom_stable';

// Assertion types
export type AssertionType =
  | 'element_visible'
  | 'element_hidden'
  | 'element_text'
  | 'element_value'
  | 'element_count'
  | 'url_is'
  | 'url_contains'
  | 'url_matches'
  | 'title_is'
  | 'title_contains'
  | 'no_console_errors'
  | 'no_validation_errors'
  | 'form_valid'
  | 'network_success'
  | 'cookie_exists'
  | 'localstorage_has';

export interface Action {
  action: ActionType;
  selector?: string;
  value?: string;
  url?: string;
  duration?: number;
  description?: string;
  observe?: boolean;
  expect?: Expectation[];
  wait_after?: number;
  retry?: {
    maxAttempts?: number;
    backoff?: number;
  };
  // NEW: Smart wait options
  wait_for?: WaitForOptions | WaitForOptions[];
  // NEW: Dropdown options
  dropdown?: string;           // For select_option: dropdown trigger selector
  option?: string;             // For select_option: option to select
  option_index?: number;       // For select_option: select by index
  // NEW: Date picker options
  date?: string;               // For fill_date: date value (ISO or formatted)
  date_format?: string;        // For fill_date: format string
  // NEW: Assertion options
  assert_type?: AssertionType;
  expected?: string | number | boolean;
  // NEW: Key press options
  key?: string;                // For press_key: key to press
  modifiers?: string[];        // For press_key: modifier keys (Ctrl, Shift, Alt)
  // NEW: Timeout override
  timeout?: number;
}

// NEW: Smart wait options
export interface WaitForOptions {
  condition: WaitCondition;
  selector?: string;
  value?: string;
  timeout?: number;
}

export interface Expectation {
  type: 'element_visible' | 'no_console_errors' | 'network_success' | 'url_changed' | 'element_text' 
    // NEW expectation types
    | 'no_validation_errors' | 'form_submitted' | 'page_changed' | 'element_hidden';
  selector?: string;
  url?: string;
  pattern?: string;
  contains?: string;
}

// Observation data structures
export interface ConsoleLog {
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  text: string;
  timestamp: number;
  location?: string;
  args?: any[];
  // NEW: Categorization
  category?: 'critical' | 'warning' | 'info' | 'debug';
  source?: 'javascript' | 'network' | 'security' | 'browser' | 'framework';
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  duration: number;
  resourceType: string;
  timestamp: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  // NEW: Enhanced info
  requestBody?: string;
  responseBody?: string;
  errorType?: 'timeout' | 'cors' | 'server_error' | 'client_error' | 'network_error';
}

// NEW: Form validation state
export interface FormValidation {
  isValid: boolean;
  fields: FormFieldState[];
  validationErrors: ValidationError[];
}

export interface FormFieldState {
  selector: string;
  name?: string;
  type: string;
  required: boolean;
  filled: boolean;
  valid: boolean;
  value?: string;
  validationMessage?: string;
}

export interface ValidationError {
  field: string;
  selector: string;
  message: string;
  type: 'required' | 'pattern' | 'min' | 'max' | 'custom';
}

export interface DOMState {
  url: string;
  title: string;
  visibleText: string[];
  buttons: string[];
  inputs: string[];
  links: string[];
  interactiveElementsSummary?: {
    totalButtons: number;
    totalInputs: number;
    totalLinks: number;
    keyActions: string[];
    formStatus: string;
  };
  // NEW: Enhanced DOM info
  dropdowns?: DropdownInfo[];
  datePickers?: DatePickerInfo[];
  forms?: FormInfo[];
  modals?: ModalInfo[];
  loadingIndicators?: string[];
}

// NEW: Dropdown detection
export interface DropdownInfo {
  trigger: string;           // Selector for dropdown trigger
  isOpen: boolean;
  options: string[];
  selectedValue?: string;
  type: 'native' | 'custom' | 'autocomplete';
}

// NEW: Date picker detection  
export interface DatePickerInfo {
  input: string;             // Selector for date input
  type: 'native' | 'custom' | 'calendar';
  currentValue?: string;
  format?: string;
}

// NEW: Form detection
export interface FormInfo {
  selector: string;
  fields: number;
  filledFields: number;
  requiredFields: number;
  filledRequired: number;
  hasValidationErrors: boolean;
  submitButton?: string;
}

// NEW: Modal detection
export interface ModalInfo {
  selector: string;
  isVisible: boolean;
  title?: string;
  buttons: string[];
}

export interface PerformanceMetrics {
  pageLoadTime: number;
  domContentLoaded: number;
  firstContentfulPaint?: number;
}

export interface Observation {
  timestamp: number;
  stepNumber: number;
  action: Action;
  screenshot?: string;
  consoleLogs: ConsoleLog[];
  newConsoleLogs: ConsoleLog[];
  networkRequests: NetworkRequest[];
  newNetworkRequests: NetworkRequest[];
  domState: DOMState;
  errors: Error[];
  performance?: PerformanceMetrics;
  // NEW: Form validation state
  formValidation?: FormValidation;
  // NEW: URL tracking
  urlBefore?: string;
  urlAfter?: string;
  urlChanged?: boolean;
}

// Scenario definition
export interface Scenario {
  name: string;
  url: string;
  description?: string;
  credentials?: {
    username: string;
    password: string;
  };
  // NEW: Variables for test data
  variables?: Record<string, any>;
  steps: Action[];
  config?: ScenarioConfig;
}

export interface ScenarioConfig {
  headless?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  timeout?: number;
  slowMo?: number;
  // NEW: Enhanced config options
  screenshotOnError?: boolean;
  screenshotOnStep?: boolean;
  stopOnFirstFailure?: boolean;
  retryFailedSteps?: number;
  networkIdleTimeout?: number;
  detectValidationErrors?: boolean;
}

// Test results
export interface StepResult {
  step: number;
  action: Action;
  status: 'success' | 'failed' | 'warning' | 'skipped';
  observations: Observation;
  aiAnalysis?: AIAnalysis;
  duration: number;
  error?: string;
  // NEW: Enhanced result info
  retryCount?: number;
  assertions?: AssertionResult[];
  formValidation?: FormValidation;
}

// NEW: Assertion result
export interface AssertionResult {
  type: AssertionType;
  passed: boolean;
  expected?: any;
  actual?: any;
  message?: string;
}

export interface AIAnalysis {
  bugFound: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  suggestedFix?: string;
  fixApplied?: boolean;
  fixLocation?: string;
}

// NEW: Categorized error summary
export interface ErrorSummary {
  critical: ErrorCategory;
  warning: ErrorCategory;
  info: ErrorCategory;
}

export interface ErrorCategory {
  count: number;
  items: CategorizedError[];
}

export interface CategorizedError {
  type: string;
  message: string;
  source: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export interface TestReport {
  scenario: string;
  status: 'passed' | 'failed' | 'warning';
  duration: number;
  startTime: number;
  endTime: number;
  steps: StepResult[];
  summary: {
    totalSteps: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
    bugsFound: number;
    bugsFixed: number;
    screenshots: string[];
    consoleErrors: number;
    networkErrors: number;
    // NEW: Enhanced summary
    validationErrors: number;
    assertionsPassed: number;
    assertionsFailed: number;
    retriedSteps: number;
  };
  // NEW: Categorized errors
  errorSummary?: ErrorSummary;
}

// AI Integration
export interface AICheckpointRequest {
  stepNumber: number;
  goal: string;
  observation: Observation;
  history: Observation[];
  question?: string;
}

export interface AICheckpointResponse {
  decision: 'continue' | 'fix' | 'investigate' | 'abort';
  analysis: string;
  action?: Action;
  concerns?: string[];
}
