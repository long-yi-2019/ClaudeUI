import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { SessionDetail, SessionSummary, SourceScope, TranscriptEntry } from "../shared/contracts.js";

type JsonLine = {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown>;
};

type SessionMetaPayload = {
  id?: string;
  timestamp?: string;
  cwd?: string;
  originator?: string;
  cli_version?: string;
  source?: string;
  git?: {
    repository_url?: string;
    branch?: string;
    commit_hash?: string;
  };
};

const ENVIRONMENT_BLOCK_RE = /<environment_context>[\s\S]*?<\/environment_context>/g;
const INSTRUCTIONS_BLOCK_RE = /<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>/g;
const OPEN_SPEC_BLOCK_RE = /<!-- OPENSPEC:START -->[\s\S]*?<!-- OPENSPEC:END -->/g;

const NOISY_EVENT_TYPES = new Set(["token_count", "task_started", "task_complete", "turn_context"]);

function hashFallback(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function safeParseLine(line: string, filePath: string, lineNumber: number, warnings: string[]): JsonLine | null {
  try {
    return JSON.parse(line) as JsonLine;
  } catch {
    warnings.push(`Failed to parse ${filePath}:${lineNumber}`);
    return null;
  }
}

function extractTextFromContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  const chunks = content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      const entry = item as Record<string, unknown>;
      const text = entry.text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean);

  return chunks.join("\n").trim();
}

