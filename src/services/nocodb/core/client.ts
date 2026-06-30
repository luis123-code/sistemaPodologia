

export const BASE_URL = import.meta.env.VITE_NOCODB_URL || "https://app.nocodb.com";
const TOKEN = import.meta.env.VITE_NOCODB_TOKEN;
export const PROJECT_ID = import.meta.env.VITE_NOCODB_PROJECT_ID || "p96bi1rx1mkbyoa";
import { requireAuthToken } from "@/lib/auth";

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MIN_REQUEST_INTERVAL_MS = 100;
let lastRequestTime = 0;

export async function fetchWithThrottle(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  requireAuthToken();
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
  let attempt = 0;

  while (true) {
    const response = await fetch(input, init);

    if (response.status === 429) {
      if (attempt >= MAX_RETRIES) {
        throw new Error("Demasiadas solicitudes. Espere un momento y reintente.");
      }
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
      continue;
    }

    return response;
  }
}


export interface PageInfo {
  totalRows: number;
  page: number;
  pageSize: number;
  isFirstPage: boolean;
  isLastPage: boolean;
}


export interface NocoDBResponse<T> {
  list: T[];
  pageInfo: PageInfo;
}


export const getHeaders = (): HeadersInit => ({
  "xc-token": TOKEN || "",
  "Content-Type": "application/json",
});


export const getBaseUrl = (tableId: string): string =>
  `${BASE_URL}/api/v3/data/${PROJECT_ID}/${tableId}/records`;


export const handleError = (error: unknown): never => {
  if (error instanceof Response) {
    switch (error.status) {
      case 401:
        throw new Error("Token inválido o expirado");
      case 403:
        throw new Error("Sin permisos para realizar esta acción");
      case 404:
        throw new Error("Registro no encontrado");
      case 422:
        throw new Error("Datos inválidos");
      case 429:
        throw new Error("Demasiadas solicitudes. Espere 30 segundos y reintente");
      case 500:
        throw new Error("Error en el servidor");
      default:
        throw new Error(`Error desconocido: ${error.status}`);
    }
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error("Error desconocido");
};


export async function getRecords<T>(
  tableId: string,
  params?: {
    where?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    fields?: string;
  }
): Promise<NocoDBResponse<T>> {
  const url = new URL(getBaseUrl(tableId));

  if (params?.where) url.searchParams.append("where", params.where);
  if (params?.limit) url.searchParams.append("limit", params.limit.toString());
  if (params?.offset) url.searchParams.append("offset", params.offset.toString());
  if (params?.sort) url.searchParams.append("sort", params.sort);
  if (params?.fields) url.searchParams.append("fields", params.fields);
  
  const response = await fetchWithThrottle(url.toString(), {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) handleError(response);

  const data = await response.json();
  
  
  
  const records = data.records || [];
  const totalRows = records.length;
  
  return {
    list: records,
    pageInfo: {
      totalRows,
      page: 1,
      pageSize: totalRows,
      isFirstPage: true,
      isLastPage: !data.nestedNext,
    },
  };
}


export async function getOne<T>(tableId: string, id: number): Promise<T> {
  const url = `${getBaseUrl(tableId)}/${id}`;

  const response = await fetchWithThrottle(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) handleError(response);

  return response.json();
}


export async function findOne<T>(
  tableId: string,
  where: string
): Promise<T | null> {
  const result = await getRecords<T>(tableId, {
    where,
    limit: 1,
    sort: "-Id",
  });

  return result.list.length > 0 ? result.list[0] : null;
}


export async function createRecord<T>(
  tableId: string,
  data: Partial<T>
): Promise<T> {
  const url = getBaseUrl(tableId);

  const response = await fetchWithThrottle(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) handleError(response);

  return response.json();
}


export async function updateRecord<T>(
  tableId: string,
  id: number,
  data: Partial<T>
): Promise<T> {
  const url = `${getBaseUrl(tableId)}/${id}`;

  const response = await fetchWithThrottle(url, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) handleError(response);

  return response.json();
}


export async function deleteRecord(
  tableId: string,
  id: number
): Promise<void> {
  const url = getBaseUrl(tableId);

  const response = await fetchWithThrottle(url, {
    method: "DELETE",
    headers: getHeaders(),
    body: JSON.stringify({ id }),
  });

  if (!response.ok) handleError(response);
}
