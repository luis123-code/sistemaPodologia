import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isValidJWT } from "./lib/auth";

const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get("token");
const storedToken = localStorage.getItem("token");
const token = urlToken || storedToken;

console.log("[Auth] urlToken:", urlToken);
console.log("[Auth] storedToken:", storedToken);
console.log("[Auth] token usado:", token);
console.log("[Auth] isValidJWT:", isValidJWT(token));

if (urlToken) {
  localStorage.setItem("token", urlToken);
  window.history.replaceState({}, document.title, window.location.pathname);
}

createRoot(document.getElementById("root")!).render(<App />);
