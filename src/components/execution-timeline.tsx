import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useRunStore } from "../store/run-store";

export default function ExecutionTimeline() {
  const { timelineEvents, inspect, status } = useRunStore();
  const [expanded, setExpanded] = useState(false);

  if (timelineEvents.length === 0 && status === "idle") {
    return null;
  }

  return (
    <div className={`execution-timeline-bar ${expanded ? "expanded" : ""}`}>
      <div className="timeline-bar-header" onClick={() => setExpanded((x) => !x)}>
        <div className="timeline-header-left">
          <History size={14} className="timeline-icon" />
          <span className="timeline-title">EXECUTION TIMELINE</span>
          <span className="timeline-count-chip">{timelineEvents.length} events</span>
        </div>

        <div className="timeline-header-center">
          {timelineEvents.slice(-3).map((evt) => (
            <div
              key={evt.id}
              className={`timeline-mini-event ${evt.status}`}
              onClick={(e) => {
                e.stopPropagation();
                if (evt.agentId !== "system") inspect(evt.agentId);
              }}
            >
              <span className="mini-event-dot" />
              <span className="mini-event-time">{evt.timestamp}</span>
              <span className="mini-event-name">{evt.agentName}</span>
              {evt.status === "completed" ? (
                <Check size={10} className="status-icon success" />
              ) : evt.status === "processing" ? (
                <Loader2 size={10} className="status-icon spin" />
              ) : evt.status === "retrying" ? (
                <RotateCcw size={10} className="status-icon warning" />
              ) : evt.status === "failed" ? (
                <AlertCircle size={10} className="status-icon error" />
              ) : (
                <Clock size={10} className="status-icon" />
              )}
            </div>
          ))}
        </div>

        <button
          className="timeline-toggle-button"
          aria-label={expanded ? "Collapse timeline" : "Expand timeline"}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="timeline-events-drawer" role="log" aria-label="Detailed execution history">
          <div className="timeline-events-list">
            {timelineEvents.map((evt) => (
              <div
                key={evt.id}
                className={`timeline-row ${evt.status}`}
                onClick={() => {
                  if (evt.agentId !== "system") inspect(evt.agentId);
                }}
              >
                <span className="timeline-stamp mono">{evt.timestamp}</span>
                <span className={`timeline-badge ${evt.status}`}>
                  {evt.status.toUpperCase()}
                </span>
                <strong className="timeline-agent-name">{evt.agentName}</strong>
                <span className="timeline-detail">{evt.detail}</span>
                {evt.durationMs !== undefined && (
                  <span className="timeline-duration mono">{evt.durationMs}ms</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
