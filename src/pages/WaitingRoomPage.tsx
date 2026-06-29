import { useState, useEffect, useRef } from "react";
import { Bell, CheckCircle2, User, Car, Home, MapPin, MessageCircle, Phone, Calendar, Loader2, Navigation, Target, Clock, Route } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Map as MapView, MapControls, useMap, MapRoute, type MapRef } from "@/components/ui/map";
import { Marker } from "maplibre-gl";
import { initialWaitingQueue, type WaitingTicket } from "@/data/mockData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { contarCitasPorRutaDia, obtenerCitasPorRutaDia, obtenerCitasDomicilioHoy, actualizarRutaDia } from "@/services/nocodb/citas.service";
import { obtenerPaciente } from "@/services/nocodb/pacientes.service";

const statusLabel: Record<WaitingTicket["status"], string> = {
  programado: "Programada",
  en_ruta: "En ruta",
  en_domicilio: "En domicilio",
  finalizado: "Finalizada",
};

const statusOrder: WaitingTicket["status"][] = ["programado", "en_ruta", "en_domicilio", "finalizado"];

async function geocodificarDireccion(direccion: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${direccion}, Lima, Peru`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    }
  } catch (e) {}
  return null;
}

function MapMarkersPaciente({
  pacienteLoc,
  userLoc,
}: {
  pacienteLoc: { lat: number; lng: number } | null;
  userLoc: { lat: number; lng: number; accuracy?: number } | null;
}) {
  const { map, isLoaded } = useMap();
  const pacienteMarkerRef = useRef<Marker | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);

  
  useEffect(() => {
    if (!map || !isLoaded || !pacienteLoc) return;

    const el = document.createElement("div");
    el.className =
      "flex items-center justify-center w-10 h-10 rounded-full bg-primary shadow-lg border-2 border-white cursor-pointer";
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    const marker = new Marker({ element: el })
      .setLngLat([pacienteLoc.lng, pacienteLoc.lat])
      .addTo(map);
    pacienteMarkerRef.current = marker;

    return () => {
      marker.remove();
      pacienteMarkerRef.current = null;
    };
  }, [map, isLoaded, pacienteLoc]);

  
  useEffect(() => {
    if (!map || !isLoaded || !userLoc) return;

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className =
        "flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600 shadow-lg border-2 border-white cursor-pointer";
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg>`;
      userMarkerRef.current = new Marker({ element: el })
        .setLngLat([userLoc.lng, userLoc.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLoc.lng, userLoc.lat]);
      
      const el = userMarkerRef.current.getElement();
      if (el) {
        el.style.animation = "none";
        el.offsetHeight; 
        el.style.animation = "markerBounce 0.6s ease";
      }
    }

    return () => {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
    };
  }, [map, isLoaded, userLoc]);

  return null;
}

