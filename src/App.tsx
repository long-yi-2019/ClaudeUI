import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import type { SessionDetail, SessionListResponse, SourceScope } from "../shared/contracts";
import { DetailPane } from "./components/DetailPane";
import { Sidebar } from "./components/Sidebar";

type MobilePane = "sidebar" | "detail";

const EMPTY_FACETS = {
  repos: [],
  cwds: [],
  sources: [],
  originators: []
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export default function App() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [scope, setScope] = useState<"all" | SourceScope>("all");
  const [repo, setRepo] = useState("");
  const [cwd, setCwd] = useState("");
  const [source, setSource] = useState("");
  const [originator, setOriginator] = useState("");
  const [listState, setListState] = useState<SessionListResponse>({
    sessions: [],
    total: 0,
    page: 1,
    pageSize: 50,
    warnings: [],
    facets: EMPTY_FACETS
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("sidebar");
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (deferredSearch.trim()) {
      params.set("q", deferredSearch.trim());
    }
    if (scope !== "all") {
      params.set("scope", scope);
    }
    if (repo) {
      params.set("repo", repo);
    }
    if (cwd) {
      params.set("cwd", cwd);
    }
    if (source) {
      params.set("source", source);
    }
    if (originator) {
      params.set("originator", originator);
    }
    params.set("sort", "updated");
    params.set("order", "desc");
    params.set("pageSize", "50");
    return params.toString();
  }, [cwd, deferredSearch, originator, repo, scope, source]);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);

    requestJson<SessionListResponse>(`/api/sessions?${queryString}`)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setListState(payload);
        setError("");
        const fallback = payload.sessions[0] || null;
        startTransition(() => {
          setSelectedId((current) => (payload.sessions.some((session) => session.id === current) ? current : fallback?.id || null));
        });
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : String(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    requestJson<SessionDetail>(`/api/sessions/${encodeURIComponent(selectedId)}`)
      .then((payload) => {
        if (!cancelled) {
          setDetail(payload);
          setError("");
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : String(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleSelect = (id: string) => {
    startTransition(() => {
      setSelectedId(id);
      setMobilePane("detail");
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await requestJson<{ ok: boolean }>("/api/reindex", { method: "POST" });
      const refreshed = await requestJson<SessionListResponse>(`/api/sessions?${queryString}`);
      setListState(refreshed);
      if (selectedId) {
        const detailPayload = await requestJson<SessionDetail>(`/api/sessions/${encodeURIComponent(selectedId)}`);
        setDetail(detailPayload);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="chat-layout">
      <nav className="mobile-nav" aria-label="Mobile panes">
        {[
          { value: "sidebar", label: "会话" },
          { value: "detail", label: "对话" }
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            className={mobilePane === item.value ? "mobile-nav-button active" : "mobile-nav-button"}
            onClick={() => setMobilePane(item.value as MobilePane)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className={collapsed ? "chat-shell collapsed" : "chat-shell"}>
        <div className={mobilePane === "sidebar" ? "pane-mobile sidebar-pane visible" : "pane-mobile sidebar-pane"}>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? "▶" : "◀"}
          </button>
          {!collapsed && (
            <Sidebar
              scope={scope}
              repo={repo}
              cwd={cwd}
              source={source}
              originator={originator}
              facets={listState.facets}
              warnings={listState.warnings}
              refreshing={refreshing}
              total={listState.total}
              sessions={listState.sessions}
              selectedId={selectedId}
              loading={listLoading}
              search={search}
              onSearchChange={setSearch}
              onScopeChange={setScope}
              onRepoChange={setRepo}
              onCwdChange={setCwd}
              onSourceChange={setSource}
              onOriginatorChange={setOriginator}
              onRefresh={handleRefresh}
              onSelect={handleSelect}
            />
          )}
        </div>

        <div className={mobilePane === "detail" ? "pane-mobile visible" : "pane-mobile"}>
          {error ? <div className="global-error in-chat">{error}</div> : null}
          <DetailPane
            detail={detail}
            loading={detailLoading}
            showRaw={showRaw}
            onToggleRaw={() => setShowRaw((value) => !value)}
          />
        </div>
      </main>
    </div>
  );
}
