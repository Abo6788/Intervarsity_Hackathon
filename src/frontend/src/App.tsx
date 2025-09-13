import { useState } from "react";
import LoginPage from "./LoginPage";
import CoursePage from "./CoursePage";

export default function App() {
  const [studentId, setStudentId] = useState<string | null>(null);

  return studentId ? (
    <CoursePage studentId={studentId} />
  ) : (
    <LoginPage onLogin={(id: string) => setStudentId(id)} />
  );
}