function PacienteMapDialog({ patientName, address, open }: { patientName: string; address: string; open: boolean }) {
  const [pacienteLoc, setPacienteLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [permStatus, setPermStatus] = useState<"prompt" | "granted" | "denied" | "unknown">("unknown");
  const [routes, setRoutes] = useState<{ coords: [number, number][]; duration: number; distance: number }[]>([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const mapRef = useRef<MapRef>(null);

  const mapStyles = {
    default: undefined as string | undefined,
    openstreetmap: "https://tiles.openfreemap.org/styles/bright",
    openstreetmap3d: "https://tiles.openfreemap.org/styles/liberty",
  };
  type MapStyleKey = keyof typeof mapStyles;
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("openstreetmap");
  const selectedMapStyle = mapStyles[mapStyle];

  function formatDuration(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }

  function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  async function fetchOsrmRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.length > 0) {
        const routeData = data.routes.map((r: any) => ({
          coords: r.geometry.coordinates as [number, number][],
          duration: r.duration,
          distance: r.distance,
        }));
        setRoutes(routeData);
        setSelectedRoute(0);
      }
    } catch (e) {
    }
  }

  
  useEffect(() => {
    if (!open) return;
    setGeoLoading(true);
    geocodificarDireccion(address).then((loc) => {
      setPacienteLoc(loc);
      setGeoLoading(false);
    });
  }, [address, open]);

  function handlePosition(pos: GeolocationPosition) {
    setUserLoc({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });
    setLastUpdated(new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setLocError(null);
    setPermStatus("granted");
  }

  function handleError(err: GeolocationPositionError) {
    if (err.code === 1) {
      setLocError("Permiso de ubicación denegado");
      setPermStatus("denied");
    } else if (err.code === 2) {
      setLocError("GPS no disponible. Verifica que esté activado.");
    } else if (err.code === 3) {
      setLocError("Tiempo de espera agotado. Intenta de nuevo o usa una red WiFi.");
    } else {
      setLocError(err.message || "Error obteniendo ubicación");
    }
  }

  
  useEffect(() => {
    if (userLoc && pacienteLoc) {
      fetchOsrmRoute(userLoc, pacienteLoc);
    }
  }, [userLoc, pacienteLoc]);

  
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocalización no soportada por este navegador");
      return;
    }

    
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          setPermStatus(result.state as "prompt" | "granted" | "denied");
          if (result.state === "granted") {
            
            startGpsTracking();
          }
          result.addEventListener("change", () => {
            setPermStatus(result.state as "prompt" | "granted" | "denied");
            if (result.state === "granted") startGpsTracking();
          });
        })
        .catch(() => {
          
          startGpsTracking();
        });
    } else {
      startGpsTracking();
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startGpsTracking() {
    if (!navigator.geolocation) return;

    
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      handleError,
      { enableHighAccuracy: false, timeout: 15000 }
    );

    
    if (watchIdRef.current === null) {
      const id = navigator.geolocation.watchPosition(
        handlePosition,
        (err) => {
        },
        { enableHighAccuracy: false, maximumAge: 5000, timeout: 30000 }
      );
      watchIdRef.current = id;
    }
  }

  function getMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }

    toast.info("Solicitando acceso a tu ubicación...", { duration: 5000 });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos);
        toast.success("Ubicación obtenida correctamente");
      },
      (err) => {
        handleError(err);
        
        if (err.code === 1 || err.code === 3) {
          setPermStatus("denied");
          toast.error("El navegador bloqueó la ubicación. Sigue las instrucciones del banner amarillo arriba del mapa para activarla.", {
            duration: 10000,
          });
        }
      },
      { enableHighAccuracy: false, timeout: 4000 }
    );
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const routeUrl = (() => {
    
    if (isMobile && pacienteLoc) {
      if (userLoc && pacienteLoc) {
        return `https://maps.google.com/maps?saddr=${userLoc.lat},${userLoc.lng}&daddr=${pacienteLoc.lat},${pacienteLoc.lng}&directionsmode=driving`;
      }
      return `https://maps.google.com/maps?daddr=${pacienteLoc.lat},${pacienteLoc.lng}&directionsmode=driving`;
    }
    
    if (userLoc && pacienteLoc) {
      return `https://www.google.com/maps/dir/${userLoc.lat},${userLoc.lng}/${pacienteLoc.lat},${pacienteLoc.lng}?travelmode=driving`;
    }
    if (pacienteLoc) {
      return `https://www.google.com/maps/dir//${pacienteLoc.lat},${pacienteLoc.lng}?travelmode=driving`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  })();

  const hasLocation = userLoc !== null;
  const statusText = hasLocation
    ? `Ubicación activa · ${lastUpdated}`
    : locError
    ? locError
    : "Obteniendo ubicación...";

  const accuracyLabel = userLoc?.accuracy
    ? userLoc.accuracy < 20
      ? "Alta precisión"
      : userLoc.accuracy < 100
      ? "Precisión media"
      : "Baja precisión"
    : null;

  const mapCenter = pacienteLoc
    ? [pacienteLoc.lng, pacienteLoc.lat]
    : [-77.0369, -12.0464];
  const mapZoom = pacienteLoc ? 14 : 10;

  return (
    <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden gap-0" showScrollContainer={false} showPadding={false}>
      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm">{patientName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" /> {address}
          </p>
        </div>
      </div>

      {/* Status bar — banner prominente debajo del header */}
      <div className={cn(
        "mx-5 mb-3 flex items-center gap-2.5 rounded-lg px-4 py-2.5 border",
        hasLocation
          ? "bg-emerald-50 border-emerald-200"
          : locError
          ? "bg-red-50 border-red-200"
          : "bg-amber-50 border-amber-200"
      )}>
        {hasLocation ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Car className="h-4 w-4 text-emerald-600" style={{ animation: "carDrive 0.8s ease-in-out infinite" }} />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        ) : (
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full shrink-0",
              locError ? "bg-red-500" : "bg-amber-500"
            )}
          />
        )}
        <span className={cn(
          "text-xs font-medium flex-1 truncate",
          hasLocation ? "text-emerald-800" : locError ? "text-red-700" : "text-amber-800"
        )}>
          {statusText}
        </span>
        {accuracyLabel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shrink-0">
            <Target className="h-3 w-3" /> {accuracyLabel}
          </span>
        )}
      </div>

      {/* Permiso de ubicación */}
      {(permStatus === "prompt" || permStatus === "denied" || permStatus === "unknown") && !hasLocation && (
        <div className="mx-5 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-medium text-amber-800">
            {permStatus === "denied"
              ? "Permiso de ubicación bloqueado. Para permitirlo:"
              : "Se necesita acceso a tu ubicación para mostrarte en el mapa."}
          </p>
          {permStatus === "denied" && (
            <ol className="mt-1.5 ml-4 list-decimal text-[10px] text-amber-700 space-y-0.5">
              <li>Haz clic en el icono 🔒 de la barra de direcciones</li>
              <li>Busca "Ubicación" o "Location"</li>
              <li>Cámbialo a "Permitir"</li>
              <li>Recarga la página (F5)</li>
            </ol>
          )}
          <Button
            size="sm"
            className="mt-2 h-8 text-[11px] gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={getMyLocation}
          >
            <Navigation className="h-3.5 w-3.5" />
            {permStatus === "denied" ? "Intentar de nuevo" : "Permitir ubicación"}
          </Button>
        </div>
      )}

      {/* Map area */}
      <div className="mx-5 mb-3 relative h-[520px] rounded-xl overflow-hidden border border-border/60 bg-muted/20">
        {geoLoading ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin opacity-40" />
            <span className="text-xs">Geocodificando dirección...</span>
          </div>
        ) : (
          <MapView
            ref={mapRef}
            center={mapCenter as [number, number]}
            zoom={mapZoom}
            theme="light"
            styles={
              selectedMapStyle
                ? { light: selectedMapStyle, dark: selectedMapStyle }
                : undefined
            }
          >
            <MapControls />
            <MapMarkersPaciente pacienteLoc={pacienteLoc} userLoc={userLoc} />
            {routes.map((route, idx) => {
              const isSelected = idx === selectedRoute;
              return (
                <MapRoute
                  key={idx}
                  coordinates={route.coords}
                  color={isSelected ? "#6366f1" : "#94a3b8"}
                  width={isSelected ? 6 : 4}
                  opacity={isSelected ? 0.95 : 0.55}
                  onClick={() => setSelectedRoute(idx)}
                />
              );
            })}
          </MapView>
        )}
        {/* Selector de estilo del mapa */}
        <div className="absolute top-3 right-3 z-10">
          <select
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value as MapStyleKey)}
            className="bg-card/95 text-foreground rounded-lg border border-border/70 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-sm cursor-pointer hover:bg-card"
          >
            <option value="default">Carto (Default)</option>
            <option value="openstreetmap">OpenStreetMap</option>
            <option value="openstreetmap3d">OpenStreetMap 3D</option>
          </select>
        </div>
        {/* Overlay de rutas: selector de alternativas */}
        {routes.length > 0 && (
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
            {routes.map((route, idx) => {
              const isActive = idx === selectedRoute;
              const isFastest = idx === 0;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedRoute(idx)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all",
                    "backdrop-blur-sm border shadow-xl",
                    isActive
                      ? "bg-black text-white border-black"
                      : "bg-card/80 text-foreground border-border/50 hover:bg-card/90"
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Clock className={cn("h-3.5 w-3.5", isActive ? "text-white/70" : "text-muted-foreground")} />
                    <span>{formatDuration(route.duration)}</span>
                  </div>
                  <div className={cn("h-3 w-px", isActive ? "bg-white/30" : "bg-border")} />
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Route className={cn("h-3.5 w-3.5", isActive ? "text-white/70" : "text-muted-foreground")} />
                    <span>{formatDistance(route.distance)}</span>
                  </div>
                  {isFastest && (
                    <span className={cn(
                      "ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      isActive
                        ? "bg-emerald-500 text-white border-emerald-400"
                        : "bg-emerald-100 text-emerald-700 border-emerald-200"
                    )}>
                      Ruta más rápida
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mx-5 mb-5 grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" asChild disabled={!pacienteLoc} className="h-9 text-[11px] gap-1.5">
          <a href={routeUrl} target="_blank" rel="noopener noreferrer">
            <MapPin className="h-3.5 w-3.5" />
            {userLoc ? "Cómo llegar" : "Ver en Google Maps"}
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={getMyLocation}
          className="h-9 text-[11px] gap-1.5"
        >
          <Navigation className="h-3.5 w-3.5" />
          Obtener mi ubicación
        </Button>
      </div>

    </DialogContent>
  );
}

function MapDialogButton({ patientName, address }: { patientName: string; address: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 flex-1 sm:flex-none shrink-0 font-normal"
        >
          <Navigation className="h-3.5 w-3.5" aria-hidden />
          Mapa
        </Button>
      </DialogTrigger>
      <PacienteMapDialog patientName={patientName} address={address} open={open} />
    </Dialog>
  );
}

function telHref(phone: string) {
  return `tel:${phone.replace(/\D/g, "")}`;
}

function waMeUrl(ticket: WaitingTicket) {
  const raw = ticket.whatsapp ?? ticket.phone;
  return `https://wa.me/${raw.replace(/\D/g, "")}`;
}

function mapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function WaitingRoomPage() {
  const [queue, setQueue] = useState<WaitingTicket[]>([]);
  const [finalizadoCount, setFinalizadoCount] = useState(0);
  const [enRutaCount, setEnRutaCount] = useState(0);
  const [enDomicilioCount, setEnDomicilioCount] = useState(0);
  const [programadaCount, setProgramadaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [fechaActual, setFechaActual] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<WaitingTicket["status"] | "todos">("todos");

  
  useEffect(() => {
    const hoy = new Date().toLocaleDateString('es-PE', {
      timeZone: 'America/Lima',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    setFechaActual(hoy.charAt(0).toUpperCase() + hoy.slice(1));
  }, []);

  
  const loadMetrics = async () => {
    try {
      setLoading(true);
      
      
      const enRuta = await contarCitasPorRutaDia("En ruta");
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const enDomicilio = await contarCitasPorRutaDia("En domicilio");
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const finalizado = await contarCitasPorRutaDia("Finalizado");
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const programada = await contarCitasPorRutaDia("Programada");
      
      setEnRutaCount(enRuta.count || 0);
      setEnDomicilioCount(enDomicilio.count || 0);
      setProgramadaCount(programada.count || 0);
      setFinalizadoCount(finalizado.count || 0);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  
  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  
  useEffect(() => {
    const loadVisits = async () => {
      try {
        setLoadingVisits(true);
        const data = await obtenerCitasDomicilioHoy();
        const citas = data.records || [];
        
        
        const resultados: any[] = [];
        for (const cita of citas) {
          const fields = cita.fields || {};
          const pacienteId = fields.pacientes?.id;
          
          if (pacienteId) {
            try {
              const paciente = await obtenerPaciente(pacienteId);
              resultados.push({ cita, paciente });
            } catch (err) {
              resultados.push({ cita, paciente: null });
            }
          } else {
            resultados.push({ cita, paciente: null });
          }
          
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        
        const mappedQueue: WaitingTicket[] = resultados.map(({ cita, paciente }) => {
          const fields = cita.fields || {};
          const pacienteBasico = fields.pacientes || {};
          const pacienteBasicoFields = pacienteBasico.fields || {};
          const pacienteCompletoFields = paciente?.fields || {};
          
          
          const nombre = pacienteCompletoFields.nombreCompleto || pacienteBasicoFields.nombreCompleto || "Sin nombre";
          const direccion = pacienteCompletoFields.Dirección || pacienteBasicoFields.Dirección || pacienteCompletoFields.direccion || pacienteBasicoFields.direccion || "Sin dirección";
          const telefono = pacienteCompletoFields.telefono || pacienteBasicoFields.telefono || "";
          const wasap = pacienteCompletoFields.Wasap || pacienteBasicoFields.Wasap || pacienteCompletoFields.Mensaje?.url || pacienteBasicoFields.Mensaje?.url || telefono;
          const ubicacionUrl = pacienteCompletoFields.Ubicacion?.url || pacienteBasicoFields.Ubicacion?.url || pacienteCompletoFields.EnlaceGoogle || pacienteBasicoFields.EnlaceGoogle || "";
          
          
          let status: WaitingTicket["status"] = "programado";
          if (fields.rutaDia === "En ruta") status = "en_ruta";
          else if (fields.rutaDia === "En domicilio") status = "en_domicilio";
          else if (fields.rutaDia === "Finalizado") status = "finalizado";
          
          return {
            id: cita.id,
            patientName: nombre,
            reason: Array.isArray(fields.tipoProcedimientoCita) 
              ? fields.tipoProcedimientoCita.join(", ") 
              : fields.tipoProcedimientoCita || "Visita a domicilio",
            appointmentTime: fields.horaCita || "00:00",
            visitAddress: direccion,
            phone: telefono,
            whatsapp: wasap,
            priority: fields.calificacion === "alta" ? "alta" : "normal",
            status,
            googleMapsUrl: ubicacionUrl,
          };
        });
        
        setQueue(mappedQueue.sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)));
      } catch (err) {
      } finally {
        setLoadingVisits(false);
      }
    };
    loadVisits();
  }, []);

  const advance = async (id: string) => {
    const ticket = queue.find((t) => t.id === id);
    if (!ticket) return;

    const idx = statusOrder.indexOf(ticket.status);
    if (idx >= statusOrder.length - 1) return;
    const next = statusOrder[idx + 1];

    
    const statusToRutaDia: Record<WaitingTicket["status"], string> = {
      programado: "Programada",
      en_ruta: "En ruta",
      en_domicilio: "En domicilio",
      finalizado: "Finalizado",
    };

    const loadingToast = toast.loading(`Actualizando estado: ${ticket.patientName}...`);

    try {
      await actualizarRutaDia(id, statusToRutaDia[next]);
      setQueue((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          return { ...t, status: next };
        }),
      );
      toast.success(`Estado actualizado: ${ticket.patientName}`, { id: loadingToast });
      
      loadMetrics();
    } catch (err) {
      toast.error("Error al actualizar el estado de la visita", { id: loadingToast });
    }
  };

  const startNextRoute = async () => {
    const next = queue.find((t) => t.status === "programado");
    if (!next) {
      toast.message("No hay visitas pendientes de desplazamiento");
      return;
    }

    const loadingToast = toast.loading(`Iniciando desplazamiento: ${next.patientName}...`);

    try {
      await actualizarRutaDia(next.id, "En ruta");
      setQueue((prev) =>
        prev.map((t) => (t.id === next.id ? { ...t, status: "en_ruta" as const } : t)),
      );
      toast.success(`En ruta: ${next.patientName} → ${next.visitAddress}`, { id: loadingToast });
      
      loadMetrics();
    } catch (err) {
      toast.error("Error al iniciar el desplazamiento", { id: loadingToast });
    }
  };

  const enDomicilio = queue.filter((t) => t.status === "en_domicilio").length;
  const enRuta = queue.filter((t) => t.status === "en_ruta").length;

  
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full bg-[#22b4ad]/10 animate-ping" />
            <div className="absolute w-10 h-10 rounded-full bg-[#22b4ad]/20 animate-pulse" />
            <Loader2 className="h-10 w-10 animate-spin text-[#22b4ad] relative z-10" />
          </div>
          <p className="text-muted-foreground animate-pulse font-medium">Cargando citas de hoy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ruta del día</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {fechaActual}
          </p>
          <p className="text-muted-foreground text-sm mt-0.5">
            Visitas a domicilio: desplazamiento, atención en el hogar del paciente y cierre
          </p>
        </div>
        <Button onClick={startNextRoute} className="shrink-0 gap-2">
          <Bell className="h-4 w-4" />
          Iniciar siguiente desplazamiento
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="card-shadow">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              {loading ? (
                <Skeleton className="h-6 sm:h-8 w-10 sm:w-12" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold tracking-tight">{programadaCount}</p>
              )}
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Programadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-shadow">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              {loading ? (
                <Skeleton className="h-6 sm:h-8 w-10 sm:w-12" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold tracking-tight">{finalizadoCount}</p>
              )}
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Finalizadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-shadow">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <Car className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              {loading ? (
                <Skeleton className="h-6 sm:h-8 w-10 sm:w-12" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold tracking-tight">{enRutaCount}</p>
              )}
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">En ruta</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-shadow">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <Home className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              {loading ? (
                <Skeleton className="h-6 sm:h-8 w-10 sm:w-12" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold tracking-tight">{enDomicilioCount}</p>
              )}
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">En domicilio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-shadow overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col gap-3">
            <div>
              <CardTitle className="text-base">Orden de visitas</CardTitle>
              <CardDescription className="mt-1">
                Cada visita es en el domicilio del paciente. Avanza el estado cuando sales, llegas o finalizas.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "todos", label: "Todas" },
                { value: "programado", label: "Programadas" },
                { value: "en_ruta", label: "En ruta" },
                { value: "en_domicilio", label: "En domicilio" },
                { value: "finalizado", label: "Finalizadas" },
              ] as { value: typeof filtroEstado; label: string }[]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFiltroEstado(value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    filtroEstado === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {label}
                  {value !== "todos" && (
                    <span className="ml-1.5 tabular-nums">
                      ({queue.filter(t => t.status === value).length})
                    </span>
                  )}
                  {value === "todos" && (
                    <span className="ml-1.5 tabular-nums">({queue.length})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingVisits ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
              {[1, 2, 3].map((i) => (
                <li key={i} className="flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-card shadow-sm">
                  <div className="flex items-start gap-3 min-w-0">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                      <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </li>
              ))}
            </ul>
          ) : queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Home className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No hay ruta por hoy</p>
              <p className="text-sm text-muted-foreground mt-1">No tienes visitas a domicilio programadas para hoy</p>
            </div>
          ) : (() => {
            const queueFiltrada = filtroEstado === "todos" ? queue : queue.filter(t => t.status === filtroEstado);
            return queueFiltrada.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm font-medium text-muted-foreground">Sin visitas con este estado</p>
              </div>
            ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
              {queueFiltrada.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex flex-col gap-3 p-3 sm:p-4 rounded-xl border border-border/50 bg-card shadow-sm transition-colors",
                  t.status === "en_domicilio" && "bg-primary/[0.03] border-primary/20",
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                    {t.appointmentTime.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm sm:text-base truncate">{t.patientName}</p>
                      {t.priority === "alta" && (
                        <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase shrink-0">
                          Prioridad
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t.reason}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Visita · {t.appointmentTime}</p>
                  </div>
                </div>

                <div className="mt-1 space-y-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
                  <div className="flex items-start gap-2 text-xs">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ubicación</p>
                      <p className="font-normal text-foreground leading-snug text-xs sm:text-sm">{t.visitAddress}</p>
                      <a
                        href={t.googleMapsUrl || mapsSearchUrl(t.visitAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline mt-0.5 inline-block text-xs"
                      >
                        Ver en mapa →
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 text-xs">
                    <div className="flex items-start gap-2 flex-1">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Teléfono</p>
                        <a
                          href={telHref(t.phone)}
                          className="font-normal tabular-nums truncate hover:text-primary underline-offset-2 hover:underline"
                        >
                          {t.phone}
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-fit">
                      <MapDialogButton patientName={t.patientName} address={t.visitAddress} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 flex-1 sm:flex-none shrink-0 font-normal"
                        asChild
                      >
                        <a href={telHref(t.phone)}>
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          Llamar
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 flex-1 sm:flex-none bg-[#25D366] text-white hover:bg-[#128C7E] shrink-0 shadow-sm font-normal"
                        asChild
                      >
                        <a href={waMeUrl(t)} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                          WhatsApp
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "font-normal text-[10px] sm:text-xs",
                      t.status === "finalizado" && "bg-success/15 text-success hover:bg-success/20",
                      t.status === "en_domicilio" && "bg-primary/15 text-primary hover:bg-primary/20",
                      t.status === "en_ruta" && "bg-warning/15 text-warning hover:bg-warning/20",
                    )}
                  >
                    {statusLabel[t.status]}
                  </Badge>
                  {t.status !== "finalizado" && (
                    <Button size="sm" variant="outline" onClick={() => advance(t.id)} className="gap-1 h-8 text-xs">
                      {t.status === "en_domicilio" ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
                        </>
                      ) : (
                        "Siguiente paso"
                      )}
                    </Button>
                  )}
                </div>
              </li>
            ))}
            </ul>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
