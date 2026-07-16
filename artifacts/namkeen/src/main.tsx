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
        
        // Listen for background synchronization events or push registration flags
        if ("sync" in reg) {
          (reg as any).sync.register("order-sync")
            .then(() => {
              console.log("[Service Worker] Background sync 'order-sync' registered successfully");
            })
            .catch((err: any) => {
              console.warn("[Service Worker] Background sync registration failed:", err);
            });
        }
        
        if ("pushManager" in reg) {
          reg.pushManager.getSubscription()
            .then((subscription) => {
              if (subscription) {
                console.log("[Service Worker] Active Push Subscription:", subscription.endpoint);
              } else {
                console.log("[Service Worker] No active push subscription, flags checked.");
              }
            });
        }
      })
      .catch((err: any) => {
        console.error("[Service Worker] Registration failed:", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
