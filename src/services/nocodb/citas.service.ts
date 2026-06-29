/**
 * Servicio de Citas para NocoDB API v3
 * Maneja todas las operaciones CRUD para la tabla de Citas
 * 
 * Endpoint base: /api/v3/data/{projectId}/{TABLE_CITAS}/records
 */

import { format } from "date-fns";
import { getRecords, createRecord, updateRecord, deleteRecord, fetchWithThrottle } from "./core/client";
import { wb } from "./core/whereBuilder";
import type { Cita } from "./core/types";

const TABLE_CITAS = "myd8mjv9kx9ejjx";

/**
 * Obtener todos los pacientes (con y sin citas)
 * Endpoint: GET /api/v3/data/{projectId}/mocqh1jrukq7ms3/records
 * 
 * @returns Promise con el count de pacientes y lista de pacientes
 */
export async function obtenerPacientesConCita() {
  const response = await fetchWithThrottle(
    `https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/mocqh1jrukq7ms3/records`,
    {
      method: "GET",
      headers: {
        "xc-token": import.meta.env.VITE_NOCODB_TOKEN,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Error al obtener pacientes");
  }

  const data = await response.json();
  console.log("Respuesta de API pacientes:", data);
  
  // Mapear todos los pacientes con sus nombres, cantidad de expedientes (citas) y foto
  const pacientesInfo = data.records?.map((paciente: any) => {
    console.log("Paciente JSON:", paciente);
    console.log("Fields del paciente:", paciente.fields);
    console.log("Citas del paciente:", paciente.fields?.citas);
    return {
      id: paciente.id,
      nombre: paciente.fields?.nombreCompleto || "Sin nombre",
      expedientes: paciente.fields?.citas?.length || 0,
      foto: (Array.isArray(paciente.fields?.fotoPacientes) && paciente.fields.fotoPacientes.length > 0) 
        ? (paciente.fields.fotoPacientes[0].signedUrl || paciente.fields.fotoPacientes[0].url) 
        : "",
    };
  }) || [];
  
  const pacientesUnicos = data.records?.length || 0;
  console.log("pacientesUnicos:", pacientesUnicos);
  console.log("pacientesInfo:", pacientesInfo);
  return { count: pacientesUnicos, pacientes: pacientesInfo };
}

/**
 * Obtener citas del mes actual
 * Endpoint: GET /api/v3/data/{projectId}/myd8mjv9kx9ejjx/records
 * 
 * @returns Promise con el count de citas del mes actual
 */
export async function contarCitasEsteMes() {
  const response = await fetchWithThrottle(
    `https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/myd8mjv9kx9ejjx/records`,
    {
      method: "GET",
      headers: {
        "xc-token": import.meta.env.VITE_NOCODB_TOKEN,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Error al obtener citas del mes actual");
  }

  const data = await response.json();
  console.log("Respuesta de API citas:", data);
  // Obtener fecha actual y primer día del mes
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayIso = firstDayOfMonth.toISOString().split('T')[0];

  // Contar citas del mes actual
  const citasEsteMes = data.records?.filter((cita: any) => {
    const citaFecha = cita.fields?.fecha; // Campo de fecha en fields
    if (!citaFecha) return false;
    const citaDate = new Date(citaFecha);
    return citaDate >= firstDayOfMonth;
  });

  const count = citasEsteMes?.length || 0;
  console.log("citasEsteMes count:", count);
  return { count };
}

/**
 * Listar citas con filtros combinados
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records
 * Where: dinámico con wb.and(...) según filtros proporcionados
 * 
 * @param params - Filtros opcionales (fecha, estado, podologo, paciente_id)
 * @returns Promise con lista de citas y pageInfo
 */
export async function listarCitas(params?: {
  fecha?: string;
  estado?: Cita["estado"];
  podologo?: string;
  paciente_id?: number;
}) {
  const conditions: string[] = [];

  if (params?.fecha) {
    conditions.push(wb.eq("fecha", params.fecha));
  }
  if (params?.estado) {
    conditions.push(wb.eq("estado", params.estado));
  }
  if (params?.podologo) {
    conditions.push(wb.eq("podologo", params.podologo));
  }
  if (params?.paciente_id) {
    conditions.push(wb.eq("paciente_id", params.paciente_id));
  }

  const where = conditions.length > 0 ? wb.and(...conditions) : undefined;

  return getRecords<Cita>(TABLE_CITAS, {
    where,
  });
}

/**
 * Obtener citas de hoy
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records
 * Where: (fecha,eq,{hoy})
 * Sort: hora
 * 
 * @returns Promise con lista de citas de hoy
 */
export async function citasDeHoy() {
  const hoy = format(new Date(), "yyyy-MM-dd");
  return getRecords<Cita>(TABLE_CITAS, {
    where: wb.eq("fecha", hoy),
    sort: "hora",
  });
}

/**
 * Obtener citas de un paciente
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records
 * Where: (paciente_id,eq,{paciente_id})
 * Sort: -fecha
 * 
 * @param paciente_id - ID del paciente
 * @returns Promise con lista de citas del paciente
 */
export async function citasDePaciente(paciente_id: number) {
  return getRecords<Cita>(TABLE_CITAS, {
    where: wb.eq("paciente_id", paciente_id),
    sort: "-fecha",
  });
}

/**
 * Obtener citas por estado
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records
 * Where: (estado,eq,{estado})
 * Sort: fecha
 * 
 * @param estado - Estado de las citas
 * @returns Promise con lista de citas por estado
 */
export async function citasPorEstado(estado: Cita["estado"]) {
  return getRecords<Cita>(TABLE_CITAS, {
    where: wb.eq("estado", estado),
    sort: "fecha",
  });
}

/**
 * Obtener citas activas (no canceladas ni completadas)
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records
 * Where: (estado,in,programada,confirmada,en_camino)
 * Sort: fecha
 * 
 * @returns Promise con lista de citas activas
 */
export async function citasActivas() {
  return getRecords<Cita>(TABLE_CITAS, {
    where: wb.in("estado", "programada", "confirmada", "en_camino"),
    sort: "fecha",
  });
}

/**
 * Crear una nueva cita
 * Endpoint: POST /api/v3/data/{projectId}/{TABLE_CITAS}/records
 * 
 * @param data - Datos de la cita (sin Id ni creado_en)
 * @returns Promise con la cita creada
 */
export async function crearCita(data: Omit<Cita, "Id" | "creado_en">) {
  return createRecord<Cita>(TABLE_CITAS, data);
}

/**
 * Cambiar el estado de una cita
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_CITAS}/records/{id}
 * 
 * @param id - ID de la cita
 * @param estado - Nuevo estado
 * @returns Promise con la cita actualizada
 */
export async function cambiarEstado(id: number, estado: Cita["estado"]) {
  return updateRecord<Cita>(TABLE_CITAS, id, { estado });
}

/**
 * Cancelar una cita
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_CITAS}/records/{id}
 * Where: estado = cancelada
 * 
 * @param id - ID de la cita
 * @returns Promise con la cita actualizada
 */
export async function cancelarCita(id: number) {
  return updateRecord<Cita>(TABLE_CITAS, id, { estado: "cancelada" });
}

/**
 * Actualizar una cita
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_CITAS}/records/{id}
 * 
 * @param id - ID de la cita
 * @param data - Datos a actualizar
 * @returns Promise con la cita actualizada
 */
export async function actualizarCita(id: number, data: Partial<Cita>) {
  return updateRecord<Cita>(TABLE_CITAS, id, data);
}

/**
 * Eliminar una cita
 * Endpoint: DELETE /api/v3/data/{projectId}/{TABLE_CITAS}/records/{id}
 * 
 * @param id - ID de la cita
 * @returns Promise vacío
 */
export async function eliminarCita(id: number) {
  return deleteRecord(TABLE_CITAS, id);
}

/**
 * Eliminar asociación de paciente de una cita
 * Endpoint: DELETE /api/v3/data/{projectId}/{TABLE_CITAS}/links/ctumef8d9ilo27a/{citaId}
 *
 * @param citaId - ID de la cita
 * @param pacienteId - ID del paciente a desasociar
 * @returns Promise vacío
 */
export async function eliminarAsociacionPaciente(citaId: string, pacienteId: string) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/links/ctumef8d9ilo27a/${citaId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: pacienteId })
    }
  );
  if (!response.ok) {
    throw new Error('Error al eliminar asociación de paciente');
  }
}

