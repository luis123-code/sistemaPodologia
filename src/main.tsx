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
<<<<<<< HEAD
  window.location.href = "https://login-podologiazavalos.vercel.app/?token=true";
=======
  window.location.href = "https://login-podologiazevallos.vercel.app/";
>>>>>>> adf48fb94aa2d7ac964048a267746acfa49d9dcf
} else {
  if (urlToken) {
    localStorage.setItem("token", urlToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  createRoot(document.getElementById("root")!).render(<App />);
}
