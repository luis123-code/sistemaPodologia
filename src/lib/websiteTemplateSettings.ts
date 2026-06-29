import { podiatryServices } from "@/data/mockData";

const STORAGE_KEY = "sole-website-template-v1";

export type WebsiteFontPresetId = "system" | "serif" | "humanist" | "mono";

export const WEBSITE_FONT_PRESETS: { id: WebsiteFontPresetId; label: string; stack: string }[] = [
  { id: "system", label: "Sistema (moderno)", stack: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif' },
  { id: "serif", label: "Serif (clásico)", stack: 'Georgia, "Times New Roman", serif' },
  { id: "humanist", label: "Sans humanista", stack: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: "mono", label: "Monoespaciado", stack: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
];

export interface WebsiteServiceLine {
  id: string;
  title: string;
  description: string;
}

export interface WebsiteBeforeAfterPair {
  id: string;
  label: string;
  beforeImage: string;
  afterImage: string;
}

export interface TituloSubtitulo {
  id: string;
  titulo: string;
  subtitulo: string;
}

export interface WebsiteTemplateSettings {
  contactPhone: string;
  heroTitle: string;
  heroSubtitle: string;
  heroTitles: TituloSubtitulo[]; 
  fontPresetId: WebsiteFontPresetId;
  logoUrl: string;
  heroImageUrl: string;
  services: WebsiteServiceLine[];
  beforeAfter: WebsiteBeforeAfterPair[];
  galleryImages: string[];
}

function id(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultWebsiteTemplateSettings(): WebsiteTemplateSettings {
  const servicesFromCatalog = podiatryServices.slice(0, 4).map((s) => ({
    id: id(),
    title: s.name,
    description: s.description,
  }));

  return {
    contactPhone: "+34 912 345 678",
    heroTitle: "Podología a domicilio",
    heroSubtitle: "Cuidado profesional de tus pies en la comodidad de tu hogar.",
    heroTitles: [
      {
        id: id(),
        titulo: "Podología a domicilio",
        subtitulo: "Cuidado profesional de tus pies en la comodidad de tu hogar.",
      },
    ],
    fontPresetId: "system",
    logoUrl: "",
    heroImageUrl: "",
    services: servicesFromCatalog,
    beforeAfter: [
      {
        id: id(),
        label: "Ejemplo — caso 1",
        beforeImage: "",
        afterImage: "",
      },
    ],
    galleryImages: [],
  };
}

export function loadWebsiteTemplateSettings(): WebsiteTemplateSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWebsiteTemplateSettings();
    const parsed = JSON.parse(raw) as Partial<WebsiteTemplateSettings>;
    const base = defaultWebsiteTemplateSettings();
    return {
      ...base,
      ...parsed,
      fontPresetId:
        parsed.fontPresetId && WEBSITE_FONT_PRESETS.some((f) => f.id === parsed.fontPresetId)
          ? parsed.fontPresetId
          : base.fontPresetId,
      services: Array.isArray(parsed.services) && parsed.services.length ? parsed.services : base.services,
      beforeAfter:
        Array.isArray(parsed.beforeAfter) && parsed.beforeAfter.length ? parsed.beforeAfter : base.beforeAfter,
      galleryImages:
        Array.isArray(parsed.galleryImages) ? parsed.galleryImages : base.galleryImages,
    };
  } catch {
    return defaultWebsiteTemplateSettings();
  }
}

export function saveWebsiteTemplateSettings(data: WebsiteTemplateSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetWebsiteTemplateSettings(): WebsiteTemplateSettings {
  const fresh = defaultWebsiteTemplateSettings();
  saveWebsiteTemplateSettings(fresh);
  return fresh;
}
