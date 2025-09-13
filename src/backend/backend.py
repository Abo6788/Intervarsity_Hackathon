from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression

# ----------------------------- Config -----------------------------
# Adjust this if your frontend runs somewhere else
FRONTEND_ORIGIN = "http://localhost:5173"

# CSV locations: prefer relative paths (repo/assets), fallback to your absolute Windows paths
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"

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
    raise FileNotFoundError(f"Could not find CSV at {preferred} or {fallback}")


# ----------------------------- Data load -----------------------------
# Load once on startup
student_assessments: pd.DataFrame = _load_csv(REL_STUDENT_ASSESSMENTS, ABS_STUDENT_ASSESSMENTS)
student_registration: pd.DataFrame = _load_csv(REL_STUDENT_REGISTRATION, ABS_STUDENT_REGISTRATION)
student_info: pd.DataFrame = _load_csv(REL_STUDENT_INFO, ABS_STUDENT_INFO)

# Normalize column names (defensive)
for df in (student_assessments, student_registration, student_info):
    df.columns = [c.strip() for c in df.columns]

# Merge module/presentation info (used in analytics later if needed)
merged_df = pd.merge(
    student_assessments,
    student_info[["id_student", "code_module", "code_presentation"]],
    on="id_student",
    how="left",
)

# ----------------------------- Domain logic -----------------------------
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


# ----------------------------- API schemas -----------------------------
class ExistsResponse(BaseModel):
    exists: bool


class AssessmentRow(BaseModel):
    id_assessment: int
    task: Optional[str] = None   # frontend can display "Assessment {id}" if None
    date_submitted: Optional[str] = None  # YYYY-MM-DD
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


# ----------------------------- FastAPI app -----------------------------
app = FastAPI(title="Intervarsity Backend", version="1.0.0")

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


# ---- Students ----
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

    # Sort by id_assessment for stable display
    df = df.sort_values("id_assessment")

    # Normalize date -> YYYY-MM-DD if the column exists
    date_col = None
    for candidate in ("date_submitted", "date_submitted ", "date_submited", "date"):
        if candidate in df.columns:
            date_col = candidate
            break

    rows: List[AssessmentRow] = []
    for _, r in df.iterrows():
        date_val = None
        if date_col is not None and pd.notna(r[date_col]):
            s = str(r[date_col])
            # If it looks like a timestamp, slice to date
            if "T" in s:
                date_val = s[:10]
            else:
                # Try parse with pandas, then format
                try:
                    date_val = pd.to_datetime(s).strftime("%Y-%m-%d")
                except Exception:
                    date_val = s
        rows.append(
            AssessmentRow(
                id_assessment=int(r["id_assessment"]),
                task=None,  # frontend can fall back to `Assessment {id_assessment}`
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
        # No data — return zeros so frontend can handle gracefully
        return StudentSummary(
            studentId=str(student_id),
            average=0.0,
            status=assign_status(0.0),
            predicted_next=PredictedNext(id_assessment=None, score=None),
        )

    # Overall average
    avg = float(np.round(df["score"].mean(), 1))
    status = assign_status(avg)

    # Simple linear regression on (id_assessment -> score), needs at least 2 points
    pred_id: Optional[int] = None
    pred_score: Optional[float] = None

    model_df = df.dropna(subset=["score", "id_assessment"]).copy()
    # Ensure ints for sorting and next id prediction
    model_df["id_assessment"] = model_df["id_assessment"].astype(int)

    if len(model_df) >= 2:
        X = model_df["id_assessment"].to_numpy().reshape(-1, 1)
        y = model_df["score"].to_numpy()
        try:
            model = LinearRegression()
            model.fit(X, y)
            pred_id = int(model_df["id_assessment"].max()) + 1
            pred_score = float(model.predict(np.array([[pred_id]])).item())
            pred_score = round(pred_score, 2)
        except Exception:
            # Keep predicted as None on any regression issue
            pred_id, pred_score = None, None

    return StudentSummary(
        studentId=str(student_id),
        average=avg,
        status=status,
        predicted_next=PredictedNext(id_assessment=pred_id, score=pred_score),
    )


@app.get("/api/students/{student_id}/modules", response_model=ModulesResponse)
def student_completed_modules(student_id: str):
    """Completed modules = registrations with no unregistration date."""
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


# Optional: run directly with `python backend.py`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend:app", reload=True, port=8000)
