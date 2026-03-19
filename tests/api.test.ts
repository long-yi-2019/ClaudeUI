import test from "node:test";
import assert from "node:assert/strict";

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
