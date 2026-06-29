import { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  ArrowUpRight,
  Activity,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Map as MapView, MapControls, useMap, MapPopup, type MapRef } from "@/components/ui/map";
import { Marker } from "maplibre-gl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { obtenerPacientesRegistrados } from "@/services/nocodb/pacientes.service";
import { obtenerCitasResumen, contarCitasPorPaciente } from "@/services/nocodb/citas.service";
import { obtenerHistorialResumen } from "@/services/nocodb/historialMedico.service";
import { obtenerFacturacionResumen } from "@/services/nocodb/facturacion.service";
import { AreaChartShadcn } from "@/components/charts/AreaChartShadcn";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
} from "recharts";
import {
  appointments,
  invoices,
  medicalRecords,
  monthlyStats,
  patients,
  weeklyHomeVisits,
} from "@/data/mockData";
import { formatSoles } from "@/lib/currency";
import { SparklineAreaAnimated } from "@/components/charts/SparklineAreaAnimated";
import {
  cumulativeAppointmentsByDate,
  cumulativeInvoiceAmountByDate,
  cumulativeMedicalRecordsByDate,
  cumulativePatientsByRegistration,
} from "@/lib/metricSparklineSeries";

const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const tasaCumplimientoConfig = {
  asistencia: {
    label: "Cumplimiento (%)",
    color: "hsl(217 91% 60%)",
  },
} satisfies ChartConfig;

const visitStatusConfig = {
  cantidad: {
    label: "Cantidad",
    color: "hsl(217 91% 60%)",
  },
} satisfies ChartConfig;

const patronSemanalConfig = {
  visitas: {
    label: "Visitas",
    color: "hsl(217 91% 60%)",
  },
} satisfies ChartConfig;

const visitasDomicilioConfig = {
  visitas: {
    label: "Visitas",
    color: "hsl(217 91% 60%)",
  },
} satisfies ChartConfig;


function useAnimatedNumber(value: number, duration: number = 1000): number {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const startValue = displayValue;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (value - startValue) * easeOut);

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return displayValue;
}

function ymKey(iso: string): string {
  return iso.slice(0, 7);
}

function labelForYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}


const DISTRITOS_LIMA = [
  "Ancón", "Ate", "Barranco", "Breña", "Carabayllo", "Cercado de Lima", "Chaclacayo", "Chorrillos",
  "Cieneguilla", "Comas", "El Agustino", "Independencia", "Jesús María", "La Molina", "La Victoria",
  "Lince", "Los Olivos", "Lurigancho", "Lurín", "Magdalena", "Miraflores", "Pachacámac", "Pucusana",
  "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rímac", "San Bartolo",
  "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis",
  "San Martín de Porres", "San Miguel", "Santa Anita", "Santa Clara", "Santa María del Mar",
  "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador", "Villa María del Triunfo",
];

function extraerDistrito(direccion: string): string | null {
  const upper = direccion.toUpperCase();
  for (const distrito of DISTRITOS_LIMA) {
    if (upper.includes(distrito.toUpperCase())) {
      return distrito;
    }
  }
  return null;
}

