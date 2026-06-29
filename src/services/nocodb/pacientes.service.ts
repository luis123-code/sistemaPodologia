/**
 * Servicio de Pacientes para NocoDB API v3
 * Maneja todas las operaciones CRUD para la tabla de Pacientes
 * 
 * Endpoint base: /api/v3/data/{projectId}/{TABLE_PACIENTES}/records
 */

import { getRecords, getOne, createRecord, updateRecord, deleteRecord, getBaseUrl, getHeaders, handleError, BASE_URL, PROJECT_ID, fetchWithThrottle } from "./core/client";
import { wb } from "./core/whereBuilder";
import type { Paciente } from "./core/types";

const TABLE_PACIENTES = import.meta.env.VITE_TABLE_PACIENTES || "";

/**
 * Listar pacientes con paginación y búsqueda
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_PACIENTES}/records
 * Where: (nombre,like,%search%)~or(apellido,like,%search%)~and(activo,is,true) si search y activo
 * 
 * @param params - Parámetros de filtrado y paginación
 * @returns Promise con lista de pacientes y pageInfo
 */
export async function listarPacientes(params?: {
  page?: number;
  limit?: number;
  search?: string;
  activo?: boolean;
}) {
  let where: string | undefined;
  const queryParams: {
    where?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  } = {};

  if (params?.search) {
    const searchCondition = wb.or(
      wb.like("nombre", params.search),
      wb.like("apellido", params.search)
    );
    if (params.activo !== undefined) {
      where = wb.and(searchCondition, wb.is("activo", params.activo ? "true" : "false"));
    } else {
      where = searchCondition;
    }
  } else if (params?.activo !== undefined) {
    where = wb.is("activo", params.activo ? "true" : "false");
  }

  if (where) queryParams.where = where;
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.page && params?.limit) queryParams.offset = (params.page - 1) * params.limit;
  if (params?.limit) queryParams.sort = "-creado_en";

  return getRecords<Paciente>(TABLE_PACIENTES, queryParams);
}

/**
 * Obtener un paciente por ID
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_PACIENTES}/records/{id}
 * 
 * @param id - ID del paciente
 * @returns Promise con el paciente
 */
export async function obtenerPaciente(id: number) {
  return getOne<Paciente>(TABLE_PACIENTES, id);
}

/**
 * Buscar paciente por nombre o apellido
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_PACIENTES}/records
 * Where: (nombre,like,%texto%)~or(apellido,like,%texto%)
 * 
 * @param texto - Texto a buscar
 * @returns Promise con lista de pacientes
 */
export async function buscarPaciente(texto: string) {
  const where = wb.or(wb.like("nombre", texto), wb.like("apellido", texto));
  return getRecords<Paciente>(TABLE_PACIENTES, {
    where,
    limit: 10,
  });
}

/**
 * Crear un nuevo paciente
 * Endpoint: POST /api/v3/data/{projectId}/{TABLE_PACIENTES}/records
 * 
 * @param data - Datos del paciente (sin Id ni creado_en)
 * @returns Promise con el paciente creado
 */
export async function crearPaciente(data: Omit<Paciente, "Id" | "creado_en">) {
  return createRecord<Paciente>(TABLE_PACIENTES, data);
}

/**
 * Actualizar un paciente
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_PACIENTES}/records/{id}
 * 
 * @param id - ID del paciente
 * @param data - Datos a actualizar
 * @returns Promise con el paciente actualizado
 */
export async function actualizarPaciente(id: number, data: Partial<Paciente>) {
  return updateRecord<Paciente>(TABLE_PACIENTES, id, data);
}

/**
 * Desactivar un paciente (soft delete)
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_PACIENTES}/records/{id}
 * Where: activo = false
 * 
 * @param id - ID del paciente
 * @returns Promise con el paciente actualizado
 */
export async function desactivarPaciente(id: number) {
  return updateRecord<Paciente>(TABLE_PACIENTES, id, { activo: false });
}

/**
 * Eliminar un paciente permanentemente
 * Endpoint: DELETE /api/v3/data/{projectId}/{TABLE_PACIENTES}/records/{id}
 * 
 * @param id - ID del paciente
 * @returns Promise vacío
 */
export async function eliminarPaciente(id: number) {
  return deleteRecord(TABLE_PACIENTES, id);
}

/**
 * Obtener solo pacientes activos
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_PACIENTES}/records
 * Where: (activo,is,true)
 * Sort: nombre
 * 
 * @returns Promise con lista de pacientes activos
 */
export async function pacientesActivos() {
  return getRecords<Paciente>(TABLE_PACIENTES, {
    where: wb.is("activo", "true"),
    sort: "nombre",
  });
}

/**
 * Contar total de pacientes
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_PACIENTES}/count
 * 
 * @returns Promise con el total de pacientes
 */
