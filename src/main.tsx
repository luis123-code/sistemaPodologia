import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isValidJWT } from "./lib/auth";

const LOGIN_URL = "https://login-podologiazevallos.vercel.app/?token=true";

const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get("token");
const storedToken = localStorage.getItem("token");
const token = urlToken || storedToken;

if (urlToken) {
  localStorage.setItem("token", urlToken);
  window.history.replaceState({}, document.title, window.location.pathname);
}

if (!isValidJWT(token)) {
  localStorage.removeItem("token");
  window.location.href = LOGIN_URL;
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
