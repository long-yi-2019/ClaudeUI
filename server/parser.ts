import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { SessionDetail, SessionSummary, SourceScope, TranscriptEntry } from "../shared/contracts.js";

/* ── Raw JSONL shape ── */

type ContentBlock = {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  tool_use_id?: string;
  thinking?: string;
};

type MessagePayload = {
  role?: string;
  content?: ContentBlock[] | string;
  id?: string;
  model?: string;
  stop_reason?: string;
  usage?: Record<string, unknown>;
};

type JsonLine = {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  message?: MessagePayload;
  slug?: string;
  userType?: string;
  toolUseResult?: unknown;
  uuid?: string;
  parentUuid?: string;
  version?: string;
};

/* ── Constants ── */

const ENVIRONMENT_BLOCK_RE = /<environment_context>[\s\S]*?<\/environment_context>/g;
const INSTRUCTIONS_BLOCK_RE = /<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>/g;
const OPEN_SPEC_BLOCK_RE = /<!-- OPENSPEC:START -->[\s\S]*?<!-- OPENSPEC:END -->/g;

const BOILERPLATE_MARKERS = [
  "AGENTS.md instructions",
  "Repository Guidelines",
  "OpenSpec Instructions",
  "<environment_context>",
  "<INSTRUCTIONS>",
  "system-reminder",
];

const TOOL_CODE_NAMES = new Set(["Write", "Edit", "write_to_file", "create_file", "insert_code_block"]);

/* ── Helpers ── */

