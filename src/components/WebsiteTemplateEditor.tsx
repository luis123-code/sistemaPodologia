import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Globe,
  Layers,
  Phone,
  Plus,
  Trash2,
  Type,
  RotateCcw,
  Loader2,
  Camera,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  type WebsiteTemplateSettings,
  type WebsiteFontPresetId,
  loadWebsiteTemplateSettings,
  resetWebsiteTemplateSettings,
  WEBSITE_FONT_PRESETS,
} from "@/lib/websiteTemplateSettings";
import { crearPlantilla, obtenerPlantillas } from "@/services/nocodb/plantillas.service";
import { uploadImageToCloudinary } from "@/services/cloudinary/cloudinary.service";
import { cn } from "@/lib/utils";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fontStackFor(id: WebsiteFontPresetId): string {
  return WEBSITE_FONT_PRESETS.find((f) => f.id === id)?.stack ?? WEBSITE_FONT_PRESETS[0].stack;
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

export function WebsiteTemplateEditor() {
  const [settings, setSettings] = useState<WebsiteTemplateSettings>(() => loadWebsiteTemplateSettings());
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  
  useEffect(() => {
    let cancelled = false;

    async function loadLatest() {
      try {
        const plantillas = await obtenerPlantillas();
        if (cancelled) return;

        if (plantillas.length > 0) {
          
          const ultimaPlantilla = plantillas[plantillas.length - 1];

          let infoWeb = ultimaPlantilla.fields?.informacionDelaWeb;
          if (typeof infoWeb === "string") {
            infoWeb = JSON.parse(infoWeb);
          }

          if (infoWeb) {
            const base = loadWebsiteTemplateSettings();
            setSettings({
              ...base,
              contactPhone: infoWeb.telefonoPrincipal || base.contactPhone,
              heroTitles: infoWeb.titulosSubtitulos?.map((ts: any, idx: number) => ({
                id: crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${idx}`,
                titulo: ts.titulo || "",
                subtitulo: ts.subtitulo || "",
              })) || base.heroTitles,
              services: infoWeb.servicios?.map((s: any, idx: number) => ({
                id: crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${idx}`,
                title: s.titulo || "",
                description: s.descripcion || "",
              })) || base.services,
              beforeAfter: infoWeb.casos?.map((c: any, idx: number) => ({
                id: crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${idx}`,
                label: c.label || "",
                beforeImage: c.antes || "",
                afterImage: c.despues || "",
              })) || base.beforeAfter,
              galleryImages: Array.isArray(infoWeb.galeria) ? infoWeb.galeria.map((g: any) => g || "") : base.galleryImages,
              professionalPhotoUrl: infoWeb.fotoProfesional || base.professionalPhotoUrl,
            });
          }
        }
      } catch {
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    loadLatest();
    return () => {
      cancelled = true;
    };
  }, []);

  const fontStack = useMemo(() => fontStackFor(settings.fontPresetId), [settings.fontPresetId]);

  const persist = useCallback((next: WebsiteTemplateSettings) => {
    setSettings(next);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      
      const uploadIfNeeded = (url: string) =>
        url && url.startsWith("data:") ? uploadImageToCloudinary(url) : Promise.resolve(url);

      const uploadedBeforeAfter = await Promise.all(
        settings.beforeAfter.map(async (ba) => ({
          ...ba,
          beforeImage: await uploadIfNeeded(ba.beforeImage),
          afterImage: await uploadIfNeeded(ba.afterImage),
        }))
      );

      const uploadedGallery = await Promise.all(
        settings.galleryImages.map((img) => uploadIfNeeded(img))
      );
      const uploadedProfessionalPhoto = await uploadIfNeeded(settings.professionalPhotoUrl);

      const plantillaData = {
        titulosSubtitulos: (settings.heroTitles || []).map((ht) => ({
          titulo: ht.titulo,
          subtitulo: ht.subtitulo,
        })),
        telefonoPrincipal: settings.contactPhone,
        servicios: settings.services.map((s) => ({
          titulo: s.title,
          descripcion: s.description,
        })),
        galeria: uploadedGallery.map((img) => img || null),
        casos: uploadedBeforeAfter.map((ba) => ({
          label: ba.label,
          antes: ba.beforeImage || null,
          despues: ba.afterImage || null,
        })),
        fotoProfesional: uploadedProfessionalPhoto || null,
      };

      setSettings((prev) => ({
        ...prev,
        beforeAfter: uploadedBeforeAfter,
        galleryImages: uploadedGallery,
        professionalPhotoUrl: uploadedProfessionalPhoto,
      }));

      const resultado = await crearPlantilla(plantillaData as any);

      if (resultado) {
        toast.success("Plantilla guardada en NocoDB correctamente");
      } else {
        toast.error("Error al guardar en NocoDB");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar en NocoDB");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const fresh = resetWebsiteTemplateSettings();
    setSettings(fresh);
    toast.message("Valores por defecto restaurados");
  };

  const handleRestoreFromNocoDB = async () => {
    try {
      const plantillas = await obtenerPlantillas();
      
      if (plantillas.length === 0) {
        toast.error("No hay plantillas guardadas en NocoDB");
        return;
      }
      
      
      const index = plantillas.length >= 2 ? plantillas.length - 2 : 0;
      const ultimaPlantilla = plantillas[index];
      
      
      let infoWeb = ultimaPlantilla.fields?.informacionDelaWeb;
      
      
      if (typeof infoWeb === 'string') {
        infoWeb = JSON.parse(infoWeb);
      }
      
      if (!infoWeb) {
        toast.error("La plantilla no tiene datos válidos");
        return;
      }
      
      
      const newSettings = {
        ...settings,
        contactPhone: infoWeb.telefonoPrincipal || settings.contactPhone,
        heroTitles: infoWeb.titulosSubtitulos?.map((ts: any, idx: number) => ({
          id: crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${idx}`,
          titulo: ts.titulo || "",
          subtitulo: ts.subtitulo || ""
        })) || settings.heroTitles,
        services: infoWeb.servicios?.map((s: any, idx: number) => ({
          id: crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${idx}`,
          title: s.titulo || "",
          description: s.descripcion || ""
        })) || settings.services,
        beforeAfter: infoWeb.casos?.map((c: any, idx: number) => ({
          id: crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${idx}`,
          label: c.label || "",
          beforeImage: c.antes || "",
          afterImage: c.despues || ""
        })) || settings.beforeAfter,
        galleryImages: Array.isArray(infoWeb.galeria) ? infoWeb.galeria.map((g: any) => g || "") : settings.galleryImages,
        professionalPhotoUrl: infoWeb.fotoProfesional || settings.professionalPhotoUrl,
      };

      setSettings(newSettings);
      toast.success(`Plantilla "${ultimaPlantilla.fields?.Title || 'Sin título'}" cargada desde NocoDB`);
      
    } catch (error) {
      toast.error("Error al cargar la plantilla desde NocoDB");
    }
  };

  const onProfessionalPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen");
      return;
    }
    try {
      const url = await readFileAsDataUrl(file);
      persist({ ...settings, professionalPhotoUrl: url });
    } catch {
      toast.error("No se pudo leer la imagen");
    }
  };

  const onPairImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    pairId: string,
    side: "beforeImage" | "afterImage",
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen");
      return;
    }
    try {
      const url = await readFileAsDataUrl(file);
      persist({
        ...settings,
        beforeAfter: settings.beforeAfter.map((p) => (p.id === pairId ? { ...p, [side]: url } : p)),
      });
    } catch {
      toast.error("No se pudo leer la imagen");
    }
  };

  const addService = () => {
    persist({
      ...settings,
      services: [
        ...settings.services,
        {
          id: newId("svc"),
          title: "Nuevo servicio",
          description: "Describe qué incluye y para quién va dirigido.",
        },
      ],
    });
  };

  const removeService = (serviceId: string) => {
    persist({
      ...settings,
      services: settings.services.filter((s) => s.id !== serviceId),
    });
  };

  const updateService = (serviceId: string, patch: Partial<{ title: string; description: string }>) => {
    persist({
      ...settings,
      services: settings.services.map((s) => (s.id === serviceId ? { ...s, ...patch } : s)),
    });
  };

  const addBeforeAfter = () => {
    persist({
      ...settings,
      beforeAfter: [
        ...settings.beforeAfter,
        {
          id: newId("ba"),
          label: "Nuevo antes / después",
          beforeImage: "",
          afterImage: "",
        },
      ],
    });
  };

  const removeBeforeAfter = (pairId: string) => {
    persist({
      ...settings,
      beforeAfter: settings.beforeAfter.filter((p) => p.id !== pairId),
    });
  };

  const updatePairLabel = (pairId: string, label: string) => {
    persist({
      ...settings,
      beforeAfter: settings.beforeAfter.map((p) => (p.id === pairId ? { ...p, label } : p)),
    });
  };

  const onGalleryImage = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen");
      return;
    }
    try {
      const url = await readFileAsDataUrl(file);
      const next = [...settings.galleryImages];
      next[index] = url;
      persist({ ...settings, galleryImages: next });
    } catch {
      toast.error("No se pudo leer la imagen");
    }
  };

  const addGalleryImage = () => {
    if (settings.galleryImages.length >= 2) {
      toast.info("La galería web es de 2 imágenes");
      return;
    }
    persist({ ...settings, galleryImages: [...settings.galleryImages, ""] });
  };

  const removeGalleryImage = (index: number) => {
    persist({
      ...settings,
      galleryImages: settings.galleryImages.filter((_, i) => i !== index),
    });
  };

  const updateGalleryImage = (index: number, value: string) => {
    const next = [...settings.galleryImages];
    next[index] = value;
    persist({ ...settings, galleryImages: next });
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full bg-primary/10 animate-ping" />
            <div className="absolute w-10 h-10 rounded-full bg-primary/20 animate-pulse" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-muted-foreground animate-pulse font-medium">Cargando plantilla desde NocoDB...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="card-shadow border-primary/10">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-primary" />
              Plantilla de tu página web
            </CardTitle>
            <CardDescription>
              Personaliza textos, tipografía, imágenes, servicios visibles, casos antes/después y el teléfono de
              contacto. Los datos se guardan en NocoDB.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleReset} disabled={saving}>
              <RotateCcw className="h-4 w-4" />
              Valores por defecto
            </Button>
            <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={handleRestoreFromNocoDB} disabled={saving}>
              <Globe className="h-4 w-4" />
              Restaurar desde NocoDB
            </Button>
            <Button type="button" size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Guardando..." : "Guardar plantilla"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,340px)]">
        <div className="space-y-6">
          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Type className="h-4 w-4 text-primary" />
                  Títulos y subtítulos
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newId = crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                    persist({
                      ...settings,
                      heroTitles: [...(settings.heroTitles || []), { id: newId, titulo: "", subtitulo: "" }]
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(settings.heroTitles || []).map((ht, idx) => (
                <div key={ht.id} className="grid gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Título #{idx + 1}</span>
                    {settings.heroTitles.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          const next = settings.heroTitles.filter((t) => t.id !== ht.id);
                          persist({ ...settings, heroTitles: next });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Título principal</Label>
                    <Input
                      value={ht.titulo}
                      onChange={(e) => {
                        const next = settings.heroTitles.map((t) =>
                          t.id === ht.id ? { ...t, titulo: e.target.value } : t
                        );
                        persist({ ...settings, heroTitles: next });
                      }}
                      placeholder="Ej: Podología a domicilio"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Frase de cabecera</Label>
                    <Textarea
                      rows={2}
                      value={ht.subtitulo}
                      onChange={(e) => {
                        const next = settings.heroTitles.map((t) =>
                          t.id === ht.id ? { ...t, subtitulo: e.target.value } : t
                        );
                        persist({ ...settings, heroTitles: next });
                      }}
                      placeholder="Ej: Cuidado profesional de tus pies..."
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-primary" />
                Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="wt-phone">Teléfono de contacto</Label>
                <Input
                  id="wt-phone"
                  value={settings.contactPhone}
                  onChange={(e) => persist({ ...settings, contactPhone: e.target.value })}
                  placeholder="+34 600 000 000"
                  inputMode="tel"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="h-4 w-4 text-primary" />
                  Foto profesional
                </CardTitle>
                <CardDescription>Sube una foto de la clínica o del profesional para la web.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div
                  className="relative flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-muted/20"
                >
                  {settings.professionalPhotoUrl ? (
                    <img
                      src={settings.professionalPhotoUrl}
                      alt="Foto profesional"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin imagen</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    id="wt-professional-photo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onProfessionalPhoto}
                  />
                  <Label htmlFor="wt-professional-photo" className="cursor-pointer">
                    <Button type="button" variant="secondary" size="sm" className="gap-1" asChild>
                      <span>
                        <Plus className="h-4 w-4" />
                        {settings.professionalPhotoUrl ? "Cambiar foto" : "Subir foto"}
                      </span>
                    </Button>
                  </Label>
                  {settings.professionalPhotoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive justify-start px-2"
                      onClick={() => persist({ ...settings, professionalPhotoUrl: "" })}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-primary" />
                  Servicios en la web
                </CardTitle>
                <CardDescription>Texto que verán los visitantes (independiente de tarifas internas).</CardDescription>
              </div>
              <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={addService}>
                <Plus className="h-4 w-4" />
                Añadir
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay servicios. Pulsa «Añadir».</p>
              ) : (
                settings.services.map((s, index) => (
                  <div key={s.id} className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Servicio {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeService(s.id)}
                        aria-label="Eliminar servicio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`svc-t-${s.id}`}>Nombre</Label>
                      <Input id={`svc-t-${s.id}`} value={s.title} onChange={(e) => updateService(s.id, { title: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`svc-d-${s.id}`}>Descripción</Label>
                      <Textarea
                        id={`svc-d-${s.id}`}
                        rows={2}
                        value={s.description}
                        onChange={(e) => updateService(s.id, { description: e.target.value })}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Galería web</CardTitle>
                <CardDescription>Dos imágenes destacadas para la sección de galería de tu web.</CardDescription>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={addGalleryImage}
                disabled={settings.galleryImages.length >= 2}
              >
                <Plus className="h-4 w-4" />
                Añadir
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.galleryImages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay imágenes de galería. Pulsa «Añadir».</p>
              ) : (
                settings.galleryImages.map((url, index) => (
                  <div key={index} className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Imagen {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeGalleryImage(index)}
                        aria-label="Eliminar imagen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div
                      className={cn(
                        "flex aspect-[16/9] max-h-44 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30",
                        url && "border-solid",
                      )}
                    >
                      {url ? (
                        <img src={url} alt={`Galería ${index + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin imagen</span>
                      )}
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      className="cursor-pointer text-xs"
                      onChange={(e) => onGalleryImage(e, index)}
                    />
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">O pega una URL</Label>
                      <Input
                        type="text"
                        value={url}
                        onChange={(e) => updateGalleryImage(index, e.target.value)}
                        placeholder="https://..."
                        className="text-xs"
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Antes y después</CardTitle>
                <CardDescription>Galería de resultados (sube la foto previa y la final).</CardDescription>
              </div>
              <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={addBeforeAfter}>
                <Plus className="h-4 w-4" />
                Caso
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings.beforeAfter.map((pair, index) => (
                <div key={pair.id} className="space-y-3 rounded-lg border border-border/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor={`ba-l-${pair.id}`} className="text-sm font-medium">
                      Caso {index + 1}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeBeforeAfter(pair.id)}
                    >
                      Quitar
                    </Button>
                  </div>
                  <Input
                    id={`ba-l-${pair.id}`}
                    value={pair.label}
                    onChange={(e) => updatePairLabel(pair.id, e.target.value)}
                    placeholder="Título del caso"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground">Antes</span>
                      <div
                        className={cn(
                          "flex aspect-[4/3] max-h-40 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30",
                          pair.beforeImage && "border-solid",
                        )}
                      >
                        {pair.beforeImage ? (
                          <img src={pair.beforeImage} alt="Antes" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin imagen</span>
                        )}
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        className="cursor-pointer text-xs"
                        onChange={(e) => onPairImage(e, pair.id, "beforeImage")}
                      />
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground">Después</span>
                      <div
                        className={cn(
                          "flex aspect-[4/3] max-h-40 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30",
                          pair.afterImage && "border-solid",
                        )}
                      >
                        {pair.afterImage ? (
                          <img src={pair.afterImage} alt="Después" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin imagen</span>
                        )}
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        className="cursor-pointer text-xs"
                        onChange={(e) => onPairImage(e, pair.id, "afterImage")}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 h-fit space-y-3">
          <Card className="card-shadow overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-br from-primary/10 to-transparent py-3">
              <CardTitle className="text-sm font-semibold">Vista previa</CardTitle>
              <CardDescription className="text-xs">Así podría verse tu cabecera pública.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div
                className="relative min-h-[140px] bg-gradient-to-br from-primary/20 to-muted/40"
                style={{ fontFamily: fontStack }}
              >
                {settings.heroImageUrl ? (
                  <img src={settings.heroImageUrl} alt="" className="h-36 w-full object-cover opacity-90" />
                ) : (
                  <div className="h-36 w-full bg-muted/60" />
                )}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/95 via-background/40 to-transparent p-4">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="" className="mb-2 h-10 w-auto object-contain drop-shadow" />
                  ) : null}
                  <h2 className="text-lg font-bold leading-tight text-foreground">{settings.heroTitle}</h2>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{settings.heroSubtitle}</p>
                  <p className="mt-3 text-sm font-medium text-primary">{settings.contactPhone}</p>
                </div>
              </div>
              <Separator />
              <div className="p-4 space-y-3" style={{ fontFamily: fontStack }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Servicios</p>
                <ul className="space-y-2 text-sm">
                  {settings.services.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">{s.title}</span>
                      <span className="text-muted-foreground"> — {s.description.slice(0, 80)}
                        {s.description.length > 80 ? "…" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Antes / después</p>
                <div className="grid grid-cols-2 gap-2">
                  {settings.beforeAfter.slice(0, 2).map((p) => (
                    <div key={p.id} className="text-xs space-y-1">
                      <p className="font-medium truncate">{p.label}</p>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="aspect-square rounded bg-muted overflow-hidden">
                          {p.beforeImage ? (
                            <img src={p.beforeImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">Antes</div>
                          )}
                        </div>
                        <div className="aspect-square rounded bg-muted overflow-hidden">
                          {p.afterImage ? (
                            <img src={p.afterImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">Después</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
