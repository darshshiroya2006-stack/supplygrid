import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
(window as any).VITE_API_URL = "http://localhost:3002";

createRoot(document.getElementById("root")!).render(<App />);