function hashFallback(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function safeParseLine(raw: string, filePath: string, lineNumber: number, warnings: string[]): JsonLine | null {
  try {
    return JSON.parse(raw) as JsonLine;
  } catch {
    warnings.push(`Failed to parse ${filePath}:${lineNumber}`);
    return null;
  }
}

function cleanUserText(value: string): string {
  return value
    .replace(ENVIRONMENT_BLOCK_RE, " ")
    .replace(INSTRUCTIONS_BLOCK_RE, " ")
    .replace(OPEN_SPEC_BLOCK_RE, " ")
    .replace(/# AGENTS\.md instructions[^\n]*/g, " ")
    .replace(/##? Repository Guidelines[\s\S]*/g, " ")
    .replace(/<environment_context>[\s\S]*/g, " ")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, " ")
    .replace(/<[a-z-]+>[\s\S]*?<\/[a-z-]+>/g, " ")
    .replace(/\[Request interrupted by user[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBoilerplate(text: string): boolean {
  if (!text) return true;
  if (text.startsWith("[Request interrupted")) return true;
  if (text.startsWith("<local-command-caveat>")) return true;
  return BOILERPLATE_MARKERS.some((m) => text.includes(m));
}

function clampPreview(value: string, maxLength = 180): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

/* ── Content extraction ── */

function extractTextParts(content: ContentBlock[] | string | undefined): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
      parts.push(block.text.trim());
    }
  }
  return parts.join("\n\n");
}

function extractToolBlocks(content: ContentBlock[] | string | undefined): string[] {
  if (!Array.isArray(content)) return [];

  const blocks: string[] = [];
  for (const block of content) {
    if (block.type === "tool_use" && block.name && block.input) {
      if (TOOL_CODE_NAMES.has(block.name)) {
        const filePath = (block.input.file_path || block.input.path || "") as string;
        const code = (block.input.content || block.input.new_string || "") as string;
        if (code) {
          const lang = guessLang(filePath);
          const label = filePath ? basename(filePath) : block.name;
          blocks.push(`**${block.name}** → \`${label}\`\n\n\`\`\`${lang}\n${code}\n\`\`\``);
        }
      } else if (block.name === "Bash" || block.name === "execute_command") {
        const cmd = (block.input.command || "") as string;
        if (cmd) {
          blocks.push(`**${block.name}**\n\n\`\`\`bash\n${cmd}\n\`\`\``);
        }
      }
    }
  }
  return blocks;
}

function guessLang(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", java: "java",
    css: "css", html: "html", json: "json", md: "markdown",
    sh: "bash", yml: "yaml", yaml: "yaml", sql: "sql",
    toml: "toml", xml: "xml", vue: "vue", svelte: "svelte",
  };
  return map[ext] || ext;
}

/* ── Build transcript ── */

function buildTranscript(lines: JsonLine[]): TranscriptEntry[] {
  const raw: TranscriptEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineType = line.type;
    if (!lineType || lineType === "file-history-snapshot" || lineType === "progress" || lineType === "queue-operation") {
      continue;
    }

    const msg = line.message;
    if (!msg) continue;

    const timestamp = line.timestamp || new Date(0).toISOString();
    const content = msg.content;

    // Determine role
    let role: "user" | "assistant" | "developer" | "system";
    if (lineType === "user") role = "user";
    else if (lineType === "assistant") role = "assistant";
    else if (lineType === "system") role = "system";
    else continue;

    // Extract text
    const textPart = extractTextParts(content);
    const toolBlocks = role === "assistant" ? extractToolBlocks(content) : [];

    // For user lines with toolUseResult, these are tool results — hide by default
    const isToolResult = lineType === "user" && Boolean(line.toolUseResult);

    // Skip user lines that are only tool_result content blocks
    if (role === "user" && Array.isArray(content)) {
      const hasOnlyToolResults = content.every(
        (b) => typeof b === "object" && b !== null && (b as ContentBlock).type === "tool_result"
      );
      if (hasOnlyToolResults) {
        // Still add as hidden entry for raw view
        raw.push({
          id: `${timestamp}-${i}`,
          timestamp,
          kind: "event",
          role: "user",
          text: "[tool result]",
          rawType: "tool_result",
          rawPayload: msg,
          hiddenByDefault: true,
        });
        continue;
      }
    }

    // Skip thinking-only blocks
    if (role === "assistant" && !textPart && toolBlocks.length === 0) {
      if (Array.isArray(content) && content.some((b) => (b as ContentBlock).type === "thinking")) {
        raw.push({
          id: `${timestamp}-${i}`,
          timestamp,
          kind: "event",
          role: "assistant",
          text: "[thinking]",
          rawType: "thinking",
          rawPayload: msg,
          hiddenByDefault: true,
        });
      }
      continue;
    }

    // Combine text + tool blocks
    const combined = [textPart, ...toolBlocks].filter(Boolean).join("\n\n---\n\n");
    if (!combined) continue;

    // Clean boilerplate from user messages
    const finalText = role === "user" ? cleanUserText(combined) : combined;
    if (!finalText) continue;

    raw.push({
      id: `${timestamp}-${i}`,
      timestamp,
      kind: "message",
      role,
      text: finalText,
      rawType: lineType,
      rawPayload: msg,
      hiddenByDefault: isToolResult,
    });
  }

  return mergeConsecutive(raw);
}

/* ── Merge consecutive same-role messages ── */

function mergeConsecutive(entries: TranscriptEntry[]): TranscriptEntry[] {
  const merged: TranscriptEntry[] = [];

  for (const entry of entries) {
    const prev = merged[merged.length - 1];

    if (
      prev &&
      prev.role === entry.role &&
      prev.hiddenByDefault === entry.hiddenByDefault &&
      entry.kind === "message" &&
      prev.kind === "message"
    ) {
      // Merge into previous
      prev.text = prev.text + "\n\n" + entry.text;
      // Keep the later timestamp
      prev.timestamp = entry.timestamp;
    } else {
      merged.push({ ...entry });
    }
  }

  return merged;
}

/* ── Title / preview derivation ── */

function deriveTitleAndPreview(lines: JsonLine[], fallbackName: string): { title: string; preview: string } {
  let firstUserText = "";
  let latestAssistantText = "";

  for (const line of lines) {
    if (line.type === "user" && line.message) {
      const text = extractTextParts(line.message.content);
      const cleaned = cleanUserText(text);
      if (!firstUserText && cleaned && !isBoilerplate(cleaned)) {
        firstUserText = cleaned;
      }
    }
    if (line.type === "assistant" && line.message) {
      const text = extractTextParts(line.message.content);
      if (text) {
        latestAssistantText = clampPreview(text, 220);
      }
    }
  }

  const title = firstUserText || fallbackName;
  return {
    title: clampPreview(title, 72),
    preview: clampPreview(firstUserText || latestAssistantText || fallbackName, 200),
  };
}

/* ── Metadata extraction ── */

function extractMeta(lines: JsonLine[]) {
  // Get metadata from the first meaningful line
  const first = lines.find((l) => l.type === "user" || l.type === "assistant" || l.type === "system");
  return {
    sessionId: first?.sessionId || "",
    cwd: first?.cwd || "",
    gitBranch: first?.gitBranch || "",
    slug: first?.slug || "",
  };
}

/* ── Main export ── */

export function parseSessionFile(filePath: string, scope: SourceScope): SessionDetail {
  const warnings: string[] = [];
  const content = readFileSync(filePath, "utf8");
  const rawLines = content.split("\n").filter(Boolean);
  const lines = rawLines
    .map((line, index) => safeParseLine(line, filePath, index + 1, warnings))
    .filter((l): l is JsonLine => Boolean(l));

  if (lines.length === 0) {
    throw new Error(`Empty session file: ${filePath}`);
  }

  const meta = extractMeta(lines);
  const repoName = meta.cwd ? basename(meta.cwd) : "unknown";

  // Timestamps
  const timestamps = lines.map((l) => l.timestamp).filter(Boolean) as string[];
  const startedAt = timestamps[0] || new Date(0).toISOString();
  const lastEventAt = timestamps[timestamps.length - 1] || startedAt;

  const titlePreview = deriveTitleAndPreview(
    lines,
    `${repoName} ${new Date(startedAt).toLocaleDateString("zh-CN")}`
  );

  const transcript = buildTranscript(lines);
  const userMessageCount = transcript.filter((e) => e.role === "user" && e.kind === "message").length;
  const assistantMessageCount = transcript.filter((e) => e.role === "assistant" && e.kind === "message").length;

  const summary: SessionSummary = {
    id: `${scope}_${meta.sessionId || hashFallback(filePath)}`,
    filePath,
    sourceScope: scope,
    title: titlePreview.title,
    preview: titlePreview.preview,
    cwd: meta.cwd,
    repoName,
    branch: meta.gitBranch,
    originator: undefined,
    source: undefined,
    cliVersion: undefined,
    startedAt,
    lastEventAt,
    messageCount: transcript.filter((e) => !e.hiddenByDefault).length,
    userMessageCount,
    assistantMessageCount,
  };

  return {
    summary,
    git: {
      branch: meta.gitBranch,
    },
    transcript,
    parseWarnings: warnings,
  };
}