function cleanUserText(value: string): string {
  return value
    .replace(ENVIRONMENT_BLOCK_RE, " ")
    .replace(INSTRUCTIONS_BLOCK_RE, " ")
    .replace(OPEN_SPEC_BLOCK_RE, " ")
    .replace(/# AGENTS\.md instructions[^\n]*/g, " ")
    .replace(/##? Repository Guidelines[\s\S]*/g, " ")
    .replace(/<environment_context>[\s\S]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyBoilerplate(text: string): boolean {
  if (!text) {
    return true;
  }

  return [
    "AGENTS.md instructions",
    "Repository Guidelines",
    "OpenSpec Instructions",
    "<environment_context>",
    "<INSTRUCTIONS>"
  ].some((marker) => text.includes(marker));
}

function clampPreview(value: string, maxLength = 180): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractMessageText(line: JsonLine): string {
  const payload = line.payload ?? {};
  const payloadType = payload.type;

  if (line.type === "response_item" && payloadType === "message") {
    return extractTextFromContent(payload.content);
  }

  if (line.type === "event_msg" && payload.type === "agent_message") {
    const message = payload.message;
    return typeof message === "string" ? message.trim() : "";
  }

  if (line.type === "event_msg" && payload.type === "user_message") {
    const message = payload.message;
    return typeof message === "string" ? message.trim() : "";
  }

  return "";
}

function deriveTitleAndPreview(lines: JsonLine[], fallbackName: string): { title: string; preview: string } {
  let threadName = "";
  let firstMeaningfulUser = "";
  let latestAssistant = "";

  for (const line of lines) {
    const payload = line.payload ?? {};
    const possibleThreadName = payload.thread_name;
    if (!threadName && typeof possibleThreadName === "string" && possibleThreadName.trim()) {
      threadName = possibleThreadName.trim();
    }

    if (line.type === "response_item" && payload.role === "user") {
      const rawText = extractMessageText(line);
      const cleaned = cleanUserText(rawText);
      if (!firstMeaningfulUser && cleaned && !isLikelyBoilerplate(cleaned)) {
        firstMeaningfulUser = cleaned;
      }
    }

    if (
      (line.type === "response_item" && payload.role === "assistant") ||
      (line.type === "event_msg" && payload.type === "agent_message")
    ) {
      const rawText = extractMessageText(line);
      if (rawText) {
        latestAssistant = clampPreview(rawText, 220);
      }
    }
  }

  const titleCandidate = threadName || firstMeaningfulUser || fallbackName;
  return {
    title: clampPreview(titleCandidate, 72),
    preview: clampPreview(firstMeaningfulUser || latestAssistant || fallbackName, 200)
  };
}

function deriveRepoName(meta: SessionMetaPayload): string {
  const repositoryUrl = meta.git?.repository_url;
  if (repositoryUrl) {
    const cleaned = repositoryUrl.split("/").pop()?.replace(/\.git$/i, "");
    if (cleaned) {
      return cleaned;
    }
  }

  const cwd = meta.cwd?.trim();
  return cwd ? basename(cwd) : "unknown";
}

function buildTranscript(lines: JsonLine[]): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];

  lines.forEach((line, index) => {
    if (!line.type) {
      return;
    }

    const payload = line.payload ?? {};
    const timestamp =
      line.timestamp ||
      (typeof payload.timestamp === "string" ? payload.timestamp : "") ||
      new Date(0).toISOString();

    if (line.type === "response_item" && payload.type === "message") {
      const text = extractMessageText(line);
      if (!text) {
        return;
      }

      const role =
        payload.role === "user" || payload.role === "assistant" || payload.role === "developer"
          ? payload.role
          : "system";

      entries.push({
        id: `${timestamp}-message-${index}`,
        timestamp,
        kind: "message",
        role,
        text,
        rawType: line.type,
        rawPayload: payload,
        hiddenByDefault: role === "developer"
      });
      return;
    }

    if (line.type === "event_msg") {
      const eventType = typeof payload.type === "string" ? payload.type : "event_msg";
      const text = extractMessageText(line);
      if (!text && NOISY_EVENT_TYPES.has(eventType)) {
        return;
      }

      entries.push({
        id: `${timestamp}-event-${index}`,
        timestamp,
        kind: "event",
        role: eventType === "agent_message" ? "assistant" : eventType === "user_message" ? "user" : "system",
        text: text || JSON.stringify(payload, null, 2),
        phase: typeof payload.phase === "string" ? payload.phase : undefined,
        rawType: eventType,
        rawPayload: payload,
        hiddenByDefault: eventType !== "agent_message" && eventType !== "user_message"
      });
      return;
    }
  });

  return dedupeTranscript(entries);
}

function normalizeTextForDedupe(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeTranscript(entries: TranscriptEntry[]): TranscriptEntry[] {
  const deduped: TranscriptEntry[] = [];

  for (const entry of entries) {
    const previous = deduped[deduped.length - 1];
    if (!previous) {
      deduped.push(entry);
      continue;
    }

    const sameRole = previous.role === entry.role;
    const sameText = normalizeTextForDedupe(previous.text) === normalizeTextForDedupe(entry.text);

    if (!sameRole || !sameText) {
      deduped.push(entry);
      continue;
    }

    const previousIsMessage = previous.kind === "message";
    const nextIsMessage = entry.kind === "message";

    if (!previousIsMessage && nextIsMessage) {
      deduped[deduped.length - 1] = entry;
    }
  }

  return deduped;
}

export function parseSessionFile(filePath: string, scope: SourceScope): SessionDetail {
  const warnings: string[] = [];
  const content = readFileSync(filePath, "utf8");
  const rawLines = content.split("\n").filter(Boolean);
  const lines = rawLines
    .map((line, index) => safeParseLine(line, filePath, index + 1, warnings))
    .filter((line): line is JsonLine => Boolean(line));

  const metaLine = lines.find((line) => line.type === "session_meta");
  if (!metaLine?.payload) {
    throw new Error(`Missing session_meta in ${filePath}`);
  }

  const meta = metaLine.payload as SessionMetaPayload;
  const startedAt = meta.timestamp || metaLine.timestamp || new Date(0).toISOString();
  const lastEventAt = [...lines]
    .reverse()
    .find((line) => line.timestamp)?.timestamp || startedAt;
  const repoName = deriveRepoName(meta);
  const titlePreview = deriveTitleAndPreview(lines, `${repoName} ${new Date(startedAt).toLocaleDateString("zh-CN")}`);
  const transcript = buildTranscript(lines);
  const userMessageCount = transcript.filter((entry) => entry.role === "user" && entry.kind === "message").length;
  const assistantMessageCount = transcript.filter(
    (entry) => entry.role === "assistant" && entry.kind === "message"
  ).length;

  const summary: SessionSummary = {
    id: `${scope}_${meta.id || hashFallback(filePath)}`,
    filePath,
    sourceScope: scope,
    title: titlePreview.title,
    preview: titlePreview.preview,
    cwd: meta.cwd || "",
    repoName,
    branch: meta.git?.branch,
    originator: meta.originator,
    source: meta.source,
    cliVersion: meta.cli_version,
    startedAt,
    lastEventAt,
    messageCount: transcript.filter((entry) => !entry.hiddenByDefault).length,
    userMessageCount,
    assistantMessageCount
  };

  return {
    summary,
    git: {
      repositoryUrl: meta.git?.repository_url,
      branch: meta.git?.branch,
      commitHash: meta.git?.commit_hash
    },
    transcript,
    parseWarnings: warnings
  };
}
