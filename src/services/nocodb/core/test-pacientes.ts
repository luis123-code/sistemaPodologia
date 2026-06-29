/**
 * Ejemplo de uso del servicio de pacientes
 * Para probar la conexión con NocoDB
 */

import { listarPacientes, crearPaciente } from "../pacientes.service";

async function testPacientes() {
  try {
    console.log("Listando pacientes...");
    const result = await listarPacientes({ limit: 5 });
    console.log("Pacientes encontrados:", result.list);
    console.log("Total:", result.pageInfo.totalRows);
  } catch (error) {
    console.error("Error al listar pacientes:", error);
  }
}

// Ejemplo de creación
async function testCrearPaciente() {
  try {
    const nuevoPaciente = await crearPaciente({
      nombre: "Juan",
      apellido: "Pérez",
      email: "juan@example.com",
      telefono: "555-1234",
      direccion: "Calle 123",
      fecha_nacimiento: "1990-01-01",
      activo: true,
    });
    console.log("Paciente creado:", nuevoPaciente);
  } catch (error) {
    console.error("Error al crear paciente:", error);
  }
}

// Descomentar para probar
// testPacientes();
// testCrearPaciente();

export { testPacientes, testCrearPaciente };