export async function contarPacientes() {
  const url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_PACIENTES}/count`;
  const response = await fetchWithThrottle(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) handleError(response);

  return response.json();
}

/**
 * Buscar pacientes por nombre completo (para dropdown de búsqueda)
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_PACIENTES}/records
 * Where: (nombreCompleto,like,%texto%)
 * 
 * @param texto - Texto a buscar
 * @returns Promise con lista de pacientes
 */
export async function buscarPacientePorNombre(texto: string) {
  const url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_PACIENTES}/records?where=(nombreCompleto,like,%${texto}%)`;
  const response = await fetchWithThrottle(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) handleError(response);

  return response.json();
}

/**
 * Buscar pacientes por campo específico (para PatientsPage)
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_PACIENTES}/records
 * Where: (campo,operador,valor)
 * 
 * @param field - Campo a buscar (nombreCompleto, telefono, Dirección, Edad)
 * @param operator - Operador (like, eq)
 * @param value - Valor a buscar
 * @returns Promise con lista de pacientes
 */
export async function buscarPacientePorCampo(field: string, operator: string, value: string) {
  const where = operator === 'eq' 
    ? `(${field},${operator},${value})`
    : `(${field},${operator},%${value}%)`;
  const url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_PACIENTES}/records?where=${encodeURIComponent(where)}`;
  const response = await fetchWithThrottle(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) handleError(response);

  return response.json();
}

/**
 * Actualizar paciente con formato NocoDB v3 (id + fields)
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_PACIENTES}/records
 * 
 * @param id - ID del paciente
 * @param fields - Campos a actualizar
 * @returns Promise con el paciente actualizado
 */
export async function actualizarPacienteV3(id: string, fields: any) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_PACIENTES}/records`,
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
    throw new Error('Error al actualizar paciente');
  }
  return response.json();
}

/**
 * Obtener pacientes registrados desde tabla específica
 * Endpoint: GET /api/v3/data/{projectId}/mocqh1jrukq7ms3/records
 * 
 * @returns Promise con datos de pacientes y conteo
 */
export async function obtenerPacientesRegistrados(): Promise<{ 
  count: number; 
  activos: number;
  inactivos: number;
  pacientesPorMes: { periodo: string; nuevos: number }[];
  pacientes: any[];
}> {
  const url = `${import.meta.env.VITE_NOCODB_URL || BASE_URL}/api/v3/data/${PROJECT_ID}/mocqh1jrukq7ms3/records?limit=1000`;
  
  const response = await fetchWithThrottle(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) handleError(response);

  const data = await response.json();
  const pacientes = data.records || [];
  const count = pacientes.length;
  const activos = pacientes.filter((p: any) => p.fields?.activo === true || p.fields?.activo === "true").length;
  const inactivos = count - activos;

  // Calcular pacientes nuevos por mes
  const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const pacientesPorMesMap = new Map<string, number>();

  console.log("[Pacientes API] Total pacientes:", pacientes.length);
  if (pacientes.length > 0) {
    console.log("[Pacientes API] Campos primer registro:", Object.keys(pacientes[0].fields || {}));
    console.log("[Pacientes API] Fechas primer registro:", {
      CreatedAt: pacientes[0].fields?.CreatedAt,
      createdAt: pacientes[0].fields?.createdAt,
      fechaRegistro: pacientes[0].fields?.fechaRegistro,
      fechaAlta: pacientes[0].fields?.fechaAlta,
    });
  }

  pacientes.forEach((p: any) => {
    const fechaStr: string = p.fields?.CreatedAt || p.fields?.createdAt || p.fields?.fechaRegistro || p.fields?.fechaAlta || "";
    if (fechaStr) {
      // Parsear fecha ISO directamente (evita desplazamiento UTC)
      const iso = fechaStr.split('T')[0];
      const parts = iso.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && parts[1] >= 1 && parts[1] <= 12) {
        const mesLabel = `${MONTH_SHORT[parts[1] - 1]} ${parts[0]}`;
        pacientesPorMesMap.set(mesLabel, (pacientesPorMesMap.get(mesLabel) || 0) + 1);
      }
    }
  });

  console.log("[Pacientes API] Mapa por mes:", Array.from(pacientesPorMesMap.entries()));

  // Convertir a array ordenado cronológicamente
  const pacientesPorMes = Array.from(pacientesPorMesMap.entries())
    .sort((a, b) => {
      const [mesA, yearA] = a[0].split(" ");
      const [mesB, yearB] = b[0].split(" ");
      if (yearA !== yearB) return Number(yearA) - Number(yearB);
      return MONTH_SHORT.indexOf(mesA) - MONTH_SHORT.indexOf(mesB);
    })
    .map(([periodo, nuevos]) => ({ periodo, nuevos }));

  console.log("[Pacientes API] Conteos:", { count, activos, inactivos });
  console.log("[Pacientes API] Por mes:", pacientesPorMes);

  return { count, activos, inactivos, pacientesPorMes, pacientes };
}

/**
 * Contar pacientes registrados (alias para compatibilidad)
 * @deprecated Usar obtenerPacientesRegistrados en su lugar
 */
export async function contarPacientesRegistrados(): Promise<{ count: number }> {
  const result = await obtenerPacientesRegistrados();
  return { count: result.count };
}
