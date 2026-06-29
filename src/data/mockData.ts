export interface Patient {
  id: string;
  name: string;
  dni: string;
  phone: string;
  age: number | null;
  registeredAt: string;
  status: "registrado" | "nuevo" | "activo" | "inactivo" | string;
  email?: string;
  address?: string;
  genero?: string;
  foto?: string;
  whatsapp?: string;
  ubicacion?: string;
  mensaje?: string;
  citas?: any[];
}

export interface Appointment {
  id: string;
  patientId?: string;
  patientName?: string;
  date?: string;
  time?: string;
  status?: "pendiente" | "atendido" | "cancelado";
  
  visitAddress?: string;
  
  accessNotes?: string;
  notes?: string;
  
  fechaCitas?: string;
  horaCita?: string;
  fecha?: string;
  progreso?: string;
  calificacion?: number;
  tipoPaciente?: string;
  tipoProcedimientoCita?: string[];
  historialMedico?: any[];
  pacientes?: {
    id: number;
    id_fields: { Id: number };
    fields: { nombreCompleto: string };
  };
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  diagnosis: string;
  treatment: string;
  observations: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "appointment" | "reminder" | "alert";
  read: boolean;
}


export const clinicToday = new Date().toISOString().split('T')[0];

export interface PodiatryService {
  id: string;
  name: string;
  category: "consulta" | "quirurgico" | "ortesis";
  durationMin: number;
  pricePen: number;
  description: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  units: number;
  minUnits: number;
  unit: string;
}

export interface WaitingTicket {
  id: string;
  patientName: string;
  appointmentTime: string;
  reason: string;
  visitAddress: string;
  
  phone: string;
  
  whatsapp?: string;
  status: "programado" | "en_ruta" | "en_domicilio" | "finalizado";
  priority: "normal" | "alta";
  
  googleMapsUrl?: string;
}

export interface Invoice {
  rowId?: number; 
  patientId?: number; 
  id: string;
  patientName: string;
  date: string;
  concept: string;
  amountPen: number;
  status: "Pagado" | "Pendiente" | "Parcial";
}

export interface DocumentTemplate {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
}

export const patients: Patient[] = [
  { id: "1", name: "María García López", dni: "12345678A", phone: "+34 612 345 678", age: 45, registeredAt: "2026-01-15", status: "activo", email: "maria@email.com", address: "Calle Mayor 12, Madrid" },
  { id: "2", name: "Carlos Rodríguez Pérez", dni: "87654321B", phone: "+34 623 456 789", age: 62, registeredAt: "2026-02-03", status: "activo", email: "carlos@email.com", address: "Av. de la Constitución 5, Getafe" },
  { id: "3", name: "Ana Martínez Ruiz", dni: "11223344C", phone: "+34 634 567 890", age: 38, registeredAt: "2026-03-10", status: "activo", address: "Calle Real 8, 3º B, Pozuelo de Alarcón", email: "ana@email.com" },
  { id: "4", name: "Pedro Sánchez Gómez", dni: "44332211D", phone: "+34 645 678 901", age: 55, registeredAt: "2026-03-22", status: "inactivo", address: "Calle del Prado 21, Boadilla del Monte" },
  { id: "5", name: "Laura Fernández Díaz", dni: "55667788E", phone: "+34 656 789 012", age: 29, registeredAt: "2026-04-01", status: "activo", address: "Calle Orense 34, 6º D, Madrid", email: "laura@email.com" },
  { id: "6", name: "José López Moreno", dni: "99887766F", phone: "+34 667 890 123", age: 71, registeredAt: "2026-04-05", status: "activo", address: "Urbanización Los Pinos 14, Majadahonda" },
  { id: "7", name: "Isabel Torres Navarro", dni: "22334455G", phone: "+34 678 901 234", age: 50, registeredAt: "2026-04-10", status: "activo", address: "Plaza de España 2, 2º, Las Rozas" },
  { id: "8", name: "Miguel Ángel Ruiz", dni: "66778899H", phone: "+34 689 012 345", age: 33, registeredAt: "2026-04-12", status: "inactivo", address: "Calle Toledo 101, Valdemoro" },
];

