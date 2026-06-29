const KEY = "sole-user-profile-v1";

export interface StoredUserProfile {
  displayName: string;
  email: string;
  role: string;
}

const defaults: StoredUserProfile = {
  displayName: "Dr. Ramírez",
  email: "dr.ramirez@footcare.es",
  role: "Podólogo — visitas a domicilio",
};

export function loadUserProfile(): StoredUserProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<StoredUserProfile>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : defaults.displayName,
      email: typeof parsed.email === "string" ? parsed.email : defaults.email,
      role: typeof parsed.role === "string" ? parsed.role : defaults.role,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveUserProfile(profile: StoredUserProfile): void {
  localStorage.setItem(KEY, JSON.stringify(profile));
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
