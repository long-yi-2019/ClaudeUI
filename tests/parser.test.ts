import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

import { parseSessionFile } from "../server/parser.js";
import { createFixtureCodexHome } from "./helpers.js";

test("parseSessionFile derives title and preview from meaningful user content", () => {
  const fixture = createFixtureCodexHome({
    userPrompt: "<environment_context>ignored</environment_context>\n我要查看最近的 codex 会话"
  });

  const detail = parseSessionFile(fixture.filePath, "active");
  assert.equal(detail.summary.sourceScope, "active");
  assert.match(detail.summary.title, /我要查看最近的 codex 会话/);
  assert.match(detail.summary.preview, /我要查看最近的 codex 会话/);
  assert.equal(detail.summary.repoName, "demo-project");
  assert.equal(detail.transcript.length, 2);
});

test("parseSessionFile supports archived sessions", () => {
  const fixture = createFixtureCodexHome({
    archived: true,
    userPrompt: "帮我找出之前讨论过的 UI 方案"
  });

  const detail = parseSessionFile(fixture.filePath, "archived");
  assert.equal(detail.summary.sourceScope, "archived");
});

test("parseSessionFile merges consecutive same-role messages", () => {
  const fixture = createFixtureCodexHome({
    userPrompt: "合并测试"
  });

  const cwd = "/workspace/demo-project";
  const lines = [
    JSON.stringify({
      type: "user",
      timestamp: "2026-03-19T10:00:01.000Z",
      sessionId: "merge-test",
      cwd,
      gitBranch: "main",
      message: { role: "user", content: [{ type: "text", text: "第一段" }] },
      uuid: "u1", parentUuid: "", version: "1", userType: "external", isSidechain: false,
    }),
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-03-19T10:00:02.000Z",
      sessionId: "merge-test",
      cwd,
      gitBranch: "main",
      message: { role: "assistant", content: [{ type: "text", text: "回复A" }] },
      uuid: "a1", parentUuid: "u1", version: "1", userType: "external", isSidechain: false,
    }),
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-03-19T10:00:03.000Z",
      sessionId: "merge-test",
      cwd,
      gitBranch: "main",
      message: { role: "assistant", content: [{ type: "text", text: "回复B" }] },
      uuid: "a2", parentUuid: "a1", version: "1", userType: "external", isSidechain: false,
    }),
  ];

  const mergeFile = `${fixture.filePath}.merge`;
  writeFileSync(mergeFile, `${lines.join("\n")}\n`, "utf8");

  const detail = parseSessionFile(mergeFile, "active");
  // user + merged assistant = 2 entries
  assert.equal(detail.transcript.filter(e => !e.hiddenByDefault).length, 2);
  assert.equal(detail.transcript[0].role, "user");
  assert.equal(detail.transcript[1].role, "assistant");
  assert.ok(detail.transcript[1].text.includes("回复A"));
  assert.ok(detail.transcript[1].text.includes("回复B"));
});

test("parseSessionFile extracts tool_use code blocks", () => {
  const fixture = createFixtureCodexHome({
    userPrompt: "代码测试"
  });

  const cwd = "/workspace/demo-project";
  const lines = [
    JSON.stringify({
      type: "user",
      timestamp: "2026-03-19T10:00:01.000Z",
      sessionId: "code-test",
      cwd,
      gitBranch: "main",
      message: { role: "user", content: [{ type: "text", text: "写个文件" }] },
      uuid: "u1", parentUuid: "", version: "1", userType: "external", isSidechain: false,
    }),
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-03-19T10:00:02.000Z",
      sessionId: "code-test",
      cwd,
      gitBranch: "main",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "我来创建文件。" },
          { type: "tool_use", name: "Write", input: { file_path: "/tmp/test.ts", content: "console.log('hello');" } },
        ],
      },
      uuid: "a1", parentUuid: "u1", version: "1", userType: "external", isSidechain: false,
    }),
  ];

  const codeFile = `${fixture.filePath}.code`;
  writeFileSync(codeFile, `${lines.join("\n")}\n`, "utf8");

  const detail = parseSessionFile(codeFile, "active");
  const assistantMsg = detail.transcript.find(e => e.role === "assistant");
  assert.ok(assistantMsg);
  assert.ok(assistantMsg.text.includes("console.log"));
  assert.ok(assistantMsg.text.includes("```"));
});
