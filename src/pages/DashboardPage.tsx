import { Link } from "react-router-dom";
import { useMemo, useState, useEffect, useRef, useId } from "react";
import {
  Users,
  CalendarDays,
  Clock,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  MapPinned,
  Stethoscope,
  Package,
  Receipt,
  FileText,
  ClipboardList,
  AlertTriangle,
  MapPin,
  Footprints,
  ChevronRight,
  LayoutGrid,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  appointmentsPerDayWindow,
  cumulativeCountChronologicalFiltered,
  cumulativeCountsPerDayInRange,
  cumulativePatientsByRegistration,
} from "@/lib/metricSparklineSeries";
import { clinicToday } from "@/data/mockData";
import { addDaysIso } from "@/lib/clinicDates";
import { formatSoles } from "@/lib/currency";

// Servicios NocoDB
import { obtenerPacientesRegistrados } from "@/services/nocodb/pacientes.service";
import { obtenerCitasResumen } from "@/services/nocodb/citas.service";
import { obtenerInventario } from "@/services/nocodb/inventario.service";
import { obtenerFacturacionResumen } from "@/services/nocodb/facturacion.service";

// Tipos
interface PacienteAPI {
  id: string | number;
  fields?: {
    nombreCompleto?: string;
    estadoPaciente?: string;
    fechaRegistro?: string;
  };
  name?: string;
  status?: string;
  registeredAt?: string;
}

interface CitaAPI {
  id: string | number;
  fields?: {
    pacienteAsociado?: string;
    fechaCitas?: string;
    horaCita?: string;
    progreso?: string;
    direccionCita?: string;
    tipoPaciente?: string;
    notasCita?: string;
    tipoProcedimientoCita?: string[];
  };
  patientName?: string;
  date?: string;
  time?: string;
  status?: string;
  visitAddress?: string;
  notes?: string;
}

interface InventarioItem {
  id: string | number;
  fields?: {
    articulo?: string;
    sku?: string;
    Categoria?: string;
    Actual?: number;
    Minimo?: number;
    unidad?: string;
  };
  name?: string;
  units?: number;
  minUnits?: number;
  unit?: string;
}

interface FacturaAPI {
  id: string | number;
  fields?: {
    nombreCompletoPaciente?: string;
    conceptoFacturacion?: string;
    importeTotal?: number;
    estadoFacturacion?: string;
  };
  patientName?: string;
  concept?: string;
  amountPen?: number;
  status?: string;
}

const quickLinks = [
  { to: "/ruta-dia", label: "Ruta del día", hint: "Orden del día", icon: MapPinned, accent: "from-violet-500/15 to-primary/8 ring-violet-500/10" },
  { to: "/citas", label: "Visitas", hint: "Agenda", icon: CalendarDays, accent: "from-sky-500/15 to-primary/8 ring-sky-500/10" },
  { to: "/servicios", label: "Servicios", hint: "Tarifas", icon: Stethoscope, accent: "from-emerald-500/15 to-primary/8 ring-emerald-500/10" },
  { to: "/inventario", label: "Inventario", hint: "Stock", icon: Package, accent: "from-amber-500/15 to-primary/8 ring-amber-500/10" },
  { to: "/facturacion", label: "Facturación", hint: "Cobros", icon: Receipt, accent: "from-rose-500/12 to-primary/8 ring-rose-500/10" },
  { to: "/documentacion", label: "Plantillas", hint: "Documentos", icon: FileText, accent: "from-cyan-500/15 to-primary/8 ring-cyan-500/10" },
] as const;

const WELCOME_TITLE = "Bienvenida, Dra. Herlinda Zevallos";
const WELCOME_TITLE_PREFIX = "Bienvenida, ";
const WELCOME_SUBTITLE =
  "Que tenga una excelente jornada de podología a domicilio: pies sanos, prevención y tratamientos con la tranquilidad de quien confía en su cuidado profesional.";

const WELCOME_SEEN_KEY = "sole-dashboard-welcome-typewriter-once";

