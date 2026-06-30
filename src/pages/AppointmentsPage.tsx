import { useMemo, useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Filter, CalendarDays, Clock, CheckCircle2, XCircle, MapPin, Search, MoreVertical, Calendar, Star, X, Loader2, Eye, Check, Upload, Maximize2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { clinicToday, type Appointment } from "@/data/mockData";
import { useCitas } from "@/services/nocodb/core/useCitas";
import { eliminarAsociacionPaciente, crearAsociacionPaciente, actualizarCitaV3, crearCitaV3, contarCitasPorEstado, contarCitasTotal, filtrarCitasPorTipoPaciente } from "@/services/nocodb/citas.service";
import { historialPorCita, crearRegistro, crearRegistroV3 } from "@/services/nocodb/historialMedico.service";
import { buscarPacientePorNombre, obtenerPacientesRegistrados } from "@/services/nocodb/pacientes.service";
import { toast } from "sonner";
import { SparklineAreaAnimated } from "@/components/charts/SparklineAreaAnimated";
import { cumulativeAppointmentsByDate, cumulativeCountChronologicalFiltered } from "@/lib/metricSparklineSeries";
import { cn } from "@/lib/utils";
import { PatientSearchDropdown } from "@/components/PatientSearchDropdown";

const statusColor = (status: string) => {
  if (status === "atendido") return "bg-success/10 text-success hover:bg-success/20 border-0";
  if (status === "pendiente") return "bg-warning/10 text-warning hover:bg-warning/20 border-0";
  return "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0";
};

const progresoColor = (progreso: string) => {
  if (progreso === "Confirmada") return "bg-primary/10 text-primary hover:bg-primary/20 border-0";
  if (progreso === "Pendiente") return "bg-warning/10 text-warning hover:bg-warning/20 border-0";
  if (progreso === "En Progreso") return "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border-0";
  if (progreso === "Completada") return "bg-success/10 text-success hover:bg-success/20 border-0";
  if (progreso === "Cancelada") return "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0";
  return "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 border-0";
};

const tipoPacienteColor = (tipo: string) => {
  if (tipo === "domicilio") return "bg-primary/10 text-primary hover:bg-primary/20 border-0";
  if (tipo === "consultorio interno") return "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border-0";
  if (tipo === "teleconsulta") return "bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 border-0";
  if (tipo === "urgencia") return "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-0";
  return "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 border-0";
};

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

function titleForCalendarIso(dateIso: string): string {
  const [y, mo, d] = dateIso.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

export default function AppointmentsPage() {
  const { citas: citasNocoDB, loading, error, crear, actualizar, eliminar, recargar } = useCitas();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [originalAppointments, setOriginalAppointments] = useState<Appointment[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Appointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsAppointment, setDetailsAppointment] = useState<Appointment | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [tipoPacienteFilter, setTipoPacienteFilter] = useState("all");
  const [loadingTipoPaciente, setLoadingTipoPaciente] = useState(false);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    Confirmada: 0,
    Pendiente: 0,
    Cancelada: 0,
    Descontinuado: 0,
    Programado: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);

  
  const animatedCountAll = useCountUp(statusCounts.all, 800);
  const animatedCountConfirmada = useCountUp(statusCounts.Confirmada, 800);
  const animatedCountPendiente = useCountUp(statusCounts.Pendiente, 800);
  const animatedCountCancelada = useCountUp(statusCounts.Cancelada, 800);
  const animatedCountDescontinuado = useCountUp(statusCounts.Descontinuado, 800);
  const animatedCountProgramado = useCountUp(statusCounts.Programado, 800);

  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const [newVisitForm, setNewVisitForm] = useState({
    fecha: "",
    horaCita: "",
    progreso: "Confirmada",
    estadoCalendario: "registrado",
    tipoPaciente: "",
    calificacion: 0,
    tipoProcedimientoCita: [] as string[],
  });
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [historialPaciente, setHistorialPaciente] = useState<any[]>([]);
  const [agregarHistorialOpen, setAgregarHistorialOpen] = useState(false);
  const [imagenCompletaOpen, setImagenCompletaOpen] = useState(false);
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [nuevoHistorial, setNuevoHistorial] = useState({
    problemas: "",
    recetaPaciente: "",
    antecedentesPatalogico: "",
    Anamnesis: "",
    tipoProcedimiento: [] as string[],
    observacionMes: "",
    imagenPodologica: null as File | null,
  });
  const [procedimientoOpen, setProcedimientoOpen] = useState(false);
  const [procedimientoData, setProcedimientoData] = useState<Appointment | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<any[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [originalPatientId, setOriginalPatientId] = useState<string | null>(null);

  
  useEffect(() => {
    const loadStatusCounts = async () => {
      setLoadingCounts(true);
      try {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        
        const total = await contarCitasTotal();
        setStatusCounts(prev => ({ ...prev, all: total.count || 0 }));
        await delay(300);

        
        const confirmada = await contarCitasPorEstado("Confirmada");
        setStatusCounts(prev => ({ ...prev, Confirmada: confirmada.count || 0 }));
        await delay(300);

        
        const pendiente = await contarCitasPorEstado("Pendiente");
        setStatusCounts(prev => ({ ...prev, Pendiente: pendiente.count || 0 }));
        await delay(300);

        
        const cancelada = await contarCitasPorEstado("Cancelada");
        setStatusCounts(prev => ({ ...prev, Cancelada: cancelada.count || 0 }));
        await delay(300);

        
        const descontinuado = await contarCitasPorEstado("Descontinuado");
        setStatusCounts(prev => ({ ...prev, Descontinuado: descontinuado.count || 0 }));
        await delay(300);

        
        const programado = await contarCitasPorEstado("Programado");
        setStatusCounts(prev => ({ ...prev, Programado: programado.count || 0 }));

        setLoadingCounts(false);
      } catch (err) {
        setLoadingCounts(false);
      }
    };
    loadStatusCounts();
  }, []);

  
  useEffect(() => {
    const loadCitasPorTipo = async () => {
      if (tipoPacienteFilter === "all") {
        
        setAppointments(originalAppointments);
        return;
      }

      setLoadingTipoPaciente(true);
      try {
        const data = await filtrarCitasPorTipoPaciente(tipoPacienteFilter);
        
        const citasFiltradas = data.records?.map((record: any) => ({
          id: record.id,
          patientName: record.fields?.pacientes?.fields?.nombreCompleto || record.fields?.pacienteId || "Sin paciente",
          date: record.fields?.fecha || record.fields?.fechaCitas || "",
          time: record.fields?.horaCita || "",
          progreso: record.fields?.progreso || record.fields?.status || "",
          status: record.fields?.progreso?.toLowerCase() || record.fields?.status?.toLowerCase() || "",
          calificacion: record.fields?.calificacion || 0,
          tipoPaciente: record.fields?.tipoPaciente || "",
          tipoProcedimientoCita: record.fields?.tipoProcedimientoCita || [],
          notes: record.fields?.notes || "",
          visitAddress: record.fields?.visitAddress || "",
          pacientes: record.fields?.pacientes || null,
          fechaCitas: record.fields?.fechaCitas || "",
          horaCita: record.fields?.horaCita || "",
        })) || [];
        setAppointments(citasFiltradas);
      } catch (err) {
      } finally {
        setLoadingTipoPaciente(false);
      }
    };

    loadCitasPorTipo();
  }, [tipoPacienteFilter, originalAppointments]);

  
  const loadAllPatients = async () => {
    if (patientSearchResults.length > 0) return;
    setPatientSearchLoading(true);
    try {
      const data = await obtenerPacientesRegistrados();
      setPatientSearchResults(data.pacientes || []);
      setShowPatientDropdown(true);
    } catch (error) {
      setPatientSearchResults([]);
    } finally {
      setPatientSearchLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (patientSearch.trim().length >= 2) {
        setPatientSearchLoading(true);
        try {
          const data = await buscarPacientePorNombre(patientSearch);
          setPatientSearchResults(data.records || []);
        } catch (error) {
          setPatientSearchResults([]);
        } finally {
          setPatientSearchLoading(false);
        }
      } else {
        setPatientSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [patientSearch]);

  
  useEffect(() => {
    if (citasNocoDB && citasNocoDB.length > 0) {
      const converted = citasNocoDB.map((cita: any) => {
        const f = cita.fields || cita;
        
        const fechaCitasClean = f.fechaCitas ? f.fechaCitas.split(' - ').slice(0, 2).join(' - ') : f.fechaCitas;
        return {
          id: cita.id?.toString() || "",
          patientId: f.pacientes?.id?.toString() || "",
          patientName: f.pacientes?.fields?.nombreCompleto || f.paciente || "",
          date: f.fecha || f.fechaCitas?.split(' - ')[0] || "",
          time: f.horaCita || f.fechaCitas?.split(' - ')[1]?.split(' ')[1] || "",
          status: f.progreso === "Confirmada" ? "pendiente" : f.progreso?.toLowerCase() || "pendiente",
          visitAddress: f.direccion || "",
          accessNotes: f.notas || "",
          notes: f.motivo || "",
          
          fechaCitas: fechaCitasClean,
          horaCita: f.horaCita,
          fecha: f.fecha,
          progreso: f.progreso,
          estadoCalendario: f.estadoCalendario || "registrado",
          calificacion: f.calificacion,
          tipoPaciente: f.tipoPaciente,
          tipoProcedimientoCita: f.tipoProcedimientoCita,
          historialMedico: f.historialMedico,
          pacientes: f.pacientes,
        } as Appointment & { estadoCalendario?: string };
      });
      setAppointments(converted);
      setOriginalAppointments(converted);
    } else {
      setAppointments([]);
      setOriginalAppointments([]);
    }
  }, [citasNocoDB]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [y, m] = clinicToday.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  const [activeTab, setActiveTab] = useState("list");

  
  useEffect(() => {
    if (activeTab === "calendar") {
      recargar();
    }
  }, [activeTab]);
  
  const [calendarSearch, setCalendarSearch] = useState("");
  const calYear = calendarMonth.getFullYear();
  const calMonth = calendarMonth.getMonth();

  const metrics = useMemo(() => {
    const totalApps = appointments.length;
    const today = new Date().toISOString().split('T')[0];
    const pending = appointments.filter((a) => a.date === today || a.fechaCitas?.includes(today)).length;
    const attended = appointments.filter((a) => a.status === "atendido").length;
    const cancelled = appointments.filter((a) => a.status === "cancelado").length;

    
    const citasHoy = appointments.filter((a) => a.date === today || a.fechaCitas?.includes(today));
    return [
      {
        label: "Total visitas",
        value: totalApps,
        icon: CalendarDays,
        color: "text-primary",
        bg: "bg-primary/10",
        spark: cumulativeAppointmentsByDate(appointments),
      },
      {
        label: "Citas hoy",
        value: pending,
        icon: Clock,
        color: "text-warning",
        bg: "bg-warning/10",
        spark: cumulativeCountChronologicalFiltered(appointments, (a) => a.date, (a) => a.status === "pendiente"),
      },
      {
        label: "Confirmadas",
        value: attended,
        icon: CheckCircle2,
        color: "text-success",
        bg: "bg-success/10",
        spark: cumulativeCountChronologicalFiltered(appointments, (a) => a.date, (a) => a.status === "atendido"),
      },
      {
        label: "Canceladas",
        value: cancelled,
        icon: XCircle,
        color: "text-destructive",
        bg: "bg-destructive/10",
        spark: cumulativeCountChronologicalFiltered(appointments, (a) => a.date, (a) => a.status === "cancelado"),
      },
    ];
  }, [appointments]);

  
  const animatedTotalApps = useCountUp(metrics[0]?.value || 0, 800);
  const animatedPendingToday = useCountUp(metrics[1]?.value || 0, 800);
  const animatedAttended = useCountUp(metrics[2]?.value || 0, 800);
  const animatedCancelled = useCountUp(metrics[3]?.value || 0, 800);

  const filtered = appointments.filter((a) => {
    const ms = statusFilter === "all" || a.progreso === statusFilter || a.status === statusFilter;
    const md = !dateFilter || a.date === dateFilter;
    const mp = tipoPacienteFilter === "all" || a.tipoPaciente === tipoPacienteFilter;
    return ms && md && mp;
  }).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const dataForCalendar = useMemo(() => {
    const q = calendarSearch.trim().toLowerCase();
    return appointments.filter((a) => {
      const st = statusFilter === "all" || a.status === statusFilter;
      const txt =
        !q ||
        a.patientName.toLowerCase().includes(q) ||
        a.notes.toLowerCase().includes(q) ||
        a.visitAddress.toLowerCase().includes(q);
      return st && txt;
    });
  }, [appointments, statusFilter, calendarSearch]);

  const openEditVisit = (a: Appointment & { estadoCalendario?: string }) => {
    console.log("Estado calendario de la fila:", a.estadoCalendario);
    setEditForm({ ...a });
    
    if (a.pacientes) {
      setOriginalPatientId(String(a.pacientes.id));
    } else {
      setOriginalPatientId(null);
    }
    setEditOpen(true);
  };

  const openDetailsVisit = async (a: Appointment) => {
    setDetailsAppointment(a);
    setDetailsOpen(true);
    
    setLoadingHistorial(true);
    try {
      const historial = await historialPorCita(Number(a.id));
      setHistorialPaciente(historial.records || []);
    } catch (err) {
      setHistorialPaciente([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const handleSaveHistorial = async () => {
    if (!detailsAppointment) return;
    try {
      await crearRegistroV3({
        problemas: nuevoHistorial.problemas,
        tipoProcedimiento: nuevoHistorial.tipoProcedimiento,
        imagenPodologica: nuevoHistorial.imagenPodologica,
        observacionMes: nuevoHistorial.observacionMes,
        antecedentesPatalogico: nuevoHistorial.antecedentesPatalogico,
        recetaPaciente: nuevoHistorial.recetaPaciente,
        Anamnesis: nuevoHistorial.Anamnesis,
        citaId: String(detailsAppointment.id),
      });
      toast.success("Historial médico agregado");
      setAgregarHistorialOpen(false);
      setNuevoHistorial({
        problemas: "",
        recetaPaciente: "",
        antecedentesPatalogico: "",
        Anamnesis: "",
        tipoProcedimiento: [] as string[],
        observacionMes: "",
        imagenPodologica: null,
      });
      
      const historial = await historialPorCita(Number(detailsAppointment.id));
      setHistorialPaciente(historial.records || []);
    } catch (err) {
      toast.error("Error al agregar historial médico");
    }
  };

  const saveEditVisit = async () => {
    if (!editForm) return;
    try {
      
      if (selectedPatient && originalPatientId) {
        await eliminarAsociacionPaciente(editForm.id, originalPatientId);
        
        await crearAsociacionPaciente(editForm.id, String(selectedPatient.id));
      }

      const fields: any = {
        horaCita: editForm.time,
        fecha: editForm.date,
        progreso: editForm.progreso,
        estadoCalendario: (editForm as any).estadoCalendario === "eliminar" ? "registrado" : (editForm as any).estadoCalendario === "actualizar" ? "reseteado" : "actualizar",
        calificacion: editForm.calificacion,
        tipoPaciente: editForm.tipoPaciente,
        tipoProcedimientoCita: editForm.tipoProcedimientoCita || []
      };

      
      if (selectedPatient) {
        fields.pacientes = [{ id: selectedPatient.id }];
      }
      
      await actualizarCitaV3(editForm.id, fields);
      toast.success("Visita actualizada");
      setEditOpen(false);
      setEditForm(null);
      setPatientSearch("");
      setSelectedPatient(null);
      setOriginalPatientId(null);
      recargar();
    } catch (err) {
      toast.error("Error al actualizar visita");
    }
  };

  const removeVisit = async (id: string) => {
    try {
      await eliminar(Number(id));
      toast.success("Visita eliminada");
    } catch (err) {
      toast.error("Error al eliminar visita");
    }
  };

  const totalDays = daysInMonth(calYear, calMonth);
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const isoForCalendarDay = (day: number) =>
    `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getAppointmentsForDay = (day: number) => {
    const dateStr = isoForCalendarDay(day);
    return dataForCalendar.filter((a) => a.date === dateStr);
  };

  const goToToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setCalendarMonth(new Date(year, month, 1));
    setDateFilter(todayStr);
  };

  const clearCalendarFilters = () => {
    setCalendarSearch("");
    setStatusFilter("all");
    setDateFilter("");
    setTipoPacienteFilter("all");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visitas a domicilio</h1>
          <p className="text-muted-foreground text-sm mt-1">Agenda de desplazamientos: fecha, hora y dirección del paciente</p>
        </div>
        <Dialog open={newVisitOpen} onOpenChange={setNewVisitOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nueva visita</Button></DialogTrigger>
          <DialogContent className="sm:max-w-xl overflow-hidden rounded-xl p-0" showCloseButton={false} showScrollContainer={false} showPadding={false}>
            {/* Header con degradado sutil */}
            <div className="relative px-6 pt-5 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, rgba(34, 180, 173, 0.05) 0%, white 50%)' }}>
              <DialogClose asChild>
                <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </DialogClose>
              <div className="flex items-start gap-3.5 pr-8">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#e6f7f6' }}>
                  <Calendar className="h-5 w-5" style={{ color: '#22b4ad' }} />
                </div>
                <div>
                  <DialogTitle className="text-[18px] font-medium text-foreground">Nueva visita</DialogTitle>
                  <p className="text-[13px] text-gray-500 mt-1">
                    Programar nueva visita para un paciente.
                  </p>
                </div>
              </div>
            </div>

            {/* Formulario */}
            <div className="px-6 py-5 space-y-6 sm:overflow-visible max-sm:overflow-y-auto max-sm:max-h-[calc(90vh-180px)]">
              {/* Sección Paciente */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Paciente</span>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                </div>

                <div className="space-y-2 relative">
                  <Label className="text-[11px] text-gray-500 font-medium">Buscar paciente</Label>
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
              </div>

              {/* Divisor con icono de calendario */}
              <div className="flex items-center gap-3" style={{ marginTop: '8px' }}>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: '#e6f7f6' }}>
                  <Calendar className="h-3.5 w-3.5" style={{ color: '#22b4ad' }} />
                </div>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
              </div>

              {/* Sección Fecha y Hora */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Fecha y Hora</span>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Fecha</Label>
                    <Input
                      type="date"
                      className="w-full text-sm"
                      value={newVisitForm.fecha}
                      onChange={(e) => setNewVisitForm({ ...newVisitForm, fecha: e.target.value })}
                      style={{
                        backgroundColor: '#f5fffe',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: 'none'
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Hora</Label>
                    <Input
                      type="time"
                      className="w-full text-sm"
                      value={newVisitForm.horaCita}
                      onChange={(e) => setNewVisitForm({ ...newVisitForm, horaCita: e.target.value })}
                      style={{
                        backgroundColor: '#f5fffe',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Divisor con icono de calendario */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: '#e6f7f6' }}>
                  <Calendar className="h-3.5 w-3.5" style={{ color: '#22b4ad' }} />
                </div>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
              </div>

              {/* Sección Detalles */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Detalles</span>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Tipo de paciente</Label>
                    <Select
                      value={newVisitForm.tipoPaciente}
                      onValueChange={(v) => setNewVisitForm({ ...newVisitForm, tipoPaciente: v })}
                    >
                      <SelectTrigger
                        className="w-full text-sm"
                        style={{
                          backgroundColor: '#f5fffe',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}
                      >
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="domicilio">Domicilio</SelectItem>
                        <SelectItem value="consultorio">Consultorio</SelectItem>
                        <SelectItem value="consultorio interno">Consultorio interno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Calificación</Label>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Estado</Label>
                    <Select
                      value={newVisitForm.progreso}
                      onValueChange={(v) => setNewVisitForm({ ...newVisitForm, progreso: v })}
                    >
                      <SelectTrigger
                        className="w-full text-sm"
                        style={{
                          backgroundColor: '#f5fffe',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}
                      >
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
                    <Label className="text-[11px] text-gray-500 font-medium">Estado calendario</Label>
                    <Select
                      value={newVisitForm.estadoCalendario || "registrado"}
                      onValueChange={(v) => setNewVisitForm({ ...newVisitForm, estadoCalendario: v })}
                    >
                      <SelectTrigger
                        className="w-full text-sm"
                        style={{
                          backgroundColor: '#f5fffe',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}
                      >
                        <SelectValue placeholder="Registrado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="registrado">Registrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Sección Procedimientos */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Procedimientos</span>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Tipo de procedimiento</Label>
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
                        className={`text-xs px-3 py-1.5 rounded-full transition-colors ${newVisitForm.tipoProcedimientoCita.includes(proc)
                            ? 'bg-[#22b4ad] text-white'
                            : 'bg-[#f5fffe] text-gray-600 hover:bg-[#e6f7f6]'
                          }`}
                      >
                        {proc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2.5" style={{ marginTop: '15px' }}>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="text-sm border-[0.5px]">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  className="text-sm bg-[#22b4ad] hover:bg-[#1a9993] text-white"
                  onClick={async () => {
                    try {
                      await crearCitaV3({
                        horaCita: newVisitForm.horaCita,
                        fecha: newVisitForm.fecha,
                        progreso: newVisitForm.progreso,
                        estadoCalendario: newVisitForm.estadoCalendario,
                        calificacion: newVisitForm.calificacion,
                        tipoPaciente: newVisitForm.tipoPaciente,
                        tipoProcedimientoCita: newVisitForm.tipoProcedimientoCita,
                        historialMedico: [],
                        pacientes: selectedPatient ? [{ id: selectedPatient.id }] : []
                      });
                      toast.success("Visita agendada correctamente");
                      setNewVisitOpen(false);
                      setNewVisitForm({
                        fecha: "",
                        horaCita: "",
                        progreso: "Confirmada",
                        estadoCalendario: "registrado",
                        tipoPaciente: "",
                        calificacion: 0,
                        tipoProcedimientoCita: [],
                      });
                      setPatientSearch("");
                      setSelectedPatient(null);
                      recargar();
                    } catch (err) {
                      toast.error("Error al agendar visita");
                    }
                  }}
                >
                  Agendar visita
                </Button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[0.5px] border-border/60">
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Citas para hoy */}
      <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, rgba(34, 180, 173, 0.05) 0%, white 50%)' }}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: '#e6f7f6' }}>
                <Calendar className="h-5 w-5" style={{ color: '#22b4ad' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Citas para hoy</p>
                <p className="text-xs text-muted-foreground">
                  {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
            <div className="text-right">
              {loading && appointments.length === 0 ? (
                <>
                  <Skeleton className="h-8 w-16 mb-1 ml-auto" />
                  <Skeleton className="h-3 w-24 ml-auto" />
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: '#22b4ad' }}>
                    {animatedPendingToday}
                  </p>
                  <p className="text-xs text-muted-foreground">citas programadas</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="list" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 mt-4">
          <Card className="card-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                {/* Status filter buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                    className={statusFilter === "all" ? "bg-[#22b4ad] hover:bg-[#1a9993] text-white" : "hover:bg-[#22b4ad]/10 hover:text-[#22b4ad] hover:border-[#22b4ad]/30"}
                  >
                    Todos <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[13px] font-semibold tabular-nums">{loadingCounts ? <Skeleton className="h-3 w-4 inline-block" /> : animatedCountAll}</span>
                  </Button>
                  <Button
                    variant={statusFilter === "Confirmada" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("Confirmada")}
                    className={statusFilter === "Confirmada" ? "bg-primary/10 text-primary hover:bg-primary/20 border-0" : "hover:bg-primary/10 hover:text-primary hover:border-primary/30"}
                  >
                    Confirmada <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[13px] font-semibold tabular-nums">{loadingCounts ? <Skeleton className="h-3 w-4 inline-block" /> : animatedCountConfirmada}</span>
                  </Button>
                  <Button
                    variant={statusFilter === "Pendiente" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("Pendiente")}
                    className={statusFilter === "Pendiente" ? "bg-warning/10 text-warning hover:bg-warning/20 border-0" : "hover:bg-warning/10 hover:text-warning hover:border-warning/30"}
                  >
                    Pendiente <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[13px] font-semibold tabular-nums">{loadingCounts ? <Skeleton className="h-3 w-4 inline-block" /> : animatedCountPendiente}</span>
                  </Button>
                  <Button
                    variant={statusFilter === "Cancelada" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("Cancelada")}
                    className={statusFilter === "Cancelada" ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0" : "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"}
                  >
                    Cancelada <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[13px] font-semibold tabular-nums">{loadingCounts ? <Skeleton className="h-3 w-4 inline-block" /> : animatedCountCancelada}</span>
                  </Button>
                  <Button
                    variant={statusFilter === "Descontinuado" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("Descontinuado")}
                    className={statusFilter === "Descontinuado" ? "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 border-0" : "hover:bg-slate-500/10 hover:text-slate-600 hover:border-slate-500/30"}
                  >
                    Descontinuado <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[13px] font-semibold tabular-nums">{loadingCounts ? <Skeleton className="h-3 w-4 inline-block" /> : animatedCountDescontinuado}</span>
                  </Button>
                  <Button
                    variant={statusFilter === "Programado" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("Programado")}
                    className={statusFilter === "Programado" ? "bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 border-0" : "hover:bg-teal-500/10 hover:text-teal-600 hover:border-teal-500/30"}
                  >
                    Programado <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[13px] font-semibold tabular-nums">{loadingCounts ? <Skeleton className="h-3 w-4 inline-block" /> : animatedCountProgramado}</span>
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Input type="date" className="w-48" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                  <Select value={tipoPacienteFilter} onValueChange={setTipoPacienteFilter}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Tipo paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="domicilio">Domicilio</SelectItem>
                      <SelectItem value="consultorio">Consultorio</SelectItem>
                      <SelectItem value="consultorio interno">Consultorio interno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-shadow overflow-hidden">
            <div className="relative w-full min-w-0 overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch', padding: '15px 25px' }}>
              <Table className="min-w-[1200px] [&_td]:py-1.5 [&_td]:px-2 [&_th]:py-2 [&_th]:px-2">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Fecha Cita</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Calificación</TableHead>
                    <TableHead>Tipo Paciente</TableHead>
                    <TableHead className="max-w-[200px]">Procedimiento</TableHead>
                    <TableHead className="text-center">Historial</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {loading && appointments.length === 0 ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={`sk-${i}`} style={{ height: '20px' }}>
                        <TableCell className=""><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell className=""><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell className=""><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className=""><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className=""><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className=""><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className=""><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell className=""><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell className=""><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-6 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : filtered.map((a) => (
                  <TableRow key={a.id} className="hover:bg-muted/30" style={{ height: '20px' }}>
                    <TableCell className="text-sm text-muted-foreground">{a.id}</TableCell>
                    <TableCell className="font-medium">{a.pacientes?.fields?.nombreCompleto || a.patientName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                      <span className="line-clamp-2">{a.fechaCitas || a.date}</span>
                    </TableCell>
                    <TableCell className="">{a.horaCita || a.time}</TableCell>
                    <TableCell className=""><Badge className={progresoColor(a.progreso || a.status)}>{a.progreso || a.status}</Badge></TableCell>
                    <TableCell className="">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${star <= (a.calificacion || 0)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'fill-gray-200 text-gray-200'
                              }`}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="">{a.tipoPaciente ? <Badge className={tipoPacienteColor(a.tipoPaciente)}>{a.tipoPaciente}</Badge> : '-'}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setProcedimientoData(a); setProcedimientoOpen(true); }}
                          className="shrink-0 p-1 rounded hover:bg-[#22b4ad]/10 transition-colors"
                          title="Ver procedimiento"
                        >
                          <Eye className="h-4 w-4 text-[#22b4ad]" />
                        </button>
                        <span className="truncate">{Array.isArray(a.tipoProcedimientoCita) ? a.tipoProcedimientoCita.join(', ') : (a.notes || '-')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2 border-[#22b4ad] text-[#22b4ad] hover:bg-[#22b4ad]/10"
                        onClick={() => {
                          setDetailsAppointment(a);
                          openDetailsVisit(a);
                        }}
                      >
                        Ver historial ({Array.isArray(a.historialMedico) ? a.historialMedico.length : 0})
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Más opciones"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditVisit(a)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDetailsVisit(a)}>
                            Ver detalles
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              >
                                Eliminar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar esta visita?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se quitará de la agenda la visita del {a.date} a las {a.time} ({a.patientName}). En esta demo el cambio solo afecta a esta sesión.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => removeVisit(a.id)}
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4 space-y-4">
          <Card className="card-shadow">
            <CardHeader className="pb-2 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Calendario interactivo</CardTitle>
                  <CardDescription className="mt-1">
                    Pulsa un día para abrir un resumen con hora, paciente y estado. Desde ahí puedes filtrar la pestaña Lista. Usa estado y búsqueda para acotar el calendario. El día de referencia de la clínica va resaltado.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={goToToday}>
                    Ir a hoy
                  </Button>
                  {dateFilter ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDateFilter("")}>
                      Quitar día
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" size="sm" onClick={clearCalendarFilters}>
                    Limpiar filtros
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 h-10"
                    placeholder="Buscar en calendario: paciente, notas o domicilio…"
                    value={calendarSearch}
                    onChange={(e) => setCalendarSearch(e.target.value)}
                    aria-label="Buscar visitas en el calendario"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full lg:w-52 h-10">
                    <Filter className="mr-2 h-4 w-4 shrink-0" />
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="Confirmada">Confirmada</SelectItem>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                    <SelectItem value="Descontinuado">Descontinuado</SelectItem>
                    <SelectItem value="Programado">Programado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                >
                  ← Mes anterior
                </Button>
                <p className="text-sm font-semibold text-center tabular-nums">
                  {monthNames[calMonth]} {calYear}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                >
                  Mes siguiente →
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                  <div key={d} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                    {d}
                  </div>
                ))}
                {Array.from({ length: offset }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-muted/20 p-2 min-h-[96px]" />
                ))}
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                  const dateStr = isoForCalendarDay(day);
                  const dayApps = getAppointmentsForDay(day);
                  const sortedDay = [...dayApps].sort((a, b) => a.time.localeCompare(b.time));
                  const isSelected = dateFilter === dateStr;
                  const isClinicToday = dateStr === clinicToday;
                  return (
                    <Popover key={day}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "bg-card p-2 min-h-[96px] border-t text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                          )}
                        >
                          <span className={cn("text-sm font-semibold tabular-nums", isClinicToday && "text-primary")}>
                            {day}
                          </span>
                          <div className="mt-1.5 space-y-0.5">
                            {dayApps.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            ) : (
                              <>
                                {dayApps.slice(0, 3).map((a) => (
                                  <div
                                    key={a.id}
                                    className="text-[11px] px-2 py-0.5 rounded truncate flex items-center gap-1.5"
                                  >
                                    <span
                                      className={cn(
                                        "w-2 h-2 rounded-full shrink-0",
                                        a.progreso === "Confirmada" && "bg-primary",
                                        a.progreso === "Pendiente" && "bg-warning",
                                        a.progreso === "En Progreso" && "bg-indigo-500",
                                        a.progreso === "Completada" && "bg-success",
                                        a.progreso === "Cancelada" && "bg-destructive",
                                        !a.progreso && "bg-slate-500",
                                      )}
                                    />
                                    Pct: {a.patientName.split(" ")[0]} - Cita {a.time}
                                  </div>
                                ))}
                                {dayApps.length > 3 ? (
                                  <p className="text-[11px] text-muted-foreground font-medium">+{dayApps.length - 3} más</p>
                                ) : null}
                              </>
                            )}
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-full min-w-[414px] max-w-[1200px] p-0"
                        align="start"
                        side="bottom"
                        sideOffset={6}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <div className="border-b border-border px-3 py-2.5">
                          <p className="text-sm font-semibold capitalize leading-tight">{titleForCalendarIso(dateStr)}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {sortedDay.length === 0
                              ? "Sin visitas con los filtros actuales"
                              : `${sortedDay.length} visita${sortedDay.length === 1 ? "" : "s"}`}
                          </p>
                        </div>
                        <div className="max-h-[min(240px,40vh)] overflow-y-auto p-2 space-y-2">
                          {sortedDay.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-1 py-2">Prueba a quitar búsqueda o estado.</p>
                          ) : (
                            sortedDay.map((a) => (
                              <div
                                key={a.id}
                                className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-left"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-semibold tabular-nums text-primary shrink-0">{a.time}</span>
                                  <div className="flex items-center gap-1.5">
                                    <Badge className={cn("shrink-0 text-[11px] px-2 py-0.5", progresoColor(a.progreso || a.status))}>
                                      {a.progreso || a.status}
                                    </Badge>
                                    <button
                                      onClick={() => {
                                        setDetailsAppointment(a);
                                        openDetailsVisit(a);
                                      }}
                                      className="shrink-0 p-1 rounded hover:bg-[#22b4ad]/10 transition-colors"
                                      title="Ver detalles"
                                    >
                                      <Eye className="h-4 w-4 text-[#22b4ad]" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-base font-medium mt-1 leading-snug">{a.patientName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.visitAddress}</p>
                                
                                {/* Información adicional */}
                                <div className="mt-2 space-y-1.5">
                                  {a.tipoPaciente && (
                                    <div className="flex items-center gap-1.5">
                                      <Badge className={cn("text-[10px] px-2 py-0.5", tipoPacienteColor(a.tipoPaciente))}>
                                        {a.tipoPaciente}
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {a.calificacion > 0 && (
                                    <div className="flex items-center gap-0.5">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          className={`h-3.5 w-3.5 ${star <= a.calificacion
                                              ? 'fill-yellow-400 text-yellow-400'
                                              : 'fill-gray-200 text-gray-200'
                                            }`}
                                        />
                                      ))}
                                    </div>
                                  )}
                                  
                                  {Array.isArray(a.tipoProcedimientoCita) && a.tipoProcedimientoCita.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {a.tipoProcedimientoCita.slice(0, 2).map((proc: string, idx: number) => (
                                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-white/60 text-gray-600">
                                          {proc}
                                        </span>
                                      ))}
                                      {a.tipoProcedimientoCita.length > 2 && (
                                        <span className="text-[10px] text-muted-foreground">+{a.tipoProcedimientoCita.length - 2}</span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {Array.isArray(a.historialMedico) && a.historialMedico.length > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                        <polyline points="10 9 9 9 8 9"></polyline>
                                      </svg>
                                      <span>{a.historialMedico.length} registro{a.historialMedico.length === 1 ? '' : 's'}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {a.notes ? (
                                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 border-t border-border/50 pt-1.5">
                                    {a.notes}
                                  </p>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                        <div className="border-t border-border p-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setDateFilter(dateStr);
                              toast.success("Lista filtrada", {
                                description: `Mostrando solo visitas del ${dateStr}. Abre la pestaña Lista.`,
                              });
                            }}
                          >
                            Filtrar pestaña Lista por este día
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditForm(null); }}>
        <DialogContent className="sm:max-w-xl overflow-hidden rounded-xl p-0" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {editForm && (
            <>
              {/* Header con degradado sutil */}
              <div className="relative px-6 pt-5 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, rgba(34, 180, 173, 0.05) 0%, white 50%)' }}>
                <DialogClose asChild>
                  <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </DialogClose>
                <div className="flex items-start gap-3.5 pr-8">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#e6f7f6' }}>
                    <Calendar className="h-5 w-5" style={{ color: '#22b4ad' }} />
                  </div>
                  <div className="flex-1">
                    <DialogTitle className="text-[18px] font-medium text-foreground">Editar visita</DialogTitle>
                    <p className="text-[13px] text-gray-500 mt-1">
                      Modifica los datos de la visita programada.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" className="text-sm border-[0.5px]">
                        Cancelar
                      </Button>
                    </DialogClose>
                    <Button
                      type="button"
                      className="text-sm bg-[#22b4ad] hover:bg-[#1a9993] text-white"
                      onClick={saveEditVisit}
                    >
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              </div>

              {/* Formulario */}
              <div className="px-6 py-5 space-y-6 sm:overflow-visible max-sm:overflow-y-auto max-sm:max-h-[calc(90vh-180px)]">
                {/* Sección Paciente */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Paciente</span>
                    <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                  </div>

                  <div className="space-y-2 relative">
                    <Label className="text-[11px] text-gray-500 font-medium">Buscar paciente</Label>
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
                        setEditForm((f) => f ? { ...f, patientId: patient.id, patientName: patient.fields.nombreCompleto } : f);
                      }}
                    />
                  </div>
                </div>

                {/* Divisor con icono de calendario */}
                <div className="flex items-center gap-3" style={{ marginTop: '8px' }}>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: '#e6f7f6' }}>
                    <Calendar className="h-3.5 w-3.5" style={{ color: '#22b4ad' }} />
                  </div>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
                </div>

                {/* Sección Fecha y Hora */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Fecha y Hora</span>
                    <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Fecha</Label>
                      <Input
                        type="date"
                        className="w-full text-sm"
                        value={editForm.date}
                        onChange={(e) => setEditForm((f) => (f ? { ...f, date: e.target.value } : f))}
                        style={{
                          backgroundColor: '#f5fffe',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Hora</Label>
                      <Input
                        type="time"
                        className="w-full text-sm"
                        value={editForm.time}
                        onChange={(e) => setEditForm((f) => (f ? { ...f, time: e.target.value } : f))}
                        style={{
                          backgroundColor: '#f5fffe',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Divisor con icono de calendario */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: '#e6f7f6' }}>
                    <Calendar className="h-3.5 w-3.5" style={{ color: '#22b4ad' }} />
                  </div>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
                </div>

                {/* Sección Detalles */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Detalles</span>
                    <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Tipo de paciente</Label>
                      <Select
                        value={editForm.tipoPaciente || ""}
                        onValueChange={(v) => setEditForm((f) => (f ? { ...f, tipoPaciente: v } : f))}
                      >
                        <SelectTrigger
                          className="w-full text-sm"
                          style={{
                            backgroundColor: '#f5fffe',
                            border: 'none',
                            borderRadius: '8px',
                            boxShadow: 'none'
                          }}
                        >
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="domicilio">Domicilio</SelectItem>
                          <SelectItem value="consultorio">Consultorio</SelectItem>
                          <SelectItem value="consultorio interno">Consultorio interno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Calificación</Label>
                      <div className="flex gap-0.5 items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setEditForm((f) => (f ? { ...f, calificacion: star } : f))}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(null)}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-5 w-5 ${(hoveredRating || editForm.calificacion) >= star
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'fill-gray-200 text-gray-200'
                                }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Estado</Label>
                      <Select
                        value={editForm.progreso || editForm.status}
                        onValueChange={(v) => setEditForm((f) => (f ? { ...f, progreso: v, status: v as Appointment["status"] } : f))}
                      >
                        <SelectTrigger
                          className="w-full text-sm"
                          style={{
                            backgroundColor: '#f5fffe',
                            border: 'none',
                            borderRadius: '8px',
                            boxShadow: 'none'
                          }}
                        >
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
                      <Label className="text-[11px] text-gray-500 font-medium">Estado calendario</Label>
                      {(editForm as any).estadoCalendario === "eliminar" ? (
                        <Select
                          value="registrado"
                          onValueChange={(v) => setEditForm((f) => (f ? { ...f, estadoCalendario: v } as any : f))}
                        >
                          <SelectTrigger
                            className="w-full text-sm"
                            style={{
                              backgroundColor: '#f5fffe',
                              border: 'none',
                              borderRadius: '8px',
                              boxShadow: 'none'
                            }}
                          >
                            <SelectValue placeholder="Registrar de nuevo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="registrado">Registrar de nuevo</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select
                          value={(editForm as any).estadoCalendario === "registrado" || !(editForm as any).estadoCalendario ? "actualizar" : (editForm as any).estadoCalendario}
                          onValueChange={(v) => setEditForm((f) => (f ? { ...f, estadoCalendario: v } as any : f))}
                        >
                          <SelectTrigger
                            className="w-full text-sm"
                            style={{
                              backgroundColor: '#f5fffe',
                              border: 'none',
                              borderRadius: '8px',
                              boxShadow: 'none'
                            }}
                          >
                            <SelectValue placeholder="Actualizar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="actualizar">Actualizar</SelectItem>
                            <SelectItem value="eliminar">Eliminar</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sección Procedimientos */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Procedimientos</span>
                    <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Tipo de procedimiento</Label>
                    <div className="flex flex-wrap gap-2">
                      {['uñeros', 'limpieza de los pies', 'Profilaxis podal', 'Onicotomia', 'Deslaminado', 'Masaje Podal', 'Encarilado', 'Retiro de espicula'].map((proc) => (
                        <button
                          key={proc}
                          type="button"
                          onClick={() => {
                            const selected = Array.isArray(editForm.tipoProcedimientoCita) && editForm.tipoProcedimientoCita.includes(proc);
                            setEditForm((f) => (f ? {
                              ...f,
                              tipoProcedimientoCita: selected
                                ? editForm.tipoProcedimientoCita.filter(p => p !== proc)
                                : [...(editForm.tipoProcedimientoCita || []), proc]
                            } : f));
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${Array.isArray(editForm.tipoProcedimientoCita) && editForm.tipoProcedimientoCita.includes(proc)
                              ? 'bg-[#22b4ad] text-white'
                              : 'bg-[#f5fffe] text-gray-600 hover:bg-[#e6f7f6]'
                            }`}
                        >
                          {proc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[0.5px] border-border/60">
            </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[1000px] overflow-hidden" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {detailsAppointment && (
            <>
              {/* Header con color sólido */}
              <div className="bg-[#22b4ad] relative">
                <DialogClose asChild>
                  <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/20 border-0 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </DialogClose>
                <div className="flex items-center gap-3.5 px-6 py-5">
                  <div className="w-12 h-12 rounded-full bg-white/25 flex items-center justify-center text-lg font-medium text-white shrink-0">
                    {detailsAppointment.patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-medium text-white truncate">{detailsAppointment.patientName}</p>
                    <p className="text-[13px] text-white/80">Detalles de visita · Podología domicilio</p>
                  </div>
                  <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full border border-white/35 mr-8">
                    {detailsAppointment.progreso || detailsAppointment.status}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Datos de la visita */}
                <div className="px-6 pt-5">
                  <p className="text-[11px] font-medium text-[#22b4ad] tracking-wide uppercase mb-3">Datos de la visita</p>

                  <div className="grid grid-cols-2 gap-3 bg-muted/30 rounded-lg p-4 border border-border/60">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Fecha</p>
                      <p className="text-sm font-medium text-foreground">{detailsAppointment.date}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Hora</p>
                      <p className="text-sm font-medium text-foreground">{detailsAppointment.time}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Tipo de paciente</p>
                      {detailsAppointment.tipoPaciente ? (
                        <Badge className={tipoPacienteColor(detailsAppointment.tipoPaciente)}>
                          {detailsAppointment.tipoPaciente}
                        </Badge>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Calificación</p>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${star <= (detailsAppointment.calificacion || 0)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'fill-gray-200 text-gray-200'
                              }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] text-muted-foreground mb-0.5">Procedimiento</p>
                      <p className="text-sm font-medium text-foreground">
                        {Array.isArray(detailsAppointment.tipoProcedimientoCita) 
                          ? detailsAppointment.tipoProcedimientoCita.join(', ') 
                          : (detailsAppointment.notes || '—')}
                      </p>
                    </div>
                  </div>

                  {/* Dirección */}
                  {detailsAppointment.visitAddress && (
                    <div className="mt-3 p-3 bg-[#f5fffe] rounded-lg border border-[#22b4ad]/20">
                      <p className="text-[11px] text-muted-foreground mb-1">Dirección de la visita</p>
                      <p className="text-sm font-medium text-foreground">{detailsAppointment.visitAddress}</p>
                    </div>
                  )}
                </div>

                {/* Historial médico */}
                <div className="px-6 pt-5 pb-5">
                  {/* Header de sección */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                      </svg>
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#0F6E56', letterSpacing: '0.07em' }}>HISTORIAL MÉDICO</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs h-8 px-3 rounded-md"
                      style={{ backgroundColor: '#1D9E75', color: 'white' }}
                      onClick={() => setAgregarHistorialOpen(true)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Agregar
                    </Button>
                  </div>

                  {loadingHistorial ? (
                    <div className="text-center py-4 flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#1D9E75' }} />
                      <span className="text-sm text-muted-foreground">Cargando historial...</span>
                    </div>
                  ) : historialPaciente && historialPaciente.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      {historialPaciente.map((historial: any, idx: number) => {
                        const fields = historial.fields || historial;
                        const imagenPodologica = fields.imagenPodologica && fields.imagenPodologica.length > 0
                          ? fields.imagenPodologica[0]
                          : null;
                        return (
                          <div key={idx} className="space-y-3">
                            {/* Grid de tarjetas de datos clínicos */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Problemas */}
                              <div className="bg-white border border-gray-200 p-[14px_16px] rounded-r-lg" style={{ borderLeft: '3px solid #1D9E75', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
                                <div className="flex items-center gap-2 mb-2">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  <p className="text-[10px] font-semibold uppercase" style={{ color: '#1D9E75', letterSpacing: '0.07em' }}>Problemas</p>
                                </div>
                                <p className="text-[14px] leading-relaxed text-foreground">{fields.problemas || "No especificado"}</p>
                              </div>

                              {/* Antecedentes patológicos */}
                              <div className="bg-white border border-gray-200 p-[14px_16px] rounded-r-lg" style={{ borderLeft: '3px solid #1D9E75', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
                                <div className="flex items-center gap-2 mb-2">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                                  </svg>
                                  <p className="text-[10px] font-semibold uppercase" style={{ color: '#1D9E75', letterSpacing: '0.07em' }}>Antecedentes patológicos</p>
                                </div>
                                <p className="text-[14px] leading-relaxed text-foreground">{fields.antecedentesPatalogico || "No especificado"}</p>
                              </div>

                              {/* Receta */}
                              <div className="bg-white border border-gray-200 p-[14px_16px] rounded-r-lg" style={{ borderLeft: '3px solid #1D9E75', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
                                <div className="flex items-center gap-2 mb-2">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                    <path d="M2 17l10 5 10-5"></path>
                                    <path d="M2 12l10 5 10-5"></path>
                                  </svg>
                                  <p className="text-[10px] font-semibold uppercase" style={{ color: '#1D9E75', letterSpacing: '0.07em' }}>Receta</p>
                                </div>
                                <p className="text-[14px] leading-relaxed text-foreground">{fields.recetaPaciente || "No especificado"}</p>
                              </div>

                              {/* Anamnesis */}
                              <div className="bg-white border border-gray-200 p-[14px_16px] rounded-r-lg" style={{ borderLeft: '3px solid #1D9E75', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
                                <div className="flex items-center gap-2 mb-2">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                  <p className="text-[10px] font-semibold uppercase" style={{ color: '#1D9E75', letterSpacing: '0.07em' }}>Anamnesis</p>
                                </div>
                                <p className="text-[14px] leading-relaxed text-foreground">{fields.Anamnesis || "No especificado"}</p>
                              </div>
                            </div>

                            {/* Fila inferior */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Tipo de procedimiento */}
                              {fields.tipoProcedimiento && fields.tipoProcedimiento.length > 0 && (
                                <div className="p-4 rounded-2xl" style={{ backgroundColor: '#E1F5EE' }}>
                                  <div className="flex flex-wrap gap-2">
                                    {fields.tipoProcedimiento.map((proc: string, pIdx: number) => (
                                      <span key={pIdx} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ color: '#085041', backgroundColor: 'rgba(255,255,255,0.6)' }}>
                                        {proc}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Imagen clínica */}
                              {imagenPodologica ? (
                                <div className="relative rounded-lg overflow-hidden group" style={{ height: '160px' }}>
                                  <img
                                    src={imagenPodologica.signedUrl || imagenPodologica.url}
                                    alt="Imagen clínica"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md" style={{ backgroundColor: 'rgba(15,110,86,0.88)' }}>
                                    <span className="text-[11px] font-medium text-white">Imagen clínica</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setImagenUrl(imagenPodologica.signedUrl || imagenPodologica.url);
                                      setImagenCompletaOpen(true);
                                    }}
                                    className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                    title="Ver imagen completa"
                                  >
                                    <Maximize2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="relative rounded-lg bg-gray-100 flex items-center justify-center" style={{ height: '160px' }}>
                                  <span className="text-sm text-muted-foreground">No disponible</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/60 text-center">
                      <p className="text-sm text-muted-foreground">No hay historial médico disponible</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <DialogFooter className="gap-2 border-t border-border/60 bg-muted/30 px-6 py-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cerrar
                  </Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Agregar Historial Modal */}
      <Dialog open={agregarHistorialOpen} onOpenChange={setAgregarHistorialOpen}>
        <DialogContent className="sm:max-w-xl overflow-hidden rounded-xl p-0" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {/* Header */}
          <div className="bg-[#22b4ad] relative">
            <DialogClose asChild>
              <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/20 border-0 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
            <div className="px-6 py-5">
              <DialogTitle className="text-[18px] font-medium text-white">Agregar historial médico</DialogTitle>
              <p className="text-[13px] text-white/80 mt-1">
                Registra información médica de la visita.
              </p>
            </div>
          </div>

          {/* Formulario */}
          <div className="px-6 py-5 space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-[11px] text-gray-500 font-medium">Problemas</Label>
              <Textarea
                placeholder="Describe los problemas o síntomas..."
                className="w-full text-sm min-h-[80px]"
                value={nuevoHistorial.problemas}
                onChange={(e) => setNuevoHistorial({ ...nuevoHistorial, problemas: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-gray-500 font-medium">Receta</Label>
              <Textarea
                placeholder="Prescripción médica..."
                className="w-full text-sm min-h-[80px]"
                value={nuevoHistorial.recetaPaciente}
                onChange={(e) => setNuevoHistorial({ ...nuevoHistorial, recetaPaciente: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-gray-500 font-medium">Antecedentes patológicos</Label>
              <Textarea
                placeholder="Antecedentes médicos relevantes..."
                className="w-full text-sm min-h-[80px]"
                value={nuevoHistorial.antecedentesPatalogico}
                onChange={(e) => setNuevoHistorial({ ...nuevoHistorial, antecedentesPatalogico: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-gray-500 font-medium">Anamnesis</Label>
              <Textarea
                placeholder="Historia clínica del paciente..."
                className="w-full text-sm min-h-[80px]"
                value={nuevoHistorial.Anamnesis}
                onChange={(e) => setNuevoHistorial({ ...nuevoHistorial, Anamnesis: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-gray-500 font-medium">Tipo de procedimiento</Label>
              <div className="flex flex-wrap gap-2">
                {['uñeros', 'limpieza de los pies', 'Profilaxis podal', 'Onicotomia', 'Deslaminado', 'Masaje Podal', 'Encarilado', 'Retiro de espicula'].map((proc) => (
                  <button
                    key={proc}
                    type="button"
                    onClick={() => {
                      setNuevoHistorial((prev) => ({
                        ...prev,
                        tipoProcedimiento: prev.tipoProcedimiento.includes(proc)
                          ? prev.tipoProcedimiento.filter((p) => p !== proc)
                          : [...prev.tipoProcedimiento, proc],
                      }));
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      nuevoHistorial.tipoProcedimiento.includes(proc)
                        ? 'bg-[#22b4ad] text-white border-[#22b4ad]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#22b4ad] hover:text-[#22b4ad]'
                    }`}
                  >
                    {proc}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-gray-500 font-medium">Observación del mes</Label>
              <Textarea
                placeholder="Observaciones del mes actual..."
                className="w-full text-sm min-h-[80px]"
                value={nuevoHistorial.observacionMes}
                onChange={(e) => setNuevoHistorial({ ...nuevoHistorial, observacionMes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-gray-500 font-medium">Imagen podológica</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#22b4ad] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="imagenPodologica"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNuevoHistorial({ ...nuevoHistorial, imagenPodologica: file });
                    }
                  }}
                />
                <label htmlFor="imagenPodologica" className="cursor-pointer">
                  {nuevoHistorial.imagenPodologica ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center">
                        <Check className="h-8 w-8 text-green-500" />
                      </div>
                      <p className="text-sm text-gray-600">{nuevoHistorial.imagenPodologica.name}</p>
                      <p className="text-xs text-gray-400">Click para cambiar</p>
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
          </div>

          {/* Footer */}
          <DialogFooter className="gap-2 border-t border-border/60 bg-muted/30 px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="bg-[#22b4ad] hover:bg-[#1a9993] text-white"
              onClick={handleSaveHistorial}
            >
              Guardar historial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Procedure Modal */}
      <Dialog open={procedimientoOpen} onOpenChange={setProcedimientoOpen}>
        <DialogContent className="sm:max-w-[720px] overflow-hidden" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {procedimientoData && (
            <>
              {/* Header con color sólido */}
              <div className="bg-[#22b4ad] relative">
                <DialogClose asChild>
                  <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/20 border-0 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </DialogClose>
                <div className="flex items-center gap-3.5 px-6 py-5">
                  <div className="w-12 h-12 rounded-full bg-white/25 flex items-center justify-center text-lg font-medium text-white shrink-0">
                    {procedimientoData.patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-medium text-white truncate">{procedimientoData.patientName}</p>
                    <p className="text-[13px] text-white/80">Procedimiento · Podología domicilio</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="px-6 pt-5">
                  <p className="text-[11px] font-medium text-[#22b4ad] tracking-wide uppercase mb-3">Procedimiento</p>

                  <div className="p-4 bg-muted/30 rounded-lg border border-border/60">
                    <p className="text-[11px] text-muted-foreground mb-2">Tipo de procedimiento:</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(procedimientoData.tipoProcedimientoCita) && procedimientoData.tipoProcedimientoCita.length > 0 ? (
                        procedimientoData.tipoProcedimientoCita.map((proc, idx) => (
                          <Badge key={idx} className="bg-[#22b4ad] text-white">
                            {proc}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-foreground">{procedimientoData.notes || 'No especificado'}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3 bg-muted/30 rounded-lg p-4 border border-border/60">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Fecha</p>
                      <p className="text-sm font-medium text-foreground">{procedimientoData.date}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Hora</p>
                      <p className="text-sm font-medium text-foreground">{procedimientoData.time}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Estado</p>
                      <Badge className={progresoColor(procedimientoData.progreso || procedimientoData.status)}>
                        {procedimientoData.progreso || procedimientoData.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Tipo de paciente</p>
                      {procedimientoData.tipoPaciente ? (
                        <Badge className={tipoPacienteColor(procedimientoData.tipoPaciente)}>
                          {procedimientoData.tipoPaciente}
                        </Badge>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>

                  {procedimientoData.visitAddress && (
                    <div className="mt-3 p-3 bg-[#f5fffe] rounded-lg border border-[#22b4ad]/20">
                      <p className="text-[11px] text-muted-foreground mb-1">Dirección de la visita</p>
                      <p className="text-sm font-medium text-foreground">{procedimientoData.visitAddress}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <DialogFooter className="gap-2 border-t border-border/60 bg-muted/30 px-6 py-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cerrar
                  </Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para ver imagen completa */}
      <Dialog open={imagenCompletaOpen} onOpenChange={setImagenCompletaOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden" showCloseButton={false}>
          <button
            onClick={() => setImagenCompletaOpen(false)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {imagenUrl && (
            <img
              src={imagenUrl}
              alt="Imagen completa"
              className="w-full h-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