function MapMarkersLayer({
  coords,
  onSelect,
}: {
  coords: { distrito: string; visitas: number; lng: number; lat: number }[];
  onSelect?: (distrito: string) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const markers: Marker[] = [];

    coords.forEach((p) => {
      const el = document.createElement("div");
      el.className =
        "bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap shadow-lg cursor-pointer flex items-center gap-1";
      el.innerHTML = `<span>${p.distrito}</span><span class="bg-white/20 px-1 rounded">${p.visitas}</span>`;
      el.title = `${p.distrito}: ${p.visitas} visitas`;

      el.addEventListener("click", () => onSelect?.(p.distrito));

      const marker = new Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      markers.push(marker);
    });

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, isLoaded, coords, onSelect]);

  return null;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [pacientesRegistradosCount, setPacientesRegistradosCount] = useState<number>(0);
  const [pacientesActivos, setPacientesActivos] = useState<number>(0);
  const [pacientesInactivos, setPacientesInactivos] = useState<number>(0);
  const [pacientesPorMesAPI, setPacientesPorMesAPI] = useState<{ periodo: string; nuevos: number }[]>([]);
  const [pacientesCoords, setPacientesCoords] = useState<
    { distrito: string; visitas: number; lng: number; lat: number }[]
  >([]);
  const [selectedDistrito, setSelectedDistrito] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<"carto" | "osm" | "osm3d">("carto");
  const mapRef = useRef<MapRef>(null);
  const is3D = mapStyle === "osm3d";
  const [pacientesLoading, setPacientesLoading] = useState(true);
  const [pacientesError, setPacientesError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  
  useEffect(() => {
    if (!pacientesLoading) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [pacientesLoading]);

  const [citasCount, setCitasCount] = useState<number>(0);
  const [citasConfirmadas, setCitasConfirmadas] = useState<number>(0);
  const [citasPendientes, setCitasPendientes] = useState<number>(0);
  const [citasCanceladas, setCitasCanceladas] = useState<number>(0);
  const [citasDescontinuadas, setCitasDescontinuadas] = useState<number>(0);
  const [patronSemanal, setPatronSemanal] = useState<{ dia: string; visitas: number }[]>([]);
  const [tasaCumplimientoAPI, setTasaCumplimientoAPI] = useState<{ periodo: string; asistencia: number }[]>([]);
  const [visitasDomicilioPorMes, setVisitasDomicilioPorMes] = useState<{ periodo: string; visitas: number }[]>([]);
  const [citasLoading, setCitasLoading] = useState(true);
  const [citasError, setCitasError] = useState<string | null>(null);

  const [historialCount, setHistorialCount] = useState<number>(0);
  const [diagnosticosUnicos, setDiagnosticosUnicos] = useState<number>(0);
  const [fichasPorMesAPI, setFichasPorMesAPI] = useState<{ periodo: string; fichas: number }[]>([]);
  const [historialLoading, setHistorialLoading] = useState(true);
  const [historialError, setHistorialError] = useState<string | null>(null);

  const [facturacionTotal, setFacturacionTotal] = useState<number>(0);
  const [facturacionPendiente, setFacturacionPendiente] = useState<number>(0);
  const [facturacionCobrada, setFacturacionCobrada] = useState<number>(0);
  const [facturasCount, setFacturasCount] = useState<number>(0);
  const [revenueByMonthAPI, setRevenueByMonthAPI] = useState<{ periodo: string; soles: number }[]>([]);
  const [facturacionLoading, setFacturacionLoading] = useState(true);
  const [facturacionError, setFacturacionError] = useState<string | null>(null);

  
  async function geocodeAddress(address: string): Promise<{ lng: number; lat: number } | null> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ", Lima, Peru")}&limit=1`,
        { headers: { "User-Agent": "SoleFlowManager/1.0" } }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return { lng: parseFloat(data[0].lon), lat: parseFloat(data[0].lat) };
      }
    } catch (e) {
    }
    return null;
  }

  const [mapCargado, setMapCargado] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);

  
  useEffect(() => {
    async function cargarPacientes() {
      try {
        setPacientesLoading(true);
        const result = await obtenerPacientesRegistrados();
        setPacientesRegistradosCount(result.count || 0);
        setPacientesActivos(result.activos || 0);
        setPacientesInactivos(result.inactivos || 0);
        setPacientesPorMesAPI(result.pacientesPorMes || []);
        setPacientesError(null);
      } catch (err) {
        setPacientesError("Error al cargar");
      } finally {
        setPacientesLoading(false);
      }
    }
    cargarPacientes();
  }, []);

  
  async function cargarMapa() {
    if (mapCargado || mapLoading) return;
    try {
      setMapLoading(true);
      const result = await obtenerPacientesRegistrados();
      const pacientes = result.pacientes || [];
      const porPaciente: { distrito: string; visitas: number; lng: number; lat: number }[] = [];

      for (const p of pacientes) {
        const pacienteId = p.id;
        const dir: string = p.fields?.Dirección || "";
        const enlace: string = p.fields?.EnlaceGoogle || "";
        const distrito = extraerDistrito(dir) || extraerDistrito(enlace) || "Lima";

        let visitas = 0;
        try {
          const countResult = await contarCitasPorPaciente(pacienteId);
          visitas = countResult.count || 0;
        } catch (e) {
        }

        const coord = await geocodeAddress(distrito);
        if (coord) porPaciente.push({ distrito, visitas, ...coord });

        
        await new Promise((r) => setTimeout(r, 1100));
      }

      const acumuladoMap = new Map<string, { distrito: string; visitas: number; lng: number; lat: number }>();
      for (const item of porPaciente) {
        const existing = acumuladoMap.get(item.distrito);
        if (existing) existing.visitas += item.visitas;
        else acumuladoMap.set(item.distrito, { ...item });
      }
      setPacientesCoords(Array.from(acumuladoMap.values()));
      setMapCargado(true);
    } catch (err) {
    } finally {
      setMapLoading(false);
    }
  }

  
  useEffect(() => {
    async function cargarCitas() {
      try {
        setCitasLoading(true);
        const result = await obtenerCitasResumen();
        setCitasCount(result.count || 0);
        setCitasConfirmadas(result.confirmadas || 0);
        setCitasPendientes(result.pendientes || 0);
        setCitasCanceladas(result.canceladas || 0);
        setCitasDescontinuadas(result.descontinuadas || 0);
        setPatronSemanal(result.patronSemanal || []);
        setTasaCumplimientoAPI(result.tasaCumplimientoPorMes || []);
        setVisitasDomicilioPorMes(result.visitasDomicilioPorMes || []);
        setCitasError(null);
      } catch (err) {
        setCitasError("Error al cargar");
      } finally {
        setCitasLoading(false);
      }
    }
    cargarCitas();
  }, []);

  
  useEffect(() => {
    async function cargarHistorial() {
      try {
        setHistorialLoading(true);
        const result = await obtenerHistorialResumen();
        setHistorialCount(result.count || 0);
        setDiagnosticosUnicos(result.diagnosticosUnicos || 0);
        setFichasPorMesAPI(result.fichasPorMes || []);
        setHistorialError(null);
      } catch (err) {
        setHistorialError("Error al cargar");
      } finally {
        setHistorialLoading(false);
      }
    }
    cargarHistorial();
  }, []);

  
  useEffect(() => {
    async function cargarFacturacion() {
      try {
        setFacturacionLoading(true);
        const result = await obtenerFacturacionResumen();
        setFacturasCount(result.count || 0);
        setFacturacionTotal(result.totalFacturado || 0);
        setFacturacionPendiente(result.pendienteCobro || 0);
        setFacturacionCobrada(result.cobrado || 0);
        setRevenueByMonthAPI(result.revenueByMonth || []);
        setFacturacionError(null);
      } catch (err) {
        setFacturacionError("Error al cargar");
      } finally {
        setFacturacionLoading(false);
      }
    }
    cargarFacturacion();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const {
    kpi,
    visitStatusRows,
    revenueByMonth,
    clinicalByMonth,
    cancelRate,
    tasaCierre,
    sparkVisitas,
    sparkPacientes,
    sparkFichas,
    sparkFacturacion,
  } = useMemo(() => {
    const pend = appointments.filter((a) => a.status === "pendiente").length;
    const atend = appointments.filter((a) => a.status === "atendido").length;
    const canc = appointments.filter((a) => a.status === "cancelado").length;
    const n = appointments.length || 1;

    const totalFacturado = invoices.reduce((s, i) => s + i.amountPen, 0);
    const pendienteCobro = invoices.filter((i) => i.status === "Pendiente" || i.status === "Parcial").reduce((s, i) => s + i.amountPen, 0);

    
    const visitStatusRowsInner: Record<string, string|number>[] = citasCount > 0 ? [
      { estado: "Confirmada", cantidad: citasConfirmadas },
      { estado: "Pendiente", cantidad: citasPendientes },
      { estado: "Cancelada", cantidad: citasCanceladas },
      { estado: "Descontinuado", cantidad: citasDescontinuadas },
    ] : [
      { estado: "Pendiente", cantidad: pend },
      { estado: "Atendido", cantidad: atend },
      { estado: "Cancelado", cantidad: canc },
    ];

    
    let revenueByMonthInner: Record<string, string|number>[];
    if (revenueByMonthAPI.length > 0) {
      revenueByMonthInner = revenueByMonthAPI;
    } else {
      const revenueMap = new Map<string, number>();
      for (const inv of invoices) {
        const k = ymKey(inv.date);
        revenueMap.set(k, (revenueMap.get(k) ?? 0) + inv.amountPen);
      }
      const revenueKeys = [...revenueMap.keys()].sort();
      revenueByMonthInner = revenueKeys.map((k) => ({
        periodo: labelForYm(k),
        soles: Math.round(revenueMap.get(k) ?? 0),
      }));
    }

    
    let clinicalByMonthInner: Record<string, string|number>[];
    if (fichasPorMesAPI.length > 0) {
      clinicalByMonthInner = fichasPorMesAPI;
    } else {
      const clinMap = new Map<string, number>();
      for (const r of medicalRecords) {
        const k = ymKey(r.date);
        clinMap.set(k, (clinMap.get(k) ?? 0) + 1);
      }
      const clinKeys = [...clinMap.keys()].sort();
      clinicalByMonthInner = clinKeys.map((k) => ({
        periodo: labelForYm(k),
        fichas: clinMap.get(k) ?? 0,
      }));
    }

    return {
      kpi: {
        visitas: citasCount || appointments.length,
        pacientes: pacientesRegistradosCount || patients.length,
        fichas: historialCount || medicalRecords.length,
        facturacion: facturacionTotal || totalFacturado,
        pendiente: facturacionPendiente || pendienteCobro,
        activosPct: Math.round((patients.filter((p) => p.status === "activo").length / (patients.length || 1)) * 100),
        tasaCierre: Math.round((atend / n) * 100),
        cancelRate: Math.round((canc / n) * 100),
      },
      visitStatusRows: visitStatusRowsInner,
      revenueByMonth: revenueByMonthInner,
      clinicalByMonth: clinicalByMonthInner,
      cancelRate: Math.round((canc / n) * 100),
      tasaCierre: Math.round((atend / n) * 100),
      sparkVisitas: cumulativeAppointmentsByDate(appointments),
      sparkPacientes: cumulativePatientsByRegistration(patients),
      sparkFichas: cumulativeMedicalRecordsByDate(medicalRecords),
      sparkFacturacion: cumulativeInvoiceAmountByDate(invoices),
    };
  }, [pacientesRegistradosCount, pacientesActivos, pacientesInactivos, pacientesPorMesAPI, citasCount, citasConfirmadas, citasPendientes, citasCanceladas, citasDescontinuadas, tasaCumplimientoAPI, historialCount, diagnosticosUnicos, fichasPorMesAPI, facturacionTotal, facturacionPendiente, facturacionCobrada, revenueByMonthAPI]);

  
  const animVisitas = useAnimatedNumber(citasCount || kpi.visitas, 1200);
  const animPacientes = useAnimatedNumber(pacientesRegistradosCount || kpi.pacientes, 1200);
  const animFichas = useAnimatedNumber(historialCount || kpi.fichas, 1200);
  const animFacturacion = useAnimatedNumber(facturacionTotal || kpi.facturacion, 1200);

  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full bg-primary/10 animate-ping" />
            <div className="absolute w-10 h-10 rounded-full bg-primary/20 animate-pulse" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-muted-foreground animate-pulse font-medium">Generando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">
          Indicadores clave en tiempo real desde NocoDB: pacientes registrados, citas, historial clínico y facturación.
          Sirven para ver carga de trabajo, cierre de visitas, actividad clínica e ingresos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-shadow border-primary/10">
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums">
                {citasLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary inline" />
                ) : (
                  animVisitas
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Visitas en agenda</p>
              <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                {citasError ? (
                  <span className="text-destructive">{citasError}</span>
                ) : (
                  <>Progreso: <span className="font-medium text-success">{Math.round((citasConfirmadas / (citasCount || 1)) * 100)}%</span> ({citasConfirmadas}/{citasCount})</>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground/90 mt-1.5">Tendencia: acumulado por fecha de visita · Datos en tiempo real</p>
            </div>
            <SparklineAreaAnimated
              values={sparkVisitas}
              delayMs={0}
              color="hsl(217,91%,60%)"
              className="shrink-0 self-center"
            />
          </CardContent>
        </Card>
        <Card className="card-shadow border-primary/10">
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums">
                {pacientesLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary inline" />
                ) : (
                  animPacientes
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pacientes registrados</p>
              <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                {pacientesError ? (
                  <span className="text-destructive">{pacientesError}</span>
                ) : (
                  <><span className="font-medium text-success">{pacientesRegistradosCount}</span> pacientes registrados</>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground/90 mt-1.5">Tendencia: altas por fecha de registro · Datos en tiempo real</p>
            </div>
            <SparklineAreaAnimated
              values={sparkPacientes}
              delayMs={85}
              color="hsl(213,94%,68%)"
              className="shrink-0 self-center"
            />
          </CardContent>
        </Card>
        <Card className="card-shadow border-primary/10">
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums">
                {historialLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary inline" />
                ) : (
                  animFichas
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Fichas en historial clínico</p>
              <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                {historialError ? (
                  <span className="text-destructive">{historialError}</span>
                ) : (
                  <><span className="font-medium text-info">{historialCount}</span> registros en historial</>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground/90 mt-1.5">Tendencia: acumulado por fecha de ficha · Datos en tiempo real</p>
            </div>
            <SparklineAreaAnimated
              values={sparkFichas}
              delayMs={170}
              color="hsl(217,91%,60%)"
              className="shrink-0 self-center"
            />
          </CardContent>
        </Card>
        <Card className="card-shadow border-primary/10">
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums">
                {facturacionLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary inline" />
                ) : (
                  formatSoles(animFacturacion)
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Facturación acumulada</p>
              <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                {facturacionError ? (
                  <span className="text-destructive">{facturacionError}</span>
                ) : (
                  <>Pendiente: <span className="font-medium text-warning">{formatSoles(facturacionPendiente || kpi.pendiente)}</span> · Cobrado: <span className="font-medium text-success">{formatSoles(facturacionCobrada)}</span></>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground/90 mt-1.5">Tendencia: acumulado por fecha de factura · Datos en tiempo real</p>
            </div>
            <SparklineAreaAnimated
              values={sparkFacturacion}
              delayMs={255}
              color="hsl(212,95%,68%)"
              className="shrink-0 self-center"
            />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Operación y agenda</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prioriza seguimiento de pendientes y detecta cuellos de botella en la ruta a domicilio.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Estado actual de las visitas</CardTitle>
              <CardDescription>
                Distribución real de la agenda: pendientes (por realizar), atendidas y canceladas. Ideal para cuadrar la carga del día.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6 flex items-center justify-center">
              <PieChart width={280} height={220}>
                <Pie
                  data={visitStatusRows}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  strokeWidth={2}
                  stroke="white"
                  dataKey="cantidad"
                  nameKey="estado"
                >
                  {visitStatusRows.map((entry: any, index: number) => {
                    const colors = [
                      "hsl(152 45% 42%)",
                      "hsl(217 91% 60%)",
                      "hsl(0 72% 55%)",
                      "hsl(215 12% 46%)",
                    ];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, name: string, props: any) => {
                    const total = visitStatusRows.reduce((s: number, r: any) => s + (r.cantidad || 0), 0);
                    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                    return [`${value} (${pct}%)`, name];
                  }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(220 13% 91%)",
                    background: "white",
                  }}
                />
                <RechartsLegend
                  verticalAlign="bottom"
                  iconType="circle"
                  formatter={(value: string) => (
                    <span className="text-muted-foreground text-xs">{value}</span>
                  )}
                />
              </PieChart>
            </CardContent>
          </Card>

          <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Patrón semanal de visitas (referencia)</CardTitle>
              <CardDescription>
                Promedio de visitas por día de la semana en la operación habitual. Ayuda a planificar rutas y refuerzos.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
              <ChartContainer
                config={patronSemanalConfig}
                className="aspect-auto h-[250px] w-full"
              >
                <BarChart data={(patronSemanal.length > 0 ? patronSemanal : weeklyHomeVisits) as any[]} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <XAxis
                    dataKey={patronSemanal.length > 0 ? "dia" : "day"}
                    tick={{ fontSize: 11, fill: "hsl(215 12% 46%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(215 12% 46%)" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <ChartTooltip
                    cursor={{ fill: "hsl(220 13% 91%)", opacity: 0.4 }}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar dataKey="visitas" fill="hsl(217 91% 60%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Clínica y facturación</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Volumen documentado en historial e ingresos facturados por mes (datos en tiempo real desde NocoDB).
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Fichas clínicas por mes</CardTitle>
              <CardDescription>
                Número de registros de atención por mes desde NocoDB. Indica intensidad de actividad clínica real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historialLoading ? (
                <div className="flex items-center justify-center h-[260px]">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : clinicalByMonth.length === 0 ? (
                <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                  Sin datos de fichas clínicas
                </div>
              ) : (
                <AreaChartShadcn
                  data={clinicalByMonth}
                  xKey="periodo"
                  yKey="fichas"
                  variant="area"
                  height={260}
                  color="hsl(217 91% 60%)"
                />
              )}
            </CardContent>
          </Card>

          <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Distribución de facturación</CardTitle>
              <CardDescription>
                Estado de los cobros: importes pagados vs pendientes de cobro.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 h-auto sm:h-[260px]">
                <PieChart width={200} height={200}>
                  <Pie
                    data={[
                      { name: "Cobrado", value: facturacionCobrada },
                      { name: "Pendiente", value: facturacionPendiente },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    strokeWidth={3}
                    stroke="white"
                    dataKey="value"
                  >
                    <Cell fill="hsl(217 91% 60%)" />
                    <Cell fill="hsl(220 13% 91%)" />
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [formatSoles(value), name]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid hsl(220 13% 91%)",
                      background: "white",
                    }}
                  />
                  <RechartsLegend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value: string) => (
                      <span className="text-muted-foreground text-xs">{value}</span>
                    )}
                  />
                </PieChart>
                <div className="flex-1 space-y-4 sm:space-y-6 w-full sm:w-auto">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full" style={{ backgroundColor: "hsl(217 91% 60%)" }} />
                      <span className="text-sm sm:text-base text-muted-foreground">Cobrado</span>
                    </div>
                    <span className="text-sm sm:text-base font-semibold">{formatSoles(facturacionCobrada)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full" style={{ backgroundColor: "hsl(220 13% 91%)" }} />
                      <span className="text-sm sm:text-base text-muted-foreground">Pendiente</span>
                    </div>
                    <span className="text-sm sm:text-base font-semibold">{formatSoles(facturacionPendiente)}</span>
                  </div>
                  <div className="pt-3 sm:pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-base font-medium">Total facturado</span>
                      <span className="text-lg sm:text-xl font-bold">{formatSoles(facturacionTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tendencias y metas (serie mensual)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Datos en tiempo real desde NocoDB: evolución mensual de fichas clínicas, pacientes nuevos y tasa de cumplimiento.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Visitas a domicilio por mes</CardTitle>
              <CardDescription>
                Visitas con tipo &quot;domicilio&quot; agrupadas por mes · Datos en tiempo real desde NocoDB.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
              {citasLoading ? (
                <div className="flex items-center justify-center h-[250px]">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : visitasDomicilioPorMes.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  Sin datos de visitas a domicilio
                </div>
              ) : (
                <ChartContainer
                  config={visitasDomicilioConfig}
                  className="aspect-auto h-[250px] w-full"
                >
                  <LineChart
                    data={visitasDomicilioPorMes}
                    margin={{ left: 12, right: 12 }}
                  >
                    <XAxis
                      dataKey="periodo"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 11, fill: "hsl(215 12% 46%)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(215 12% 46%)" }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Line
                      dataKey="visitas"
                      type="natural"
                      stroke="hsl(217 91% 60%)"
                      strokeWidth={2}
                      dot={{ fill: "hsl(217 91% 60%)", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Pacientes nuevos por mes</CardTitle>
              <CardDescription>Altas reales de pacientes desde NocoDB por mes de registro; útil para prever demanda.</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pt-0 sm:px-6">
              {(() => {
                const rows: any[] = pacientesPorMesAPI.length > 0 ? pacientesPorMesAPI : monthlyStats;
                const totalNuevos = rows.reduce((sum: number, r: any) => sum + (r.nuevos || 0), 0);
                const promedio = rows.length > 0 ? Math.round(totalNuevos / rows.length) : 0;
                const maxNuevos = rows.length > 0 ? Math.max(...rows.map((r: any) => r.nuevos || 0)) : 0;
                const mejorMes = rows.reduce((best: any, r: any) => ((r.nuevos || 0) > (best?.nuevos || 0) ? r : best), rows[0]);
                const ultimoMes: any = rows[rows.length - 1];
                const penultimoMes: any = rows.length > 1 ? rows[rows.length - 2] : null;
                const ultimoValor = ultimoMes?.nuevos || 0;
                const penultimoValor = penultimoMes?.nuevos || 0;
                const diff = penultimoValor > 0 ? Math.round(((ultimoValor - penultimoValor) / penultimoValor) * 100) : 0;
                const tendenciaUp = diff >= 0;

                return (
                  <div className="space-y-4">
                    {/* Grid de métricas */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Users className="h-3.5 w-3.5" />
                          <span className="text-[11px] uppercase tracking-wide font-medium">Total altas</span>
                        </div>
                        <p className="text-2xl font-bold tracking-tight">{totalNuevos}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{rows.length} meses registrados</p>
                      </div>

                      <div className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Activity className="h-3.5 w-3.5" />
                          <span className="text-[11px] uppercase tracking-wide font-medium">Promedio / mes</span>
                        </div>
                        <p className="text-2xl font-bold tracking-tight">{promedio}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">pacientes por mes</p>
                      </div>

                      <div className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          <span className="text-[11px] uppercase tracking-wide font-medium">Mejor mes</span>
                        </div>
                        <p className="text-lg font-bold truncate">{mejorMes?.periodo || mejorMes?.month || "-"}</p>
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {mejorMes?.nuevos || 0} pacientes
                        </Badge>
                      </div>

                      <div className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="text-[11px] uppercase tracking-wide font-medium">Último mes</span>
                        </div>
                        <p className="text-lg font-bold truncate">{ultimoMes?.periodo || ultimoMes?.month || "-"}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge
                            variant={tendenciaUp ? "default" : "destructive"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {tendenciaUp ? "+" : ""}{diff}%
                          </Badge>
                          {tendenciaUp ? (
                            <TrendingUp className="h-3 w-3 text-primary" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-destructive" />
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Lista de meses con barras */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Evolución mensual
                      </h4>
                      <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                        {rows.map((row: any, index: number) => {
                          const pct = maxNuevos > 0 ? Math.round(((row.nuevos || 0) / maxNuevos) * 100) : 0;
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{row.periodo || row.month}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold tabular-nums">{row.nuevos}</span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
                                </div>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tasa de cumplimiento (%)</CardTitle>
              <CardDescription>
                Porcentaje real de citas confirmadas vs total por mes desde NocoDB (indicador de calidad operativa).
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
              {citasLoading ? (
                <div className="flex items-center justify-center h-[250px]">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : tasaCumplimientoAPI.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  Sin datos de tasa de cumplimiento
                </div>
              ) : (
              <ChartContainer
                config={tasaCumplimientoConfig}
                className="aspect-auto h-[250px] w-full"
              >
                <AreaChart data={tasaCumplimientoAPI}>
                  <defs>
                    <linearGradient id="fillCumplimiento" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="hsl(217 91% 60%)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(217 91% 60%)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="periodo"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={40}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.periodo}
                        indicator="dot"
                      />
                    }
                  />
                  <Area
                    dataKey="asistencia"
                    type="natural"
                    fill="url(#fillCumplimiento)"
                    stroke="hsl(217 91% 60%)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Distrito con más visitas</CardTitle>
              <CardDescription>
                Zona geográfica con mayor concentración de atenciones a domicilio.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0" style={{ padding: "9px 17px" }}>
              <div className="h-[300px] w-full relative">
                {pacientesLoading ? (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-6">
                    <div className="w-full space-y-3">
                      <Skeleton className="h-4 w-3/4 mx-auto" />
                      <Skeleton className="h-4 w-1/2 mx-auto" />
                      <Skeleton className="h-4 w-2/3 mx-auto" />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Recopilando información del servidor en tiempo real, un momento por favor... ({elapsedSeconds}s)</span>
                    </div>
                  </div>
                ) : !mapCargado ? (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-muted/20 rounded-xl border border-border/50">
                    <MapPin className="h-8 w-8 text-muted-foreground/50" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">Mapa de distritos</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-[220px]">
                        Geocodifica las direcciones de pacientes para mostrar el mapa
                      </p>
                    </div>
                    <Button size="sm" className="gap-2" onClick={cargarMapa} disabled={mapLoading}>
                      {mapLoading ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando mapa...</>
                      ) : (
                        <><MapPin className="h-3.5 w-3.5" /> Cargar mapa</>
                      )}
                    </Button>
                    {mapLoading && (
                      <p className="text-[11px] text-muted-foreground">Esto puede tardar unos segundos...</p>
                    )}
                  </div>
                ) : (
                  <>
                    <MapView
                      ref={mapRef}
                      center={[-77.0369, -12.0464]}
                      zoom={6}
                      theme="light"
                      styles={
                        mapStyle === "osm"
                          ? { light: "https://tiles.openfreemap.org/styles/bright", dark: "https://tiles.openfreemap.org/styles/bright" }
                          : mapStyle === "osm3d"
                          ? { light: "https://tiles.openfreemap.org/styles/liberty", dark: "https://tiles.openfreemap.org/styles/liberty" }
                          : undefined
                      }
                    >
                      <MapControls />
                      <MapMarkersLayer coords={pacientesCoords} onSelect={setSelectedDistrito} />
                      {selectedDistrito && (() => {
                        const d = pacientesCoords.find((c) => c.distrito === selectedDistrito);
                        if (!d) return null;
                        return (
                          <MapPopup
                            longitude={d.lng}
                            latitude={d.lat}
                            onClose={() => setSelectedDistrito(null)}
                            closeButton
                            closeOnClick={false}
                          >
                            <div className="space-y-3 min-w-[180px] p-1">
                              <div className="flex items-center justify-between">
                                <h3 className="font-bold text-sm">{d.distrito}</h3>
                                <Badge variant="secondary" className="text-[10px]">
                                  {d.visitas} visitas
                                </Badge>
                              </div>
                              <Separator className="my-2" />
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Users className="h-3.5 w-3.5" />
                                  <span>Pacientes registrados</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>{d.visitas} citas acumuladas</span>
                                </div>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-2 text-center">
                                <p className="text-lg font-bold text-primary">{d.visitas}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total visitas</p>
                              </div>
                            </div>
                          </MapPopup>
                        );
                      })()}
                    </MapView>
                    <div className="absolute top-3 right-3 z-10">
                      <Select value={mapStyle} onValueChange={(v) => setMapStyle(v as typeof mapStyle)}>
                        <SelectTrigger className="w-[140px] h-8 text-xs bg-background/90 backdrop-blur-sm shadow-sm">
                          <SelectValue placeholder="Estilo mapa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="carto">Carto (Default)</SelectItem>
                          <SelectItem value="osm">OpenStreetMap</SelectItem>
                          <SelectItem value="osm3d">OpenStreetMap 3D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
