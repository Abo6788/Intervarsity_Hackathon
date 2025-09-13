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
    if (r < 0.1) mark = randomInt(86, 100);
    else if (r > 0.9) mark = randomInt(35, 54);
    else mark = randomInt(55, 85);

    return { task, mark, dateSubmitted: randomDateWithin(90) };
  });
}

function getStatus(avg: number) {
  if (avg < 50) return { label: "At risk of failure", type: "at-risk" };
  if (avg < 65) return { label: "Possible failure", type: "possible" };
  return { label: "Likely to pass", type: "likely" };
}

export default function CoursePage() {
  const rows = useMemo(() => makeRows(), []);
  const total = rows.length;

  const average =
    Math.round((rows.reduce((sum, r) => sum + r.mark, 0) / total) * 10) / 10;

  const { label: statusLabel, type: statusType } = getStatus(average);

  const progressPct = 100; // assume all tasks submitted

  return (
    <div className="course-page">
      <div className="course-container">
        <header className="course-header">
          <div className="header-left">
            <h1 className="course-code">EEE3095S</h1>
            <p className="student-id">EBRZEE006</p>
          </div>
          <div className="header-right">
            <div className="avg-card">
              <div className="avg-label">Overall Average</div>
              <div className="avg-value">{average}%</div>
            </div>
            <div className={`status overall ${statusType}`}>{statusLabel}</div>
          </div>
        </header>

        <table className="marks-table">
          <colgroup>
            <col style={{ width: "30%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "35%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>

          <thead>
            <tr>
              <th>Task</th>
              <th>Mark</th>
              <th>Date Submitted</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.task}>
                <td>{r.task}</td>
                <td className="num">{r.mark}%</td>
                <td>{r.dateSubmitted}</td>
                <td>
                  <button className="btn">Insights</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="progress-wrapper">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="progress-caption">
            {total}/{total} submitted • {progressPct}%
          </div>
        </div>
      </div>
    </div>
  );
}
