import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Validar estructura JWT y firma
// const isValidJWT = (token: string | null): boolean => {
//   if (!token) return false;

//   try {
//     // JWT tiene 3 partes separadas por puntos: header.payload.signature
//     const parts = token.split(".");
//     if (parts.length !== 3) return false;

//     const [header, payload, signature] = parts;

//     // Verificar que las partes no estén vacías
//     if (!header || !payload || !signature) return false;

//     // Decodificar y validar header (debe ser JSON válido)
//     const decodedHeader = JSON.parse(atob(header));
//     if (!decodedHeader || !decodedHeader.alg) return false;

//     // Decodificar y validar payload (debe ser JSON válido)
//     const decodedPayload = JSON.parse(atob(payload));
//     if (!decodedPayload) return false;

//     // Verificar que la firma no esté vacía
//     if (signature.length === 0) return false;

//     return true;
//   } catch (error) {
//     // Si falla la decodificación o validación, el token es inválido
//     return false;
//   }
// };

// Leer token de los query parameters o localStorage
// const urlParams = new URLSearchParams(window.location.search);
// const urlToken = urlParams.get("token");
// const storedToken = localStorage.getItem("token");
// const token = urlToken || storedToken;

// Validar token JWT y redirigir si es inválido o no existe
// if (!isValidJWT(token)) {
//   // Limpiar localStorage de token inválido
//   localStorage.removeItem("token");
//   // Redirigir a ngrok con token=true
//   window.location.href = "https://anh-billowier-atlas.ngrok-free.dev/?token=true";
// } else {
//   // Si el token viene de la URL, guardarlo en localStorage
//   if (urlToken) {
//     localStorage.setItem("token", urlToken);
//     // Limpiar el token de la URL
//     window.history.replaceState({}, document.title, window.location.pathname);
//   }

  createRoot(document.getElementById("root")!).render(<App />);
// }
