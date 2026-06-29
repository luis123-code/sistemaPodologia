import { useMemo, useState, useEffect, useRef } from "react";
import { Search, Plus, Edit, Trash2, Filter, Users, UserCheck, UserX, UserPlus, MapPin, MessageCircle, Calendar, Eye, ScrollText, X, MoreVertical, Home, Check, UserPlus2, Loader2, Copy, ImageIcon, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { crearCita, citasPorPacienteAsociado } from "@/services/nocodb/citas.service";
import { historialPorCita } from "@/services/nocodb/historialMedico.service";
import { buscarPacientePorCampo, actualizarPacienteV3 } from "@/services/nocodb/pacientes.service";
import { type Patient, appointments, medicalRecords, clinicToday } from "@/data/mockData";
import { addMonthsMonthStart, monthStartIso } from "@/lib/clinicDates";
import { toast } from "sonner";
import { SparklineAreaAnimated } from "@/components/charts/SparklineAreaAnimated";
import {
  cumulativeNewPatientsInMonth,
  cumulativePatientsByRegistration,
  cumulativePatientsWithStatus,
} from "@/lib/metricSparklineSeries";
import { usePacientes } from "@/services/nocodb/core";
import type { Paciente } from "@/services/nocodb/core/types";

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

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<string>("nombreCompleto");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { pacientes: pacientesNocoDB, loading, error, crear, actualizar, eliminar, recargar, totalCount } = usePacientes();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showCitas, setShowCitas] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailPatient, setDetailPatient] = useState<Patient | null>(null);
  const [citaPatient, setCitaPatient] = useState<Patient | null>(null);
  const [citasPaciente, setCitasPaciente] = useState<any[]>([]);
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [historialPaciente, setHistorialPaciente] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [imagenSeleccionada, setImagenSeleccionada] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 20;
  const [uploadingFotoAdd, setUploadingFotoAdd] = useState(false);
  const [uploadingFotoEdit, setUploadingFotoEdit] = useState(false);
  const [fotoPreviewAdd, setFotoPreviewAdd] = useState<string | null>(null);
  const [fotoPreviewEdit, setFotoPreviewEdit] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [agendarCitaOpen, setAgendarCitaOpen] = useState(false);
  const [savingCita, setSavingCita] = useState(false);
  const [nuevaCita, setNuevaCita] = useState<{
    horaCita: string;
    fecha: string;
    progreso: string;
    estadoCalendario: string;
    tokenCalendario: string;
    calificacion: number;
    tipoPaciente: string;
    tipoProcedimientoCita: string[];
    historialMedico: { id: string }[];
  }>({
    horaCita: "",
    fecha: "",
    progreso: "Confirmada",
    estadoCalendario: "nuevo",
    tokenCalendario: "",
    calificacion: 5,
    tipoPaciente: "",
    tipoProcedimientoCita: [],
    historialMedico: [],
  });
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [newPatient, setNewPatient] = useState<Partial<Patient>>({
    name: "",
    phone: "",
    email: "",
    age: 0,
    genero: "",
    address: "",
    ubicacion: "",
    status: "registrado",
  });
  const [saving, setSaving] = useState(false);

  // Convertir Paciente de NocoDB a formato Patient del componente
  const patientsData = useMemo(() => {
    console.log("[PatientsPage] pacientesNocoDB recibido:", pacientesNocoDB);
    console.log("[PatientsPage] Es array:", Array.isArray(pacientesNocoDB));
    if (!pacientesNocoDB || !Array.isArray(pacientesNocoDB)) {
      console.log("[PatientsPage] Retornando array vacío");
      return [];
    }
    const converted = pacientesNocoDB.map((p) => {
      // Extraer datos de fields si existe (estructura real de API), sino usar directo
      const f = (p.fields || p) as any;
      const originalId = p.id || p.Id;
      console.log("[PatientsPage] Procesando paciente:", p);
      console.log("[PatientsPage] Original ID:", originalId, "Type:", typeof originalId);
      console.log("[PatientsPage] CreatedAt de API:", f.CreatedAt, "Type:", typeof f.CreatedAt);
      const convertedPatient = {
        id: (originalId || "").toString(),
        nocodbId: originalId || null,
        name: f.nombreCompleto || "",
        dni: f.telefono || "",
        phone: f.telefono || "",
        age: f.Edad || null,
        email: f.correoElectronico || "",
        address: f.Dirección || "",
        status: f.Estado || "nuevo",
        registeredAt: f.CreatedAt || "",
        genero: f.genero || "",
        foto: (Array.isArray(f.fotoPacientes) && f.fotoPacientes.length > 0) ? (f.fotoPacientes[0].signedUrl || f.fotoPacientes[0].url) : "",
        whatsapp: f.Wasap || "",
        ubicacion: f.Ubicacion?.url || "",
        mensaje: f.Mensaje?.url || "",
        citas: f.citas || [],
      };
      console.log("[PatientsPage] Paciente convertido - id:", convertedPatient.id, "nocodbId:", convertedPatient.nocodbId);
      return convertedPatient;
    }) as Patient[];
    console.log("[PatientsPage] Pacientes convertidos:", converted.length, converted);
    return converted;
  }, [pacientesNocoDB]);

  const monthStart = monthStartIso(clinicToday);
  const nextMonthStart = addMonthsMonthStart(monthStart, 1);

  // Debounce search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (search.trim() === "") {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      try {
        const operator = searchField === 'Edad' ? 'eq' : 'like';
        const data = await buscarPacientePorCampo(searchField, operator, search);

        console.log("[Search] API Response structure:", JSON.stringify(data, null, 2));
        console.log("[Search] data.records:", data.records);
        console.log("[Search] data.records length:", data.records?.length);

        if (data.records && data.records.length > 0) {
          console.log("[Search] First item structure:", JSON.stringify(data.records[0], null, 2));
        }
        setSearchResults(data.records || []);
      } catch (err) {
        console.error("[Search] Error:", err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(delayDebounceFn);
  }, [search, searchField]);

  const metrics = useMemo(() => {
    const totalPatients = patientsData.length;
    const registrados = patientsData.filter((p) => p.status === "registrado").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = patientsData.filter((p) => {
      if (!p.registeredAt) return false;
      const registeredDate = new Date(p.registeredAt);
      registeredDate.setHours(0, 0, 0, 0);
      return registeredDate.getTime() === today.getTime();
    });
    console.log("[Metrics] today:", today.toISOString());
    console.log("[Metrics] Pacientes creados hoy:", newToday.length);
    console.log("[Metrics] Pacientes creados hoy:", newToday.map(p => ({ name: p.name, registeredAt: p.registeredAt })));
    return [
      {
        label: "Total Pacientes",
        value: totalPatients,
        icon: Users,
        color: "text-primary",
        bg: "bg-primary/10",
        spark: cumulativePatientsByRegistration(patientsData),
      },
      {
        label: "Registrados",
        value: registrados,
        icon: UserCheck,
        color: "text-success",
        bg: "bg-success/10",
        spark: cumulativePatientsWithStatus(patientsData, "registrado"),
      },
      {
        label: "Nuevos hoy",
        value: newToday.length,
        icon: UserPlus2,
        color: "text-warning",
        bg: "bg-warning/10",
        spark: cumulativeNewPatientsInMonth(patientsData, monthStart, nextMonthStart),
      },
    ];
  }, [patientsData, monthStart, nextMonthStart]);

  // Animated values for metrics
  const animatedTotalPatients = useCountUp(metrics[0]?.value || 0, 800);
  const animatedRegistrados = useCountUp(metrics[1]?.value || 0, 800);
  const animatedNewToday = useCountUp(metrics[2]?.value || 0, 800);

  const filtered = patientsData.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.dni.includes(search);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Convert searchResults to Patient format
  const searchResultsConverted = useMemo(() => {
    if (!searchResults || searchResults.length === 0) {
      console.log("[Search] No search results to convert");
      return [];
    }
    console.log("[Search] Converting search results:", searchResults);
    const converted = searchResults.map((p, index) => {
      console.log(`[Search] Converting item ${index}:`, p);
      const f = (p.fields || p) as any;
      console.log(`[Search] Item ${index} fields:`, f);
      const originalId = p.id || p.Id;
      const patient = {
        id: (originalId || "").toString(),
        nocodbId: originalId || null,
        name: f.nombreCompleto || "",
        dni: f.telefono || "",
        phone: f.telefono || "",
        age: f.Edad || null,
        email: f.correoElectronico || "",
        address: f.Dirección || "",
        status: f.Estado || "nuevo",
        registeredAt: f.CreatedAt || "",
        genero: f.genero || "",
        foto: (Array.isArray(f.fotoPacientes) && f.fotoPacientes.length > 0) ? (f.fotoPacientes[0].signedUrl || f.fotoPacientes[0].url) : "",
        whatsapp: f.Wasap || "",
        ubicacion: f.Ubicacion?.url || "",
        mensaje: f.Mensaje?.url || "",
        citas: f.citas || [],
      };
      console.log(`[Search] Item ${index} converted:`, patient);
      return patient;
    }) as Patient[];
    console.log("[Search] Converted results:", converted);
    return converted;
  }, [searchResults]);

  // Use searchResults when searching, otherwise use filtered patientsData
  const displayData = search.trim() !== "" ? searchResultsConverted : filtered;
  console.log("[Table] search:", search, "searchResultsConverted.length:", searchResultsConverted.length, "displayData.length:", displayData.length);

  const totalPages = Math.ceil(displayData.length / perPage);
  const paginated = displayData.slice((currentPage - 1) * perPage, currentPage * perPage);
  console.log("[Table] paginated.length:", paginated.length, "currentPage:", currentPage);

  const handleDelete = async (id: string) => {
    try {
      const idNum = parseInt(id, 10);
      await eliminar(idNum);
      toast.success("Paciente eliminado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar paciente");
    }
  };

  const openEditPatient = (p: Patient) => {
    setEditPatient({ ...p });
    setEditOpen(true);
  };

  const openDetailsPatient = async (p: Patient) => {
    console.log('[Details] Patient object received:', p);
    console.log('[Details] Patient ID:', p.id, 'nocodbId:', (p as any).nocodbId);
    setDetailPatient({ ...p });
    console.log('[Details] detailPatient set');
    setDetailsOpen(true);
    setLoadingCitas(true);
    setCitasPaciente([]);
    setHistorialPaciente([]);

    // Fetch patient details from citas API with pacienteAsociado filter
    try {
      console.log('[Details] Fetching citas for patient ID:', p.id, 'Type:', typeof p.id);
      const patientId = (p as any).nocodbId || p.id;
      const data = await citasPorPacienteAsociado(patientId);
      console.log('[Details] Citas fetched:', data);
      console.log('[Details] Number of records:', data.records?.length);
      setCitasPaciente(data.records || []);
      console.log('[Details] citasPaciente set to:', data.records?.length, 'records');
    } catch (err) {
      console.error('[Details] Error fetching citas:', err);
    } finally {
      setLoadingCitas(false);
    }
    console.log('[Details] After fetch, detailPatient:', detailPatient);
  };

  const handleVerHistorial = async (cita: any) => {
    setLoadingHistorial(true);
    setHistorialPaciente([]);

    try {
      const citaId = cita.id || cita.Id;
      console.error("CITA ENCONTRADA :", citaId);
      const data = await historialPorCita(citaId);
      console.log('[Historial] Records fetched:', data);
      setHistorialPaciente(data.records || []);
    } catch (err) {
      console.error('[Historial] Error fetching records:', err);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const openAddPatient = () => {
    setNewPatient({
      name: "",
      phone: "",
      email: "",
      age: 0,
      genero: "",
      address: "",
      ubicacion: "",
      status: "registrado",
    });
    setFotoPreviewAdd(null);
    setAddOpen(true);
  };

  const openAgendarCita = (patient?: Patient) => {
    const p = patient || detailPatient;
    console.log('[AgendarCita] Opening modal for patient ID:', p?.id, 'nocodbId:', (p as any)?.nocodbId);
    setCitaPatient(p || null);
    setNuevaCita({
      horaCita: "",
      fecha: new Date().toISOString().split('T')[0],
      progreso: "Confirmada",
      estadoCalendario: "nuevo",
      tokenCalendario: "",
      calificacion: 5,
      tipoPaciente: "",
      tipoProcedimientoCita: [],
      historialMedico: [],
    });
    setAgendarCitaOpen(true);
  };

  const handleSaveCita = async () => {
    console.log('[AgendarCita] detailPatient at start:', detailPatient);
    console.log('[AgendarCita] detailPatient is null:', detailPatient === null);
    if (!nuevaCita.horaCita) {
      toast.error("La hora de la cita es obligatoria");
      return;
    }
    if (!nuevaCita.fecha) {
      toast.error("La fecha de la cita es obligatoria");
      return;
    }
    if (!nuevaCita.tipoPaciente) {
      toast.error("El tipo de paciente es obligatorio");
      return;
    }

    setSavingCita(true);
    try {
      const patientNocoId = (citaPatient as any)?.nocodbId;
      console.log('[AgendarCita] citaPatient:', citaPatient);
      console.log('[AgendarCita] nocodbId:', patientNocoId, 'Type:', typeof patientNocoId);
      const citaData = {
        fields: {
          horaCita: nuevaCita.horaCita,
          fecha: nuevaCita.fecha,
          progreso: nuevaCita.progreso,
          estadoCalendario: nuevaCita.estadoCalendario,
          calificacion: nuevaCita.calificacion,
          tipoPaciente: nuevaCita.tipoPaciente,
          tipoProcedimientoCita: nuevaCita.tipoProcedimientoCita,
          historialMedico: nuevaCita.historialMedico,
          pacientes: [{ id: patientNocoId }],
        },
      };

      await crearCita(citaData as any);
      toast.success("Cita agendada correctamente");
      setAgendarCitaOpen(false);
      setDetailsOpen(false);
      setShowCitas(false);
      // Recargar tabla de pacientes
      recargar();
    } catch (err) {
      toast.error("Error al agendar cita: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setSavingCita(false);
    }
  };

  const handleSaveNewPatient = async () => {
    if (!newPatient.name) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!newPatient.phone) {
      toast.error("El teléfono es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const pacienteData = {
        fields: {
          nombreCompleto: newPatient.name,
          telefono: newPatient.phone,
          correoElectronico: newPatient.email,
          Edad: newPatient.age || 0,
          genero: newPatient.genero,
          Dirección: newPatient.address,
          EnlaceGoogle: newPatient.ubicacion || "",
          Estado: newPatient.status || "registrado",
          Wasap: newPatient.phone ? `https://wa.me/${newPatient.phone.replace(/\s+/g, '')}` : "",
          fotoPacientes: fotoPreviewAdd ? [
            {
              url: fotoPreviewAdd,
              title: "foto_paciente.jpg",
              mimetype: "image/jpeg",
              size: 0
            }
          ] : []
        }
      };

      await crear(pacienteData as any);
      toast.success("Paciente registrado correctamente");
      setAddOpen(false);
      recargar(); // Reload the list
    } catch (err) {
      toast.error("Error al registrar paciente: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const saveEditPatient = async () => {
    if (!editPatient?.name?.trim() || !editPatient.phone?.trim()) {
      toast.error("Nombre y teléfono son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const patientNocoId = (editPatient as any)?.nocodbId || parseInt(editPatient.id, 10);
      const pacienteData = {
        id: patientNocoId,
        fields: {
          nombreCompleto: editPatient.name,
          telefono: editPatient.phone,
          correoElectronico: editPatient.email,
          Edad: editPatient.age || 0,
          genero: editPatient.genero ? editPatient.genero.charAt(0).toUpperCase() + editPatient.genero.slice(1).toLowerCase() : "",
          Dirección: editPatient.address,
          EnlaceGoogle: editPatient.ubicacion || "",
          Estado: editPatient.status || "registrado",
          Wasap: editPatient.phone ? `https://wa.me/${editPatient.phone.replace(/\s+/g, '')}` : "",
        },
      };
      
      await actualizarPacienteV3(editPatient.id, pacienteData);
      toast.success("Paciente actualizado correctamente");
      setEditOpen(false);
      setEditPatient(null);
      recargar();
    } catch (err) {
      toast.error("Error al actualizar paciente: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const patientAppointments = selectedPatient ? appointments.filter((a) => a.patientId === selectedPatient.id) : [];
  const patientRecords = selectedPatient ? medicalRecords.filter((r) => r.patientId === selectedPatient.id) : [];

  // Mostrar error si existe
  if (error && pacientesNocoDB.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">Error al cargar pacientes</p>
          <p className="text-muted-foreground text-sm mt-1">{error}</p>
          <Button onClick={() => recargar()} className="mt-4">Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground text-sm mt-1">Pacientes atendidos en domicilio: datos y dirección de visita</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddPatient}><Plus className="mr-2 h-4 w-4" /> Nuevo Paciente</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl overflow-hidden rounded-xl p-0" showCloseButton={false} showScrollContainer={false} showPadding={false}>
            {/* Header con degradado sutil */}
            <div className="relative px-6 pt-5 pb-5" style={{ background: 'linear-gradient(135deg, rgba(34, 180, 173, 0.05) 0%, white 50%)' }}>
              <DialogClose asChild>
                <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </DialogClose>
              <div className="flex items-start gap-3.5 pr-8">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#e6f7f6' }}>
                  <UserPlus2 className="h-5 w-5" style={{ color: '#22b4ad' }} />
                </div>
                <div>
                  <DialogTitle className="text-[18px] font-medium text-foreground">Registrar paciente</DialogTitle>
                  <p className="text-[13px] text-gray-500 mt-1">
                    Datos básicos y domicilio donde se realizarán las visitas.
                  </p>
                </div>
              </div>
            </div>

            {/* Formulario */}
            <div className="px-6 py-5 space-y-5">
              {/* Sección Identificación */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Identificación</span>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Nombre completo</Label>
                  <Input
                    className="w-full text-sm placeholder:text-gray-400"
                    placeholder="Nombre y apellidos"
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1.5px solid #22b4ad';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Teléfono</Label>
                    <Input
                      className="w-full text-sm placeholder:text-gray-400"
                      placeholder="+34 600 000 000"
                      value={newPatient.phone}
                      onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                      style={{
                        backgroundColor: '#f5fffe',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.border = '1.5px solid #22b4ad';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Email</Label>
                    <Input
                      className="w-full text-sm placeholder:text-gray-400"
                      placeholder="paciente@email.com"
                      value={newPatient.email}
                      onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                      style={{
                        backgroundColor: '#f5fffe',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.border = '1.5px solid #22b4ad';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Edad</Label>
                    <Input
                      type="number"
                      className="w-full text-sm placeholder:text-gray-400"
                      placeholder="45"
                      value={newPatient.age || ""}
                      onChange={(e) => setNewPatient({ ...newPatient, age: parseInt(e.target.value) || 0 })}
                      style={{
                        backgroundColor: '#f5fffe',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.border = '1.5px solid #22b4ad';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Género</Label>
                    <Select
                      value={newPatient.genero || ""}
                      onValueChange={(v) => setNewPatient({ ...newPatient, genero: v })}
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
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Femenino">Femenino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Divisor con icono de casa */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: '#e6f7f6' }}>
                  <Home className="h-3.5 w-3.5" style={{ color: '#22b4ad' }} />
                </div>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
              </div>

              {/* Sección Domicilio */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Domicilio</span>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Dirección para visitas</Label>
                  <Input
                    className="w-full text-sm placeholder:text-gray-400"
                    placeholder="Calle, número, CP, ciudad"
                    value={newPatient.address}
                    onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1.5px solid #22b4ad';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Grid: Google Maps + Foto lado a lado */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Enlace Google Maps (Ubicación)</Label>
                    <Input
                      className="w-full text-sm placeholder:text-gray-400"
                      placeholder="https://maps.google.com/?q=..."
                      value={newPatient.ubicacion || ""}
                      onChange={(e) => setNewPatient({ ...newPatient, ubicacion: e.target.value })}
                      style={{
                        backgroundColor: '#f5fffe',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.border = '1.5px solid #22b4ad';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Foto lado a lado */}
                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Foto del paciente</Label>
                    {fotoPreviewAdd ? (
                      <div className="relative w-full">
                        <img
                          src={fotoPreviewAdd}
                          alt="Foto del paciente"
                          className="w-full h-20 object-cover rounded-lg border border-[#22b4ad]/20"
                        />
                        <button
                          type="button"
                          onClick={() => setFotoPreviewAdd(null)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-sm"
                        >
                          <X className="h-3 w-3 text-gray-600" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="relative w-full h-9 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-[#e6f7f6] transition-colors"
                        style={{
                          backgroundColor: '#f5fffe',
                          border: '1.5px dashed #22b4ad',
                        }}
                        onClick={() => document.getElementById('foto-upload')?.click()}
                      >
                        <input
                          id="foto-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadingFotoAdd(true);
                              // Crear preview de la imagen
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setFotoPreviewAdd(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                              // Simular carga de foto (reemplazar con lógica real de upload)
                              setTimeout(() => {
                                console.log('Archivo subido:', file.name);
                                setUploadingFotoAdd(false);
                                toast.success("Foto subida correctamente");
                              }, 1500);
                            }
                          }}
                        />
                        {uploadingFotoAdd ? (
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 text-[#22b4ad] animate-spin" />
                            <span className="text-[11px] text-gray-500">Cargando...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5 text-[#22b4ad]" />
                            <span className="text-[11px] text-gray-500">Subir foto</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ backgroundColor: '#f9fafb', borderColor: 'rgba(0,0,0,0.06)' }}>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="text-sm h-9">
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="text-sm h-9 text-white gap-1.5"
                style={{ backgroundColor: '#22b4ad' }}
                onClick={handleSaveNewPatient}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Guardar paciente
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m, i) => (
          <Card key={m.label} className="card-shadow hover:card-shadow-hover transition-shadow">
            <CardContent className="p-5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.bg}`}>
                  <m.icon className={`h-5 w-5 ${m.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tabular-nums">
                    {i === 0 ? animatedTotalPatients : i === 1 ? animatedRegistrados : animatedNewToday}
                  </p>
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

      {/* Filters */}
      <Card className="card-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                {searchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#22b4ad]" />}
              </div>
              <Input placeholder={`Buscar por ${searchField === 'nombreCompleto' ? 'nombre' : searchField}...`} className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
            </div>
            <Select value={searchField} onValueChange={setSearchField}>
              <SelectTrigger className="w-40"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Campo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nombreCompleto">Nombre</SelectItem>
                <SelectItem value="telefono">Teléfono</SelectItem>
                <SelectItem value="Dirección">Dirección</SelectItem>
                <SelectItem value="Edad">Edad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="card-shadow overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        <div className="relative w-full min-w-0 overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch', padding: '15px 25px' }}>
          <Table className="w-full table-fixed min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead className="w-[15%]">Nombre</TableHead>
                <TableHead className="w-12 pl-2 pr-2">Foto</TableHead>
                <TableHead className="w-[12%]">Teléfono</TableHead>
                <TableHead className="w-[20%]">Dirección</TableHead>
                <TableHead className="w-[10%]">Ubicación</TableHead>
                <TableHead className="w-[10%]">Mensaje</TableHead>
                <TableHead className="w-[15%]">Citas</TableHead>
                <TableHead className="w-[8%]">Edad</TableHead>
                <TableHead className="w-[10%]">Género</TableHead>
                <TableHead className="w-[18%]">Email</TableHead>
                <TableHead className="w-[80px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {loading && pacientesNocoDB.length === 0 ? (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={`sk-${i}`} className="h-[20px]">
                    <TableCell className=""><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className=""><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className=""><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                    <TableCell className=""><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className=""><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className=""><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell className=""><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell className=""><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className=""><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className=""><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className=""><Skeleton className="h-6 w-8" /></TableCell>
                  </TableRow>
                ))}
              </>
            ) : searchLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#22b4ad] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#22b4ad] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#22b4ad] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <p className="text-sm text-muted-foreground animate-pulse font-medium">Buscando pacientes...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 && search.trim() !== "" ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm text-muted-foreground">No se encontraron datos</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((p) => (
              <TableRow key={p.id} className="hover:bg-muted/30 h-[20px]">
                <TableCell className="text-sm text-muted-foreground">{(p as any).nocodbId || p.id}</TableCell>
                <TableCell className="font-medium truncate">{p.name}</TableCell>
                <TableCell className="pl-2 pr-2">
                  {p.foto ? (
                    <img
                      src={p.foto}
                      alt={p.name}
                      className="h-10 w-10 rounded-full object-cover border-2 border-[#22b4ad]/20"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-[#e6f7f6] flex items-center justify-center border border-[#22b4ad]/20 mx-auto">
                      <span className="text-sm font-medium text-[#22b4ad]">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground truncate">{p.phone || "—"}</TableCell>
                <TableCell className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{p.address || "—"}</span>
                    {p.address && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(p.address);
                          toast.success("Dirección copiada");
                        }}
                        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                        title="Copiar dirección"
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="">
                  {(p as any).ubicacion ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 border-primary/20 hover:bg-primary/10 hover:border-primary/40"
                      asChild
                    >
                      <a href={(p as any).ubicacion} target="_blank" rel="noopener noreferrer">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        Mapa
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="">
                  {(p as any).mensaje ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 border-success/20 hover:bg-success/10 hover:border-success/40 text-success"
                      asChild
                    >
                      <a href={(p as any).mensaje} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell
                  className="cursor-pointer hover:bg-muted/50 rounded transition-colors"
                  onClick={() => { setSelectedPatient(p); setShowCitas(true); }}
                  title="Ver todas las citas"
                >
                  {p.citas && p.citas.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-primary">
                        Ver {p.citas.length} {p.citas.length === 1 ? "cita" : "citas"} →
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="">{p.age || "—"}</TableCell>
                <TableCell className="">
                  {(p as any).genero ? (
                    <Badge
                      className={
                        (p as any).genero.toLowerCase() === "maculino" || (p as any).genero.toLowerCase() === "masculino"
                          ? "bg-primary/10 text-primary hover:bg-primary/20 border-0"
                          : (p as any).genero.toLowerCase() === "femenino"
                            ? "bg-pink-100 text-pink-600 hover:bg-pink-200 border-0 dark:bg-pink-900/20 dark:text-pink-400"
                            : "bg-muted text-muted-foreground border-0"
                      }
                    >
                      {(p as any).genero}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground truncate">{p.email || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Más opciones"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetailsPatient(p)}>
                          Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditPatient(p)}>
                          Editar
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
                              <AlertDialogTitle>¿Eliminar paciente?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará del sistema a <span className="font-medium text-foreground">{p.name}</span> y dejará de aparecer en visitas e historial.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => eliminar(Number(p.id))}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">{filtered.length} de {totalCount} pacientes</p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <Button key={i} variant={currentPage === i + 1 ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(i + 1)}>{i + 1}</Button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditPatient(null);
        }}
      >
        <DialogContent className="sm:max-w-xl overflow-hidden rounded-xl" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {editPatient && (
            <>
              {/* Header con degradado sutil */}
              <div className="relative px-6 pt-5 pb-5" style={{ background: 'linear-gradient(135deg, rgba(34, 180, 173, 0.05) 0%, white 50%)' }}>
                <DialogClose asChild>
                  <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </DialogClose>
                <div className="flex items-start gap-3.5 pr-8">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#e6f7f6' }}>
                    <Edit className="h-5 w-5" style={{ color: '#22b4ad' }} />
                  </div>
                  <div>
                    <p className="text-[18px] font-medium text-foreground">Editar paciente</p>
                    <p className="text-[13px] text-gray-500 mt-1">Actualiza datos de contacto y domicilio para visitas a domicilio.</p>
                  </div>
                </div>
              </div>

              {/* Formulario */}
              <div className="px-6 py-5 space-y-5">
                {/* Sección Identificación */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Identificación</span>
                    <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Nombre completo</Label>
                    <Input
                      className="w-full text-sm placeholder:text-gray-400"
                      placeholder="Nombre y apellidos"
                      style={{
                        backgroundColor: '#f5fffe',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: 'none'
                      }}
                      value={editPatient.name}
                      onChange={(e) => setEditPatient((x) => (x ? { ...x, name: e.target.value } : x))}
                      onFocus={(e) => {
                        e.currentTarget.style.border = '1.5px solid #22b4ad';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Teléfono</Label>
                      <Input
                        className="w-full text-sm placeholder:text-gray-400"
                        placeholder="+34 600 000 000"
                        style={{
                          backgroundColor: '#f5fffe',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}
                        value={editPatient.phone}
                        onChange={(e) => setEditPatient((x) => (x ? { ...x, phone: e.target.value } : x))}
                        onFocus={(e) => {
                          e.currentTarget.style.border = '1.5px solid #22b4ad';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Email</Label>
                      <Input
                        className="w-full text-sm placeholder:text-gray-400"
                        placeholder="paciente@email.com"
                        style={{
                          backgroundColor: '#f5fffe',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}
                        value={editPatient.email ?? ""}
                        onChange={(e) => setEditPatient((x) => (x ? { ...x, email: e.target.value } : x))}
                        onFocus={(e) => {
                          e.currentTarget.style.border = '1.5px solid #22b4ad';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Edad</Label>
                      <Input
                        type="number"
                        className="w-full text-sm placeholder:text-gray-400"
                        placeholder="45"
                        style={{
                          backgroundColor: '#f5fffe',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}
                        value={editPatient.age}
                        onChange={(e) => setEditPatient((x) => (x ? { ...x, age: Number.parseInt(e.target.value, 10) || 0 } : x))}
                        onFocus={(e) => {
                          e.currentTarget.style.border = '1.5px solid #22b4ad';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Género</Label>
                      <Select
                        value={(editPatient as any).genero || ""}
                        onValueChange={(v) => setEditPatient((x) => (x ? { ...(x as any), genero: v } : x))}
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
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="femenino">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Divisor */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: '#e6f7f6' }}>
                    <Home className="h-3.5 w-3.5" style={{ color: '#22b4ad' }} />
                  </div>
                  <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.12)' }}></div>
                </div>

                {/* Sección Domicilio */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Domicilio</span>
                    <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] text-gray-500 font-medium">Dirección para visitas</Label>
                    <Input
                      className="w-full text-sm placeholder:text-gray-400"
                      placeholder="Calle, número, CP, ciudad"
                      style={{
                        backgroundColor: '#f5fffe',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: 'none'
                      }}
                      value={editPatient.address ?? ""}
                      onChange={(e) => setEditPatient((x) => (x ? { ...x, address: e.target.value } : x))}
                      onFocus={(e) => {
                        e.currentTarget.style.border = '1.5px solid #22b4ad';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Grid: Google Maps + Foto lado a lado */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Enlace Google Maps (Ubicación)</Label>
                      <Input
                        className="w-full text-sm placeholder:text-gray-400"
                        placeholder="https://maps.google.com/?q=..."
                        style={{
                          backgroundColor: '#f5fffe',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}
                        value={(editPatient as any).ubicacion ?? ""}
                        onChange={(e) => setEditPatient((x) => (x ? { ...(x as any), ubicacion: e.target.value } : x))}
                        onFocus={(e) => {
                          e.currentTarget.style.border = '1.5px solid #22b4ad';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    {/* Foto lado a lado */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-gray-500 font-medium">Foto del paciente</Label>
                      {fotoPreviewEdit ? (
                        <div className="relative w-full">
                          <img
                            src={fotoPreviewEdit}
                            alt="Foto del paciente"
                            className="w-full h-20 object-cover rounded-lg border border-[#22b4ad]/20"
                          />
                          <button
                            type="button"
                            onClick={() => setFotoPreviewEdit(null)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-sm"
                          >
                            <X className="h-3 w-3 text-gray-600" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="relative w-full h-9 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-[#e6f7f6] transition-colors"
                          style={{
                            backgroundColor: '#f5fffe',
                            border: '1.5px dashed #22b4ad',
                          }}
                          onClick={() => document.getElementById('foto-upload-edit')?.click()}
                        >
                          <input
                            id="foto-upload-edit"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setUploadingFotoEdit(true);
                                // Crear preview de la imagen
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setFotoPreviewEdit(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                                // Simular carga de foto (reemplazar con lógica real de upload)
                                setTimeout(() => {
                                  console.log('Archivo subido:', file.name);
                                  setUploadingFotoEdit(false);
                                  toast.success("Foto subida correctamente");
                                }, 1500);
                              }
                            }}
                          />
                          {uploadingFotoEdit ? (
                            <div className="flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 text-[#22b4ad] animate-spin" />
                              <span className="text-[11px] text-gray-500">Cargando...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Plus className="h-3.5 w-3.5 text-[#22b4ad]" />
                              <span className="text-[11px] text-gray-500">Subir foto</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ backgroundColor: '#f9fafb', borderColor: 'rgba(0,0,0,0.06)' }}>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="text-sm h-9">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  className="text-sm h-9 text-white gap-1.5"
                  style={{ backgroundColor: '#22b4ad' }}
                  onClick={saveEditPatient}
                >
                  <Check className="h-4 w-4" />
                  Guardar cambios
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Citas Dialog */}
      <Dialog open={showCitas} onOpenChange={setShowCitas}>
        <DialogContent className="sm:max-w-[580px] overflow-hidden rounded-xl" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {selectedPatient && (
            <>
              {/* Header */}
              <div className="bg-[#22b4ad] px-6 py-5 relative">
                <DialogClose asChild>
                  <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/20 border-0 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </DialogClose>
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/25">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[18px] font-medium text-white truncate">{selectedPatient.name}</p>
                    <p className="text-[13px] text-white/80">
                      {selectedPatient.citas?.length || 0} citas finalizadas
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5 max-h-[calc(100vh-180px)] overflow-y-auto">
                <div className="flex flex-col gap-2">
                  {selectedPatient.citas && selectedPatient.citas.length > 0 ? (
                    selectedPatient.citas.map((cita: any, idx: number) => {
                      const fechaCita = cita.fields?.fechaCitas || cita.fechaCitas || "";
                      const match = fechaCita.match(/(\d{2}\/\d{2}\/\d{4}) - Cita (\d{2}:\d{2}:\d{2})/);
                      const fecha = match ? match[1] : "Fecha no disponible";
                      const hora = match ? match[2] : "";
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 rounded-xl border border-[0.5px] border-border/60 bg-white border-l-[3px] border-l-[#22b4ad]"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e6f7f6]">
                            <Calendar className="h-4 w-4 text-[#22b4ad]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-foreground">
                              {fecha} · {hora}
                            </p>
                            <p className="text-[12px] text-muted-foreground">Cita programada</p>
                          </div>
                          <span className="text-[11px] px-2.5 rounded-full whitespace-nowrap bg-[#e6f7f6] text-[#0f7e78]">
                            Cita #{idx + 1}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No hay citas finalizadas
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex justify-end gap-2.5 border-t border-[0.5px] border-border/60">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="text-sm border-[0.5px]">
                    Cerrar
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  className="text-sm bg-[#22b4ad] hover:bg-[#1a9993] text-white"
                  onClick={() => openAgendarCita(selectedPatient)}
                >
                  + Agendar nueva cita
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Agendar Cita Dialog */}
      <Dialog open={agendarCitaOpen} onOpenChange={setAgendarCitaOpen}>
        <DialogContent className="sm:max-w-xl overflow-hidden rounded-xl p-0" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {/* Header con degradado sutil */}
          <div className="relative px-6 pt-5 pb-5" style={{ background: 'linear-gradient(135deg, rgba(34, 180, 173, 0.05) 0%, white 50%)' }}>
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
                <DialogTitle className="text-[18px] font-medium text-foreground">Agendar cita</DialogTitle>
                <p className="text-[13px] text-gray-500 mt-1">
                  Programar nueva visita para el paciente.
                </p>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="px-6 py-5 space-y-6">
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
                    value={nuevaCita.fecha}
                    onChange={(e) => setNuevaCita({ ...nuevaCita, fecha: e.target.value })}
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1.5px solid #22b4ad';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Hora</Label>
                  <Input
                    type="time"
                    className="w-full text-sm"
                    value={nuevaCita.horaCita}
                    onChange={(e) => setNuevaCita({ ...nuevaCita, horaCita: e.target.value })}
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1.5px solid #22b4ad';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 180, 173, 0.09)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = 'none';
                      e.currentTarget.style.boxShadow = 'none';
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
                    value={nuevaCita.tipoPaciente || ""}
                    onValueChange={(v) => setNuevaCita({ ...nuevaCita, tipoPaciente: v })}
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
                        onClick={() => setNuevaCita({ ...nuevaCita, calificacion: star })}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(null)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-5 w-5 ${(hoveredRating || nuevaCita.calificacion) >= star
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
                    value={nuevaCita.progreso}
                    onValueChange={(v) => setNuevaCita({ ...nuevaCita, progreso: v })}
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
                    value={nuevaCita.estadoCalendario}
                    onValueChange={(v) => setNuevaCita({ ...nuevaCita, estadoCalendario: v })}
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
                      <SelectItem value="nuevo">Nuevo</SelectItem>
                      <SelectItem value="registrado">Registrado</SelectItem>
                      <SelectItem value="actualizar">Actualizar</SelectItem>
                      <SelectItem value="eliminar">Eliminar</SelectItem>
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
                        const selected = nuevaCita.tipoProcedimientoCita.includes(proc);
                        setNuevaCita({
                          ...nuevaCita,
                          tipoProcedimientoCita: selected
                            ? nuevaCita.tipoProcedimientoCita.filter(p => p !== proc)
                            : [...nuevaCita.tipoProcedimientoCita, proc]
                        });
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full transition-colors ${nuevaCita.tipoProcedimientoCita.includes(proc)
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
          <div className="px-6 py-4 flex justify-end gap-2.5 border-t border-[0.5px] border-border/60">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="text-sm border-[0.5px]">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="text-sm bg-[#22b4ad] hover:bg-[#1a9993] text-white"
              onClick={handleSaveCita}
              disabled={savingCita}
            >
              {savingCita ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Agendar cita
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Historial médico section in details dialog */}

      {/* Image Viewer Dialog */}
      <Dialog open={!!imagenSeleccionada} onOpenChange={() => setImagenSeleccionada(null)}>
        <DialogContent className="sm:max-w-[800px] overflow-hidden rounded-xl" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {imagenSeleccionada && (
            <>
              {/* Header */}
              <div className="bg-[#22b4ad] relative">
                <DialogClose asChild>
                  <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/20 border-0 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </DialogClose>
                <div className="flex items-center gap-3.5 px-6 py-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/25">
                    <ImageIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[18px] font-medium text-white truncate">Imagen podológica</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex items-center justify-center bg-black">
                <img
                  src={imagenSeleccionada}
                  alt="Imagen podológica ampliada"
                  className="max-w-full max-h-[600px] object-contain rounded-lg"
                />
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex justify-end border-t border-border/60 bg-white">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="text-sm">
                    Cerrar
                  </Button>
                </DialogClose>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Patient Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[720px] overflow-hidden" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {detailPatient && (
            <>
              {/* Header */}
              <div className="bg-[#22b4ad] relative">
                <DialogClose asChild>
                  <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/20 border-0 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </DialogClose>
                <div className="flex items-center gap-3.5 px-6 py-5">
                  <div className="w-12 h-12 rounded-full bg-white/25 flex items-center justify-center text-lg font-medium text-white shrink-0">
                    {detailPatient.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-medium text-white truncate">{detailPatient.name}</p>
                    <p className="text-[13px] text-white/80">Ficha de paciente · Podología domicilio</p>
                  </div>
                  <span className="bg-white/20 text-white text-xs px-2.5 rounded-full border border-white/35 mr-8">
                    {detailPatient.status}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Datos del paciente */}
                <div className="px-6 pt-5">
                  <p className="text-[11px] font-medium text-[#22b4ad] tracking-wide uppercase mb-3">Datos del paciente</p>

                  {/* Foto y datos principales */}
                  <div className="flex items-start gap-4 mb-4">
                    {(detailPatient as any).foto ? (
                      <img
                        src={(detailPatient as any).foto}
                        alt="Foto del paciente"
                        className="w-16 h-16 rounded-full object-cover border-2 border-[#22b4ad]/20"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-[#e6f7f6] flex items-center justify-center text-xl font-medium text-[#22b4ad]">
                        {detailPatient.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-medium text-foreground truncate">{detailPatient.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#e6f7f6] text-[#0f7e78]">
                          {(detailPatient as any).genero || "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {detailPatient.age ? `${detailPatient.age} años` : "Edad no registrada"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-muted/30 rounded-lg p-4 border border-border/60">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Teléfono</p>
                      <p className="text-sm font-medium text-foreground">{detailPatient.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Email</p>
                      <p className="text-sm font-medium text-foreground">{detailPatient.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Estado</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#e6f7f6] text-[#0f7e78]">
                        {detailPatient.status}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] text-muted-foreground mb-0.5">Dirección</p>
                      <p className="text-sm font-medium text-foreground">{detailPatient.address || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Registro</p>
                      <p className="text-xs text-muted-foreground">{detailPatient.registeredAt || "—"}</p>
                    </div>
                  </div>

                  {/* Ubicación */}
                  {(detailPatient as any).ubicacion && (
                    <div className="mt-3 p-3 bg-[#f5fffe] rounded-lg border border-[#22b4ad]/20">
                      <p className="text-[11px] text-muted-foreground mb-1">Ubicación Google Maps</p>
                      <a
                        href={(detailPatient as any).ubicacion}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-[#22b4ad] hover:underline flex items-center gap-1"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Ver en mapa →
                      </a>
                    </div>
                  )}

                  {/* Botón WhatsApp */}
                  {detailPatient.phone && (
                    <div className="mt-3">
                      <a
                        href={`https://wa.me/${detailPatient.phone.replace(/\s+/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.955L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
                        </svg>
                        Contactar
                      </a>
                    </div>
                  )}
                </div>

                {/* Visitas agendadas */}
                <div className="px-6 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-medium text-[#22b4ad] tracking-wide uppercase">Visitas agendadas</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-3 rounded-full border-[#22b4ad] text-[#22b4ad] hover:bg-[#22b4ad]/10"
                      onClick={() => openAgendarCita(detailPatient)}
                    >
                      + nueva visita
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {loadingCitas && (
                      <div className="text-center py-8 flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 text-[#22b4ad] animate-spin" />
                        <span className="text-sm text-muted-foreground">Cargando visitas...</span>
                      </div>
                    )}
                    {citasPaciente.map((cita: any, idx: number) => {
                      const fields = cita.fields || cita;
                      const fecha = fields.fecha || "";
                      const hora = fields.horaCita || "";
                      const progreso = fields.progreso || "pendiente";
                      const procedimientos = fields.tipoProcedimientoCita || [];
                      const tipoPaciente = fields.tipoPaciente || "";
                      const calificacion = fields.calificacion || 0;
                      const estadoCalendario = fields.estadoCalendario || "";
                      const historial = fields.historialMedico || [];
                      return (
                        <div
                          key={cita.id || idx}
                          className="border border-border/60 rounded-md p-3 flex items-center justify-between border-l-[3px] border-l-[#22b4ad]"
                        >
                          <div className="flex-1">
                            <p className="text-[13px] font-medium text-foreground mb-0.5">
                              {fecha} · {hora}
                            </p>
                            <p className="text-[11px] text-muted-foreground mb-0.5">Tipo: {tipoPaciente}</p>
                            <div className="flex flex-wrap gap-1 mb-0.5">
                              {procedimientos.map((proc: string, pIdx: number) => (
                                <span key={pIdx} className="text-[10px] px-2 py-0.5 rounded-full bg-[#22b4ad]/10 text-[#0f7e78]">{proc}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className={`h-3 w-3 ${calificacion >= star ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />
                              ))}
                            </div>
                            <p className="text-xs text-[#22b4ad] mt-1">
                              {detailPatient.address || ""}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`text-[11px] px-2.5 rounded-full whitespace-nowrap ${progreso === "Confirmada" ? "bg-green-100 text-green-700" :
                                progreso === "Cancelada" ? "bg-red-100 text-red-700" :
                                  "bg-[#e6f7f6] text-[#0f7e78]"
                              }`}>
                              {progreso}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {estadoCalendario}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs px-2 border-[#22b4ad] text-[#22b4ad] hover:bg-[#22b4ad]/10"
                              onClick={() => handleVerHistorial(cita)}
                            >
                              Ver historial ({historial.length})
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {!loadingCitas && citasPaciente.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No hay visitas
                      </div>
                    )}
                  </div>
                </div>

                {/* Historial médico */}
                <div className="px-6 pt-5">
                  <p className="text-[11px] font-medium text-[#22b4ad] tracking-wide uppercase mb-3">Historial médico</p>
                  {loadingHistorial ? (
                    <div className="text-center py-4 flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 text-[#22b4ad] animate-spin" />
                      <span className="text-sm text-muted-foreground">Cargando historial...</span>
                    </div>
                  ) : historialPaciente && historialPaciente.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {historialPaciente.map((historial: any, idx: number) => {
                        const fields = historial.fields || historial;
                        return (
                          <div key={idx} className="p-4 bg-muted/30 rounded-lg border border-border/60">
                            <div className="grid grid-cols-3 gap-3">
                              {/* Columna 1: Problemas y Receta */}
                              <div className="space-y-3">
                                <div className="p-3 bg-white rounded-lg border border-border/60">
                                  <p className="text-[10px] font-semibold text-[#22b4ad] uppercase tracking-wide mb-1">Problemas:</p>
                                  <p className="text-sm text-foreground">{fields.problemas || "No especificado"}</p>
                                </div>
                                <div className="p-3 bg-[#f5fffe] rounded-lg border border-[#22b4ad]/20">
                                  <p className="text-[10px] font-semibold text-[#22b4ad] uppercase tracking-wide mb-1">Receta:</p>
                                  <p className="text-sm text-foreground">{fields.recetaPaciente || "No especificado"}</p>
                                </div>
                              </div>

                              {/* Columna 2: Antecedentes, Anamnesis, Observación */}
                              <div className="space-y-3">
                                <div className="p-3 bg-white rounded-lg border border-border/60">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Antecedentes patológicos:</p>
                                  <p className="text-sm text-foreground">{fields.antecedentesPatalogico || "No especificado"}</p>
                                </div>
                                <div className="p-3 bg-white rounded-lg border border-border/60">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Anamnesis:</p>
                                  <p className="text-sm text-foreground">{fields.Anamnesis || "No especificado"}</p>
                                </div>
                                {fields.observacionMes && (
                                  <div className="p-3 bg-white rounded-lg border border-border/60">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Observación del mes:</p>
                                    <p className="text-sm text-foreground">{fields.observacionMes}</p>
                                  </div>
                                )}
                              </div>

                              {/* Columna 3: Imagen podológica */}
                              <div>
                                {fields.imagenPodologica && Array.isArray(fields.imagenPodologica) && fields.imagenPodologica.length > 0 && (
                                  <div className="h-full p-3 bg-white rounded-lg border border-border/60">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Imagen podológica:</p>
                                    <img
                                      src={fields.imagenPodologica[0].signedUrl || fields.imagenPodologica[0].url}
                                      alt="Imagen podológica"
                                      className="w-full h-48 object-cover rounded-lg border border-border/60 cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => setImagenSeleccionada(fields.imagenPodologica[0].signedUrl || fields.imagenPodologica[0].url)}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Tipo de procedimiento - ancho completo */}
                            {(fields.tipoProcedimiento || []).length > 0 && (
                              <div className="mt-3">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tipo de procedimiento:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {(fields.tipoProcedimiento || []).map((proc: string, pIdx: number) => (
                                    <span key={pIdx} className="text-xs px-2.5 rounded-full bg-[#22b4ad] text-white font-medium">
                                      {proc}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm border border-border/60 rounded-md">
                      No hay registros médicos disponibles
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex justify-end border-t border-border/60 mt-5">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="text-sm">
                    Cerrar
                  </Button>
                </DialogClose>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
