


export interface LinkField {
  type: string;
  label: string;
  url: string;
}


export interface CitaAnidada {
  id: number;
  id_fields: { Id: number };
  fields: {
    fechaCitas?: string;
  };
}


export interface Paciente {
  Id?: number;
  id?: number;
  id_fields?: { Id: number };
  fields?: {
    nombreCompleto?: string;
    fotoPacientes?: string | null;
    Edad?: number | null;
    genero?: string;
    correoElectronico?: string | null;
    telefono?: string | null;
    Dirección?: string;
    Wasap?: string | null;
    Estado?: string;
    CreatedAt?: string;
    UpdatedAt?: string | null;
    Ubicacion?: LinkField;
    Mensaje?: LinkField;
    citas?: CitaAnidada[];
  };
  
  nombreCompleto?: string;
  fotoPacientes?: string | null;
  Edad?: number | null;
  genero?: string;
  correoElectronico?: string | null;
  telefono?: string | null;
  Dirección?: string;
  Wasap?: string | null;
  Estado?: string;
  CreatedAt?: string;
  UpdatedAt?: string | null;
  Ubicacion?: LinkField;
  Mensaje?: LinkField;
  citas?: CitaAnidada[];
  nombre?: string;
  apellido?: string;
  email?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  activo?: boolean;
  creado_en?: string;
}


export interface HistorialMedico {
  Id?: number;
  paciente_id: number;
  fecha: string;
  condiciones?: string;
  alergias?: string;
  notas?: string;
  podologo?: string;
  tratamiento?: string;
  creado_en?: string;
}


export interface Cita {
  Id?: number;
  paciente_id: number;
  fecha: string;
  hora: string;
  direccion?: string;
  estado: "programada" | "confirmada" | "en_camino" | "completada" | "cancelada";
  notas?: string;
  precio?: number;
  podologo?: string;
  servicio?: string;
  creado_en?: string;
}
