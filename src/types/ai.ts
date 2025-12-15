// AI Integration types for Phase 2

export interface AIObservation {
  stepNumber: number;
  timestamp: number;
  goal: string;
  currentUrl: string;
  screenshot: string;
  domState: {
    title: string;
    buttons: string[];
    inputs: string[];
    links: string[];
    visibleText: string[];
    interactiveElementsSummary?: {
      totalButtons: number;
      totalInputs: number;
      totalLinks: number;
      keyActions: string[];
      formStatus: string;
    };
  };
  consoleLogs: Array<{
    type: string;
    text: string;
    timestamp: number;
    location?: string;
  }>;
  networkRequests: Array<{
    url: string;
    method: string;
    status: number;
    duration: number;
  }>;
  newErrors: {
    consoleErrors: number;
    networkErrors: number;
  };
  performance?: {
    pageLoadTime: number;
    domContentLoaded: number;
  };
  previousActions: Array<{
    action: string;
    selector?: string;
    value?: string;
    url?: string;
    description?: string;
  }>;
}

export type AIDecision = 'continue' | 'fix_bug' | 'goal_achieved' | 'stuck' | 'abort';

export interface AIAction {
  decision: AIDecision;
  reasoning: string;
  action?: {
    action: string;
    selector?: string;
    element?: string; // Natural language element description
    value?: string;
    url?: string;
    description?: string;
  };
  actions?: Array<{  // NEW: Batched actions for efficiency
    action: string;
    selector?: string;
    element?: string;
    value?: string;
    url?: string;
    description?: string;
  }>;
  stopOnError?: boolean;  // NEW: Stop batch on first error (default: true)
  concerns?: string[];
  nextCheckpoint?: boolean;
  bugReport?: AIBugReport;
}

export interface AIBugReport {
  bugFound: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'console_error' | 'network_error' | 'visual_bug' | 'performance' | 'crash';
  description: string;
  evidence: {
    request?: string;
    response?: any;
    consoleError?: string;
    stackTrace?: string;
    screenshot?: string;
  };
  suggestedFix?: {
    file: string;
    issue: string;
    fix: string;
  };
}

export interface ExplorationGoal {
  objective: string;
  credentials?: {
    username: string;
    password: string;
  };
  maxSteps?: number;
  autoFix?: boolean;
  checkpointInterval?: number;
}

export interface ExplorationSession {
  sessionId: string;
  sessionDir: string;
  goal: ExplorationGoal;
  currentStep: number;
  status: 'running' | 'waiting_for_ai' | 'completed' | 'failed';
  startTime: number;
  observations: AIObservation[];
  actions: AIAction[];
  bugsFound: number;
  bugsFixed: number;
}
