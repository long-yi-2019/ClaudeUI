import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

type SessionOptions = {
  archived?: boolean;
  title?: string;
  userPrompt?: string;
  assistantReply?: string;
  cwd?: string;
};

export function createFixtureCodexHome(options: SessionOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), "codex-session-browser-"));
  const activeDir = join(root, "projects", "test-project");
  const archivedDir = join(root, "archived_sessions");

  mkdirSync(activeDir, { recursive: true });
  mkdirSync(archivedDir, { recursive: true });

  const targetDir = options.archived ? archivedDir : activeDir;
  const filePath = join(targetDir, "test-session.jsonl");

  const ts1 = "2026-03-19T10:00:01.000Z";
  const ts2 = "2026-03-19T10:00:02.000Z";
  const cwd = options.cwd || "/workspace/demo-project";

  const lines = [
    JSON.stringify({
      type: "user",
      timestamp: ts1,
      sessionId: "demo-session-id",
      cwd,
      gitBranch: "main",
      slug: options.title || "",
      message: {
        role: "user",
        content: [{ type: "text", text: options.userPrompt || "请帮我做一个会话浏览器" }],
      },
      uuid: "u1",
      parentUuid: "",
      version: "1",
      userType: "external",
      isSidechain: false,
    }),
    JSON.stringify({
      type: "assistant",
      timestamp: ts2,
      sessionId: "demo-session-id",
      cwd,
      gitBranch: "main",
      slug: "",
      message: {
        id: "msg1",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: options.assistantReply || "可以，先把 session 列表和详情页做起来。" }],
        model: "claude-opus-4-20250514",
        stop_reason: "end_turn",
      },
      uuid: "a1",
      parentUuid: "u1",
      version: "1",
      userType: "external",
      isSidechain: false,
    }),
  ];

  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return { root, filePath };
}
