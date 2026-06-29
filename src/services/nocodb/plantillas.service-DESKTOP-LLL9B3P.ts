

import { BASE_URL, PROJECT_ID, createRecord, fetchWithThrottle } from "./core/client";

const TABLE_PLANTILLAS = import.meta.env.VITE_TABLE_PLANTILLAS || "";

export interface ServicioWeb {
  titulo: string;
  descripcion: string;
}

export interface CasoWeb {
  label: string;
  antes: string | null;  
  despues: string | null;  
}

export interface TituloSubtitulo {
  titulo: string;
  subtitulo: string;
}

export interface PlantillaData {
  titulosSubtitulos: TituloSubtitulo[];
  telefonoPrincipal: string;
  servicios: ServicioWeb[];
  casos: CasoWeb[];
  galeria?: string[];
  galeriaProfesional?: string[];
  galeriaPanel?: string[];
  
  id?: string | number;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface PlantillaRecord {
  id: string | number;
  fields: PlantillaData;
  CreatedAt?: string;
  UpdatedAt?: string;
}


export async function obtenerPlantillas(): Promise<any[]> {
  try {
    
    const url = `${BASE_URL}/api/v3/data/${PROJECT_ID}/${TABLE_PLANTILLAS}/records`;
    
    const response = await fetchWithThrottle(url, {
      method: "GET",
      headers: {
        "xc-token": import.meta.env.VITE_NOCODB_TOKEN || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    
    return data.records || [];
  } catch (error) {
    return [];
  }
}


export async function crearPlantilla(data: PlantillaData): Promise<PlantillaRecord | null> {
  try {
    
    const informacionWeb = {
      titulosSubtitulos: data.titulosSubtitulos,
      telefonoPrincipal: data.telefonoPrincipal,
      servicios: data.servicios,
      casos: data.casos,
      galeria: data.galeria || [],
      galeriaProfesional: data.galeriaProfesional || [],
      galeriaPanel: data.galeriaPanel || [],
    };
    
    const payload = {
      fields: {
        informacionDelaWeb: JSON.stringify(informacionWeb)
      }
    };

    const response = await createRecord(TABLE_PLANTILLAS, payload);

    if (response) {
    }
    
    return response as PlantillaRecord;

  } catch (error) {
    throw error;
  }
}

