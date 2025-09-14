from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression

# -------------------------------------------------
# Config
# -------------------------------------------------
FRONTEND_ORIGIN = "http://localhost:5173"  # adjust if needed
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"

# Prefer repo-relative CSVs; fall back to your absolute Windows paths
REL_STUDENT_ASSESSMENTS = ASSETS_DIR / "studentAssessment.csv"
REL_STUDENT_REGISTRATION = ASSETS_DIR / "studentRegistration.csv"
REL_STUDENT_INFO = ASSETS_DIR / "studentInfo.csv"

ABS_STUDENT_ASSESSMENTS = Path(r"C:\Users\HP\OneDrive - University of Cape Town\Hackathon\Intervarsity_Hackathon\assets\studentAssessment.csv")
ABS_STUDENT_REGISTRATION = Path(r"C:\Users\HP\OneDrive - University of Cape Town\Hackathon\Intervarsity_Hackathon\assets\studentRegistration.csv")
ABS_STUDENT_INFO = Path(r"C:\Users\HP\OneDrive - University of Cape Town\Hackathon\Intervarsity_Hackathon\assets\studentInfo.csv")


def _load_csv(preferred: Path, fallback: Path) -> pd.DataFrame:
    if preferred.exists():
        return pd.read_csv(preferred)
    if fallback.exists():
        return pd.read_csv(fallback)
    raise FileNotFoundError(f"CSV not found at {preferred} or {fallback}")


# -------------------------------------------------
# Data load (once at startup)
# -------------------------------------------------
student_assessments: pd.DataFrame = _load_csv(REL_STUDENT_ASSESSMENTS, ABS_STUDENT_ASSESSMENTS)
student_registration: pd.DataFrame = _load_csv(REL_STUDENT_REGISTRATION, ABS_STUDENT_REGISTRATION)
student_info: pd.DataFrame = _load_csv(REL_STUDENT_INFO, ABS_STUDENT_INFO)

for df in (student_assessments, student_registration, student_info):
    df.columns = [c.strip() for c in df.columns]

# Extra merged view (for analytics / rank)
merged_df = pd.merge(
    student_assessments,
    student_info[["id_student", "code_module", "code_presentation"]],
    on="id_student",
    how="left",
)


# -------------------------------------------------
# Domain helpers
# -------------------------------------------------
def assign_status(score: float) -> str:
    if 0 <= score < 50:
        return "-"
    if 50 <= score < 60:
        return "bronze"
    if 60 <= score < 70:
        return "silver"
    if 70 <= score < 80:
        return "gold"
    if 80 <= score < 90:
        return "platinum"
    if 90 <= score <= 100:
        return "diamond"
    return "invalid"


# -------------------------------------------------
# API models
# -------------------------------------------------
class ExistsResponse(BaseModel):
    exists: bool


class AssessmentRow(BaseModel):
    id_assessment: int
    task: Optional[str] = None           # frontend can fall back to "Assessment {id}"
    date_submitted: Optional[str] = None # OULAD: "Day N"
    score: float


class AssessmentsResponse(BaseModel):
    rows: List[AssessmentRow]


class PredictedNext(BaseModel):
    id_assessment: Optional[int] = None
    score: Optional[float] = None


class StudentSummary(BaseModel):
    studentId: str
    average: float
    status: str
    predicted_next: PredictedNext


class ModulesResponse(BaseModel):
    count: int
    modules: List[str]


class AssessmentAnalytics(BaseModel):
    assessment_id: int
    bins: List[int]            # length N+1 (edges, e.g., [0,10,...,100])
    counts: List[int]          # length N
    student_score: float
    percentile: float
    status: str
    position_in_status: Optional[int] = None
    group_size_in_status: Optional[int] = None


class RankResponse(BaseModel):
    position: int          # 1 = best
    total: int
    percentile: float      # higher = better
    student_average: float
    modules: List[str]


