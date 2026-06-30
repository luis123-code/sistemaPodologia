import { fetchWithThrottle } from "./core/client";

const TABLE_SERVICIOS = import.meta.env.VITE_TABLE_SERVICIOS;


export async function obtenerServicios(tipoCatologo?: string, search?: string) {
  let url = `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_SERVICIOS}/records`;
  
  if (tipoCatologo || search) {
    let whereConditions: string[] = [];
    
    if (tipoCatologo) {
      whereConditions.push(`(tipoCatologo,eq,${tipoCatologo})`);
    }
    
    if (search) {
      whereConditions.push(`(servicio,like,${encodeURIComponent('%' + search + '%')})`);
    }
    
    url += `?where=${whereConditions.join('~and')}`;
  }
  
  const response = await fetchWithThrottle(url, {
    headers: {
      'xc-token': import.meta.env.VITE_NOCODB_TOKEN
    }
  });
  if (!response.ok) {
    throw new Error('Error al obtener servicios');
  }
  return response.json();
}


export async function crearServicio(data: {
  servicio: string;
  tipoCatologo: string;
  descripcion: string;
  duracion: string; 
  precio: number;
}) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_SERVICIOS}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({
        fields: {
          servicio: data.servicio,
          tipoCatologo: data.tipoCatologo,
          descripcion: data.descripcion,
          duracion: data.duracion,
          precio: data.precio
        }
      })
    }
  );
  if (!response.ok) {
    throw new Error('Error al crear servicio');
  }
  return response.json();
}


export async function actualizarServicio(id: string, data: {
  servicio: string;
  tipoCatologo: string;
  descripcion: string;
  duracion: string; 
  precio: number;
}) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_SERVICIOS}/records`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN
      },
      body: JSON.stringify({
        id,
        fields: {
          servicio: data.servicio,
          tipoCatologo: data.tipoCatologo,
          descripcion: data.descripcion,
          duracion: data.duracion,
          precio: data.precio
        }
      })
    }
  );
  if (!response.ok) {
    throw new Error('Error al actualizar servicio');
  }
  return response.json();
}


export async function eliminarServicio(id: string) {
  const response = await fetchWithThrottle(
    `${import.meta.env.VITE_NOCODB_URL}/api/v3/data/${import.meta.env.VITE_NOCODB_PROJECT_ID}/${TABLE_SERVICIOS}/records`,
    {
      method: 'DELETE',
      headers: {
        'xc-token': import.meta.env.VITE_NOCODB_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id })
    }
  );
  if (!response.ok) {
    throw new Error('Error al eliminar servicio');
  }
  return response.json();
}
