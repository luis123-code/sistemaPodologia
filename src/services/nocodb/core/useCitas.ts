

import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import {
  listarCitas,
  crearCita,
  actualizarCita,
  cancelarCita,
  cambiarEstado,
  eliminarCita,
  citasDeHoy,
} from "../citas.service";
import type { Cita } from "./types";

interface UseCitasParams {
  fecha?: string;
  estado?: Cita["estado"];
  podologo?: string;
  paciente_id?: number;
}

interface UseCitasReturn {
  citas: Cita[];
  loading: boolean;
  error: string | null;
  cargar: (params?: UseCitasParams) => Promise<void>;
  crear: (data: Omit<Cita, "Id" | "creado_en">) => Promise<Cita>;
  actualizar: (id: number, data: Partial<Cita>) => Promise<Cita>;
  cancelar: (id: number) => Promise<void>;
  cambiarEstado: (id: number, estado: Cita["estado"]) => Promise<void>;
  eliminar: (id: number) => Promise<void>;
  recargar: () => Promise<void>;
}

export function useCitas(initialParams?: UseCitasParams): UseCitasReturn {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<UseCitasParams>(initialParams || {});

  const cargar = useCallback(async (params?: UseCitasParams) => {
    setLoading(true);
    setError(null);
    try {
      const finalParams = { ...currentParams, ...params };
      setCurrentParams(finalParams);
      const result = await listarCitas(finalParams);
      setCitas(result.list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar citas");
    } finally {
      setLoading(false);
    }
  }, [currentParams]);

  const crear = useCallback(async (data: Omit<Cita, "Id" | "creado_en">) => {
    setLoading(true);
    setError(null);
    try {
      const nueva = await crearCita(data);
      await cargar();
      return nueva;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear cita");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cargar]);

  const actualizar = useCallback(async (id: number, data: Partial<Cita>) => {
    setLoading(true);
    setError(null);
    try {
      const actualizada = await actualizarCita(id, data);
      await cargar();
      return actualizada;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar cita");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cargar]);

  const cancelar = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await cancelarCita(id);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar cita");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cargar]);

  const cambiarEstado = useCallback(async (id: number, estado: Cita["estado"]) => {
    setLoading(true);
    setError(null);
    try {
      await cambiarEstado(id, estado);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar estado de cita");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cargar]);

  const eliminar = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await eliminarCita(id);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar cita");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cargar]);

  const recargar = useCallback(async () => {
    await cargar();
  }, [cargar]);

  
  useEffect(() => {
    cargar(initialParams);
  }, []); 

  return {
    citas,
    loading,
    error,
    cargar,
    crear,
    actualizar,
    cancelar,
    cambiarEstado,
    eliminar,
    recargar,
  };
}


export function useCitasDeHoy() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await citasDeHoy();
      setCitas(result.list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar citas de hoy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, []);

  return { citas, loading, error, recargar };
}
