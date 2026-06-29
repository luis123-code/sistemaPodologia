import { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  ClipboardList,
  Users,
  Stethoscope,
  FileText,
  FolderOpen,
  X,
  Pencil,
  MessageCircle,
  MapPin,
  Upload,
  Calendar,
  Star,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientSearchDropdown } from "@/components/PatientSearchDropdown";
import { medicalRecords as initialRecords, patients, clinicToday, type MedicalRecord } from "@/data/mockData";
import { contarHistorialTotal, contarDiagnosticosUnicos, obtenerRegistrosPorPacienteAsociado, historialPorCita, crearRegistroV3 } from "@/services/nocodb/historialMedico.service";
import { obtenerPacientesConCita, contarCitasEsteMes, crearCitaV3 } from "@/services/nocodb/citas.service";
import { buscarPacientePorCampo, actualizarPacienteV3, obtenerPaciente, obtenerPacientesRegistrados } from "@/services/nocodb/pacientes.service";
import { fetchWithThrottle } from "@/services/nocodb/core/client";
import { addMonthsMonthStart, monthStartIso } from "@/lib/clinicDates";
import { toast } from "sonner";
import { SparklineAreaAnimated } from "@/components/charts/SparklineAreaAnimated";
import {
  cumulativeMedicalRecordsByDate,
  cumulativeRecordsInMonthChronological,
  runningUniqueDiagnosisCount,
  runningUniquePatientCount,
} from "@/lib/metricSparklineSeries";

type DetailPanel = null | { type: "expediente"; patientId: string };

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

