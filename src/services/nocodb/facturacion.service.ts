/**
 * Servicio de Facturación para NocoDB API v3
 * Maneja todas las operaciones CRUD para la tabla de Facturación
 * 
 * Endpoint base: /api/v3/data/{projectId}/{TABLE_FACTURACION}/records
 */

import { getHeaders, fetchWithThrottle } from "./core/client";

const TABLE_FACTURACION = import.meta.env.VITE_TABLE_FACTURACION || "";

/**
 * Listar facturas con paginación y búsqueda
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_FACTURACION}/records
 * 
 * @param params - Parámetros de filtrado y paginación
 * @returns Promise con lista de facturas
 */
export async function obtenerFacturacion(params?: {
  search?: string;
  limit?: number;
  page?: number;
  estado?: string;
}) {
  let where = "";
  const queryParams: any = {};

  if (params?.search) {
    where = `(Factura,like,%${params.search}%)~or(Concepto,like,%${params.search}%)`;
  }

  if (params?.estado && params.estado !== "all") {
    if (where) {
      where += `~and(Estado,eq,${params.estado})`;
    } else {
      where = `(Estado,eq,${params.estado})`;
    }
  }

  if (where) queryParams.where = where;
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.page && params?.limit) queryParams.offset = (params.page - 1) * params.limit;
  if (params?.limit) queryParams.sort = "-fecha";

  const url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_FACTURACION}/records`;
  const queryString = new URLSearchParams(queryParams as any).toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;

  const response = await fetchWithThrottle(fullUrl, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Error al obtener facturas: ${response.status}`);
  }

  return response.json();
}

/**
 * Obtener una factura por ID
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_FACTURACION}/records/{id}
 * 
 * @param id - ID de la factura
 * @returns Promise con la factura
 */
export async function obtenerFactura(id: number) {
  const url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_FACTURACION}/records/${id}`;
  const response = await fetchWithThrottle(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Error al obtener factura: ${response.status}`);
  }

  return response.json();
}

/**
 * Crear una nueva factura
 * Endpoint: POST /api/v3/data/{projectId}/{TABLE_FACTURACION}/records
 * Body: { "fields": { "Factura": "string", "fecha": "string", "Concepto": "string", "Importe": 0, "Estado": "string", "Pacientes": [{ "id": "string" }] } }
 * 
 * @param data - Datos de la factura
 * @returns Promise con la factura creada
 */