/**
 * Crear asociación de paciente a una cita
 * Endpoint: POST /api/v3/data/{projectId}/{TABLE_CITAS}/links/ctumef8d9ilo27a/{citaId}
 *
 * @param citaId - ID de la cita
 * @param pacienteId - ID del paciente a asociar
 * @returns Promise vacío
 */
export async function crearAsociacionPaciente(citaId: string, pacienteId: string) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/links/ctumef8d9ilo27a/${citaId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: pacienteId })
    }
  );
  if (!response.ok) {
    throw new Error('Error al crear asociación de paciente');
  }
}

/**
 * Crear una cita con formato NocoDB v3 (fields)
 * Endpoint: POST /api/v3/data/{projectId}/{TABLE_CITAS}/records
 *
 * @param fields - Campos de la cita
 * @returns Promise con la cita creada
 */
export async function crearCitaV3(fields: any) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ fields })
    }
  );
  if (!response.ok) {
    throw new Error('Error al crear cita');
  }
  return response.json();
}

/**
 * Obtener count de citas por estado
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/count?where=(progreso,eq,{estado})
 *
 * @param estado - Estado de la cita (Confirmada, Pendiente, En Progreso, Completada, Cancelada)
 * @returns Promise con el count
 */
export async function contarCitasPorEstado(estado: string) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/count?where=(progreso,eq,${estado})`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al contar citas por estado');
  }
  return response.json();
}

/**
 * Obtener count de citas de un paciente específico
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/count?where=(pacienteAsociado,like,%{pacienteId}%)
 *
 * @param pacienteId - ID del paciente
 * @returns Promise con { count: number }
 */
export async function contarCitasPorPaciente(pacienteId: number) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/count?where=(pacienteAsociado,like,%${pacienteId}%)`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error(`Error al contar citas del paciente ${pacienteId}`);
  }
  return response.json() as Promise<{ count: number }>;
}

