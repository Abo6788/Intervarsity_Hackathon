import { useState } from "react";
import "./CoursePage.css"; // reuse the styles from CoursePage

type Props = {
  onLogin: (studentId: string) => void; // callback to notify App.tsx
};

export default function LoginPage({ onLogin }: Props) {
  const [studentId, setStudentId] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Accept any student number for now and pass it up
    onLogin(studentId.trim());
  };

  return (
    <div className="course-page">
      <div className="course-container" style={{ maxWidth: 420 }}>
        <header className="course-header">
          <div className="header-left">
            <h1 className="course-code">Login</h1>
            <p className="student-id">Student Portal</p>
          </div>
        </header>

        <form onSubmit={handleLogin} style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <label
              htmlFor="studentId"
              style={{ display: "block", fontSize: 12, color: "#6b7280" }}
            >
              Student number
            </label>
            <input
              id="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Enter your student number"
              className="search-input"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: "14px",
              }}
            />
          </div>

          <button type="submit" className="btn" style={{ width: "100%" }}>
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