# -------------------------------------------------
# FastAPI app
# -------------------------------------------------
app = FastAPI(title="Intervarsity Backend", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


# ---------- Students ----------
@app.get("/api/students/{student_id}/exists", response_model=ExistsResponse)
def student_exists(student_id: str):
    try:
        sid = int(student_id)
    except ValueError:
        return ExistsResponse(exists=False)
    exists = (student_assessments["id_student"] == sid).any()
    return ExistsResponse(exists=bool(exists))


@app.get("/api/students/{student_id}/assessments", response_model=AssessmentsResponse)
def student_assessments_table(student_id: str):
    try:
        sid = int(student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="student_id must be an integer")

    df = student_assessments.loc[student_assessments["id_student"] == sid].copy()
    if df.empty:
        return AssessmentsResponse(rows=[])

    df = df.sort_values("id_assessment")

    rows: List[AssessmentRow] = []
    for _, r in df.iterrows():
        # OULAD: date_submitted = days since module start
        date_val: Optional[str] = None
        if "date_submitted" in df.columns and pd.notna(r["date_submitted"]):
            try:
                date_val = f"Day {int(r['date_submitted'])}"
            except Exception:
                date_val = str(r["date_submitted"])

        rows.append(
            AssessmentRow(
                id_assessment=int(r["id_assessment"]),
                task=None,
                date_submitted=date_val,
                score=float(r["score"]),
            )
        )

    return AssessmentsResponse(rows=rows)


@app.get("/api/students/{student_id}/summary", response_model=StudentSummary)
def student_summary(student_id: str):
    try:
        sid = int(student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="student_id must be an integer")

    df = student_assessments.loc[student_assessments["id_student"] == sid].copy()
    if df.empty:
        return StudentSummary(
            studentId=str(student_id),
            average=0.0,
            status=assign_status(0.0),
            predicted_next=PredictedNext(),
        )

    avg = float(np.round(df["score"].mean(), 1))
    status = assign_status(avg)

    model_df = df.dropna(subset=["score", "id_assessment"]).copy()
    model_df["id_assessment"] = model_df["id_assessment"].astype(int)

    pred_id: Optional[int] = None
    pred_score: Optional[float] = None
    if len(model_df) >= 2:
        X = model_df["id_assessment"].to_numpy().reshape(-1, 1)
        y = model_df["score"].to_numpy()
        try:
            model = LinearRegression()
            model.fit(X, y)
            pred_id = int(model_df["id_assessment"].max()) + 1
            pred_score = float(round(model.predict(np.array([[pred_id]])).item(), 2))
        except Exception:
            pred_id, pred_score = None, None

    return StudentSummary(
        studentId=str(student_id),
        average=avg,
        status=status,
        predicted_next=PredictedNext(id_assessment=pred_id, score=pred_score),
    )


@app.get("/api/students/{student_id}/modules", response_model=ModulesResponse)
def student_completed_modules(student_id: str):
    try:
        sid = int(student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="student_id must be an integer")

    df = student_registration.loc[
        (student_registration["id_student"] == sid)
        & (student_registration["date_unregistration"].isna())
    ]
    if df.empty:
        return ModulesResponse(count=0, modules=[])

    mods = [str(m) for m in df["code_module"].tolist()]
    return ModulesResponse(count=len(mods), modules=mods)


# ---------- Assessment analytics for Insights modal ----------
@app.get("/api/assessments/{assessment_id}/analytics", response_model=AssessmentAnalytics)
def assessment_analytics(assessment_id: int, student_id: int = Query(...)):
    data = merged_df.loc[merged_df["id_assessment"] == assessment_id].dropna(subset=["score"])
    if data.empty:
        raise HTTPException(status_code=404, detail="Assessment not found or has no scores")

    stu_row = data.loc[data["id_student"] == student_id]
    if stu_row.empty:
        raise HTTPException(status_code=404, detail="Student did not attempt this assessment")

    student_score = float(stu_row.iloc[0]["score"])
    scores = data["score"].to_numpy(dtype=float)
    n = len(scores)

    # Percentile (midrank for ties)
    less = (scores < student_score).sum()
    equal = (scores == student_score).sum()
    percentile = 100.0 * (less + 0.5 * equal) / n

    data = data.copy()
    data["status"] = data["score"].apply(assign_status)
    student_status = assign_status(student_score)
    same_status = data.loc[data["status"] == student_status].sort_values("score", ascending=False)
    position_in_status = None
    group_size_in_status = None
    if not same_status.empty:
        same_status = same_status.reset_index(drop=True)
        idx = same_status.index[same_status["id_student"] == student_id]
        if len(idx) > 0:
            position_in_status = int(idx[0]) + 1
            group_size_in_status = int(len(same_status))

    # Histogram (0..100) → 10 bins
    bin_edges = np.linspace(0, 100, 11)
    counts, edges = np.histogram(scores, bins=bin_edges)

    return AssessmentAnalytics(
        assessment_id=int(assessment_id),
        bins=[int(x) for x in edges.tolist()],
        counts=[int(c) for c in counts.tolist()],
        student_score=student_score,
        percentile=round(float(percentile), 1),
        status=student_status,
        position_in_status=position_in_status,
        group_size_in_status=group_size_in_status,
    )


# ---------- Overall rank among peers in same modules ----------
@app.get("/api/students/{student_id}/rank", response_model=RankResponse)
def student_rank(student_id: str):
    try:
        sid = int(student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="student_id must be an integer")

    stu_rows = merged_df.loc[
        (merged_df["id_student"] == sid) & (merged_df["score"].notna())
    ].copy()
    if stu_rows.empty:
        raise HTTPException(status_code=404, detail="No assessments found for this student")

    if "code_module" not in stu_rows.columns:
        raise HTTPException(status_code=500, detail="code_module column missing in data")

    modules = sorted(set(stu_rows["code_module"].dropna().astype(str).tolist()))
    if not modules:
        raise HTTPException(status_code=404, detail="No module info for this student")

    peers = merged_df.loc[
        (merged_df["code_module"].isin(modules)) & (merged_df["score"].notna())
    ][["id_student", "score"]].copy()

    per_student_avg = peers.groupby("id_student", as_index=False)["score"].mean()
    per_student_avg.rename(columns={"score": "avg"}, inplace=True)

    per_student_avg.sort_values(["avg", "id_student"], ascending=[False, True], inplace=True)
    per_student_avg.reset_index(drop=True, inplace=True)

    total = int(len(per_student_avg))
    row = per_student_avg.loc[per_student_avg["id_student"] == sid]
    if row.empty:
        raise HTTPException(status_code=404, detail="Student not found in peer set")

    student_avg = float(round(row.iloc[0]["avg"], 1))
    position = int(row.index[0]) + 1

    avg_vals = per_student_avg["avg"].to_numpy(dtype=float)
    less = int((avg_vals < student_avg).sum())
    eq = int((avg_vals == student_avg).sum())
    percentile = 100.0 * (less + 0.5 * eq) / max(total, 1)

    return RankResponse(
        position=position,
        total=total,
        percentile=round(percentile, 1),
        student_average=student_avg,
        modules=modules,
    )


# Optional: run with `python backend.py`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend:app", reload=True, port=8000)