export async function crearFacturacion(data: {
  Factura: string;
  fecha: string;
  Concepto: string;
  Importe: number;
  Estado: string;
  Pacientes?: Array<{ id: string }>;
}) {
  const url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_FACTURACION}/records`;
  const response = await fetchWithThrottle(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ fields: data }),
  });

  if (!response.ok) {
    throw new Error(`Error al crear factura: ${response.status}`);
  }

  return response.json();
}

/**
 * Actualizar una factura
 * Endpoint: PATCH /api/v3/data/{projectId}/{TABLE_FACTURACION}/records
 * Body: { "fields": { "id": "string", "Factura": "string", ... } }
 * 
 * @param id - ID de la factura
 * @param fields - Campos a actualizar
 * @param oldPatientId - ID del paciente anterior para eliminar la relación (opcional)
 * @returns Promise con la factura actualizada
 */
export async function actualizarFacturacion(id: string, fields: any, oldPatientId?: number) {
  const linkUrl = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_FACTURACION}/links/ciwdsbl2amtsznx/${id}`;
  
  const newPatientId = fields.Pacientes && fields.Pacientes.length > 0 ? fields.Pacientes[0].id : null;
  
  // Solo eliminar y agregar si el paciente cambió
  if (oldPatientId && newPatientId && oldPatientId !== Number(newPatientId)) {
    // Eliminar la relación anterior
    await fetchWithThrottle(linkUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: oldPatientId })
    });

    // Agregar la nueva relación
    await fetchWithThrottle(linkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: newPatientId })
    });
  } else if (newPatientId && !oldPatientId) {
    // Si no había paciente anterior pero hay uno nuevo, agregarlo
    await fetchWithThrottle(linkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: newPatientId })
    });
  } else if (oldPatientId && !newPatientId) {
    // Si había paciente anterior pero no hay nuevo, eliminarlo
    await fetchWithThrottle(linkUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: oldPatientId })
    });
  }

  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_FACTURACION}/records`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: id, fields: { ...fields } })
    }
  );
  if (!response.ok) {
    throw new Error('Error al actualizar factura');
  }
  return response.json();
}

/**
 * Eliminar una factura
 * Endpoint: DELETE /api/v3/data/{projectId}/{TABLE_FACTURACION}/records/{id}
 * 
 * @param id - ID de la factura
 * @returns Promise vacío
 */
export async function eliminarFacturacion(id: number) {
  const url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_FACTURACION}/records/${id}`;
  const response = await fetchWithThrottle(url, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Error al eliminar factura: ${response.status}`);
  }
}

/**
 * Obtener resumen de facturación con métricas
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_FACTURACION}/records
 * 
 * @returns Promise con datos de facturación y métricas
 */
export async function obtenerFacturacionResumen(): Promise<{ 
  count: number;
  totalFacturado: number;
  pendienteCobro: number;
  cobrado: number;
  revenueByMonth: { periodo: string; soles: number }[];
  facturas: any[];
}> {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_FACTURACION}/records`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Error al obtener facturas: ${response.status}`);
  }

  const data = await response.json();
  const facturas = data.records || [];
  const count = facturas.length;

  // Debug: ver qué campos vienen
  if (facturas.length > 0) {
    console.log("[Facturacion API] Primera factura:", facturas[0]);
    console.log("[Facturacion API] Fields:", facturas[0]?.fields);
    console.log("[Facturacion API] Fecha:", facturas[0]?.fields?.fecha || facturas[0]?.fields?.Fecha);
    console.log("[Facturacion API] Importe:", facturas[0]?.fields?.Importe || facturas[0]?.fields?.importe);
  }

  // Calcular métricas generales
  let totalFacturado = 0;
  let pendienteCobro = 0;
  let cobrado = 0;

  // Calcular facturación por mes
  const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const facturacionPorMes = new Map<string, number>();

  facturas.forEach((f: any) => {
    const importe = Number(f.fields?.Importe || f.fields?.importe || f.fields?.monto || 0);
    const estado = f.fields?.Estado || f.fields?.estado || "";
    const fechaStr = f.fields?.fecha || f.fields?.Fecha || "";

    totalFacturado += importe;

    if (estado.toLowerCase() === "pagado" || estado.toLowerCase() === "cobrado") {
      cobrado += importe;
    } else {
      pendienteCobro += importe;
    }

    // Agrupar por mes (ISO directo, sin desplazamiento UTC)
    if (fechaStr) {
      const iso = fechaStr.split('T')[0];
      const parts = iso.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && parts[1] >= 1 && parts[1] <= 12) {
        const mesLabel = `${MONTH_SHORT[parts[1] - 1]} ${parts[0]}`;
        facturacionPorMes.set(mesLabel, (facturacionPorMes.get(mesLabel) || 0) + importe);
      }
    }
  });

  // Convertir a array ordenado
  const revenueByMonth = Array.from(facturacionPorMes.entries())
    .sort((a, b) => {
      // Ordenar cronológicamente
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const [mesA, yearA] = a[0].split(" ");
      const [mesB, yearB] = b[0].split(" ");
      if (yearA !== yearB) return Number(yearA) - Number(yearB);
      return meses.indexOf(mesA) - meses.indexOf(mesB);
    })
    .map(([periodo, soles]) => ({ periodo, soles: Math.round(soles) }));

  console.log("[Facturacion API] Conteos:", { count, totalFacturado, pendienteCobro, cobrado });
  console.log("[Facturacion API] Por mes:", revenueByMonth);

  return { count, totalFacturado, pendienteCobro, cobrado, revenueByMonth, facturas };
}
