// Minimal API client the frontend will use.
// Adjust BASE if your backend runs on a different origin/port.
const BASE = "http://localhost:8000/api";

export type AssessmentRow = {
  id_assessment: number;
  task: string;           // backend can send, or we can derive e.g. "Assessment 1752"
  date_submitted: string; // ISO date "YYYY-MM-DD"
  score: number;          // 0..100
};

export type StudentSummary = {
  studentId: string;
  average: number;        // overall average for this student
};



export async function checkStudentExists(studentId: string): Promise<boolean> {
  const res = await fetch(`${BASE}/students/${encodeURIComponent(studentId)}/exists`);
  if (!res.ok) throw new Error("Failed to check student");
  const data = await res.json();
  return Boolean(data.exists);
}

export async function getStudentAssessments(studentId: string): Promise<AssessmentRow[]> {
  const res = await fetch(`${BASE}/students/${encodeURIComponent(studentId)}/assessments`);
  if (!res.ok) throw new Error("Failed to load assessments");
  const data = await res.json();
  // Expected shape: { rows: AssessmentRow[] }
  const rows = Array.isArray(data.rows) ? data.rows : [];
  // Fallback: if task missing, label by id_assessment
  return rows.map((r: any) => ({
    id_assessment: r.id_assessment,
    task: r.task ?? `Assessment ${r.id_assessment}`,
    date_submitted: (r.date_submitted ?? "").slice(0, 10),
    score: Number(r.score ?? 0),
  }));
}

export async function getStudentSummary(studentId: string): Promise<StudentSummary> {
  const res = await fetch(`${BASE}/students/${encodeURIComponent(studentId)}/summary`);
  if (!res.ok) throw new Error("Failed to load summary");
  const data = await res.json();
  return {
    studentId: String(data.studentId ?? studentId),
    average: Number(data.average ?? 0),
  };
}
