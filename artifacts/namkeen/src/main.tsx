import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[Service Worker] Registered successfully:", reg.scope);
      })
      .catch((err) => {
        console.error("[Service Worker] Registration failed:", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
