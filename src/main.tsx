import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isValidJWT = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [header, payload, signature] = parts;
    if (!header || !payload || !signature) return false;
    const decodedHeader = JSON.parse(atob(header));
    if (!decodedHeader || !decodedHeader.alg) return false;
    const decodedPayload = JSON.parse(atob(payload));
    if (!decodedPayload) return false;
    if (signature.length === 0) return false;
    return true;
  } catch {
    return false;
  }
};

const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get("token");
const storedToken = localStorage.getItem("token");
const token = urlToken || storedToken;

if (!isValidJWT(token)) {
  localStorage.removeItem("token");
  window.location.href = "https://login-podologiazevallos.vercel.app/";
} else {
  if (urlToken) {
    localStorage.setItem("token", urlToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  createRoot(document.getElementById("root")!).render(<App />);
}