/**
 * Obtener count total de citas
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/count
 *
 * @returns Promise con el count total
 */
export async function contarCitasTotal() {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/count`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al contar citas totales');
  }
  return response.json();
}

/**
 * Obtener citas filtradas por tipo de paciente
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records?where=(tipoPaciente,eq,{tipo})
 *
 * @param tipo - Tipo de paciente (domicilio, consultorio, etc.)
 * @returns Promise con las citas filtradas
 */
export async function filtrarCitasPorTipoPaciente(tipo: string) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/records?where=(tipoPaciente,eq,${tipo})`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al filtrar citas por tipo de paciente');
  }
  return response.json();
}

/**
 * Actualizar una cita con formato NocoDB v3 (id + fields)
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_CITAS}/records
 * 
 * @param id - ID de la cita
 * @param fields - Campos a actualizar
 * @returns Promise con la cita actualizada
 */
export async function actualizarCitaV3(id: string, fields: any) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/records`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id, fields })
    }
  );
  if (!response.ok) {
    throw new Error('Error al actualizar cita');
  }
  return response.json();
}

/**
 * Obtener citas por paciente asociado (para PatientsPage)
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records
 * Where: (pacienteAsociado,eq,{patientId})
 * 
 * @param patientId - ID del paciente
 * @returns Promise con lista de citas
 */
export async function citasPorPacienteAsociado(patientId: number) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${import.meta.env.VITE_TABLE_CITAS}/records?where=(pacienteAsociado,eq,${patientId})`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al obtener citas del paciente');
  }
  return response.json();
}

