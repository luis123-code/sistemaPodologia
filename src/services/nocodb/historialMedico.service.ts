/**
 * Servicio de Historial Médico para NocoDB API v3
 * Maneja todas las operaciones CRUD para la tabla de Historial Médico
 * 
 * Endpoint base: /api/v3/data/{projectId}/{TABLE_HISTORIAL}/records
 */

import { getRecords, findOne, createRecord, updateRecord, deleteRecord, fetchWithThrottle } from "./core/client";
import { wb } from "./core/whereBuilder";
import type { HistorialMedico } from "./core/types";

const TABLE_HISTORIAL = import.meta.env.VITE_TABLE_HISTORIAL || "";

/**
 * Obtener historial médico con información detallada
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_HISTORIAL}/records
 * 
 * @returns Promise con datos de historial y métricas
 */
export async function obtenerHistorialResumen(): Promise<{ 
  count: number;
  diagnosticosUnicos: number;
  fichasPorMes: { periodo: string; fichas: number }[];
  historial: any[];
}> {
  const response = await fetchWithThrottle(
    `https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/mimzhydz0qbqlcu/records?limit=1000`,
    {
      method: "GET",
      headers: {
        "xc-token": import.meta.env.VITE_NOCODB_TOKEN,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Error al obtener historial médico");
  }

  const data = await response.json();
  const historial = data.records || [];
  console.log("[Historial API] Primer registro campos:", historial[0]?.fields ? Object.keys(historial[0].fields) : "sin registros");
  const count = historial.length;
  
  // Extraer diagnósticos únicos
  const diagnosticos = new Set<string>();
  historial.forEach((h: any) => {
    const diag = h.fields?.diagnostico || h.fields?.diagnosticoPrincipal;
    if (diag) diagnosticos.add(diag);
  });

  // Calcular fichas por mes
  const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const fichasPorMesMap = new Map<string, number>();

  historial.forEach((h: any) => {
    // Fecha de la cita asociada (más precisa que CreatedAt)
    const citaFecha: string =
      h.fields?.citas?.[0]?.fields?.fecha ||
      h.fields?.citas?.[0]?.fields?.fechaCopy ||
      "";
    // Fallback: fecha de creación del registro en NocoDB
    const fechaStr: string = citaFecha || h.fields?.CreatedAt || h.fields?.createdAt || "";
    if (fechaStr) {
      const iso = fechaStr.split('T')[0];
      const parts = iso.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && parts[1] >= 1 && parts[1] <= 12) {
        const mesLabel = `${MONTH_SHORT[parts[1] - 1]} ${parts[0]}`;
        fichasPorMesMap.set(mesLabel, (fichasPorMesMap.get(mesLabel) || 0) + 1);
      }
    }
  });

  // Convertir a array ordenado cronológicamente
  const fichasPorMes = Array.from(fichasPorMesMap.entries())
    .sort((a, b) => {
      const [mesA, yearA] = a[0].split(" ");
      const [mesB, yearB] = b[0].split(" ");
      if (yearA !== yearB) return Number(yearA) - Number(yearB);
      return MONTH_SHORT.indexOf(mesA) - MONTH_SHORT.indexOf(mesB);
    })
    .map(([periodo, fichas]) => ({ periodo, fichas }));

  console.log("[Historial API] Conteos:", { count, diagnosticosUnicos: diagnosticos.size });
  console.log("[Historial API] Por mes:", fichasPorMes);

  return { count, diagnosticosUnicos: diagnosticos.size, fichasPorMes, historial };
}

/**
 * Obtener el count total de registros (alias para compatibilidad)
 * @deprecated Usar obtenerHistorialResumen en su lugar
 */
export async function contarHistorialTotal(): Promise<{ count: number }> {
  const result = await obtenerHistorialResumen();
  return { count: result.count };
}

/**
 * Obtener diagnósticos únicos del historial médico
 * Endpoint: GET /api/v3/data/{projectId}/mimzhydz0qbqlcu/records
 * 
 * @returns Promise con el count de diagnósticos únicos
 */
export async function contarDiagnosticosUnicos() {
  const response = await fetchWithThrottle(
    `https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/mimzhydz0qbqlcu/records`,
    {
      method: "GET",
      headers: {
        "xc-token": import.meta.env.VITE_NOCODB_TOKEN,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Error al obtener diagnósticos únicos");
  }

  const data = await response.json();
  console.log("Respuesta de API diagnósticos:", data);
  // Contar diagnósticos únicos basado en el campo problemas o antecedentesPatalogico
  const diagnosticosUnicos = new Set();
  data.records?.forEach((registro: any) => {
    if (registro.fields?.problemas) {
      diagnosticosUnicos.add(registro.fields.problemas);
    }
    if (registro.fields?.antecedentesPatalogico) {
      diagnosticosUnicos.add(registro.fields.antecedentesPatalogico);
    }
  });
  console.log("diagnosticosUnicos:", diagnosticosUnicos);
  console.log("count:", diagnosticosUnicos.size);
  return { count: diagnosticosUnicos.size };
}

/**
 * Obtener todo el historial de un paciente ordenado por fecha
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_HISTORIAL}/records
 * Where: (paciente_id,eq,{paciente_id})
 * Sort: -fecha
 * 
 * @param paciente_id - ID del paciente
 * @returns Promise con lista de historial médico
 */
export async function historialDePaciente(paciente_id: number) {
  return getRecords<HistorialMedico>(TABLE_HISTORIAL, {
    where: wb.eq("paciente_id", paciente_id),
    sort: "-fecha",
  });
}

/**
 * Obtener el último registro del paciente
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_HISTORIAL}/records
 * Where: (paciente_id,eq,{paciente_id})
 * Sort: -creado_en
 * Limit: 1
 * 
 * @param paciente_id - ID del paciente
 * @returns Promise con el último registro o null
 */
export async function ultimoRegistro(paciente_id: number) {
  return findOne<HistorialMedico>(TABLE_HISTORIAL, wb.eq("paciente_id", paciente_id));
}

/**
 * Crear un registro de historial médico
 * Endpoint: POST /api/v3/data/{projectId}/{TABLE_HISTORIAL}/records
 * 
 * @param data - Datos del historial (sin Id ni creado_en)
 * @returns Promise con el historial creado
 */
export async function crearRegistro(data: Omit<HistorialMedico, "Id" | "creado_en">) {
  return createRecord<HistorialMedico>(TABLE_HISTORIAL, data);
}

/**
 * Actualizar un registro de historial médico
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_HISTORIAL}/records/{id}
 * 
 * @param id - ID del registro
 * @param data - Datos a actualizar
 * @returns Promise con el historial actualizado
 */
export async function actualizarRegistro(id: number, data: Partial<HistorialMedico>) {
  return updateRecord<HistorialMedico>(TABLE_HISTORIAL, id, data);
}

/**
 * Eliminar un registro de historial médico
 * Endpoint: DELETE /api/v3/data/{projectId}/{TABLE_HISTORIAL}/records/{id}
 * 
 * @param id - ID del registro
 * @returns Promise vacío
 */
export async function eliminarRegistro(id: number) {
  return deleteRecord(TABLE_HISTORIAL, id);
}

/**
 * Obtener historial médico por cita (para PatientsPage)
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_HISTORIAL}/records
 * Where: (CitasAs,eq,{citaId})
 *
 * @param citaId - ID de la cita
 * @returns Promise con lista de historial médico
 */
export async function historialPorCita(citaId: number) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${import.meta.env.VITE_TABLE_HISTORIAL}/records?where=(CitasAs,eq,${citaId})`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al obtener historial médico');
  }
  return response.json();
}

/**
 * Obtener registros de historial médico por paciente asociado
 * Endpoint: GET https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/myd8mjv9kx9ejjx/records?where=(pacienteAsociado,eq,{pacienteId})
 *
 * @param pacienteId - ID del paciente asociado
 * @returns Promise con lista de registros de historial médico
 */
export async function obtenerRegistrosPorPacienteAsociado(pacienteId: number) {
  const response = await fetchWithThrottle(
    `https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/myd8mjv9kx9ejjx/records?where=(pacienteAsociado,eq,${pacienteId})`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al obtener registros por paciente asociado');
  }
  return response.json();
}

/**
 * Crear un registro de historial médico con el nuevo formato de API
 * Endpoint: POST https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/mimzhydz0qbqlcu/records
 *
 * @param data - Datos del historial con el nuevo formato
 * @returns Promise con el historial creado
 */
export async function crearRegistroV3(data: {
  problemas: string;
  tipoProcedimiento: string[];
  imagenPodologica?: File | null;
  observacionMes: string;
  antecedentesPatalogico: string;
  recetaPaciente: string;
  Anamnesis: string;
  citaId: string;
}) {
  // Preparar el payload
  const payload: any = {
    fields: {
      problemas: data.problemas,
      tipoProcedimiento: data.tipoProcedimiento,
      observacionMes: data.observacionMes,
      antecedentesPatalogico: data.antecedentesPatalogico,
      recetaPaciente: data.recetaPaciente,
      Anamnesis: data.Anamnesis,
      citas: [{ id: data.citaId }],
    },
  };

  // Si hay imagen, convertirla a base64 y agregarla al payload
  if (data.imagenPodologica) {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Extraer solo el base64 sin el prefijo data:image/...;base64,
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(data.imagenPodologica);

    const base64 = await base64Promise;

    payload.fields.imagenPodologica = [
      {
        mimetype: data.imagenPodologica.type,
        size: data.imagenPodologica.size,
        title: data.imagenPodologica.name,
        url: `data:${data.imagenPodologica.type};base64,${base64}`,
        icon: data.imagenPodologica.type.startsWith('image/') ? 'image' : 'file',
      },
    ];
  }

  const response = await fetchWithThrottle(
    `https://app.nocodb.com/api/v3/data/p96bi1rx1mkbyoa/mimzhydz0qbqlcu/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error('Error al crear registro de historial médico');
  }

  return response.json();
}