export default function MedicalHistoryPage() {
  const [records, setRecords] = useState<MedicalRecord[]>(() => [...initialRecords]);
  const [search, setSearch] = useState("");
  const [patientFilterId, setPatientFilterId] = useState<string | null>(null);
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null);
  const [recordEditOpen, setRecordEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [totalHistorialCount, setTotalHistorialCount] = useState<number>(0);
  const [pacientesConCitaCount, setPacientesConCitaCount] = useState<number>(0);
  const [pacientesConHistorial, setPacientesConHistorial] = useState<any[]>([]);
  const [diagnosticosUnicosCount, setDiagnosticosUnicosCount] = useState<number>(0);
  const [citasEsteMesCount, setCitasEsteMesCount] = useState<number>(0);
  const [expedientePacienteAPI, setExpedientePacienteAPI] = useState<any>(null);
  const [expedienteRegistrosAPI, setExpedienteRegistrosAPI] = useState<any[]>([]);
  const [loadingExpediente, setLoadingExpediente] = useState(false);
  
  // Estados para el formulario de agregar historial médico
  const [nuevoHistorialOpen, setNuevoHistorialOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"historial" | "cita">("historial");
  const [citaSeleccionadaTexto, setCitaSeleccionadaTexto] = useState("");
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [nuevoHistorial, setNuevoHistorial] = useState({
    problemas: "",
    receta: "",
    antecedentesPatalogico: "",
    Anamnesis: "",
    tipoProcedimiento: [] as string[],
    observacionMes: "",
    imagenPodologica: null as File | null,
    citaId: ""
  });
  
  // Estados para el dropdown de citas
  const [citasDisponibles, setCitasDisponibles] = useState<any[]>([]);
  const [citasFiltradas, setCitasFiltradas] = useState<any[]>([]);
  const [showCitasDropdown, setShowCitasDropdown] = useState(false);
  const [cargandoCitas, setCargandoCitas] = useState(false);
  
  // Estados para el modal de crear cita rápida
  const [crearCitaOpen, setCrearCitaOpen] = useState(false);
  const [newVisitForm, setNewVisitForm] = useState({
    fecha: "",
    horaCita: "",
    progreso: "Confirmada",
    tipoPaciente: "",
    calificacion: 0,
    tipoProcedimientoCita: [] as string[],
  });
  const [patientSearch, setPatientSearch] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<any[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  // Cargar todos los pacientes al hacer focus en el input
  const loadAllPatients = async () => {
    if (patientSearchResults.length > 0) return;
    setPatientSearchLoading(true);
    try {
      const data = await obtenerPacientesRegistrados();
      setPatientSearchResults(data.pacientes || []);
      setShowPatientDropdown(true);
    } catch (err) {
      console.error("Error al cargar pacientes:", err);
      setPatientSearchResults([]);
    } finally {
      setPatientSearchLoading(false);
    }
  };

  // Buscar pacientes cuando cambia el texto de búsqueda
  useEffect(() => {
    const searchPatients = async () => {
      if (patientSearch.length >= 2) {
        setPatientSearchLoading(true);
        try {
          const results = await buscarPacientePorCampo("nombreCompleto", "like", patientSearch);
          setPatientSearchResults(results?.records || []);
        } catch (err) {
          console.error("Error al buscar pacientes:", err);
          setPatientSearchResults([]);
        } finally {
          setPatientSearchLoading(false);
        }
      } else {
        setPatientSearchResults([]);
      }
    };
    const timeoutId = setTimeout(searchPatients, 300);
    return () => clearTimeout(timeoutId);
  }, [patientSearch]);

  // Cargar citas desde la API cuando se abre el modal y filtrar las que no tienen historial médico
  useEffect(() => {
    const loadCitas = async () => {
      if (nuevoHistorialOpen) {
        setCargandoCitas(true);
        try {
          const response = await fetchWithThrottle(
            `https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/myd8mjv9kx9ejjx/records`,
            {
              method: "GET",
              headers: {
                "xc-token": import.meta.env.VITE_NOCODB_TOKEN,
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            console.log("Citas cargadas:", data);
            
            // Filtrar citas que no tienen historial médico
            const citasSinHistorial: any[] = [];
            for (const cita of data.records || []) {
              try {
                const historial = await historialPorCita(cita.id);
                if (!historial.records || historial.records.length === 0) {
                  citasSinHistorial.push(cita);
                }
              } catch (err) {
                console.error("Error al verificar historial de cita:", cita.id, err);
                // Si hay error, asumimos que no tiene historial
                citasSinHistorial.push(cita);
              }
            }
            
            console.log("Citas sin historial:", citasSinHistorial);
            setCitasDisponibles(citasSinHistorial);
            setCitasFiltradas(citasSinHistorial);
          }
        } catch (err) {
          console.error("Error al cargar citas:", err);
        } finally {
          setCargandoCitas(false);
        }
      }
    };
    loadCitas();
  }, [nuevoHistorialOpen]);

  // Cargar count total de historial médico desde la API
  useEffect(() => {
    const loadTotalCount = async () => {
      try {
        const result = await contarHistorialTotal();
        const countValue = result.count !== undefined ? result.count : 0;
        setTotalHistorialCount(countValue);
      } catch (err) {
        console.error("Error al cargar count total de historial:", err);
      }
    };
    loadTotalCount();
  }, []);

  // Cargar count de pacientes con cita desde la API
  useEffect(() => {
    const loadPacientesConCita = async () => {
      try {
        const result = await obtenerPacientesConCita();
        setPacientesConCitaCount(result.count || 0);
        setPacientesConHistorial(result.pacientes || []);
      } catch (err) {
        console.error("Error al cargar count de pacientes con cita:", err);
      }
    };
    loadPacientesConCita();
  }, []);

  // Cargar count de diagnósticos únicos desde la API
  useEffect(() => {
    const loadDiagnosticosUnicos = async () => {
      try {
        const result = await contarDiagnosticosUnicos();
        setDiagnosticosUnicosCount(result.count || 0);
      } catch (err) {
        console.error("Error al cargar count de diagnósticos únicos:", err);
      }
    };
    loadDiagnosticosUnicos();
  }, []);

  // Cargar count de citas del mes actual desde la API
  useEffect(() => {
    const loadCitasEsteMes = async () => {
      try {
        const result = await contarCitasEsteMes();
        setCitasEsteMesCount(result.count || 0);
      } catch (err) {
        console.error("Error al cargar count de citas del mes:", err);
      }
    };
    loadCitasEsteMes();
  }, []);

  // Cargar datos del paciente desde la API cuando se abre el expediente
  useEffect(() => {
    const loadExpedientePaciente = async () => {
      if (detailPanel?.type === "expediente" && detailPanel.patientId) {
        setLoadingExpediente(true);
        try {
          const pacienteId = parseInt(detailPanel.patientId);
          console.log("Cargando paciente con ID:", pacienteId);
          const paciente = await obtenerPaciente(pacienteId);
          console.log("Paciente cargado:", paciente);
          setExpedientePacienteAPI(paciente);
          
          // Obtener historial por cada cita del paciente
          const citas = paciente.fields?.citas || [];
          console.log("Citas del paciente:", citas);
          
          const registrosHistorial: any[] = [];
          for (const cita of citas) {
            const citaId = cita.id;
            const fechaCitasCompleta = cita.fields?.fechaCitas || "—";
            const fechaCita = fechaCitasCompleta.split(' - ')[0] || "—";
            const horaCita = fechaCitasCompleta.split(' - ')[1] || "";
            const fechaHoraCita = horaCita ? `${fechaCita} ${horaCita}` : fechaCita;
            console.log("Cargando historial para cita ID:", citaId, "fecha:", fechaHoraCita);
            try {
              const historial = await historialPorCita(citaId);
              console.log("Historial de cita:", citaId, historial);
              if (historial.records && historial.records.length > 0) {
                // Agregar fechaCita y horaCita a cada registro de historial
                const registrosConFecha = historial.records.map((reg: any) => ({
                  ...reg,
                  fields: {
                    ...reg.fields,
                    fechaCita: fechaCita,
                    horaCita: horaCita,
                    fechaHoraCita: fechaHoraCita
                  }
                }));
                registrosHistorial.push(...registrosConFecha);
              } else {
                // Si la cita no tiene historial, agregar un registro vacío
                registrosHistorial.push({
                  id: `cita-${citaId}`,
                  fields: {
                    fechaCita: fechaCita,
                    horaCita: horaCita,
                    fechaHoraCita: fechaHoraCita,
                    CreatedAt: fechaHoraCita,
                    problemas: "Sin registro",
                    tipoProcedimiento: [],
                    observacionMes: "Esta cita no tiene historial médico registrado",
                    antecedentesPatalogico: "",
                    Anamnesis: ""
                  }
                });
              }
            } catch (err) {
              console.error("Error al cargar historial de cita:", citaId, err);
              // Agregar registro vacío en caso de error
              registrosHistorial.push({
                id: `cita-error-${citaId}`,
                fields: {
                  fechaCita: fechaCita,
                  horaCita: horaCita,
                  fechaHoraCita: fechaHoraCita,
                  CreatedAt: fechaHoraCita,
                  problemas: "Error al cargar",
                  tipoProcedimiento: [],
                  observacionMes: "No se pudo cargar el historial de esta cita",
                  antecedentesPatalogico: "",
                  Anamnesis: ""
                }
              });
            }
          }
          
          console.log("Registros de historial:", registrosHistorial);
          setExpedienteRegistrosAPI(registrosHistorial);
        } catch (err) {
          console.error("Error al cargar paciente del expediente:", err);
          setExpedientePacienteAPI(null);
          setExpedienteRegistrosAPI([]);
        } finally {
          setLoadingExpediente(false);
        }
      } else {
        setExpedientePacienteAPI(null);
        setExpedienteRegistrosAPI([]);
      }
    };
    loadExpedientePaciente();
  }, [detailPanel?.patientId]);

  const openRecordEdit = (r: MedicalRecord) => {
    setEditingRecord({ ...r });
    setRecordEditOpen(true);
  };

  const saveRecordEdit = () => {
    if (!editingRecord?.diagnosis?.trim()) {
      toast.error("El diagnóstico es obligatorio");
      return;
    }
    setRecords((prev) => prev.map((x) => (x.id === editingRecord.id ? editingRecord : x)));
    toast.success("Ficha clínica actualizada");
    setRecordEditOpen(false);
    setEditingRecord(null);
  };

  const historyStats = useMemo(() => {
    const totalRecords = records.length;
    const uniquePatients = new Set(records.map((r) => r.patientId)).size;
    const uniqueDiagnoses = new Set(records.map((r) => r.diagnosis)).size;
    const monthStart = monthStartIso(clinicToday);
    const nextMonthStart = addMonthsMonthStart(monthStart, 1);
    const thisMonth = records.filter((r) => r.date >= monthStart && r.date < nextMonthStart).length;
    return {
      totalRecords,
      uniquePatients,
      uniqueDiagnoses,
      thisMonth,
    };
  }, [records, clinicToday]);

  const indicatorCards = useMemo(() => {
    const monthStart = monthStartIso(clinicToday);
    const nextMonthStart = addMonthsMonthStart(monthStart, 1);
    return [
      {
        label: "Total Registros",
        value: totalHistorialCount,
        icon: ClipboardList,
        color: "text-primary",
        bg: "bg-primary/10",
        spark: cumulativeMedicalRecordsByDate(records),
      },
      {
        label: "Pacientes con historial",
        value: pacientesConCitaCount,
        icon: Users,
        color: "text-success",
        bg: "bg-success/10",
        spark: runningUniquePatientCount(records),
      },
      {
        label: "Diagnósticos únicos",
        value: diagnosticosUnicosCount,
        icon: Stethoscope,
        color: "text-info",
        bg: "bg-info/10",
        spark: runningUniqueDiagnosisCount(records),
      },
      {
        label: "Atenciones este mes",
        value: citasEsteMesCount,
        icon: FileText,
        color: "text-warning",
        bg: "bg-warning/10",
        spark: cumulativeRecordsInMonthChronological(records, monthStart, nextMonthStart),
      },
    ];
  }, [historyStats, records, clinicToday, totalHistorialCount, pacientesConCitaCount, diagnosticosUnicosCount, citasEsteMesCount, pacientesConHistorial]);

  // Animated values for metrics
  const animatedTotalRecords = useCountUp(indicatorCards[0]?.value || 0, 800);
  const animatedPacientesConHistorial = useCountUp(indicatorCards[1]?.value || 0, 800);
  const animatedDiagnosticosUnicos = useCountUp(indicatorCards[2]?.value || 0, 800);
  const animatedCitasEsteMes = useCountUp(indicatorCards[3]?.value || 0, 800);

  // Group records by patient
  const patientGroups = useMemo(() => {
    const groups: Record<string, { patient: typeof patients[0] | undefined; records: MedicalRecord[] }> = {};
    records.forEach((r) => {
      if (!groups[r.patientId]) {
        groups[r.patientId] = {
          patient: patients.find((p) => p.id === r.patientId),
          records: [],
        };
      }
      groups[r.patientId].records.push(r);
    });
    // Sort records within each group by date descending
    Object.values(groups).forEach((g) => g.records.sort((a, b) => b.date.localeCompare(a.date)));
    return groups;
  }, [records]);

  /** Fichas que coinciden con búsqueda y filtro por paciente (solo para el resumen numérico) */
  const filteredRecordsCount = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searchMatch = (r: MedicalRecord) => {
      if (!q) return true;
      return (
        r.patientName.toLowerCase().includes(q) ||
        r.diagnosis.toLowerCase().includes(q) ||
        r.treatment.toLowerCase().includes(q)
      );
    };
    let list = records.filter(searchMatch);
    if (patientFilterId) list = list.filter((r) => r.patientId === patientFilterId);
    return list.length;
  }, [records, search, patientFilterId]);

  const expedienteGroup =
    detailPanel?.type === "expediente" ? patientGroups[detailPanel.patientId] : null;
  const expedienteRecords = expedienteGroup?.records ?? [];
  const expedientePatient = expedienteGroup?.patient;

  // Si no hay datos locales (paciente de API), usar datos de ejemplo
  const showExpedienteExample = detailPanel?.type === "expediente" && !expedientePatient;
  console.log("detailPanel:", detailPanel);
  console.log("expedientePatient:", expedientePatient);
  console.log("showExpedienteExample:", showExpedienteExample);
  
  // Datos de ejemplo siempre disponibles
  const examplePatient = {
    name: pacientesConHistorial.find((p: any) => p.id.toString() === detailPanel?.patientId)?.nombre || "Paciente Ejemplo",
    dni: "12345678",
    age: 35,
    phone: "+51 987 654 321",
    status: "activo"
  };

  // Datos del paciente de la API
  const pacienteData = expedientePacienteAPI?.fields || {};
  const pacienteNombre = pacienteData.nombreCompleto || examplePatient.name;
  const pacienteFoto = (Array.isArray(pacienteData.fotoPacientes) && pacienteData.fotoPacientes.length > 0) 
    ? (pacienteData.fotoPacientes[0].signedUrl || pacienteData.fotoPacientes[0].url) 
    : "";
  const pacienteEdad = pacienteData.Edad || examplePatient.age;
  const pacienteTelefono = pacienteData.telefono || examplePatient.phone;
  const pacienteEstado = pacienteData.Estado || examplePatient.status;
  const pacienteCitas = pacienteData.citas?.length || 0;
  
  // Extraer fecha y hora de la última cita (ordenando por fecha)
  const citasOrdenadas = pacienteData.citas && pacienteData.citas.length > 0 
    ? [...pacienteData.citas].sort((a: any, b: any) => {
        const fechaA = a.fields?.fechaCitas || "";
        const fechaB = b.fields?.fechaCitas || "";
        return fechaB.localeCompare(fechaA);
      })
    : [];
  const ultimaCita = citasOrdenadas.length > 0 
    ? citasOrdenadas[0].fields?.fechaCitas 
    : null;
  const ultimaAtencion = ultimaCita ? ultimaCita.split(' - ')[0] : "—";
  
  // Mapear registros de la API al formato de la línea de tiempo
  const registrosTimeline = expedienteRegistrosAPI.map((reg: any) => {
    // Extraer imagen del historial médico
    const imagen = reg.fields?.imagenPodologica;
    const imagenUrl = (Array.isArray(imagen) && imagen.length > 0) 
      ? (imagen[0].signedUrl || imagen[0].url) 
      : "";
    
    return {
      id: reg.id,
      patientId: detailPanel?.patientId || "",
      patientName: pacienteNombre,
      date: reg.fields?.fechaHoraCita || reg.fields?.fechaCita || reg.fields?.CreatedAt || reg.fields?.fecha || "—",
      diagnosis: reg.fields?.problemas || reg.fields?.antecedentesPatalogico || "Sin diagnóstico",
      treatment: reg.fields?.tipoProcedimiento?.join(", ") || "Sin tratamiento",
      observations: reg.fields?.observacionMes || reg.fields?.Anamnesis || "",
      image: imagenUrl
    };
  });
  
  const exampleRecords = [
    {
      id: 1,
      date: "2026-04-25",
      diagnosis: "Acumulación de queratina en talón",
      treatment: "Profilaxis podal, Limpieza de los pies",
      observations: "Paciente refiere dolor al caminar largas distancias"
    },
    {
      id: 2,
      date: "2026-03-15",
      diagnosis: "Descamación interdigital",
      treatment: "Antiséptico tópico 2 veces al día",
      observations: "Paciente refiere picor nocturno"
    },
    {
      id: 3,
      date: "2026-02-10",
      diagnosis: "Onicocriptosis (uña encarnada)",
      treatment: "Onicotomia, Retiro de espicula",
      observations: "Proceso de cicatrización favorable"
    },
    {
      id: 4,
      date: "2026-01-20",
      diagnosis: "Hiperqueratosis plantar",
      treatment: "Deslaminado, Masaje podal",
      observations: "Mejora significativa después del tratamiento"
    },
    {
      id: 5,
      date: "2025-12-05",
      diagnosis: "Dermatitis de contacto",
      treatment: "Crema hidratante, Evitar irritantes",
      observations: "Paciente presenta sensibilidad a ciertos materiales"
    }
  ];

  // Estado de carga inicial
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // Mostrar indicador de carga inicial
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full bg-[#22b4ad]/10 animate-ping" />
            <div className="absolute w-10 h-10 rounded-full bg-[#22b4ad]/20 animate-pulse" />
            <Loader2 className="h-10 w-10 animate-spin text-[#22b4ad] relative z-10" />
          </div>
          <p className="text-muted-foreground animate-pulse font-medium">Cargando historial médico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historial Médico</h1>
          <p className="text-muted-foreground text-sm mt-1">Registro de atenciones podológicas realizadas en domicilio</p>
        </div>
        <Button onClick={() => setNuevoHistorialOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nuevo Registro</Button>
        {nuevoHistorialOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-200" 
              onClick={() => setNuevoHistorialOpen(false)}
            />
            <div className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-1.25rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-0 border border-border/70 bg-card text-card-foreground shadow-2xl ring-1 ring-black/[0.04] duration-200 rounded-xl sm:max-w-xl max-h-[min(92dvh,calc(100svh-1rem))] overflow-hidden animate-in zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%] fade-in-0 animate-out zoom-out-95 slide-out-to-left-1/2 slide-out-to-top-[48%] fade-out-0">
            <div className="bg-[#22b4ad] relative">
              <button 
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/20 border-0 text-white flex items-center justify-center hover:bg-white/30 transition-colors" 
                type="button"
                onClick={() => setNuevoHistorialOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="px-6 py-5">
                <h2 className="tracking-tight sm:text-xl text-[18px] font-medium text-white">Gestión de Historial y Citas</h2>
                <p className="text-[13px] text-white/80 mt-1">Agrega historial médico o crea una nueva cita.</p>
              </div>
            </div>
            <div className="px-6 py-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "historial" | "cita")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="historial">Agregar Historial</TabsTrigger>
                  <TabsTrigger value="cita">Crear Cita</TabsTrigger>
                </TabsList>
                <TabsContent value="historial" className="space-y-4 mt-4 max-h-[calc(92dvh-280px)] overflow-y-auto pr-2 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="space-y-2 relative">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Cita asociada</label>
                    <Input 
                      className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm" 
                      placeholder={cargandoCitas ? "Cargando..." : "Buscar cita..."}
                      value={cargandoCitas ? "Cargando..." : citaSeleccionadaTexto}
                      disabled={cargandoCitas}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCitaSeleccionadaTexto(value);
                        setShowCitasDropdown(true);
                        const filtradas = citasDisponibles.filter((cita: any) => {
                          const searchTerm = value.toLowerCase();
                          const fecha = cita.fields?.fechaCitas || "";
                          const paciente = cita.fields?.pacientes?.fields?.nombreCompleto || "";
                          return fecha.toLowerCase().includes(searchTerm) || paciente.toLowerCase().includes(searchTerm);
                        });
                        setCitasFiltradas(filtradas);
                      }}
                      onFocus={() => setShowCitasDropdown(true)}
                    />
                    {showCitasDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                          <span className="text-xs font-medium text-gray-600">Citas disponibles</span>
                          <button
                            type="button"
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            onClick={() => setShowCitasDropdown(false)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {citasFiltradas.length > 0 ? (
                          citasFiltradas.map((cita: any) => (
                      <div
                        key={cita.id}
                        className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => {
                          setNuevoHistorial({...nuevoHistorial, citaId: String(cita.id)});
                          setCitaSeleccionadaTexto(cita.fields?.fechaCitas || "Sin fecha");
                          setShowCitasDropdown(false);
                        }}
                      >
                        <div className="text-sm font-medium">{cita.fields?.fechaCitas || "Sin fecha"}</div>
                        <div className="text-xs text-gray-500">{cita.fields?.pacientes?.fields?.nombreCompleto || "Sin paciente"}</div>
                      </div>
                    ))
                        ) : (
                          <div className="px-4 py-6 text-center">
                            <p className="text-sm text-gray-600 mb-3">No hay citas sin historial médico</p>
                            <Button
                              type="button"
                              className="bg-[#22b4ad] hover:bg-[#1a9993] text-white text-xs"
                              onClick={() => {
                                setShowCitasDropdown(false);
                                setActiveTab("cita");
                              }}
                            >
                              Crear cita
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Problemas</label>
                    <Textarea 
                      className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                      placeholder="Describe los problemas o síntomas..."
                      value={nuevoHistorial.problemas}
                      onChange={(e) => setNuevoHistorial({...nuevoHistorial, problemas: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Receta</label>
                    <Textarea 
                      className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                      placeholder="Prescripción médica..."
                      value={nuevoHistorial.receta}
                      onChange={(e) => setNuevoHistorial({...nuevoHistorial, receta: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Antecedentes patológicos</label>
                    <Textarea 
                      className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                      placeholder="Antecedentes médicos relevantes..."
                      value={nuevoHistorial.antecedentesPatalogico}
                      onChange={(e) => setNuevoHistorial({...nuevoHistorial, antecedentesPatalogico: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Anamnesis</label>
                    <Textarea 
                      className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                      placeholder="Historia clínica del paciente..."
                      value={nuevoHistorial.Anamnesis}
                      onChange={(e) => setNuevoHistorial({...nuevoHistorial, Anamnesis: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Tipo de procedimiento</label>
                    <div className="flex flex-wrap gap-2">
                      {["uñeros", "limpieza de los pies", "Profilaxis podal", "Onicotomia", "Deslaminado", "Masaje Podal", "Encarilado", "Retiro de espicula"].map((proc) => (
                        <button
                          key={proc}
                          type="button"
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            nuevoHistorial.tipoProcedimiento.includes(proc)
                              ? "bg-[#22b4ad] text-white border-[#22b4ad]"
                              : "bg-white text-gray-600 border-gray-300 hover:border-[#22b4ad] hover:text-[#22b4ad]"
                          }`}
                          onClick={() => {
                            setNuevoHistorial({
                              ...nuevoHistorial,
                              tipoProcedimiento: nuevoHistorial.tipoProcedimiento.includes(proc)
                                ? nuevoHistorial.tipoProcedimiento.filter(p => p !== proc)
                                : [...nuevoHistorial.tipoProcedimiento, proc]
                            });
                          }}
                        >
                          {proc}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Observación del mes</label>
                    <Textarea 
                      className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                      placeholder="Observaciones del mes actual..."
                      value={nuevoHistorial.observacionMes}
                      onChange={(e) => setNuevoHistorial({...nuevoHistorial, observacionMes: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Imagen podológica</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#22b4ad] transition-colors">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        id="imagenPodologica"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setNuevoHistorial({...nuevoHistorial, imagenPodologica: file});
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setImagenPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          } else {
                            setImagenPreview(null);
                          }
                        }}
                      />
                      <label htmlFor="imagenPodologica" className="cursor-pointer">
                        {imagenPreview ? (
                          <div className="space-y-2">
                            <img src={imagenPreview} alt="Previsualización" className="max-h-48 mx-auto rounded-lg" />
                            <p className="text-sm text-gray-600">Click para cambiar imagen</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center">
                              <Upload className="h-8 w-8 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-600">Click para subir imagen</p>
                            <p className="text-xs text-gray-400">PNG, JPG hasta 5MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="cita" className="space-y-4 mt-4 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="space-y-2 relative">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Buscar paciente</label>
                    <PatientSearchDropdown
                      value={patientSearch}
                      onChange={setPatientSearch}
                      results={patientSearchResults}
                      loading={patientSearchLoading}
                      showDropdown={showPatientDropdown}
                      setShowDropdown={setShowPatientDropdown}
                      placeholder="Escribe el nombre del paciente..."
                      loadOnFocus={loadAllPatients}
                      onSelect={(patient) => {
                        setSelectedPatient(patient);
                        setPatientSearch(`${patient.fields.nombreCompleto} (ID: ${patient.id})`);
                        setPatientSearchResults([]);
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Fecha</label>
                      <Input
                        type="date"
                        className="w-full text-sm"
                        value={newVisitForm.fecha}
                        onChange={(e) => setNewVisitForm({ ...newVisitForm, fecha: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Hora</label>
                      <Input
                        type="time"
                        className="w-full text-sm"
                        value={newVisitForm.horaCita}
                        onChange={(e) => setNewVisitForm({ ...newVisitForm, horaCita: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Tipo de paciente</label>
                    <Select
                      value={newVisitForm.tipoPaciente}
                      onValueChange={(v) => setNewVisitForm({ ...newVisitForm, tipoPaciente: v })}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="domicilio">Domicilio</SelectItem>
                        <SelectItem value="consultorio">Consultorio</SelectItem>
                        <SelectItem value="consultorio interno">Consultorio interno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Estado</label>
                      <Select
                        value={newVisitForm.progreso}
                        onValueChange={(v) => setNewVisitForm({ ...newVisitForm, progreso: v })}
                      >
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Confirmada">Confirmada</SelectItem>
                          <SelectItem value="Pendiente">Pendiente</SelectItem>
                          <SelectItem value="Cancelada">Cancelada</SelectItem>
                          <SelectItem value="Descontinuado">Descontinuado</SelectItem>
                          <SelectItem value="Programado">Programado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Calificación</label>
                      <div className="flex gap-0.5 items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewVisitForm({ ...newVisitForm, calificacion: star })}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(null)}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-5 w-5 ${(hoveredRating || newVisitForm.calificacion) >= star
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'fill-gray-200 text-gray-200'
                                }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Tipo de procedimiento</label>
                    <div className="flex flex-wrap gap-2">
                      {['uñeros', 'limpieza de los pies', 'Profilaxis podal', 'Onicotomia', 'Deslaminado', 'Masaje Podal', 'Encarilado', 'Retiro de espicula'].map((proc) => (
                        <button
                          key={proc}
                          type="button"
                          onClick={() => {
                            const selected = newVisitForm.tipoProcedimientoCita.includes(proc);
                            setNewVisitForm({
                              ...newVisitForm,
                              tipoProcedimientoCita: selected
                                ? newVisitForm.tipoProcedimientoCita.filter(p => p !== proc)
                                : [...newVisitForm.tipoProcedimientoCita, proc]
                            });
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${newVisitForm.tipoProcedimientoCita.includes(proc)
                              ? 'bg-[#22b4ad] text-white border-[#22b4ad]'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-[#22b4ad] hover:text-[#22b4ad]'
                            }`}
                        >
                          {proc}
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 sm:space-y-0 gap-2 border-t border-border/60 bg-muted/30 px-6 py-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setNuevoHistorialOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="button" 
                className="bg-[#22b4ad] hover:bg-[#1a9993] text-white"
                onClick={async () => {
                  if (activeTab === "historial") {
                    try {
                      await crearRegistroV3({
                        problemas: nuevoHistorial.problemas,
                        tipoProcedimiento: nuevoHistorial.tipoProcedimiento,
                        imagenPodologica: nuevoHistorial.imagenPodologica,
                        observacionMes: nuevoHistorial.observacionMes,
                        antecedentesPatalogico: nuevoHistorial.antecedentesPatalogico,
                        recetaPaciente: nuevoHistorial.receta,
                        Anamnesis: nuevoHistorial.Anamnesis,
                        citaId: nuevoHistorial.citaId,
                      });
                      toast.success("Historial médico guardado");
                      setNuevoHistorialOpen(false);
                      setNuevoHistorial({
                        problemas: "",
                        receta: "",
                        antecedentesPatalogico: "",
                        Anamnesis: "",
                        tipoProcedimiento: [],
                        observacionMes: "",
                        imagenPodologica: null,
                        citaId: ""
                      });
                      setCitaSeleccionadaTexto("");
                      setImagenPreview(null);
                    } catch (err) {
                      toast.error("Error al guardar historial médico");
                    }
                  } else {
                    try {
                      await crearCitaV3({
                        horaCita: newVisitForm.horaCita,
                        fecha: newVisitForm.fecha,
                        progreso: newVisitForm.progreso,
                        estadoCalendario: "registrado",
                        calificacion: newVisitForm.calificacion,
                        tipoPaciente: newVisitForm.tipoPaciente,
                        tipoProcedimientoCita: newVisitForm.tipoProcedimientoCita,
                        historialMedico: [],
                        pacientes: selectedPatient ? [{ id: selectedPatient.id }] : []
                      });
                      toast.success("Cita creada correctamente");
                      setNuevoHistorialOpen(false);
                      setNewVisitForm({
                        fecha: "",
                        horaCita: "",
                        progreso: "Confirmada",
                        tipoPaciente: "",
                        calificacion: 0,
                        tipoProcedimientoCita: [],
                      });
                      setPatientSearch("");
                      setSelectedPatient(null);
                    } catch (err) {
                      toast.error("Error al crear cita");
                    }
                  }
                }}
              >
                {activeTab === "historial" ? "Guardar historial" : "Crear cita"}
              </Button>
            </div>
          </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <p
          className="block w-full min-w-0 text-[11px] text-muted-foreground leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
          title="Cálculo local a partir de las fichas (sin servicios externos)"
        >
          Cálculo local a partir de las fichas (sin servicios externos)
        </p>
        <h2 className="text-sm font-semibold text-foreground">Indicadores del historial</h2>
        <TooltipProvider>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {indicatorCards.map((m, i) => (
              <Card key={m.label} className="card-shadow hover:card-shadow-hover transition-shadow">
                <CardContent className="p-5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.bg}`}>
                      <m.icon className={`h-5 w-5 ${m.color}`} />
                    </div>
                    <div className="min-w-0">
                      {m.label === "Pacientes con historial" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-2xl font-bold tabular-nums cursor-help">{animatedPacientesConHistorial}</p>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold">Pacientes con historial:</p>
                              {pacientesConHistorial.length > 0 ? (
                                pacientesConHistorial.map((p: any) => (
                                  <div key={p.id} className="text-sm">
                                    <span className="font-medium">{p.nombre}</span> - {p.expedientes} expediente{p.expedientes !== 1 ? 's' : ''}
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">No hay pacientes con historial</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <p className="text-2xl font-bold tabular-nums">
                          {i === 0 ? animatedTotalRecords : i === 2 ? animatedDiagnosticosUnicos : animatedCitasEsteMes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </div>
                  </div>
                  <SparklineAreaAnimated
                    values={m.spark}
                    delayMs={i * 85}
                    colorClassName={m.color}
                    className="self-center"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TooltipProvider>
      </div>

      {/* Búsqueda y resumen */}
      <Card className="card-shadow">
        <CardContent className="p-4 sm:p-5">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por paciente, diagnóstico o tratamiento…"
              className="h-11 pl-9 pr-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar en el historial"
            />
            {search.trim() !== "" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground tabular-nums">{filteredRecordsCount}</span>
              {filteredRecordsCount === records.length
                ? " fichas coinciden con los criterios"
                : ` de ${records.length} fichas coinciden con los criterios`}
            </span>
            {patientFilterId && (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">
                  Filtrado por paciente
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-primary hover:bg-primary/15"
                    onClick={() => setPatientFilterId(null)}
                  >
                    Quitar
                  </Button>
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista pacientes + panel de expediente */}
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="order-2 space-y-0 lg:order-1 lg:col-span-4">
          <Card className="card-shadow flex flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[min(calc(100vh-7rem),720px)]">
            <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pacientes</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Clic en el nombre para marcar el paciente y ajustar el contador de fichas. «Expediente» muestra el historial a la derecha.
              </p>
            </div>
            <ScrollArea className="h-[min(42vh,420px)] lg:h-[min(calc(100vh-11rem),640px)]">
              <div className="space-y-2 p-3">
                {(() => {
                  const filteredPacientes = pacientesConHistorial.filter((p: any) => {
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    return p.nombre.toLowerCase().includes(q);
                  });
                  if (filteredPacientes.length === 0) {
                    return (
                      <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                        {pacientesConHistorial.length === 0 
                          ? "No hay pacientes con historial." 
                          : "Ningún paciente coincide con la búsqueda. Borra el texto o prueba otro término."}
                      </p>
                    );
                  }
                  return filteredPacientes.map((paciente: any) => (
                    <Card
                      key={paciente.id}
                      className="card-shadow overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/40"
                        onClick={() => setPatientFilterId(paciente.id.toString())}
                      >
                        {paciente.foto ? (
                          <img
                            src={paciente.foto}
                            alt={paciente.nombre}
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {paciente.nombre
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{paciente.nombre}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {paciente.expedientes === 0 
                              ? "Sin expedientes" 
                              : `${paciente.expedientes} ${paciente.expedientes === 1 ? "expediente" : "expedientes"}`}
                          </p>
                        </div>
                      </button>
                      <div className="flex border-t border-border/50">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 flex-1 rounded-none text-xs font-medium text-primary hover:bg-primary/10"
                          onClick={() => {
                            console.log("Clic en Expediente - Paciente:", paciente);
                            console.log("ID del paciente:", paciente.id);
                            console.log("Nombre del paciente:", paciente.nombre);
                            console.log("Cantidad de expedientes:", paciente.expedientes);
                            if (paciente.expedientes === 0) {
                              toast.error("Este paciente no tiene expedientes. Por favor, agrega una cita en las visitas agendadas primero.");
                            } else {
                              setDetailPanel({ type: "expediente", patientId: paciente.id.toString() });
                            }
                          }}
                        >
                          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                          Expediente
                        </Button>
                      </div>
                    </Card>
                  ));
                })()}
              </div>
            </ScrollArea>
          </Card>
        </div>

        <div className="order-1 min-w-0 lg:order-2 lg:col-span-8">
          {!detailPanel && (
            <Card className="card-shadow border-dashed bg-muted/20">
              <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-center">
                <FolderOpen className="h-10 w-10 text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">Vista de expediente</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Elige un paciente en la lista y pulsa <span className="font-medium text-primary">Expediente</span> para ver aquí su historial y la línea de tiempo clínica.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Expediente completo — sin modal */}
          {detailPanel?.type === "expediente" ? (
            <Card className="border-0.5 bg-card overflow-hidden shadow-none">
              {loadingExpediente ? (
                <CardContent className="p-4 sm:p-5 space-y-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-full" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-24" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                      <Skeleton className="h-6 w-48" style={{ backgroundColor: 'rgba(23, 138, 132, 0.3)' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-16" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                      <Skeleton className="h-4 w-20" style={{ backgroundColor: 'rgba(23, 138, 132, 0.3)' }} />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-12" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                      <Skeleton className="h-4 w-16" style={{ backgroundColor: 'rgba(23, 138, 132, 0.3)' }} />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-16" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                      <Skeleton className="h-4 w-24" style={{ backgroundColor: 'rgba(23, 138, 132, 0.3)' }} />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-12" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                      <Skeleton className="h-4 w-16" style={{ backgroundColor: 'rgba(23, 138, 132, 0.3)' }} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Skeleton className="h-20 flex-1 rounded-xl" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                    <Skeleton className="h-20 flex-1 rounded-xl" style={{ backgroundColor: 'rgba(23, 138, 132, 0.3)' }} />
                    <Skeleton className="h-20 flex-1 rounded-xl" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                  </div>
                  <Separator />
                  <div>
                    <Skeleton className="h-4 w-32 mb-3" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                    <div className="space-y-6">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3 sm:gap-4">
                          <Skeleton className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: 'rgba(34, 180, 173, 0.3)' }} />
                          <Skeleton className="h-24 flex-1 rounded-xl" style={{ backgroundColor: 'rgba(23, 138, 132, 0.3)' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              ) : (
                <>
              <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ backgroundColor: '#e6f7f6' }}>
                <div className="flex items-center gap-3 min-w-0">
                  {pacienteFoto ? (
                    <img
                      src={pacienteFoto}
                      alt={pacienteNombre}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: '#22b4ad', color: 'white' }}>
                      {pacienteNombre
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Expediente</p>
                    <h3 className="text-lg font-bold leading-snug truncate">{pacienteNombre}</h3>
                    <p className="text-xs text-muted-foreground">Historial y línea de tiempo en esta misma página.</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setDetailPanel(null)}>
                  Cerrar expediente
                </Button>
              </div>

              <CardContent className="space-y-5 p-4 sm:p-5">
                <Card className="border-0.5 border-dashed bg-secondary">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Edad</p>
                        <p className="text-sm font-medium">{pacienteEdad} años</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Teléfono</p>
                        <p className="text-sm font-medium">{pacienteTelefono}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Estado</p>
                        <Badge
                          className={
                            pacienteEstado === "activo"
                              ? "border-0 bg-success/10 text-success"
                              : "border-0 bg-muted text-muted-foreground"
                          }
                        >
                          {pacienteEstado}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dirección</p>
                        {pacienteData.Dirección ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-xs font-medium text-white"
                            style={{ backgroundColor: '#22b4ad' }}
                            onClick={() => window.open(pacienteData.Dirección, '_blank')}
                          >
                            Ver dirección
                          </Button>
                        ) : (
                          <p className="text-sm font-medium text-muted-foreground">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">WhatsApp</p>
                        {pacienteData.Wasap ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-xs font-medium text-white"
                            style={{ backgroundColor: '#25D366' }}
                            onClick={() => window.open(pacienteData.Wasap, '_blank')}
                          >
                            <MessageCircle className="mr-1 h-3 w-3" />
                            Chat
                          </Button>
                        ) : (
                          <p className="text-sm font-medium text-muted-foreground">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Google Maps</p>
                        {pacienteData.EnlaceGoogle ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-xs font-medium text-white"
                            style={{ backgroundColor: '#4285F4' }}
                            onClick={() => window.open(pacienteData.EnlaceGoogle, '_blank')}
                          >
                            <MapPin className="mr-1 h-3 w-3" />
                            Maps
                          </Button>
                        ) : (
                          <p className="text-sm font-medium text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[100px] flex-1 rounded-xl p-4 text-center" style={{ backgroundColor: '#22b4ad', color: 'white' }}>
                    <p className="text-2xl font-bold">{pacienteCitas}</p>
                    <p className="text-xs">Consultas totales</p>
                  </div>
                  <div className="min-w-[100px] flex-1 rounded-xl p-4 text-center" style={{ backgroundColor: '#178a84', color: 'white' }}>
                    <p className="text-2xl font-bold">{new Set((expedienteRecords || exampleRecords).map((r) => r.diagnosis)).size}</p>
                    <p className="text-xs">Diagnósticos</p>
                  </div>
                  <div className="min-w-[100px] flex-1 rounded-xl p-4 text-center bg-muted">
                    <p className="text-2xl font-bold text-muted-foreground tabular-nums">{ultimaAtencion}</p>
                    <p className="text-xs text-muted-foreground">Última atención</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Línea de tiempo clínica</h4>
                  <div className="scrollbar-brand max-h-[min(48vh,420px)] overflow-y-auto rounded-xl border border-border/50 bg-muted/10 px-3 py-4 sm:px-4">
                    {registrosTimeline.length === 0 || registrosTimeline.every((r: any) => r.diagnosis === "Sin registro" || r.diagnosis === "Error al cargar") ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-4 rounded-full p-4" style={{ backgroundColor: 'rgba(34, 180, 173, 0.1)' }}>
                          <FileText className="h-8 w-8" style={{ color: '#22b4ad' }} />
                        </div>
                        <h5 className="mb-2 text-sm font-semibold text-foreground">Sin historial médico</h5>
                        <p className="mb-4 max-w-sm text-xs text-muted-foreground">
                          Este paciente aún no tiene registros de historial médico. Agregue el historial en la próxima cita para comenzar a documentar su evolución clínica.
                        </p>
                        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 mb-4">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Estado actual</p>
                          <p className="text-xs text-muted-foreground">
                            {pacienteCitas > 0 
                              ? `El paciente tiene ${pacienteCitas} cita(s) registrada(s) sin historial médico asociado.`
                              : "El paciente no tiene citas registradas."}
                          </p>
                        </div>
                        <Button
                          type="button"
                          className="gap-2"
                          style={{ backgroundColor: '#22b4ad', color: 'white' }}
                          onClick={() => {
                            const newRecord: MedicalRecord = {
                              id: "0",
                              patientId: detailPanel?.patientId || "",
                              patientName: pacienteNombre,
                              date: new Date().toISOString().split('T')[0],
                              diagnosis: "",
                              treatment: "",
                              observations: ""
                            };
                            openRecordEdit(newRecord);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Agregar historial médico
                        </Button>
                      </div>
                    ) : (
                      <div className="relative pl-1">
                        {/* Raíl vertical continuo (centrado con los puntos de la línea de tiempo) */}
                        <div
                          className="pointer-events-none absolute bottom-4 left-[15px] top-4 w-[1.5px] rounded-full bg-secondary"
                          aria-hidden
                        />
                        <ul className="relative m-0 list-none space-y-6 p-0">
                        {registrosTimeline.filter((r: any) => r.diagnosis !== "Sin registro" && r.diagnosis !== "Error al cargar").map((r, i) => (
                        <li key={r.id} className="relative flex gap-3 sm:gap-4">
                          <div className="relative z-[1] flex w-8 shrink-0 justify-center pt-1">
                            <span
                              className={`h-4 w-4 shrink-0 rounded-full border-2 border-card ${
                                i === 0 ? "bg-[#22b4ad]" : "bg-muted-foreground"
                              }`}
                              style={i === 0 ? { boxShadow: '0 0 0 4px rgba(34,180,173,0.2)' } : {}}
                              aria-hidden
                            />
                          </div>

                          <Card className={`min-w-0 flex-1 border-0.5 bg-card ${i === 0 ? "border-[#22b4ad]" : ""} shadow-none`}>
                            <CardContent className="p-4">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {r.date}
                                  </Badge>
                                  {i === 0 && (
                                    <Badge className="border-0 text-xs" style={{ backgroundColor: '#22b4ad', color: 'white' }}>Más reciente</Badge>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 shrink-0 gap-1 text-muted-foreground hover:text-foreground"
                                  onClick={() => openRecordEdit(r)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                              </div>
                              <div className="flex gap-4">
                                {r.image && (
                                  <div className="shrink-0">
                                    <img
                                      src={r.image}
                                      alt="Imagen podológica"
                                      className="h-32 w-32 rounded-lg object-cover"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 space-y-3">
                                  <div>
                                    <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Diagnóstico</p>
                                    <p className="text-sm font-semibold">{r.diagnosis}</p>
                                  </div>
                                  <div>
                                    <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tratamiento</p>
                                    <p className="text-sm">{r.treatment}</p>
                                  </div>
                                  {r.observations && (
                                    <div className="rounded-lg bg-muted/50 p-3">
                                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Observaciones</p>
                                      <p className="text-sm text-muted-foreground">{r.observations}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                      </ul>
                    </div>
                    )}
                  </div>
                </div>
              </CardContent>
                </>
              )}
            </Card>
          ) : null}
        </div>
      </div>

      {recordEditOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50" 
            onClick={() => setRecordEditOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-1.25rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-0 border border-border/70 bg-card text-card-foreground shadow-2xl ring-1 ring-black/[0.04] duration-200 rounded-xl sm:max-w-xl max-h-[min(92dvh,calc(100svh-1rem))] overflow-hidden">
            <div className="bg-[#22b4ad] relative">
              <button 
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/20 border-0 text-white flex items-center justify-center hover:bg-white/30 transition-colors" 
                type="button"
                onClick={() => setRecordEditOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="px-6 py-5">
                <h2 className="tracking-tight sm:text-xl text-[18px] font-medium text-white">Editar historial médico</h2>
                <p className="text-[13px] text-white/80 mt-1">Modifica la información médica de la visita.</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Problemas</label>
                <Textarea 
                  className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                  placeholder="Describe los problemas o síntomas..."
                  value={editingRecord?.diagnosis || ""}
                  onChange={(e) => setEditingRecord((x) => x ? {...x, diagnosis: e.target.value} : x)}
                />
              </div>
              <div className="space-y-2">
                <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Receta</label>
                <Textarea 
                  className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                  placeholder="Prescripción médica..."
                  value={editingRecord?.treatment || ""}
                  onChange={(e) => setEditingRecord((x) => x ? {...x, treatment: e.target.value} : x)}
                />
              </div>
              <div className="space-y-2">
                <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Antecedentes patológicos</label>
                <Textarea 
                  className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                  placeholder="Antecedentes médicos relevantes..."
                  value={editingRecord?.observations || ""}
                  onChange={(e) => setEditingRecord((x) => x ? {...x, observations: e.target.value} : x)}
                />
              </div>
              <div className="space-y-2">
                <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Anamnesis</label>
                <Textarea 
                  className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                  placeholder="Historia clínica del paciente..."
                  value={editingRecord?.observations || ""}
                  onChange={(e) => setEditingRecord((x) => x ? {...x, observations: e.target.value} : x)}
                />
              </div>
              <div className="space-y-2">
                <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Tipo de procedimiento</label>
                <div className="flex flex-wrap gap-2">
                  {["uñeros", "limpieza de los pies", "Profilaxis podal", "Onicotomia", "Deslaminado", "Masaje Podal", "Encarilado", "Retiro de espicula"].map((proc) => (
                    <button
                      key={proc}
                      type="button"
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        editingRecord?.treatment?.includes(proc)
                          ? "bg-[#22b4ad] text-white border-[#22b4ad]"
                          : "bg-white text-gray-600 border-gray-300 hover:border-[#22b4ad] hover:text-[#22b4ad]"
                      }`}
                      onClick={() => {
                        if (editingRecord) {
                          const currentProcs = editingRecord.treatment?.split(", ") || [];
                          const newProcs = currentProcs.includes(proc)
                            ? currentProcs.filter(p => p !== proc)
                            : [...currentProcs, proc];
                          setEditingRecord({...editingRecord, treatment: newProcs.join(", ")});
                        }
                      }}
                    >
                      {proc}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] text-gray-500 font-medium">Observación del mes</label>
                <Textarea 
                  className="flex rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full text-sm min-h-[80px]" 
                  placeholder="Observaciones del mes actual..."
                  value={editingRecord?.observations || ""}
                  onChange={(e) => setEditingRecord((x) => x ? {...x, observations: e.target.value} : x)}
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 sm:space-y-0 gap-2 border-t border-border/60 bg-muted/30 px-6 py-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setRecordEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="button" 
                className="bg-[#22b4ad] hover:bg-[#1a9993] text-white"
                onClick={saveRecordEdit}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
