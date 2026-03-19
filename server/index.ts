import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { createApp } from "./app.js";
import type { AccessMode } from "./network.js";
import { SessionStore } from "./store.js";

const ROOT_DIR = process.cwd();

async function main() {
  const accessMode = process.env.ACCESS_MODE === "lan" ? "lan" : "localhost";
  const store = new SessionStore({
    codexHome: process.env.CODEX_HOME
  });
  await store.reindex();

  const app = createApp(store, accessMode as AccessMode);
  const clientDir = join(ROOT_DIR, "dist", "client");

  if (existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get(/^(?!\/api).*/, (_request, response) => {
      response.sendFile(join(clientDir, "index.html"));
    });
  }

  const host = process.env.HOST || (accessMode === "lan" ? "0.0.0.0" : "127.0.0.1");
  const port = Number(process.env.PORT) || 4318;

  app.listen(port, host, () => {
    console.log(`Codex Session Browser listening on http://${host}:${port} (${accessMode})`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
