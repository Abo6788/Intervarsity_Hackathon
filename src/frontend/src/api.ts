// API base; set VITE_API_BASE in a .env to override
const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

/* ------------------------- Types ------------------------- */
export type AssessmentRow = {
  id_assessment: number;
  task: string;            // derived if backend sends null
  date_submitted: string;  // "Day N"
  score: number;           // 0..100
};

export type StudentSummary = {
  studentId: string;
  average: number;
  status: string;
  predicted_next: {
    id_assessment: number | null | undefined;
    score: number | null | undefined;
  };
};

export type AssessmentAnalytics = {
  assessment_id: number;
  bins: number[];
  counts: number[];
  student_score: number;
  percentile: number;
  status: string;
  position_in_status?: number | null;
  group_size_in_status?: number | null;
};

export type StudentRank = {
  position: number;       // 1 = best
  total: number;
  percentile: number;     // higher = better
  student_average: number;
  modules: string[];
};

/* ------------------------- Helpers ------------------------- */
function normRow(r: any): AssessmentRow {
  const id = Number(r.id_assessment);
  const task =
    typeof r.task === "string" && r.task.trim().length > 0
      ? r.task
      : `Assessment ${isFinite(id) ? id : ""}`.trim();
  const ds =
    typeof r.date_submitted === "string" && r.date_submitted.length > 0
      ? r.date_submitted
      : "";
  const score = Number(r.score ?? 0);
  return {
    id_assessment: id,
    task,
    date_submitted: ds,
    score: isFinite(score) ? score : 0,
  };
}

/* ------------------------- Calls ------------------------- */
export async function checkStudentExists(studentId: string): Promise<boolean> {
  const url = `${BASE}/students/${encodeURIComponent(studentId)}/exists`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`exists: HTTP ${res.status} ${res.statusText} ${text ? "- " + text : ""}`);
  }
  const data = await res.json();
  return Boolean(data.exists);
}

export async function getStudentAssessments(studentId: string): Promise<AssessmentRow[]> {
  const url = `${BASE}/students/${encodeURIComponent(studentId)}/assessments`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`assessments: HTTP ${res.status} ${res.statusText} ${text ? "- " + text : ""}`);
  }
  const data = await res.json();
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return rows.map(normRow);
}

export async function getStudentSummary(studentId: string): Promise<StudentSummary> {
  const url = `${BASE}/students/${encodeURIComponent(studentId)}/summary`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`summary: HTTP ${res.status} ${res.statusText} ${text ? "- " + text : ""}`);
  }
  return (await res.json()) as StudentSummary;
}

export async function getAssessmentAnalytics(assessmentId: number, studentId: string): Promise<AssessmentAnalytics> {
  const url = `${BASE}/assessments/${encodeURIComponent(assessmentId)}/analytics?student_id=${encodeURIComponent(
    studentId
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`analytics: HTTP ${res.status} ${res.statusText} ${text ? "- " + text : ""}`);
  }
  return (await res.json()) as AssessmentAnalytics;
}

export async function getStudentRank(studentId: string): Promise<StudentRank> {
  const url = `${BASE}/students/${encodeURIComponent(studentId)}/rank`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`rank: HTTP ${res.status} ${res.statusText} ${text ? "- " + text : ""}`);
  }
  return (await res.json()) as StudentRank;
}
