import { useRef, useState, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import type { SessionDetail } from "../../shared/contracts";
import { formatLongDateTime, shortenPath } from "../lib/format";
import { Badge } from "./Badge";

const COLLAPSE_THRESHOLD = 800; // characters

function CollapsibleBody({ text }: { text: string }) {
  const isLong = text.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(!isLong);

  return (
    <div className="chat-message-body">
      {isLong && !expanded ? (
        <>
          <div className="collapsed-preview">
            <Markdown>{text.slice(0, COLLAPSE_THRESHOLD) + "\n\n..."}</Markdown>
          </div>
          <button type="button" className="expand-btn" onClick={() => setExpanded(true)}>
            展开全文 ({Math.ceil(text.length / 1000)}k 字符)
          </button>
        </>
      ) : (
        <>
          <Markdown>{text}</Markdown>
          {isLong && (
            <button type="button" className="expand-btn" onClick={() => setExpanded(false)}>
              收起
            </button>
          )}
        </>
      )}
    </div>
  );
}

type DetailPaneProps = {
  detail: SessionDetail | null;
  loading: boolean;
  showRaw: boolean;
  onToggleRaw: () => void;
};

export function DetailPane({ detail, loading, showRaw, onToggleRaw }: DetailPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      setShowTop(el.scrollTop > 400);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, detail]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <section className="chat-stage">
        <div className="chat-empty">
          <h3>正在载入会话</h3>
          <p>正在整理消息顺序和去重后的 transcript。</p>
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="chat-stage">
        <div className="chat-empty">
          <h3>选择一段会话</h3>
          <p>左侧选中一个 session，右侧直接进入对话阅读模式。</p>
        </div>
      </section>
    );
  }

  const visibleEntries = showRaw ? detail.transcript : detail.transcript.filter((entry) => !entry.hiddenByDefault);

  return (
    <section className="chat-stage">
      <div className="chat-header">
        <div className="chat-header-main">
          <h2>{detail.summary.title}</h2>
          <div className="chat-header-meta">
            <span>{detail.summary.repoName}</span>
            <span>{shortenPath(detail.summary.cwd)}</span>
            <span>{formatLongDateTime(detail.summary.lastEventAt)}</span>
          </div>
        </div>
        <div className="chat-header-actions">
          <Badge tone="muted">{detail.summary.sourceScope === "archived" ? "归档" : "活跃"}</Badge>
          <button type="button" className="raw-toggle" onClick={onToggleRaw}>
            {showRaw ? "隐藏原始事件" : "显示原始事件"}
          </button>
        </div>
      </div>

      <div className="chat-info-strip">
        <Badge tone="muted">branch {detail.git?.branch || "unknown"}</Badge>
        <Badge tone="muted">commit {detail.git?.commitHash?.slice(0, 12) || "unknown"}</Badge>
        <Badge tone="muted">started {formatLongDateTime(detail.summary.startedAt)}</Badge>
      </div>

      {detail.parseWarnings.length > 0 ? (
        <div className="inline-warning compact">
          <Badge tone="accent">{detail.parseWarnings.length}</Badge>
          <span>本会话存在部分解析警告</span>
        </div>
      ) : null}

      <div className="chat-scroll" ref={scrollRef}>
        {visibleEntries.map((entry) => (
          <article key={entry.id} className={`chat-message role-${entry.role}`}>
            <div className="chat-message-inner">
              <div className="chat-message-meta">
                <div className="chat-message-badges">
                  <Badge
                    tone={entry.role === "assistant" ? "accent" : entry.role === "user" ? "default" : "muted"}
                  >
                    {entry.role}
                  </Badge>
                  {showRaw ? <Badge tone="muted">{entry.rawType}</Badge> : null}
                </div>
                <time dateTime={entry.timestamp}>{formatLongDateTime(entry.timestamp)}</time>
              </div>
              <CollapsibleBody text={entry.text} />
            </div>
          </article>
        ))}
      </div>

      {showTop && (
        <button type="button" className="scroll-top-btn" onClick={scrollToTop} aria-label="回到顶部">
          ↑ 顶部
        </button>
      )}
    </section>
  );
}
