


export { wb } from "./whereBuilder";


export {
  getRecords,
  getOne,
  createRecord,
  updateRecord,
  deleteRecord,
  fetchWithThrottle,
} from "./client";
export type { PageInfo, NocoDBResponse } from "./client";


export type { Paciente, HistorialMedico, Cita } from "./types";


import {
  listarPacientes,
  obtenerPaciente,
  buscarPaciente,
  crearPaciente,
  actualizarPaciente,
  desactivarPaciente,
  eliminarPaciente,
  pacientesActivos,
  buscarPacientePorNombre,
  buscarPacientePorCampo,
  actualizarPacienteV3,
} from "../pacientes.service";

export {
  listarPacientes,
  obtenerPaciente,
  buscarPaciente,
  crearPaciente,
  actualizarPaciente,
  desactivarPaciente,
  eliminarPaciente,
  pacientesActivos,
  buscarPacientePorNombre,
  buscarPacientePorCampo,
  actualizarPacienteV3,
} from "../pacientes.service";

export const pacientesService = {
  listar: listarPacientes,
  obtener: obtenerPaciente,
  buscar: buscarPaciente,
  buscarPorNombre: buscarPacientePorNombre,
  buscarPorCampo: buscarPacientePorCampo,
  crear: crearPaciente,
  actualizar: actualizarPaciente,
  desactivar: desactivarPaciente,
  eliminar: eliminarPaciente,
  activos: pacientesActivos,
};

import {
  historialDePaciente,
  ultimoRegistro,
  crearRegistro,
  actualizarRegistro,
  eliminarRegistro,
  historialPorCita,
} from "../historialMedico.service";

export {
  historialDePaciente,
  ultimoRegistro,
  crearRegistro,
  actualizarRegistro,
  eliminarRegistro,
  historialPorCita,
} from "../historialMedico.service";

export const historialMedicoService = {
  dePaciente: historialDePaciente,
  ultimo: ultimoRegistro,
  crear: crearRegistro,
  actualizar: actualizarRegistro,
  eliminar: eliminarRegistro,
};

import {
  listarCitas,
  citasDeHoy,
  citasDePaciente,
  citasPorEstado,
  citasActivas,
  crearCita,
  cambiarEstado,
  cancelarCita,
  actualizarCita,
  eliminarCita,
  eliminarAsociacionPaciente,
  crearAsociacionPaciente,
  crearCitaV3,
  actualizarCitaV3,
  citasPorPacienteAsociado,
} from "../citas.service";

export {
  listarCitas,
  citasDeHoy,
  citasDePaciente,
  citasPorEstado,
  citasActivas,
  crearCita,
  cambiarEstado,
  cancelarCita,
  actualizarCita,
  eliminarCita,
  eliminarAsociacionPaciente,
  crearAsociacionPaciente,
  crearCitaV3,
  actualizarCitaV3,
  citasPorPacienteAsociado,
} from "../citas.service";

export const citasService = {
  listar: listarCitas,
  deHoy: citasDeHoy,
  dePaciente: citasDePaciente,
  porEstado: citasPorEstado,
  activas: citasActivas,
  crear: crearCita,
  cambiarEstado: cambiarEstado,
  cancelar: cancelarCita,
  actualizar: actualizarCita,
  eliminar: eliminarCita,
};


export { usePacientes } from "./usePacientes";
export { useCitas, useCitasDeHoy } from "./useCitas";
