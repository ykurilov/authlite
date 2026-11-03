import { SignOutButton } from "@ykurilov/authlite/react";
import { nextAuth } from "@/lib/auth";
import { NotesList } from "./notes-list";

export default async function DashboardPage() {
  const user = await nextAuth.requireUser("/dashboard");
  return (
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
  );
}
