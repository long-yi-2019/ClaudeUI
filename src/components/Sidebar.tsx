import type { FacetCounts, SessionSummary, SourceScope } from "../../shared/contracts";
import { formatDateTime } from "../lib/format";
import { Badge } from "./Badge";

type SidebarProps = {
  scope: "all" | SourceScope;
  repo: string;
  cwd: string;
  source: string;
  originator: string;
  facets: FacetCounts;
  warnings: string[];
  refreshing: boolean;
  total: number;
  sessions: SessionSummary[];
  selectedId: string | null;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onScopeChange: (value: "all" | SourceScope) => void;
  onRepoChange: (value: string) => void;
  onCwdChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onOriginatorChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
};

export function Sidebar(props: SidebarProps) {
  const {
    scope,
    repo,
    cwd,
    source,
    originator,
    facets,
    warnings,
    refreshing,
    total,
    sessions,
    selectedId,
    loading,
    search,
    onSearchChange,
    onScopeChange,
    onRepoChange,
    onCwdChange,
    onSourceChange,
    onOriginatorChange,
    onRefresh,
    onSelect
  } = props;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <p className="sidebar-kicker">Codex Browser</p>
        <h1>会话</h1>
        <p className="sidebar-copy">像聊天列表一样浏览历史记录，真正的对话内容放在右侧主区域。</p>
      </div>

      <div className="sidebar-tools">
        <label className="sidebar-search">
          <span>搜索</span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索标题、项目、目录、内容"
          />
        </label>

        <div className="scope-switch compact">
          {[
            { value: "all", label: "全部" },
            { value: "active", label: "活跃" },
            { value: "archived", label: "归档" }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={scope === option.value ? "scope-pill active" : "scope-pill"}
              onClick={() => onScopeChange(option.value as "all" | SourceScope)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <details className="filter-drawer">
          <summary>筛选项</summary>
          <div className="filter-grid">
            <label>
              <span>项目</span>
              <select value={repo} onChange={(event) => onRepoChange(event.target.value)}>
                <option value="">全部项目</option>
                {facets.repos.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value} ({item.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>目录</span>
              <select value={cwd} onChange={(event) => onCwdChange(event.target.value)}>
                <option value="">全部目录</option>
                {facets.cwds.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>来源</span>
              <select value={source} onChange={(event) => onSourceChange(event.target.value)}>
                <option value="">全部来源</option>
                {facets.sources.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value} ({item.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>入口</span>
              <select value={originator} onChange={(event) => onOriginatorChange(event.target.value)}>
                <option value="">全部入口</option>
                {facets.originators.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value} ({item.count})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>

        <div className="sidebar-meta-row">
          <Badge tone="muted">{total} sessions</Badge>
          <button type="button" className="sidebar-refresh" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "刷新中..." : "刷新索引"}
          </button>
        </div>

        {warnings.length > 0 ? (
          <div className="sidebar-warning">
            <Badge tone="accent">{warnings.length}</Badge>
            <p>有少量文件解析失败，已自动跳过。</p>
          </div>
        ) : null}
      </div>

      <div className="conversation-list" aria-busy={loading}>
        {sessions.length === 0 ? (
          <div className="sidebar-empty">
            <h3>没有找到会话</h3>
            <p>换一个搜索词，或者把筛选项清掉。</p>
          </div>
        ) : null}

        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={selectedId === session.id ? "conversation-item active" : "conversation-item"}
            onClick={() => onSelect(session.id)}
          >
            <div className="conversation-item-top">
              <span className="conversation-repo">{session.repoName}</span>
              <span>{formatDateTime(session.lastEventAt)}</span>
            </div>
            <h3>{session.title}</h3>
            <p>{session.preview}</p>
            <div className="conversation-item-bottom">
              <Badge tone={session.sourceScope === "archived" ? "muted" : "accent"}>
                {session.sourceScope === "archived" ? "归档" : "活跃"}
              </Badge>
              <span>{session.originator || session.source || "unknown"}</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
