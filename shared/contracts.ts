export type SourceScope = "active" | "archived";

export interface SessionSummary {
  id: string;
  filePath: string;
  sourceScope: SourceScope;
  title: string;
  preview: string;
  cwd: string;
  repoName: string;
  branch?: string;
  originator?: string;
  source?: string;
  cliVersion?: string;
  startedAt: string;
  lastEventAt: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
}

export interface TranscriptEntry {
  id: string;
  timestamp: string;
  kind: "message" | "event";
  role: "user" | "assistant" | "developer" | "system";
  text: string;
  phase?: string;
  rawType: string;
  rawPayload: unknown;
  hiddenByDefault: boolean;
}

export interface SessionDetail {
  summary: SessionSummary;
  git?: {
    repositoryUrl?: string;
    branch?: string;
    commitHash?: string;
  };
  transcript: TranscriptEntry[];
  parseWarnings: string[];
}

export interface FacetCounts {
  repos: Array<{ value: string; count: number }>;
  cwds: Array<{ value: string; count: number }>;
  sources: Array<{ value: string; count: number }>;
  originators: Array<{ value: string; count: number }>;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
  page: number;
  pageSize: number;
  warnings: string[];
  facets: FacetCounts;
}