export const appointments: Appointment[] = [
  {
    id: "1",
    patientId: "1",
    patientName: "María García López",
    date: clinicToday,
    time: "09:00",
    status: "pendiente",
    visitAddress: "Calle Mayor 12, Madrid",
    accessNotes: "Portero automático 12B · ascensor",
    notes: "Revisión periódica a domicilio",
  },
  {
    id: "2",
    patientId: "2",
    patientName: "Carlos Rodríguez Pérez",
    date: clinicToday,
    time: "10:30",
    status: "pendiente",
    visitAddress: "Av. de la Constitución 5, Getafe",
    accessNotes: "Portal B, 4º izq.",
    notes: "Control de uña encarnada",
  },
  {
    id: "3",
    patientId: "3",
    patientName: "Ana Martínez Ruiz",
    date: clinicToday,
    time: "12:00",
    status: "atendido",
    visitAddress: "Calle Real 8, 3º B, Pozuelo de Alarcón",
    notes: "Tratamiento de callosidades",
  },
  {
    id: "4",
    patientId: "5",
    patientName: "Laura Fernández Díaz",
    date: "2026-04-18",
    time: "09:30",
    status: "pendiente",
    visitAddress: "Calle Orense 34, 6º D, Madrid",
    notes: "Primera consulta podológica",
  },
  {
    id: "5",
    patientId: "6",
    patientName: "José López Moreno",
    date: "2026-04-18",
    time: "11:00",
    status: "pendiente",
    visitAddress: "Urbanización Los Pinos 14, Majadahonda",
    accessNotes: "Parking visitas en calle lateral",
    notes: "Estudio baropodométrico (equipo portátil)",
  },
  {
    id: "6",
    patientId: "7",
    patientName: "Isabel Torres Navarro",
    date: "2026-04-15",
    time: "10:00",
    status: "atendido",
    visitAddress: "Plaza de España 2, 2º, Las Rozas",
    notes: "Seguimiento fascitis plantar",
  },
  {
    id: "7",
    patientId: "1",
    patientName: "María García López",
    date: "2026-04-14",
    time: "16:00",
    status: "cancelado",
    visitAddress: "Calle Mayor 12, Madrid",
    notes: "Cancelado por la paciente",
  },
  {
    id: "8",
    patientId: "4",
    patientName: "Pedro Sánchez Gómez",
    date: "2026-04-19",
    time: "09:00",
    status: "pendiente",
    visitAddress: "Calle del Prado 21, Boadilla del Monte",
    notes: "Revisión post-tratamiento",
  },
];

