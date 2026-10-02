// Shared entry point. Do not edit from a feature account.
import React from "react";
import { createRoot } from "react-dom/client";
import "./shared/theme.css";
import AppShell from "./app/AppShell";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
