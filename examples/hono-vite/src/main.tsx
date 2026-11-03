import "@ykurilov/authlite/styles.css";
import "./styles.css";
import { ForgotPasswordScreen, LoginScreen, ResetPasswordScreen, SignUpScreen } from "@ykurilov/authlite/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DashboardPage } from "./dashboard-page.tsx";

/** Простейшая маршрутизация по адресу: экраны связаны обычными ссылками. */
function App() {
  switch (window.location.pathname) {
    case "/login":
      return <LoginScreen appName="Заметки" defaultRedirect="/dashboard" />;
    case "/signup":
      return <SignUpScreen appName="Заметки" defaultRedirect="/dashboard" />;
    case "/forgot-password":
      return <ForgotPasswordScreen appName="Заметки" />;
    case "/reset-password":
      return <ResetPasswordScreen appName="Заметки" />;
    case "/dashboard":
      return <DashboardPage />;
    default:
      window.location.replace("/dashboard");
      return null;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
