import { fetchWithThrottle } from "./core/client";

const TABLE_INVENTARIO = import.meta.env.VITE_TABLE_INVENTARIO;


export async function obtenerInventario(search?: string) {
  let url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_INVENTARIO}/records`;
  
  if (search) {
    url += `?where=(articulo,like,${encodeURIComponent('%' + search + '%')})~or(sku,like,${encodeURIComponent('%' + search + '%')})~or(Categoria,like,${encodeURIComponent('%' + search + '%')})`;
  }
  
  const response = await fetchWithThrottle(url, {
    headers: {
      'xc-token': import.meta.env.VITE_NOCODB_TOKEN
    }
  });
  if (!response.ok) {
    throw new Error('Error al obtener inventario');
  }
  return response.json();
}


export async function crearInventario(data: {
  articulo: string;
  sku: string;
  Categoria: string;
  Actual: number;
  Minimo: number;
  unidad: string;
}) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_INVENTARIO}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({
        fields: {
          articulo: data.articulo,
          sku: data.sku,
          Categoria: data.Categoria,
          Actual: data.Actual,
          Minimo: data.Minimo,
          unidad: data.unidad
        }
      })
    }
  );
  if (!response.ok) {
    throw new Error('Error al crear item de inventario');
  }
  return response.json();
}


export async function actualizarInventario(id: string, data: {
  articulo: string;
  sku: string;
  Categoria: string;
  Actual: number;
  Minimo: number;
  unidad: string;
}) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_INVENTARIO}/records`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({
        id,
        fields: {
          articulo: data.articulo,
          sku: data.sku,
          Categoria: data.Categoria,
          Actual: data.Actual,
          Minimo: data.Minimo,
          unidad: data.unidad
        }
      })
    }
  );
  if (!response.ok) {
    throw new Error('Error al actualizar item de inventario');
  }
  return response.json();
}


export async function eliminarInventario(id: string) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_INVENTARIO}/records/${id}`,
    {
      method: 'DELETE',
      headers: {
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      }
    }
  );
  if (!response.ok) {
    throw new Error('Error al eliminar item de inventario');
  }
  return response.json();
}
