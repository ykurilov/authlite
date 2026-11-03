import { AuthGuard, SignOutButton } from "@ykurilov/authlite/react";
import { useEffect, useState } from "react";

export function DashboardPage() {
  return (
    <AuthGuard fallback={<p className="page">Загрузка…</p>}>
      {(user) => (
        <main className="page">
          <header className="page-header">
            <h1>Мои заметки</h1>
            <SignOutButton />
          </header>
          <p>
            Вы вошли как <strong data-testid="current-email">{user.email}</strong>
          </p>
          <NotesList />
        </main>
      )}
    </AuthGuard>
  );
}

function NotesList() {
  const [notes, setNotes] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/notes")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: { notes: string[] }) => setNotes(data.notes))
      .catch(() => setFailed(true));
  }, []);
  if (failed) return <p role="alert">Не удалось загрузить заметки</p>;
  if (!notes) return <p>Загрузка…</p>;
  return (
    <ul data-testid="notes">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}
