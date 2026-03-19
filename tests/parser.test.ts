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
    title: "归档记录",
    userPrompt: "帮我找出之前讨论过的 UI 方案"
  });

  const detail = parseSessionFile(fixture.filePath, "archived");
  assert.equal(detail.summary.sourceScope, "archived");
  assert.equal(detail.summary.title, "归档记录");
});

test("parseSessionFile removes adjacent duplicate event and message entries", () => {
  const fixture = createFixtureCodexHome({
    userPrompt: "重复测试"
  });

  const duplicatedFile = `${fixture.filePath}.dup`;
  const duplicatedContent = [
    "{\"timestamp\":\"2026-03-19T10:00:00.000Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"dup-session\",\"timestamp\":\"2026-03-19T10:00:00.000Z\",\"cwd\":\"/workspace/demo-project\",\"source\":\"cli\"}}",
    "{\"timestamp\":\"2026-03-19T10:00:01.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"重复测试\"}}",
    "{\"timestamp\":\"2026-03-19T10:00:01.100Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"重复测试\"}]}}",
    "{\"timestamp\":\"2026-03-19T10:00:02.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"agent_message\",\"message\":\"好的\"}}",
    "{\"timestamp\":\"2026-03-19T10:00:02.100Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"好的\"}]}}"
  ].join("\n");

  writeFileSync(duplicatedFile, `${duplicatedContent}\n`, "utf8");

  const detail = parseSessionFile(duplicatedFile, "active");
  assert.equal(detail.transcript.length, 2);
  assert.equal(detail.transcript[0].role, "user");
  assert.equal(detail.transcript[1].role, "assistant");
});
