import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Automatically update and reload PWA when a new version is published
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log("PWA ready for offline use");
  },
});

createRoot(document.getElementById("root")!).render(<App />);