export const medicalRecords: MedicalRecord[] = [
  { id: "1", patientId: "1", patientName: "María García López", date: "2026-03-20", diagnosis: "Fascitis plantar bilateral", treatment: "Plantillas ortopédicas + ejercicios de estiramiento", observations: "Paciente con sobrepeso. Recomendar actividad física moderada." },
  { id: "2", patientId: "2", patientName: "Carlos Rodríguez Pérez", date: "2026-03-15", diagnosis: "Onicocriptosis (uña encarnada) pie derecho", treatment: "Espiculectomía parcial", observations: "Procedimiento exitoso. Cita de control en 2 semanas." },
  { id: "3", patientId: "3", patientName: "Ana Martínez Ruiz", date: clinicToday, diagnosis: "Hiperqueratosis plantar", treatment: "Quiropodia + aplicación de crema queratolítica", observations: "Callosidades en zona metatarsal. Se recomienda calzado adecuado." },
  { id: "4", patientId: "6", patientName: "José López Moreno", date: "2026-04-10", diagnosis: "Pie diabético - grado 0", treatment: "Cuidados preventivos + exploración vascular", observations: "Paciente diabético tipo 2. Control trimestral obligatorio." },
  { id: "5", patientId: "7", patientName: "Isabel Torres Navarro", date: "2026-04-15", diagnosis: "Fascitis plantar izquierda", treatment: "Ondas de choque + vendaje funcional", observations: "Mejoría notable respecto a consulta anterior." },
  { id: "6", patientId: "1", patientName: "María García López", date: "2026-01-10", diagnosis: "Metatarsalgia bilateral", treatment: "Almohadillas metatarsales + antiinflamatorios", observations: "Dolor en la zona metatarsal por uso de calzado inadecuado. Primera consulta." },
  { id: "7", patientId: "1", patientName: "María García López", date: "2026-02-14", diagnosis: "Fascitis plantar bilateral - seguimiento", treatment: "Terapia de ondas de choque + estiramientos dirigidos", observations: "Mejoría parcial desde la última consulta. Se ajusta tratamiento." },
  { id: "8", patientId: "2", patientName: "Carlos Rodríguez Pérez", date: "2026-04-01", diagnosis: "Onicocriptosis - control post-quirúrgico", treatment: "Cura local + antibiótico tópico", observations: "Evolución favorable. Sin signos de infección. Alta provisional." },
  { id: "9", patientId: "6", patientName: "José López Moreno", date: "2026-01-20", diagnosis: "Pie diabético - evaluación inicial", treatment: "Exploración neurológica + vascular completa", observations: "Sensibilidad disminuida en ambos pies. Derivar a endocrino para ajuste de medicación." },
  { id: "10", patientId: "6", patientName: "José López Moreno", date: "2026-02-25", diagnosis: "Onicomicosis pie izquierdo", treatment: "Antimicótico tópico + fresado de la uña", observations: "Infección fúngica moderada. Control en 4 semanas." },
  { id: "11", patientId: "7", patientName: "Isabel Torres Navarro", date: "2026-03-01", diagnosis: "Fascitis plantar izquierda - inicio", treatment: "Reposo relativo + taloneras de silicona + AINE", observations: "Dolor intenso al primer paso matutino. Se pauta tratamiento conservador inicial." },
  { id: "12", patientId: "3", patientName: "Ana Martínez Ruiz", date: "2026-02-10", diagnosis: "Heloma (ojo de gallo) interdigital", treatment: "Enucleación + descarga con fieltro", observations: "Lesión por roce entre 4° y 5° dedo. Recomendar separadores de silicona." },
];

export const notifications: Notification[] = [
  { id: "1", title: "Visita en 1 hora", description: "María García López · 09:00 · domicilio", time: "Hace 5 min", type: "appointment", read: false },
  { id: "2", title: "Siguiente desplazamiento", description: "Carlos Rodríguez · 10:30 · Getafe", time: "Hace 15 min", type: "appointment", read: false },
  { id: "3", title: "Recordatorio", description: "Confirmar acceso con Pedro Sánchez (visita mañana)", time: "Hace 1 hora", type: "reminder", read: false },
  { id: "4", title: "Paciente nuevo", description: "Miguel Ángel Ruiz — zona sur", time: "Hace 2 horas", type: "alert", read: true },
  { id: "5", title: "Visita cancelada", description: "María García — 14/04", time: "Ayer", type: "alert", read: true },
];

export const weeklyHomeVisits = [
  { day: "Lun", visitas: 8 },
  { day: "Mar", visitas: 12 },
  { day: "Mié", visitas: 6 },
  { day: "Jue", visitas: 10 },
  { day: "Vie", visitas: 14 },
  { day: "Sáb", visitas: 4 },
];

export const patientGrowth = [
  { month: "Ene", pacientes: 120 },
  { month: "Feb", pacientes: 135 },
  { month: "Mar", pacientes: 152 },
  { month: "Abr", pacientes: 168 },
];

export const monthlyStats = [
  { month: "Ene", visitas: 85, nuevos: 15, asistencia: 92 },
  { month: "Feb", visitas: 102, nuevos: 18, asistencia: 88 },
  { month: "Mar", visitas: 95, nuevos: 20, asistencia: 91 },
  { month: "Abr", visitas: 78, nuevos: 12, asistencia: 94 },
];