/**
 * Obtener count de citas por estado de rutaDia
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/count?where=(tipoPaciente,eq,domicilio)~and(rutaDia,eq,{estado})~and(fechaCopy,eq,{hoy})
 *
 * @param estado - Estado de rutaDia (En ruta, Finalizado, En domicilio, Programada)
 * @returns Promise con el count
 */
export async function contarCitasPorRutaDia(estado: string) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/count?where=(tipoPaciente,eq,domicilio)~and(rutaDia,eq,${encodeURIComponent(estado)})~and(fechaCopy,eq,${hoy})`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al contar citas por rutaDia');
  }
  return response.json();
}

/**
 * Obtener citas por estado de rutaDia
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records?where=(tipoPaciente,eq,domicilio)~and(rutaDia,eq,{estado})~and(fechaCopy,eq,{hoy})
 *
 * @param estado - Estado de rutaDia (En ruta, Finalizado, En domicilio, Programada)
 * @returns Promise con las citas filtradas
 */
export async function obtenerCitasPorRutaDia(estado: string) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/records?where=(tipoPaciente,eq,domicilio)~and(rutaDia,eq,${encodeURIComponent(estado)})~and(fechaCopy,eq,${hoy})`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al obtener citas por rutaDia');
  }
  return response.json();
}

/**
 * Obtener todas las citas de domicilio de hoy
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records?where=(tipoPaciente,eq,domicilio)~and(fechaCopy,eq,{hoy})
 *
 * @returns Promise con las citas de domicilio de hoy
 */
export async function obtenerCitasDomicilioHoy() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/records?where=(tipoPaciente,eq,domicilio)~and(fechaCopy,eq,${hoy})`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al obtener citas de domicilio de hoy');
  }
  return response.json();
}

/**
 * Actualizar el estado de rutaDia de una cita
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_CITAS}/records
 *
 * @param id - ID de la cita
 * @param rutaDia - Nuevo estado de rutaDia (Programada, En ruta, En domicilio, Finalizado)
 * @returns Promise con la respuesta de la API
 */
export async function actualizarRutaDia(id: string, rutaDia: string) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_CITAS}/records`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({
        id,
        fields: {
          rutaDia
        }
      })
    }
  );
  if (!response.ok) {
    throw new Error('Error al actualizar rutaDia de la cita');
  }
  return response.json();
}

/**
 * Obtener citas con información detallada
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_CITAS}/records
 * 
 * @returns Promise con datos de citas y métricas
 */
