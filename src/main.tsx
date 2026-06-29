import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isValidJWT } from "./lib/auth";

const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get("token");
const storedToken = localStorage.getItem("token");
const token = urlToken || storedToken;

if (!isValidJWT(token)) {
  localStorage.removeItem("token");
  window.location.href = "https://login-podologiazavalos.vercel.app/?token=true";
} else {
  if (urlToken) {
    localStorage.setItem("token", urlToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  createRoot(document.getElementById("root")!).render(<App />);
}
