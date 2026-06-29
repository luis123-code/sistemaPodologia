

import { useState, useCallback, useEffect } from "react";
import {
  listarPacientes,
  obtenerPaciente,
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente,
  buscarPaciente,
  contarPacientes,
} from "../pacientes.service";
import type { Paciente } from "./types";

interface UsePacientesParams {
  page?: number;
  limit?: number;
  search?: string;
  activo?: boolean;
}

interface UsePacientesReturn {
  pacientes: Paciente[];
  loading: boolean;
  error: string | null;
  total: number;
  totalCount: number;
  pagina: number;
  cargar: (params?: UsePacientesParams) => Promise<void>;
  crear: (data: Omit<Paciente, "Id" | "creado_en">) => Promise<Paciente>;
  actualizar: (id: number, data: Partial<Paciente>) => Promise<Paciente>;
  eliminar: (id: number) => Promise<void>;
  buscar: (texto: string) => Promise<void>;
  recargar: () => Promise<void>;
}

export function usePacientes(initialParams?: UsePacientesParams): UsePacientesReturn {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pagina, setPagina] = useState(initialParams?.page || 1);
  const [currentParams, setCurrentParams] = useState<UsePacientesParams>(initialParams || {});

  const cargar = useCallback(async (params?: UsePacientesParams) => {
    setLoading(true);
    setError(null);
    try {
      const finalParams = { ...currentParams, ...params };
      setCurrentParams(finalParams);
      const result = await listarPacientes(finalParams);
      setPacientes(result?.list || []);
      setTotal(result?.pageInfo?.totalRows || 0);
      setPagina(finalParams.page || 1);
      
      
      const countResult = await contarPacientes();
      setTotalCount(countResult?.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar pacientes");
      setPacientes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentParams]);

  const crear = useCallback(async (data: Omit<Paciente, "Id" | "creado_en">) => {
    setLoading(true);
    setError(null);
    try {
      const nuevo = await crearPaciente(data);
      await cargar();
      return nuevo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear paciente");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cargar]);

  const actualizar = useCallback(async (id: number, data: Partial<Paciente>) => {
    setLoading(true);
    setError(null);
    try {
      const actualizado = await actualizarPaciente(id, data);
      await cargar();
      return actualizado;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar paciente");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cargar]);

  const eliminar = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await eliminarPaciente(id);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar paciente");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cargar]);

  const buscar = useCallback(async (texto: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await buscarPaciente(texto);
      setPacientes(result.list);
      setTotal(result.pageInfo.totalRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar pacientes");
    } finally {
      setLoading(false);
    }
  }, []);

  const recargar = useCallback(async () => {
    await cargar();
  }, [cargar]);

  
  useEffect(() => {
    cargar(initialParams);
  }, []); 

  return {
    pacientes,
    loading,
    error,
    total,
    totalCount,
    pagina,
    cargar,
    crear,
    actualizar,
    eliminar,
    buscar,
    recargar,
  };
}