export const podiatryServices: PodiatryService[] = [
  { id: "s1", name: "Primera consulta a domicilio", category: "consulta", durationMin: 50, pricePen: 65, description: "Anamnesis, exploración y plan de tratamiento en el hogar del paciente." },
  { id: "s2", name: "Quiropodia a domicilio", category: "consulta", durationMin: 35, pricePen: 45, description: "Corte de uñas, hiperqueratosis y cuidado básico con material estéril portátil." },
  { id: "s3", name: "Estudio baropodométrico (domicilio)", category: "consulta", durationMin: 45, pricePen: 85, description: "Análisis de presiones y marcha con plataforma transportable." },
  { id: "s4", name: "Espiculectomía / onicocriptosis", category: "quirurgico", durationMin: 40, pricePen: 95, description: "Procedimiento menor con kit quirúrgico y bioseguridad en domicilio." },
  { id: "s5", name: "Sesión ondas de choque", category: "consulta", durationMin: 30, pricePen: 72, description: "Equipo portátil; ideal para fascitis plantar y tendinopatías." },
  { id: "s6", name: "Plantillas ortopédicas a medida", category: "ortesis", durationMin: 35, pricePen: 235, description: "Toma de moldes en domicilio y entrega en segunda visita programada." },
  { id: "s7", name: "Taloneras de descarga", category: "ortesis", durationMin: 25, pricePen: 52, description: "Adaptación y educación sanitaria en casa." },
  { id: "s8", name: "Revisión pie diabético", category: "consulta", durationMin: 45, pricePen: 58, description: "Exploración neurológica y vascular en entorno familiar." },
];

export const inventoryItems: InventoryItem[] = [
  { id: "i0", name: "Maleta podología desplazamiento", sku: "EQ-001", category: "Equipo móvil", units: 3, minUnits: 2, unit: "uds." },
  { id: "i1", name: "Guantes nitrilo T/M", sku: "CON-001", category: "Consumibles", units: 42, minUnits: 20, unit: "cajas" },
  { id: "i2", name: "Gasas estériles", sku: "CON-014", category: "Consumibles", units: 18, minUnits: 15, unit: "paquetes" },
  { id: "i3", name: "Crema queratolítica 100 ml", sku: "FAR-203", category: "Farmacia", units: 8, minUnits: 12, unit: "uds." },
  { id: "i4", name: "Bisturí desechable #15", sku: "QUI-088", category: "Quirúrgico", units: 120, minUnits: 40, unit: "uds." },
  { id: "i5", name: "Alcohol 96º 1L", sku: "CON-030", category: "Higiene", units: 6, minUnits: 4, unit: "botellas" },
  { id: "i6", name: "Separadores silicona interdigital", sku: "ORT-112", category: "Ortesis", units: 35, minUnits: 10, unit: "pares" },
];

export const initialWaitingQueue: WaitingTicket[] = [
  {
    id: "w1",
    patientName: "María García López",
    appointmentTime: "09:00",
    reason: "Revisión periódica",
    visitAddress: "Calle Mayor 12, Madrid",
    phone: "+34 612 345 678",
    status: "en_domicilio",
    priority: "normal",
  },
  {
    id: "w2",
    patientName: "Carlos Rodríguez Pérez",
    appointmentTime: "10:30",
    reason: "Uña encarnada",
    visitAddress: "Av. de la Constitución 5, Getafe",
    phone: "+34 623 456 789",
    status: "en_ruta",
    priority: "alta",
  },
  {
    id: "w3",
    patientName: "Ana Martínez Ruiz",
    appointmentTime: "12:00",
    reason: "Callosidades",
    visitAddress: "Calle Real 8, 3º B, Pozuelo de Alarcón",
    phone: "+34 634 567 890",
    status: "finalizado",
    priority: "normal",
  },
  {
    id: "w4",
    patientName: "Laura Fernández Díaz",
    appointmentTime: "09:30",
    reason: "Primera consulta",
    visitAddress: "Calle Orense 34, 6º D, Madrid",
    phone: "+34 656 789 012",
    status: "programado",
    priority: "normal",
  },
];

export const invoices: Invoice[] = [];

export const documentTemplates: DocumentTemplate[] = [
  { id: "d1", title: "Consentimiento informado — procedimiento menor", type: "Legal", updatedAt: "2026-03-01" },
  { id: "d2", title: "Historia clínica — visita a domicilio", type: "Clínico", updatedAt: "2026-02-18" },
  { id: "d3", title: "Recomendaciones post-quirúrgicas uña", type: "Paciente", updatedAt: "2026-01-10" },
  { id: "d4", title: "Informe para traumatología / RMN", type: "Interconsulta", updatedAt: "2026-04-05" },
];
