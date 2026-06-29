

import { listarPacientes, crearPaciente } from "../pacientes.service";

async function testPacientes() {
  try {
    const result = await listarPacientes({ limit: 5 });
  } catch (error) {
  }
}


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
  } catch (error) {
  }
}





export { testPacientes, testCrearPaciente };
