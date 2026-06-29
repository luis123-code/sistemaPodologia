/**
 * Servicio de Plantillas Web para NocoDB API v3
 * Maneja todas las operaciones CRUD para la tabla de Plantillas
 * 
 * Endpoint base: /api/v3/data/{projectId}/{TABLE_PLANTILLAS}/records
 */

import { BASE_URL, PROJECT_ID, createRecord, fetchWithThrottle } from "./core/client";

const TABLE_PLANTILLAS = import.meta.env.VITE_TABLE_PLANTILLAS || "";

export interface ServicioWeb {
  titulo: string;
  descripcion: string;
}

export interface CasoWeb {
  label: string;
  antes: string | null;  // Base64 image
  despues: string | null;  // Base64 image
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
  // Campos opcionales de respuesta NocoDB
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

/**
 * Obtener todas las plantillas ordenadas por fecha de creación
 * Endpoint: GET /api/v3/data/{projectId}/{TABLE_PLANTILLAS}/records
 */
export async function obtenerPlantillas(): Promise<any[]> {
  try {
    // Llamada directa al API sin usar el core/client transformador
    const url = `${BASE_URL}/api/v3/data/${PROJECT_ID}/${TABLE_PLANTILLAS}/records`;
    
    console.log("[Plantillas] URL:", url);
    
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
    
    console.log("=== RESPUESTA CRUDA NOCODB ===");
    console.log(JSON.stringify(data, null, 2));
    console.log("==============================");
    
    // El API devuelve 'records' directamente
    return data.records || [];
  } catch (error) {
    console.error("Error al obtener plantillas:", error);
    return [];
  }
}

/**
 * Crear una nueva plantilla
 * Endpoint: POST /api/v3/data/{projectId}/{TABLE_PLANTILLAS}/records
 */
export async function crearPlantilla(data: PlantillaData): Promise<PlantillaRecord | null> {
  try {
    // Enviar todo el JSON dentro de fields.informacionDelaWeb
    const informacionWeb = {
      titulosSubtitulos: data.titulosSubtitulos,
      telefonoPrincipal: data.telefonoPrincipal,
      servicios: data.servicios,
      casos: data.casos,
      galeria: data.galeria || [],
    };
    
    const payload = {
      fields: {
        informacionDelaWeb: JSON.stringify(informacionWeb)
      }
    };

    console.log("=== PAYLOAD ENVIADO A NOCODB ===");
    console.log(JSON.stringify(payload, null, 2));
    console.log("================================");

    const response = await createRecord(TABLE_PLANTILLAS, payload);

    if (response) {
      console.log("=== RESPUESTA NOCODB ===");
      console.log(JSON.stringify(response, null, 2));
      console.log("========================");
    }
    
    return response as PlantillaRecord;

  } catch (error) {
    console.error("Error al crear plantilla:", error);
    throw error;
  }
}

