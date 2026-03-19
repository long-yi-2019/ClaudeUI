import type { FacetCounts, SourceScope } from "../../shared/contracts";

import { Badge } from "./Badge";

type FiltersPaneProps = {
  scope: "all" | SourceScope;
  repo: string;
  cwd: string;
  source: string;
  originator: string;
  facets: FacetCounts;
  warnings: string[];
  onScopeChange: (value: "all" | SourceScope) => void;
  onRepoChange: (value: string) => void;
  onCwdChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onOriginatorChange: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export function FiltersPane(props: FiltersPaneProps) {
  const {
    scope,
    repo,
    cwd,
    source,
    originator,
    facets,
    warnings,
    onScopeChange,
    onRepoChange,
    onCwdChange,
    onSourceChange,
    onOriginatorChange,
    onRefresh,
    refreshing
  } = props;

  return (
    <aside className="panel panel-filters">
      <div className="panel-heading">
        <p className="eyebrow">Archive Control</p>
        <h2>Codex 档案库</h2>
        <p className="panel-copy">本地读取 `~/.codex`，只做浏览，不触碰原始数据。</p>
      </div>

      <div className="scope-switch">
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

      <button type="button" className="refresh-button" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? "刷新中..." : "重建索引"}
      </button>

      {warnings.length > 0 ? (
        <div className="warning-card">
          <div className="warning-title">
            <Badge tone="accent">{warnings.length}</Badge>
            <span>解析警告</span>
          </div>
          <p>有少量文件被跳过，不影响其余会话浏览。</p>
        </div>
      ) : null}

      <div className="facet-group">
        <label htmlFor="repo-filter">项目</label>
        <select id="repo-filter" value={repo} onChange={(event) => onRepoChange(event.target.value)}>
          <option value="">全部项目</option>
          {facets.repos.map((item) => (
            <option key={item.value} value={item.value}>
              {item.value} ({item.count})
            </option>
          ))}
        </select>
      </div>

      <div className="facet-group">
        <label htmlFor="cwd-filter">目录</label>
        <select id="cwd-filter" value={cwd} onChange={(event) => onCwdChange(event.target.value)}>
          <option value="">全部目录</option>
          {facets.cwds.map((item) => (
            <option key={item.value} value={item.value}>
              {item.value}
            </option>
          ))}
        </select>
      </div>

      <div className="facet-group">
        <label htmlFor="source-filter">来源</label>
        <select id="source-filter" value={source} onChange={(event) => onSourceChange(event.target.value)}>
          <option value="">全部来源</option>
          {facets.sources.map((item) => (
            <option key={item.value} value={item.value}>
              {item.value} ({item.count})
            </option>
          ))}
        </select>
      </div>

      <div className="facet-group">
        <label htmlFor="originator-filter">入口</label>
        <select
          id="originator-filter"
          value={originator}
          onChange={(event) => onOriginatorChange(event.target.value)}
        >
          <option value="">全部入口</option>
          {facets.originators.map((item) => (
            <option key={item.value} value={item.value}>
              {item.value} ({item.count})
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
