import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { SessionStore } from "../server/store.js";
import { createFixtureCodexHome } from "./helpers.js";

test("SessionStore filters sessions and returns details", async () => {
  const fixture = createFixtureCodexHome();
  const store = new SessionStore({ codexHome: fixture.root });
  await store.reindex();

  const listPayload = store.list({ q: "demo-project" });
  assert.equal(listPayload.total, 1);
  assert.equal(listPayload.sessions.length, 1);
  assert.equal(listPayload.sessions[0].repoName, "demo-project");

  const detailPayload = store.getById(listPayload.sessions[0].id);
  assert.ok(detailPayload);
  assert.equal(detailPayload.summary.repoName, "demo-project");
});

test("SessionStore filters sessions by updated time range", async () => {
  const fixture = createFixtureCodexHome();
  const secondDir = join(fixture.root, "projects", "older-project");
  const secondFile = join(secondDir, "older-session.jsonl");

  mkdirSync(secondDir, { recursive: true });
  writeFileSync(
    secondFile,
    [
      JSON.stringify({
        type: "user",
        timestamp: "2026-01-05T09:00:00.000Z",
        sessionId: "older-session-id",
        cwd: "/workspace/older-project",
        gitBranch: "main",
        slug: "旧会话",
        message: {
          role: "user",
          content: [{ type: "text", text: "这是更早的一段会话" }]
        },
        uuid: "u-old",
        parentUuid: "",
        version: "1",
        userType: "external",
        isSidechain: false
      }),
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-01-05T09:05:00.000Z",
        sessionId: "older-session-id",
        cwd: "/workspace/older-project",
        gitBranch: "main",
        slug: "",
        message: {
          id: "msg-old",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "这是旧会话的回复。" }],
          model: "claude-opus-4-20250514",
          stop_reason: "end_turn"
        },
        uuid: "a-old",
        parentUuid: "u-old",
        version: "1",
        userType: "external",
        isSidechain: false
      })
    ].join("\n") + "\n",
    "utf8"
  );

  const store = new SessionStore({ codexHome: fixture.root });
  await store.reindex();

  const februaryOnly = store.list({
    from: "2026-02-01T00:00:00.000Z",
    to: "2026-03-31T23:59:59.999Z"
  });
  assert.equal(februaryOnly.total, 1);
  assert.equal(februaryOnly.sessions[0].repoName, "demo-project");

  const januaryOnly = store.list({
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-01-31T23:59:59.999Z"
  });
  assert.equal(januaryOnly.total, 1);
  assert.equal(januaryOnly.sessions[0].repoName, "older-project");
});
