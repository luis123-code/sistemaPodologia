const LOGIN_URL = "https://login-podologiazevallos.vercel.app/";

export const isValidJWT = (token: string | null): boolean => {
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

export const requireAuthToken = () => {
  const token = localStorage.getItem("token");
  if (!isValidJWT(token)) {
    localStorage.removeItem("token");
    window.location.href = LOGIN_URL;
  }
};
