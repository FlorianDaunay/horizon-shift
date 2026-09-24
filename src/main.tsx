import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./themes/store"; // applies the saved (or system) theme before the first paint
import App from "./ui/App";
import "./ui/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
