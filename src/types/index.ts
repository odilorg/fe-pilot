// Core action types - v2.1.0: Universal form handling
export type ActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'           // Native <select> dropdowns
  | 'select_option'    // Custom dropdown (auto-detects native vs custom)
  | 'fill_date'        // Date picker support (native + custom)
  | 'upload'
  | 'wait'
  | 'wait_for'         // Smart wait strategies
  | 'screenshot'
  | 'scroll'
  | 'hover'
  | 'verify'
  | 'assert'           // Assertion steps
  | 'check_form'       // Form validation check
  | 'press_key'        // Keyboard actions
  // NEW v2.1: Universal form actions
  | 'fill_field'       // Smart field filler (auto-detects type)
  | 'auto_fill_form'   // Fill entire form with data object
  | 'toggle'           // Toggle checkbox/switch/radio
  | 'clear'            // Clear field value
  | 'focus'            // Focus element
  | 'blur';            // Blur element (unfocus)

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
  | 'dom_stable'
  | 'form_ready';      // NEW: Wait for form to be interactive

// Assertion types - EXPANDED
export type AssertionType =
  | 'element_visible'
  | 'element_hidden'
  | 'element_text'
  | 'element_value'    // NEW: Check input value
  | 'element_enabled'  // NEW: Check if enabled
  | 'element_disabled' // NEW: Check if disabled
  | 'element_checked'  // NEW: Check if checked
  | 'element_count'
  | 'count'            // Alias for element_count
  | 'url_is'
  | 'url_contains'
  | 'url_matches'
  | 'title_is'
  | 'title_contains'
  | 'no_console_errors'
  | 'no_validation_errors'
  | 'form_valid'
  | 'form_complete'    // NEW: All required fields filled
  | 'network_success'
  | 'cookie_exists'
  | 'cookie_has'       // Alias
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
  // Smart wait options
  wait_for?: WaitForOptions | WaitForOptions[];
  // Dropdown options
  dropdown?: string;           // For select_option: dropdown trigger selector
  option?: string;             // For select_option: option to select (text)
  option_index?: number;       // For select_option: select by index
  // Date picker options
  date?: string;               // For fill_date: date value (ISO or formatted)
  date_format?: string;        // For fill_date: format string
  datepicker?: boolean;        // Force custom datepicker handling
  // Assertion options
  assert_type?: AssertionType;
  expected?: string | number | boolean;
  // Key press options
  key?: string;                // For press_key: key to press
  modifiers?: string[];        // For press_key: modifier keys (Ctrl, Shift, Alt)
  // Timeout override
  timeout?: number;
  // NEW v2.1: Universal form options
  data?: Record<string, any>;  // For auto_fill_form: data to fill
  checked?: boolean;           // For toggle: target state
  clear?: boolean;             // For type/fill_field: clear before typing (default: true)
  delay?: number;              // For type: typing delay in ms
  force?: boolean;             // Force action on disabled/hidden elements
  direction?: 'top' | 'bottom';// For scroll: direction
  wait_until?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit'; // For navigate
  condition?: WaitCondition;   // For wait: wait condition
}

// Smart wait options
export interface WaitForOptions {
  condition: WaitCondition;
  selector?: string;
  value?: string;
  timeout?: number;
}

export interface Expectation {
  type: 'element_visible' | 'no_console_errors' | 'network_success' | 'url_changed' | 'element_text'
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
  requestBody?: string;
  responseBody?: string;
  errorType?: 'timeout' | 'cors' | 'server_error' | 'client_error' | 'network_error';
}

// Form validation state
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
  disabled?: boolean;  // NEW
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
  dropdowns?: DropdownInfo[];
  datePickers?: DatePickerInfo[];
  forms?: FormInfo[];
  modals?: ModalInfo[];
  loadingIndicators?: string[];
}

export interface DropdownInfo {
  trigger: string;
  isOpen: boolean;
  options: string[];
  selectedValue?: string;
  type: 'native' | 'custom' | 'autocomplete';
}

export interface DatePickerInfo {
  input: string;
  type: 'native' | 'custom' | 'calendar';
  currentValue?: string;
  format?: string;
}

export interface FormInfo {
  selector: string;
  fields: number;
  filledFields: number;
  requiredFields: number;
  filledRequired: number;
  hasValidationErrors: boolean;
  submitButton?: string;
}

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
  formValidation?: FormValidation;
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
  retryCount?: number;
  assertions?: AssertionResult[];
  formValidation?: FormValidation;
}

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
    validationErrors: number;
    assertionsPassed: number;
    assertionsFailed: number;
    retriedSteps: number;
  };
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
