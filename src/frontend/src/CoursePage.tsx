import { useEffect, useMemo, useState } from "react";
import "./CoursePage.css";
import type { AssessmentRow } from "./api";
import { getStudentAssessments, getStudentSummary, getAssessmentAnalytics } from "./api";

type Props = { studentId: string };

function overallStatus(avg: number) {
  if (avg < 50) return { label: "At risk of failure", type: "at-risk" as const };
  if (avg < 65) return { label: "Possible failure", type: "possible" as const };
  return { label: "Likely to pass", type: "likely" as const };
}

/** Map a numeric mark to a badge name + emoji + class */
function badgeFor(mark: number) {
  if (mark < 50) return null;
  if (mark < 60) return { name: "Bronze",   emoji: "🥉", className: "badge bronze" };
  if (mark < 70) return { name: "Silver",   emoji: "🥈", className: "badge silver" };
  if (mark < 80) return { name: "Gold",     emoji: "🥇", className: "badge gold" };
  if (mark < 90) return { name: "Platinum", emoji: "⭐",  className: "badge platinum" };
  return            { name: "Diamond",  emoji: "💎", className: "badge diamond" };
}

type Analytics = {
  bins: number[];
  counts: number[];
  student_score: number;
  percentile: number;
  status: string;
  position_in_status?: number | null;
  group_size_in_status?: number | null;
};

export default function CoursePage({ studentId }: Props) {
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [avg, setAvg] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [fetchingAnalytics, setFetchingAnalytics] = useState(false);
  const [analyticsErr, setAnalyticsErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const [assessments, summary] = await Promise.all([
          getStudentAssessments(studentId),
          getStudentSummary(studentId),
        ]);
        if (!cancelled) {
          setRows(assessments);
          setAvg(Number.isFinite(summary.average) ? summary.average : 0);
        }
      } catch (e) {
        if (!cancelled) setErr("Failed to load student data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const { label: statusLabel, type: statusType } = overallStatus(avg);
  const progressPct = rows.length > 0 ? 100 : 0;

  function openInsights(row: AssessmentRow) {
    setShowModal(true);
    setModalTitle(`${row.task} — Assessment ${row.id_assessment}`);
    setAnalytics(null);
    setAnalyticsErr(null);
    setFetchingAnalytics(true);
    getAssessmentAnalytics(row.id_assessment, studentId)
      .then((a) => setAnalytics(a))
      .catch(() => setAnalyticsErr("Unable to load analytics."))
      .finally(() => setFetchingAnalytics(false));
  }

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="course-page">
        <div className="course-container">
          <header className="course-header">
            <div>
              <h1 className="course-code">EEE3095S</h1>
              <p className="student-id">{studentId}</p>
            </div>
            <div className="header-right">
              <div className="avg-card">
                <div className="avg-label">Overall Average</div>
                <div className="avg-value">—</div>
              </div>
              <div className="status overall possible">Loading…</div>
            </div>
          </header>
          <p>Loading assessments…</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="course-page">
        <div className="course-container">
          <header className="course-header">
            <div>
              <h1 className="course-code">EEE3095S</h1>
              <p className="student-id">{studentId}</p>
            </div>
            <div className="header-right">
              <div className="avg-card">
                <div className="avg-label">Overall Average</div>
                <div className="avg-value">—</div>
              </div>
              <div className="status overall at-risk">Error</div>
            </div>
          </header>
          <p>{err}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="course-page">
      <div className="course-container">
        <header className="course-header">
          <div className="header-left">
            <h1 className="course-code">EEE3095S</h1>
            <p className="student-id">{studentId}</p>
          </div>
          <div className="header-right">
            <div className="avg-card">
              <div className="avg-label">Overall Average</div>
              <div className="avg-value">{avg}%</div>
            </div>
            <div className={`status overall ${statusType}`}>{statusLabel}</div>
          </div>
        </header>

        <table className="marks-table">
          <colgroup>
            <col style={{ width: "28%" }} /> {/* Task */}
            <col style={{ width: "14%" }} /> {/* Mark */}
            <col style={{ width: "28%" }} /> {/* Date */}
            <col style={{ width: "15%" }} /> {/* Action */}
            <col style={{ width: "15%" }} /> {/* Badge (right-most) */}
          </colgroup>

          <thead>
            <tr>
              <th>Task</th>
              <th>Mark</th>
              <th>Date Submitted</th>
              <th>Action</th>
              <th>Badge</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const b = badgeFor(r.score);
              return (
                <tr key={r.id_assessment}>
                  <td>{r.task}</td>
                  <td className="num">{r.score}%</td>
                  <td>{r.date_submitted}</td>
                  <td>
                    <button className="btn" onClick={() => openInsights(r)}>Insights</button>
                  </td>
                  <td>
                    {b ? (
                      <span className={b.className} title={`${b.name} (${r.score}%)`}>
                        <span className="badge-emoji" aria-hidden>{b.emoji}</span>
                        <span className="badge-text">{b.name}</span>
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="progress-wrapper">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="progress-caption">
            {rows.length}/{rows.length} submitted • {progressPct}%
          </div>
        </div>
      </div>

      {/* -------- Modal for Insights -------- */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 16px",
            zIndex: 999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(900px, 96vw)",   // wider modal
              maxHeight: "90vh",           // keeps it from overflowing screen vertically
              overflowY: "auto",           // scroll if content taller than screen
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 24,                 // a little more breathing space
              //marginTop: 32,
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{modalTitle}</h2>
              <button className="btn" onClick={() => setShowModal(false)}>Close</button>
            </div>

            {fetchingAnalytics && <p>Loading analytics…</p>}
            {analyticsErr && <p style={{ color: "#ef4444" }}>{analyticsErr}</p>}

            {analytics && (
              <>
                {/* Simple bar chart (CSS) */}
                <Histogram
                  bins={analytics.bins}
                  counts={analytics.counts}
                  studentScore={analytics.student_score}
                />

                <div style={{ marginTop: 12, fontSize: 14, color: "#0f172a" }}>
                  <strong>Student score:</strong> {analytics.student_score}% &nbsp;|&nbsp; 
                  <strong>Percentile:</strong> {analytics.percentile} &nbsp;|&nbsp; 
                  <strong>Status:</strong> {analytics.status}
                  {analytics.position_in_status && analytics.group_size_in_status ? (
                    <>
                      &nbsp;|&nbsp; <strong>Position in {analytics.status} group:</strong>{" "}
                      {analytics.position_in_status} / {analytics.group_size_in_status}
                    </>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** CSS bar chart using your theme colors */
function Histogram({
  bins,
  counts,
  studentScore,
}: {
  bins: number[];
  counts: number[];
  studentScore: number;
}) {
  const max = Math.max(...counts, 1);
  // Find the bin index where the studentScore falls
  let idx = 0;
  for (let i = 0; i < counts.length; i++) {
    const left = bins[i];
    const right = bins[i + 1];
    if (i === counts.length - 1) {
      // include right edge for last bin
      if (studentScore >= left && studentScore <= right) { idx = i; break; }
    }
    if (studentScore >= left && studentScore < right) { idx = i; break; }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180, padding: "8px 6px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        {counts.map((c, i) => {
          const h = Math.round((c / max) * 160) + 8;
          const isStudentBin = i === idx;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                title={`${bins[i]}–${bins[i + 1]}: ${c}`}
                style={{
                  width: "100%",
                  height: h,
                  background: isStudentBin ? "#0f172a" : "#22c55e",
                  opacity: isStudentBin ? 1 : 0.9,
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                }}
              />
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {bins[i]}–{bins[i + 1]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