export async function obtenerCitasResumen(): Promise<{ 
  count: number;
  confirmadas: number;
  pendientes: number;
  canceladas: number;
  descontinuadas: number;
  patronSemanal: { dia: string; visitas: number }[];
  tasaCumplimientoPorMes: { periodo: string; asistencia: number }[];
  visitasDomicilioPorMes: { periodo: string; visitas: number }[];
  citas: any[];
}> {
  const response = await fetchWithThrottle(
    `https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/${TABLE_CITAS}/records`,
    {
      method: "GET",
      headers: {
        "xc-token": import.meta.env.VITE_NOCODB_TOKEN,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Error al obtener citas");
  }

  const data = await response.json();
  const citas = data.records || [];
  const count = citas.length;
  
  // Debug: ver qué campos vienen
  if (citas.length > 0) {
    console.log("[Citas API] Primera cita fields:", citas[0]?.fields);
    console.log("[Citas API] Progreso:", citas[0]?.fields?.progreso);
  }
  
  // El campo se llama 'progreso' no 'estado'
  const getProgreso = (c: any) => {
    const fields = c.fields || {};
    return fields.progreso || "";
  };
  
  const confirmadas = citas.filter((c: any) => getProgreso(c) === "Confirmada").length;
  const pendientes = citas.filter((c: any) => getProgreso(c) === "Pendiente").length;
  const canceladas = citas.filter((c: any) => getProgreso(c) === "Cancelada").length;
  const descontinuadas = citas.filter((c: any) => getProgreso(c) === "Descontinuado").length;

  // Helper: obtiene día de semana (0=Dom..6=Sáb) de un string de fecha en Lima
  const getDiaSemanaLima = (fechaStr: string): number => {
    const iso = fechaStr.split('T')[0];
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return -1;
    return new Date(y, m - 1, d).getDay();
  };

  // Helper: obtiene etiqueta "Mes Año" en zona Lima
  const getMesAnioLima = (fechaStr: string): string | null => {
    const iso = fechaStr.split('T')[0];
    if (!iso || iso.length < 7) return null;
    const [y, m] = iso.split('-').map(Number);
    if (!y || !m) return null;
    const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${MONTH_SHORT[m - 1]} ${y}`;
  };

  // Calcular patrón semanal por día (0=Domingo, 1=Lunes, ..., 6=Sábado)
  const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const patronSemanal = diasSemana.map((dia, index) => {
    const citasDelDia = citas.filter((c: any) => {
      const fechaStr = c.fields?.fecha || c.fields?.fechaCopy || "";
      if (!fechaStr) return false;
      return getDiaSemanaLima(fechaStr) === index;
    }).length;
    return { dia, visitas: citasDelDia };
  });

  // Calcular tasa de cumplimiento por mes (% de confirmadas vs total)
  const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const citasPorMes = new Map<string, { total: number; confirmadas: number }>();

  citas.forEach((c: any) => {
    const fechaStr = c.fields?.fecha || c.fields?.fechaCopy || "";
    if (fechaStr) {
      const label = getMesAnioLima(fechaStr);
      if (label) {
        const actual = citasPorMes.get(label) || { total: 0, confirmadas: 0 };
        actual.total += 1;
        if (getProgreso(c) === "Confirmada") {
          actual.confirmadas += 1;
        }
        citasPorMes.set(label, actual);
      }
    }
  });

  const tasaCumplimientoPorMes = Array.from(citasPorMes.entries())
    .sort((a, b) => {
      const [mesA, yearA] = a[0].split(" ");
      const [mesB, yearB] = b[0].split(" ");
      if (yearA !== yearB) return Number(yearA) - Number(yearB);
      return MONTH_SHORT.indexOf(mesA) - MONTH_SHORT.indexOf(mesB);
    })
    .map(([periodo, datos]) => ({
      periodo,
      asistencia: Math.round((datos.confirmadas / datos.total) * 100)
    }));

  // Calcular visitas a domicilio por mes
  const domicilioPorMes = new Map<string, number>();
  citas.forEach((c: any) => {
    const tipo: string = c.fields?.tipoPaciente || "";
    if (tipo.toLowerCase() !== "domicilio") return;
    const fechaStr: string = c.fields?.fecha || c.fields?.fechaCopy || "";
    if (fechaStr) {
      const label = getMesAnioLima(fechaStr);
      if (label) domicilioPorMes.set(label, (domicilioPorMes.get(label) || 0) + 1);
    }
  });
  const visitasDomicilioPorMes = Array.from(domicilioPorMes.entries())
    .sort((a, b) => {
      const [mA, yA] = a[0].split(" ");
      const [mB, yB] = b[0].split(" ");
      if (yA !== yB) return Number(yA) - Number(yB);
      return MONTH_SHORT.indexOf(mA) - MONTH_SHORT.indexOf(mB);
    })
    .map(([periodo, visitas]) => ({ periodo, visitas }));

  console.log("[Citas API] Conteos:", { count, confirmadas, pendientes, canceladas, descontinuadas });
  console.log("[Citas API] Patrón semanal:", patronSemanal);
  console.log("[Citas API] Tasa cumplimiento por mes:", tasaCumplimientoPorMes);
  console.log("[Citas API] Visitas domicilio por mes:", visitasDomicilioPorMes);

  return { count, confirmadas, pendientes, canceladas, descontinuadas, patronSemanal, tasaCumplimientoPorMes, visitasDomicilioPorMes, citas };
}

/**
 * Contar total de citas (alias para compatibilidad)
 * @deprecated Usar obtenerCitasResumen en su lugar
 */
export async function contarCitas(): Promise<{ count: number }> {
  const result = await obtenerCitasResumen();
  return { count: result.count };
}
