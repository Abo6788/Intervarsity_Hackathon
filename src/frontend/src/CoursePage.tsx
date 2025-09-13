import { useMemo } from "react";
import "./CoursePage.css";

type Row = {
  task: string;
  dateSubmitted: string;
  mark: number;
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithin(daysBack: number) {
  const now = new Date();
  const past = new Date(now);
  past.setDate(now.getDate() - randomInt(0, daysBack));
  return past.toISOString().slice(0, 10);
}

function makeRows(): Row[] {
  const tasks = ["Prac 1","Prac 2","Prac 3","Prac 4","Prac 5","Test 1","Test 2"];
  return tasks.map((task) => {
    let mark: number;
    const r = Math.random();
    if (r < 0.1) mark = randomInt(86, 100);        // top end
    else if (r > 0.9) mark = randomInt(35, 54);    // low end
    else mark = randomInt(55, 85);                 // main mass
    return { task, mark, dateSubmitted: randomDateWithin(90) };
  });
}

function overallAverage(rows: Row[]) {
  const total = rows.length || 1;
  return Math.round((rows.reduce((s, r) => s + r.mark, 0) / total) * 10) / 10;
}

function overallStatus(avg: number) {
  if (avg < 50) return { label: "At risk of failure", type: "at-risk" as const };
  if (avg < 65) return { label: "Possible failure", type: "possible" as const };
  return { label: "Likely to pass", type: "likely" as const };
}

/** Map a numeric mark to a badge name + emoji */
function badgeFor(mark: number) {
  if (mark < 50) return null;
  if (mark < 60) return { name: "Bronze",   emoji: "🥉", className: "badge bronze" };
  if (mark < 70) return { name: "Silver",   emoji: "🥈", className: "badge silver" };
  if (mark < 80) return { name: "Gold",     emoji: "🥇", className: "badge gold" };
  if (mark < 90) return { name: "Platinum", emoji: "⭐",  className: "badge platinum" };
  return            { name: "Diamond",  emoji: "💎", className: "badge diamond" };
}

export default function CoursePage({ studentId }: { studentId: string }) {
  const rows = useMemo(() => makeRows(), []);
  const avg = overallAverage(rows);
  const { label: statusLabel, type: statusType } = overallStatus(avg);

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
            <col style={{ width: "15%" }} /> {/* Badge */}
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
              const b = badgeFor(r.mark);
              return (
                <tr key={r.task}>
                  <td>{r.task}</td>
                  <td className="num">{r.mark}%</td>
                  <td>{r.dateSubmitted}</td>
                  <td><button className="btn">Insights</button></td>
                  <td>
                    {b ? (
                      <span className={b.className} title={`${b.name} (${r.mark}%)`}>
                        <span className="badge-emoji" aria-hidden>{b.emoji}</span>
                        <span className="badge-text">{b.name}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="progress-wrapper">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "100%" }} />
          </div>
          <div className="progress-caption">
            {rows.length}/{rows.length} submitted • 100%
          </div>
        </div>
      </div>
    </div>
  );
}
