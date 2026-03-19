import express from "express";

import { SessionStore } from "./store.js";
import { createAccessGuard, type AccessMode } from "./network.js";

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

export function createApp(store: SessionStore, accessMode: AccessMode = "localhost") {
  const app = express();
  app.set("trust proxy", false);
  app.use(createAccessGuard(accessMode));
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/sessions", (request, response) => {
    response.json(
      store.list({
        q: firstQueryValue(request.query.q),
        scope: firstQueryValue(request.query.scope) as "all" | "active" | "archived" | undefined,
        cwd: firstQueryValue(request.query.cwd),
        repo: firstQueryValue(request.query.repo),
        source: firstQueryValue(request.query.source),
        originator: firstQueryValue(request.query.originator),
        from: firstQueryValue(request.query.from),
        to: firstQueryValue(request.query.to),
        sort: firstQueryValue(request.query.sort) as "updated" | "started" | undefined,
        order: firstQueryValue(request.query.order) as "asc" | "desc" | undefined,
        page: Number(firstQueryValue(request.query.page)),
        pageSize: Number(firstQueryValue(request.query.pageSize))
      })
    );
  });

  app.get("/api/sessions/:id", (request, response) => {
    const detail = store.getById(request.params.id);
    if (!detail) {
      response.status(404).json({ message: "Session not found" });
      return;
    }
    response.json(detail);
  });

  app.post("/api/reindex", async (_request, response) => {
    await store.reindex();
    response.json({ ok: true });
  });

  return app;
}
