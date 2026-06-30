

import { getHeaders, fetchWithThrottle } from "./core/client";

const TABLE_FACTURACION = import.meta.env.VITE_TABLE_FACTURACION || "";


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


export async function actualizarFacturacion(id: string, fields: any, oldPatientId?: number) {
  const linkUrl = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_FACTURACION}/links/ciwdsbl2amtsznx/${id}`;
  
  const newPatientId = fields.Pacientes && fields.Pacientes.length > 0 ? fields.Pacientes[0].id : null;
  
  
  if (oldPatientId && newPatientId && oldPatientId !== Number(newPatientId)) {
    
    await fetchWithThrottle(linkUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: oldPatientId })
    });

    
    await fetchWithThrottle(linkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: newPatientId })
    });
  } else if (newPatientId && !oldPatientId) {
    
    await fetchWithThrottle(linkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({ id: newPatientId })
    });
  } else if (oldPatientId && !newPatientId) {
    
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


export async function eliminarFacturacion(id: number) {
  const url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_FACTURACION}/records`;
  const response = await fetchWithThrottle(url, {
    method: "DELETE",
    headers: getHeaders(),
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    throw new Error(`Error al eliminar factura: ${response.status}`);
  }
}


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

  
  if (facturas.length > 0) {
  }

  
  let totalFacturado = 0;
  let pendienteCobro = 0;
  let cobrado = 0;

  
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

    
    if (fechaStr) {
      const iso = fechaStr.split('T')[0];
      const parts = iso.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && parts[1] >= 1 && parts[1] <= 12) {
        const mesLabel = `${MONTH_SHORT[parts[1] - 1]} ${parts[0]}`;
        facturacionPorMes.set(mesLabel, (facturacionPorMes.get(mesLabel) || 0) + importe);
      }
    }
  });

  
  const revenueByMonth = Array.from(facturacionPorMes.entries())
    .sort((a, b) => {
      
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const [mesA, yearA] = a[0].split(" ");
      const [mesB, yearB] = b[0].split(" ");
      if (yearA !== yearB) return Number(yearA) - Number(yearB);
      return meses.indexOf(mesA) - meses.indexOf(mesB);
    })
    .map(([periodo, soles]) => ({ periodo, soles: Math.round(soles) }));

  return { count, totalFacturado, pendienteCobro, cobrado, revenueByMonth, facturas };
}
