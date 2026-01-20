import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initGoogleAnalytics } from "./lib/analytics";

// Initialize Google Analytics before rendering the app
initGoogleAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
