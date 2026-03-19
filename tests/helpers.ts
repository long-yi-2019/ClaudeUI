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
  repoUrl?: string;
};

export function createFixtureCodexHome(options: SessionOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), "codex-session-browser-"));
  const activeDir = join(root, "sessions", "2026", "03", "19");
  const archivedDir = join(root, "archived_sessions");

  mkdirSync(activeDir, { recursive: true });
  mkdirSync(archivedDir, { recursive: true });

  const targetDir = options.archived ? archivedDir : activeDir;
  const filePath = join(targetDir, "rollout-2026-03-19T10-00-00-demo.jsonl");
  const scopeSource = options.archived ? "vscode" : "cli";

  const lines = [
    JSON.stringify({
      timestamp: "2026-03-19T10:00:00.000Z",
      type: "session_meta",
      payload: {
        id: "demo-session-id",
        timestamp: "2026-03-19T10:00:00.000Z",
        cwd: options.cwd || "/workspace/demo-project",
        originator: "codex-tui",
        cli_version: "0.115.0",
        source: scopeSource,
        git: {
          repository_url: options.repoUrl || "https://example.com/demo-project.git",
          branch: "main",
          commit_hash: "1234567890abcdef"
        }
      }
    }),
    JSON.stringify({
      timestamp: "2026-03-19T10:00:01.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        thread_name: options.title,
        content: [{ type: "input_text", text: options.userPrompt || "请帮我做一个会话浏览器" }]
      }
    }),
    JSON.stringify({
      timestamp: "2026-03-19T10:00:02.000Z",
      type: "event_msg",
      payload: {
        type: "agent_message",
        message: options.assistantReply || "可以，先把 session 列表和详情页做起来。"
      }
    })
  ];

  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return { root, filePath };
}
