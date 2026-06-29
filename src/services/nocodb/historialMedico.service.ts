

import { getRecords, findOne, createRecord, updateRecord, deleteRecord, fetchWithThrottle } from "./core/client";
import { wb } from "./core/whereBuilder";
import type { HistorialMedico } from "./core/types";

const TABLE_HISTORIAL = import.meta.env.VITE_TABLE_HISTORIAL || "";


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
  const count = historial.length;
  
  
  const diagnosticos = new Set<string>();
  historial.forEach((h: any) => {
    const diag = h.fields?.diagnostico || h.fields?.diagnosticoPrincipal;
    if (diag) diagnosticos.add(diag);
  });

  
  const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const fichasPorMesMap = new Map<string, number>();

  historial.forEach((h: any) => {
    
    const citaFecha: string =
      h.fields?.citas?.[0]?.fields?.fecha ||
      h.fields?.citas?.[0]?.fields?.fechaCopy ||
      "";
    
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

  
  const fichasPorMes = Array.from(fichasPorMesMap.entries())
    .sort((a, b) => {
      const [mesA, yearA] = a[0].split(" ");
      const [mesB, yearB] = b[0].split(" ");
      if (yearA !== yearB) return Number(yearA) - Number(yearB);
      return MONTH_SHORT.indexOf(mesA) - MONTH_SHORT.indexOf(mesB);
    })
    .map(([periodo, fichas]) => ({ periodo, fichas }));

  return { count, diagnosticosUnicos: diagnosticos.size, fichasPorMes, historial };
}


export async function contarHistorialTotal(): Promise<{ count: number }> {
  const result = await obtenerHistorialResumen();
  return { count: result.count };
}


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
  
  const diagnosticosUnicos = new Set();
  data.records?.forEach((registro: any) => {
    if (registro.fields?.problemas) {
      diagnosticosUnicos.add(registro.fields.problemas);
    }
    if (registro.fields?.antecedentesPatalogico) {
      diagnosticosUnicos.add(registro.fields.antecedentesPatalogico);
    }
  });
  return { count: diagnosticosUnicos.size };
}


export async function historialDePaciente(paciente_id: number) {
  return getRecords<HistorialMedico>(TABLE_HISTORIAL, {
    where: wb.eq("paciente_id", paciente_id),
    sort: "-fecha",
  });
}


export async function ultimoRegistro(paciente_id: number) {
  return findOne<HistorialMedico>(TABLE_HISTORIAL, wb.eq("paciente_id", paciente_id));
}


export async function crearRegistro(data: Omit<HistorialMedico, "Id" | "creado_en">) {
  return createRecord<HistorialMedico>(TABLE_HISTORIAL, data);
}


export async function actualizarRegistro(id: number, data: Partial<HistorialMedico>) {
  return updateRecord<HistorialMedico>(TABLE_HISTORIAL, id, data);
}


export async function eliminarRegistro(id: number) {
  return deleteRecord(TABLE_HISTORIAL, id);
}


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

  
  if (data.imagenPodologica) {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        
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
