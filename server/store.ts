import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { FacetCounts, SessionDetail, SessionSummary, SourceScope } from "../shared/contracts.js";
import { parseSessionFile } from "./parser.js";

type QueryParams = {
  q?: string;
  scope?: "all" | SourceScope;
  cwd?: string;
  repo?: string;
  source?: string;
  originator?: string;
  from?: string;
  to?: string;
  sort?: "updated" | "started";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

type SessionStoreOptions = {
  codexHome?: string;
};

type IndexedSession = {
  detail: SessionDetail;
  haystack: string;
};

function walkJsonlFiles(root: string, recursive: boolean): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  for (const name of readdirSync(root)) {
    const filePath = join(root, name);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      if (recursive) {
        files.push(...walkJsonlFiles(filePath, recursive));
      }
      continue;
    }
    if (filePath.endsWith(".jsonl")) {
      files.push(filePath);
    }
  }
  return files;
}

function sortSessions(items: IndexedSession[], sort: "updated" | "started", order: "asc" | "desc"): IndexedSession[] {
  const factor = order === "asc" ? 1 : -1;
  const key = sort === "started" ? "startedAt" : "lastEventAt";
  return [...items].sort((left, right) => {
    const leftValue = left.detail.summary[key];
    const rightValue = right.detail.summary[key];
    if (leftValue === rightValue) {
      return left.detail.summary.id.localeCompare(right.detail.summary.id) * factor;
    }
    return (leftValue > rightValue ? 1 : -1) * factor;
  });
}

function buildFacets(items: IndexedSession[]): FacetCounts {
  const collect = (values: string[]): Array<{ value: string; count: number }> =>
    [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map<string, number>()).entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
      .slice(0, 12);

  return {
    repos: collect(items.map((item) => item.detail.summary.repoName).filter(Boolean)),
    cwds: collect(items.map((item) => item.detail.summary.cwd).filter(Boolean)),
    sources: collect(items.map((item) => item.detail.summary.source || "").filter(Boolean)),
    originators: collect(items.map((item) => item.detail.summary.originator || "").filter(Boolean))
  };
}

function safeIso(value?: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export class SessionStore {
  private readonly codexHome: string;
  private readonly detailMap = new Map<string, IndexedSession>();
  private warnings: string[] = [];

  constructor(options: SessionStoreOptions = {}) {
    this.codexHome = options.codexHome || `${process.env.HOME || ""}/.claude`;
  }

  async reindex(): Promise<void> {
    this.detailMap.clear();
    this.warnings = [];

    const targets: Array<{ scope: SourceScope; files: string[] }> = [
      {
        scope: "active",
        files: walkJsonlFiles(join(this.codexHome, "projects"), true)
      },
      {
        scope: "archived",
        files: walkJsonlFiles(join(this.codexHome, "archived_sessions"), false)
      }
    ];

    for (const target of targets) {
      for (const filePath of target.files) {
        try {
          const detail = parseSessionFile(filePath, target.scope);
          this.detailMap.set(detail.summary.id, {
            detail,
            haystack: [
              detail.summary.title,
              detail.summary.preview,
              detail.summary.repoName,
              detail.summary.cwd,
              detail.summary.branch,
              detail.summary.originator,
              detail.summary.source
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.warnings.push(`Skipped ${filePath}: ${message}`);
        }
      }
    }
  }

  list(query: QueryParams) {
    const scope = query.scope || "all";
    const q = query.q?.trim().toLowerCase() || "";
    const from = safeIso(query.from);
    const to = safeIso(query.to);
    const sort = query.sort || "updated";
    const order = query.order || "desc";
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));

    let items = [...this.detailMap.values()].filter((item) => {
      const summary = item.detail.summary;
      if (scope !== "all" && summary.sourceScope !== scope) {
        return false;
      }
      if (query.cwd && summary.cwd !== query.cwd) {
        return false;
      }
      if (query.repo && summary.repoName !== query.repo) {
        return false;
      }
      if (query.source && summary.source !== query.source) {
        return false;
      }
      if (query.originator && summary.originator !== query.originator) {
        return false;
      }
      if (from && summary.lastEventAt < from) {
        return false;
      }
      if (to && summary.lastEventAt > to) {
        return false;
      }
      if (q && !item.haystack.includes(q)) {
        return false;
      }
      return true;
    });

    const facets = buildFacets(items);
    items = sortSessions(items, sort, order);

    const startIndex = (page - 1) * pageSize;
    return {
      sessions: items.slice(startIndex, startIndex + pageSize).map((item) => item.detail.summary),
      total: items.length,
      page,
      pageSize,
      warnings: this.warnings,
      facets
    };
  }

  getById(id: string): SessionDetail | null {
    return this.detailMap.get(id)?.detail || null;
  }
}
