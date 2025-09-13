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
  const d = past.toISOString().split("T")[0];
  return d;
}

function generateRows(): Row[] {
  const tasks = [
    "Lab 1",
    "Lab 2",
    "Lab 3",
    "Quiz 1",
    "Quiz 2",
    "Assignment 1",
    "Assignment 2",
    "Project Milestone",
  ];
  return tasks.map((t) => ({
    task: t,
    dateSubmitted: randomDateWithin(40),
    mark: randomInt(50, 95),
  }));
}

export default function CoursePage({ studentId }: { studentId: string }) {
  const rows = useMemo(() => generateRows(), []);
  const total = rows.length;
  const average = Math.round(
    rows.reduce((s, r) => s + r.mark, 0) / Math.max(total, 1)
  );

  const statusType =
    average >= 75 ? "good" : average >= 60 ? "ok" : average >= 50 ? "warn" : "bad";
  const statusLabel =
    average >= 75 ? "Excellent" : average >= 60 ? "On track" : average >= 50 ? "At risk" : "Failing";

  const progressPct = Math.round((rows.length / total) * 100);

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
              <div className="avg-value">{average}%</div>
            </div>
            <div className={`status overall ${statusType}`}>{statusLabel}</div>
          </div>
        </header>

        <div className="toolbar">
          <input className="search-input" placeholder="Search assessments…" />
          <button className="btn">Export CSV</button>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Date Submitted</th>
                <th>Mark</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.task}</td>
                  <td>{r.dateSubmitted}</td>
                  <td>
                    <span className={`badge ${r.mark >= 75 ? "good" : r.mark >= 60 ? "ok" : r.mark >= 50 ? "warn" : "bad"}`}>
                      {r.mark}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="progress-caption">
            {total}/{total} submitted • {progressPct}%
          </div>
        </div>
      </div>
    </div>
  );
}