function hasWelcomeBeenSeen(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    /* almacenamiento no disponible */
  }
}

function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const endRef = useRef(end);
  const requestRef = useRef<number>();

  useEffect(() => {
    endRef.current = end;
    countRef.current = 0;
    setCount(0);

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function: easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      
      countRef.current = Math.round(easeProgress * endRef.current);
      setCount(countRef.current);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [end, duration]);

  return count;
}

const COLOR_MAP: Record<string, string> = {
  "text-primary": "#22b4ad",
  "text-success": "#22c55e",
  "text-warning": "#f59e0b",
  "text-info": "#3b82f6",
};

function MiniSparkline({
  values,
  colorClassName,
  className,
}: {
  values: number[];
  colorClassName?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const color = COLOR_MAP[colorClassName || ""] || "#22b4ad";
  const data = values.map((v, i) => ({ i, v }));
  const gradId = `g-${uid}`;
  return (
    <span className={`inline-flex shrink-0 ${className || ""}`}>
      <ResponsiveContainer width={88} height={36}>
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2.25}
            fill={`url(#${gradId})`}
            dot={false}
            animationDuration={850}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </span>
  );
}

export default function DashboardPage() {
  const [titleLen, setTitleLen] = useState(() => (hasWelcomeBeenSeen() ? WELCOME_TITLE.length : 0));
  const [subtitleLen, setSubtitleLen] = useState(() => (hasWelcomeBeenSeen() ? WELCOME_SUBTITLE.length : 0));
  const [loading, setLoading] = useState(true);

  // Estados para datos de APIs
  const [patientsData, setPatientsData] = useState<PacienteAPI[]>([]);
  const [appointmentsData, setAppointmentsData] = useState<CitaAPI[]>([]);
  const [inventoryData, setInventoryData] = useState<InventarioItem[]>([]);
  const [facturacionData, setFacturacionData] = useState<{ facturas: FacturaAPI[]; totalFacturado: number; pendienteCobro: number; cobrado: number } | null>(null);
  const [statsSummary, setStatsSummary] = useState({
    totalPacientes: 0,
    pacientesActivos: 0,
    pacientesInactivos: 0,
    totalCitas: 0,
    citasConfirmadas: 0,
    citasPendientes: 0,
    citasCanceladas: 0,
  });
  const [patronSemanal, setPatronSemanal] = useState<{ dia: string; visitas: number }[]>([]);

  // Cargar datos de APIs
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [pacientesRes, citasRes, inventarioRes, facturacionRes] = await Promise.all([
          obtenerPacientesRegistrados(),
          obtenerCitasResumen(),
          obtenerInventario(),
          obtenerFacturacionResumen(),
        ]);

        setStatsSummary({
          totalPacientes: pacientesRes.count || 0,
          pacientesActivos: pacientesRes.activos || 0,
          pacientesInactivos: pacientesRes.inactivos || 0,
          totalCitas: citasRes.count || 0,
          citasConfirmadas: citasRes.confirmadas || 0,
          citasPendientes: citasRes.pendientes || 0,
          citasCanceladas: citasRes.canceladas || 0,
        });

        setPatientsData(pacientesRes.pacientes || []);
        setAppointmentsData(citasRes.citas || []);
        setPatronSemanal(citasRes.patronSemanal || []);
        // obtenerInventario devuelve un objeto con records, extraer el array
        const inventoryArray = Array.isArray(inventarioRes) 
          ? inventarioRes 
          : (inventarioRes?.records || []);
        setInventoryData(inventoryArray);
        setFacturacionData({
          facturas: facturacionRes.facturas || [],
          totalFacturado: facturacionRes.totalFacturado || 0,
          pendienteCobro: facturacionRes.pendienteCobro || 0,
          cobrado: facturacionRes.cobrado || 0,
        });
      } catch (error) {
        console.error("Error cargando datos del dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (hasWelcomeBeenSeen()) return;

    let cancelled = false;
    const charMs = 38;
    const pauseBeforeSubtitleMs = 380;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      timeouts.push(setTimeout(fn, ms));
    };

    const runTitle = (i: number) => {
      if (cancelled) return;
      if (i <= WELCOME_TITLE.length) {
        setTitleLen(i);
        if (i < WELCOME_TITLE.length) {
          schedule(() => runTitle(i + 1), charMs);
        } else {
          schedule(() => runSubtitle(0), pauseBeforeSubtitleMs);
        }
      }
    };

    const runSubtitle = (i: number) => {
      if (cancelled) return;
      if (i <= WELCOME_SUBTITLE.length) {
        setSubtitleLen(i);
        if (i < WELCOME_SUBTITLE.length) {
          schedule(() => runSubtitle(i + 1), Math.round(charMs * 0.65));
        } else {
          markWelcomeSeen();
        }
      }
    };

    schedule(() => runTitle(1), 120);
    return () => {
      cancelled = true;
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, []);

  const titleShown = WELCOME_TITLE.slice(0, titleLen);
  const titlePart1 = titleShown.slice(0, WELCOME_TITLE_PREFIX.length);
  const titlePart2 = titleShown.slice(WELCOME_TITLE_PREFIX.length);
  const typingTitle = titleLen < WELCOME_TITLE.length;
  const typingSubtitle = titleLen >= WELCOME_TITLE.length && subtitleLen < WELCOME_SUBTITLE.length;
  const showCursor = typingTitle || typingSubtitle;

  const { stats, statSparklines } = useMemo(() => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const since7 = addDaysIso(hoy, -7);
    const until7 = addDaysIso(hoy, 7);

    // Normaliza la fecha de una cita — fields.fecha es la fecha ISO real (YYYY-MM-DD)
    // fields.fechaCitas es texto descriptivo tipo "20/04/2026 - Cita ...", NO usar para filtrar
    const getCitaFecha = (a: any): string => {
      const raw = a.fields?.fecha || a.fields?.fechaCopy || a.date || "";
      if (!raw) return "";
      return typeof raw === 'string' ? raw.split('T')[0] : "";
    };

    const getCitaProgreso = (a: any): string =>
      a.fields?.progreso || a.status || "";

    // Usar datos reales de la API
    const newPatientsWeek = patientsData.filter((p) => {
      const regDate = (p.fields?.fechaRegistro || p.registeredAt || "").split('T')[0];
      return regDate >= since7 && regDate <= hoy;
    }).length;

    const todayCount = appointmentsData.filter((a) => getCitaFecha(a) === hoy).length;

    const pendingNextWeek = appointmentsData.filter((a) => {
      const status = getCitaProgreso(a);
      const date = getCitaFecha(a);
      return status === "Pendiente" && date >= hoy && date <= until7;
    }).length;

    // Contar pendientes reales (estado Pendiente)
    const pending = appointmentsData.filter((a) => getCitaProgreso(a) === "Pendiente").length;

    const statsRow = [
      { label: "Total Pacientes", value: statsSummary.totalPacientes, icon: Users, change: `${newPatientsWeek} alta(s) en 7 días`, up: true, color: "text-primary" },
      { label: "Visitas hoy", value: todayCount, icon: CalendarDays, change: `Ruta ${hoy}`, up: true, color: "text-success" },
      { label: "Visitas pendientes", value: pending, icon: Clock, change: `${pendingNextWeek} próx. 7 días`, up: pendingNextWeek <= 5, color: "text-warning" },
      { label: "Nuevos (7 días)", value: newPatientsWeek, icon: UserPlus, change: "Según fecha de registro", up: newPatientsWeek > 0, color: "text-info" },
    ];

    // Preparar datos válidos para sparklines
    const validPatientsForSparkline = patientsData.filter((p: any) => {
      const date = (p.fields?.fechaRegistro || p.registeredAt || "").split('T')[0];
      return date && date.length >= 8;
    });

    const validAppointmentsForSparkline = appointmentsData.filter((a: any) => {
      const date = getCitaFecha(a);
      return date && date.length >= 8;
    });

    // Sparklines usando datos reales
    const statSparklines = [
      cumulativePatientsByRegistration(validPatientsForSparkline as any),
      appointmentsPerDayWindow(validAppointmentsForSparkline as any, hoy, 12),
      cumulativeCountChronologicalFiltered(validAppointmentsForSparkline as any, (a: any) => getCitaFecha(a), (a: any) => getCitaProgreso(a) === "Pendiente"),
      cumulativeCountsPerDayInRange(since7, hoy, (d) => patientsData.filter((p) => (p.fields?.fechaRegistro || p.registeredAt || "").split('T')[0] === d).length),
    ];

    return { stats: statsRow, statSparklines };
  }, [patientsData, appointmentsData, statsSummary]);

  // Animated values for stats
  const animatedPatientCount = useCountUp(stats[0]?.value || 0, 800);
  const animatedVisitsToday = useCountUp(stats[1]?.value || 0, 800);
  const animatedPendingVisits = useCountUp(stats[2]?.value || 0, 800);
  const animatedNewPatients = useCountUp(stats[3]?.value || 0, 800);

  // Fecha real de Lima (usada también para filtros de listas)
  const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

  // Normaliza fecha de cita — usa fields.fecha (ISO YYYY-MM-DD) como fuente principal
  const getCitaFechaLocal = (a: CitaAPI): string => {
    // fields.fecha es la fecha ISO real; fields.fechaCitas es texto descriptivo, NO fecha
    const raw = (a as any).fields?.fecha || (a as any).fields?.fechaCopy || a.date || "";
    if (!raw) return "";
    return typeof raw === 'string' ? raw.split('T')[0] : "";
  };
  const getCitaProgresoLocal = (a: CitaAPI): string => (a as any).fields?.progreso || a.status || "";
  const getCitaNombrePaciente = (a: CitaAPI): string =>
    (a as any).fields?.pacientes?.fields?.nombreCompleto ||
    (a as any).fields?.pacienteAsociado ||
    a.patientName || "Sin nombre";

  // Datos derivados de las APIs
  const recentPatients = patientsData.slice(-3).reverse();

  const todayAppointments = appointmentsData
    .filter((a) => getCitaFechaLocal(a) === todayLima)
    .sort((a, b) => {
      const tA = (a as any).fields?.horaCita || a.time || "";
      const tB = (b as any).fields?.horaCita || b.time || "";
      return tA.localeCompare(tB);
    });

  const upcomingAppointments = appointmentsData
    .filter((a) => {
      const status = getCitaProgresoLocal(a);
      const date = getCitaFechaLocal(a);
      return (status === "Pendiente") && date >= todayLima;
    })
    .sort((a, b) => {
      const dateA = getCitaFechaLocal(a);
      const dateB = getCitaFechaLocal(b);
      const timeA = (a as any).fields?.horaCita || a.time || "";
      const timeB = (b as any).fields?.horaCita || b.time || "";
      return `${dateA}${timeA}`.localeCompare(`${dateB}${timeB}`);
    })
    .slice(0, 5);

  // Patrón semanal real: últimos 7 días contando visitas por día
  const patronSemanal7dias = useMemo(() => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = addDaysIso(hoy, i - 6);
      const fechaObj = new Date(d + 'T12:00:00');
      const label = diasSemana[fechaObj.getDay()];
      const visitas = appointmentsData.filter((a) => {
        const f = (a as any).fields?.fecha || (a as any).fields?.fechaCopy || a.date || "";
        return typeof f === 'string' && f.split('T')[0] === d;
      }).length;
      return { dia: label, fecha: d, visitas };
    });
    console.log("[Dashboard] patronSemanal7dias:", result);
    return result;
  }, [appointmentsData, todayLima]);

  const lowStock = inventoryData.filter((i) => {
    const units = i.fields?.Actual ?? i.units ?? 0;
    const minUnits = i.fields?.Minimo ?? i.minUnits ?? 0;
    return units <= minUnits;
  });
  
  const pendingInvoices = facturacionData?.facturas?.filter((i) => {
    const status = i.fields?.estadoFacturacion || i.status;
    return status === "Pendiente" || status === "parcial";
  }) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Podología a domicilio: agenda, rutas y seguimiento</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/25 text-primary font-normal">
            Ruta del día {clinicToday}
          </Badge>
          <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10">
            <Link to="/historial">
              <ClipboardList className="h-4 w-4 mr-1" />
              Ver historial
            </Link>
          </Button>
        </div>
      </div>

      <Card className="card-shadow relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-emerald-600/[0.06] animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" aria-hidden />
        <CardContent className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <Footprints className="h-8 w-8" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1" aria-live="off">
            <Badge variant="outline" className="mb-1 border-primary/30 bg-background/60 text-[10px] font-semibold uppercase tracking-widest text-primary">
              Anuncio
            </Badge>
            <h2 className="text-balance break-words text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              <span>{titlePart1}</span>
              <span className="text-primary">{titlePart2}</span>
              {showCursor && typingTitle && (
                <span
                  className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.12em] animate-pulse bg-primary align-middle"
                  aria-hidden
                />
              )}
            </h2>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground max-w-2xl min-h-[3.5rem]">
              {WELCOME_SUBTITLE.slice(0, subtitleLen)}
              {showCursor && typingSubtitle && (
                <span
                  className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.1em] animate-pulse bg-muted-foreground align-middle"
                  aria-hidden
                />
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <section
        aria-label="Accesos rápidos"
        className="relative overflow-hidden rounded-2xl border border-primary/12 bg-gradient-to-br from-primary/[0.07] via-background to-emerald-600/[0.04] card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.12) 1px, transparent 0)`,
            backgroundSize: "20px 20px",
          }}
          aria-hidden
        />
        <div className="relative px-4 py-5 sm:px-6 sm:py-6">
          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm ring-1 ring-primary/15">
                <LayoutGrid className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">Accesos rápidos</h2>
                <p className="text-sm text-muted-foreground">Gestión de visitas y desplazamientos</p>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {quickLinks.map(({ to, label, hint, icon: Icon, accent }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="group flex h-full flex-col rounded-xl border border-border/70 bg-card/90 p-3 shadow-sm ring-1 ring-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-md hover:ring-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                >
                  <div
                    className={`relative mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent} shadow-inner ring-1`}
                  >
                    <Icon className="h-6 w-6 text-primary transition-transform duration-200 group-hover:scale-105" aria-hidden />
                  </div>
                  <span className="text-center text-sm font-semibold leading-tight text-foreground">{label}</span>
                  <span className="mt-0.5 text-center text-[11px] font-medium text-muted-foreground">{hint}</span>
                  <span className="mt-2 flex items-center justify-center gap-0.5 text-[11px] font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    Abrir
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-auto p-1 bg-muted/60">
          <TabsTrigger value="resumen" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            Resumen del servicio
          </TabsTrigger>
          <TabsTrigger value="operacion" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            Ruta y alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6 mt-4 outline-none">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <Card key={`sk-${i}`} className="card-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <Skeleton className="h-8 w-20 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-10 w-24 rounded-md" />
                  </div>
                </CardContent>
              </Card>
            ))
          : stats.map((stat, i) => (
              <Card key={stat.label} className={`card-shadow hover:card-shadow-hover transition-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-${[100, 150, 200, 250][i] || 300}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${stat.color} animate-in zoom-in-50 duration-500 delay-${100 + i * 50}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-medium ${stat.up ? "text-success" : "text-warning"} animate-in fade-in slide-in-from-right-2 duration-500 delay-${150 + i * 50}`}>
                      {stat.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {stat.change}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div className="min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-${200 + i * 50}">
                      <p className="text-2xl font-bold tabular-nums">
                        {i === 0 ? animatedPatientCount : i === 1 ? animatedVisitsToday : i === 2 ? animatedPendingVisits : animatedNewPatients}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                    <MiniSparkline
                      values={statSparklines[i]}
                      colorClassName={stat.color}
                      className="pb-0.5"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <Card className="card-shadow">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full rounded-lg" />
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full rounded-lg" />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Visitas a domicilio por día</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-[3fr_130px] gap-4 items-center">
                <ChartContainer
                  config={{ visitas: { label: "Visitas", color: "hsl(177 68% 42%)" } }}
                  className="h-[200px] sm:h-[260px] justify-center"
                >
                  <AreaChart data={patronSemanal7dias.length > 0 ? patronSemanal7dias : []}>
                    <defs>
                      <linearGradient id="visitasGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(177 68% 42%)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(177 68% 42%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="visitas"
                      stroke="hsl(177 68% 42%)"
                      strokeWidth={2.5}
                      fill="url(#visitasGradient)"
                      dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ChartContainer>
                <div className="flex flex-col justify-center gap-3 border-l pl-4">
                  {(() => {
                    const total = patronSemanal7dias.reduce((s, d) => s + (d.visitas || 0), 0);
                    const pico = patronSemanal7dias.reduce((m, d) => (d.visitas || 0) > (m.visitas || 0) ? d : m, patronSemanal7dias[0] || { dia: "-", visitas: 0 });
                    const diasConDatos = patronSemanal7dias.filter(d => (d.visitas || 0) > 0).length || 1;
                    return (
                      <>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total semana</p>
                          <p className="text-xl font-bold text-foreground">{total}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Día pico</p>
                          <p className="text-sm font-semibold text-primary">{pico.dia} · {pico.visitas}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Promedio/día</p>
                          <p className="text-sm font-semibold text-foreground">{(total / diasConDatos).toFixed(1)}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Estado de citas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-[3fr_130px] gap-4 items-center">
                <ChartContainer
                  config={{
                    confirmada: { label: "Confirmada", color: "#22c55e" },
                    pendiente: { label: "Pendiente", color: "#f59e0b" },
                    cancelada: { label: "Cancelada", color: "#ef4444" },
                  }}
                  className="h-[200px] sm:h-[260px] justify-center"
                >
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={[
                        { name: "Confirmada", value: appointmentsData.filter((a) => getCitaProgresoLocal(a) === "Confirmada").length, key: "confirmada" },
                        { name: "Pendiente", value: appointmentsData.filter((a) => getCitaProgresoLocal(a) === "Pendiente").length, key: "pendiente" },
                        { name: "Cancelada", value: appointmentsData.filter((a) => getCitaProgresoLocal(a) === "Cancelada").length, key: "cancelada" },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                      dataKey="value"
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col justify-center gap-3 border-l pl-4">
                  {(() => {
                    const confirmadas = appointmentsData.filter((a) => getCitaProgresoLocal(a) === "Confirmada").length;
                    const pendientes = appointmentsData.filter((a) => getCitaProgresoLocal(a) === "Pendiente").length;
                    const canceladas = appointmentsData.filter((a) => getCitaProgresoLocal(a) === "Cancelada").length;
                    const total = confirmadas + pendientes + canceladas;
                    const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
                    return (
                      <>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total citas</p>
                          <p className="text-xl font-bold text-foreground">{total}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">% Confirmadas</p>
                          <p className="text-sm font-semibold text-success">{pct(confirmadas)}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">% Pendientes</p>
                          <p className="text-sm font-semibold text-warning">{pct(pendientes)}%</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Activity & Reminders */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Últimos Pacientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPatients.map((p) => {
              const name = p.fields?.nombreCompleto || p.name || "Sin nombre";
              const status = p.fields?.estadoPaciente || p.status || "activo";
              const regDate = p.fields?.fechaRegistro || p.registeredAt || "-";
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">Registro: {regDate}</p>
                  </div>
                  <Badge variant={status === "activo" ? "default" : "secondary"} className={status === "activo" ? "bg-success/10 text-success hover:bg-success/20 border-0" : ""}>
                    {status}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Visitas de hoy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayAppointments.map((a) => {
              const patientName = getCitaNombrePaciente(a);
              const time = (a as any).fields?.horaCita || a.time || "-";
              const notes = (a as any).fields?.notasCita || (a as any).fields?.notes || a.notes || "-";
              const address = (a as any).fields?.direccion || (a as any).fields?.direccionCita || a.visitAddress || "-";
              const status = getCitaProgresoLocal(a);
              return (
                <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium">{patientName}</p>
                    <p className="text-xs text-muted-foreground">{time} · {notes}</p>
                    <p className="text-xs text-primary/90 mt-1 flex items-start gap-1">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{address}</span>
                    </p>
                  </div>
                  <Badge className={
                    status === "Confirmada" || status === "atendido" ? "bg-success/10 text-success hover:bg-success/20 border-0" :
                    status === "Pendiente" || status === "pendiente" ? "bg-warning/10 text-warning hover:bg-warning/20 border-0" :
                    status === "Cancelada" ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0" :
                    "bg-muted text-muted-foreground border-0"
                  }>
                    {status}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="card-shadow animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Próximas visitas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAppointments.map((a) => {
              const patientName = getCitaNombrePaciente(a);
              const date = getCitaFechaLocal(a) || a.date || "-";
              const time = (a as any).fields?.horaCita || a.time || "-";
              const address = (a as any).fields?.direccion || (a as any).fields?.direccionCita || a.visitAddress || "-";
              return (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{patientName}</p>
                    <p className="text-xs text-muted-foreground">{date} · {time}</p>
                    <p className="text-xs text-primary/90 truncate">{address}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="operacion" className="mt-4 outline-none space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="card-shadow border-warning/25 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Inventario bajo mínimo
                </CardTitle>
                <CardDescription>Reposición sugerida antes de fin de semana</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {lowStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin alertas de stock en este momento.</p>
                ) : (
                  lowStock.map((i) => {
                    const name = i.fields?.articulo || i.name || "Sin nombre";
                    const units = i.fields?.Actual ?? i.units ?? 0;
                    const minUnits = i.fields?.Minimo ?? i.minUnits ?? 0;
                    const unit = i.fields?.unidad || i.unit || "und";
                    const sku = i.fields?.sku || "-";
                    return (
                      <div
                        key={i.id}
                        className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-medium truncate pr-2">{name}</span>
                          <span className="text-xs text-muted-foreground">({sku})</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          {units}/{minUnits} {unit}
                        </span>
                      </div>
                    );
                  })
                )}
                <Button variant="secondary" size="sm" className="w-full mt-2 bg-primary/10 text-primary hover:bg-primary/15" asChild>
                  <Link to="/inventario">Abrir inventario</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="card-shadow border-primary/10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Cobros pendientes
                </CardTitle>
                <CardDescription>Facturas con importe abierto</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingInvoices.map((inv) => {
                  const patientName = inv.fields?.nombreCompletoPaciente || inv.patientName || "Sin nombre";
                  const concept = inv.fields?.conceptoFacturacion || inv.concept || "-";
                  const amount = inv.fields?.importeTotal || inv.amountPen || 0;
                  const status = inv.fields?.estadoFacturacion || inv.status || "Pendiente";
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{patientName}</p>
                        <p className="text-xs text-muted-foreground truncate">{concept}</p>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <p className="font-semibold tabular-nums">{formatSoles(amount)}</p>
                        <Badge variant="outline" className="text-[10px] font-normal border-primary/20 text-primary capitalize">
                          {status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                <Button variant="secondary" size="sm" className="w-full mt-2 bg-primary/10 text-primary hover:bg-primary/15" asChild>
                  <Link to="/facturacion">Ir a facturación</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
