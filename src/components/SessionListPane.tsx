import type { SessionSummary } from "../../shared/contracts";
import { formatDateTime, shortenPath } from "../lib/format";
import { Badge } from "./Badge";

type SessionListPaneProps = {
  sessions: SessionSummary[];
  total: number;
  loading: boolean;
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
};

export function SessionListPane({
  sessions,
  total,
  loading,
  selectedId,
  search,
  onSearchChange,
  onSelect
}: SessionListPaneProps) {
  return (
    <section className="panel panel-list">
      <div className="panel-heading panel-heading-inline">
        <div>
          <p className="eyebrow">Session Index</p>
          <h2>{total} 段会话</h2>
        </div>
        <label className="search-field">
          <span>搜索标题、目录、预览</span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="例如：taohuayuan / React / 介绍一下"
          />
        </label>
      </div>

      <div className="session-list" aria-busy={loading}>
        {sessions.length === 0 ? (
          <div className="empty-state">
            <h3>没有匹配到会话</h3>
            <p>可以清空筛选器，或者换一个关键词再试。</p>
          </div>
        ) : null}

        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={selectedId === session.id ? "session-card active" : "session-card"}
            onClick={() => onSelect(session.id)}
          >
            <div className="session-card-top">
              <Badge tone={session.sourceScope === "archived" ? "muted" : "accent"}>
                {session.sourceScope === "archived" ? "归档" : "活跃"}
              </Badge>
              <span>{formatDateTime(session.lastEventAt)}</span>
            </div>

            <h3>{session.title}</h3>
            <p>{session.preview}</p>

            <div className="session-card-meta">
              <span>{session.repoName}</span>
              <span>{shortenPath(session.cwd)}</span>
            </div>

            <div className="session-card-footer">
              <span>{session.source || "unknown"}</span>
              <span>{session.originator || "unknown"}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
