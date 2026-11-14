/* Qué ve el sitio público (visitante sin sesión) de las rutas que comparte con el
 * dashboard. Lista de campos PERMITIDOS: una columna nueva en la tabla no sale al
 * sitio público hasta que se agregue aquí a propósito. */

export const CAMPOS_PUBLICOS = {
    // Sin RUT, correos, teléfono, usuario de Clerk, registro SIS ni estado de la firma.
    profesional: ["id_profesional", "nombreProfesional", "descripcionProfesional", "categoriaProfesional", "imagenProfesional"],
    // Solo cuándo está ocupado el profesional: el motivo es texto libre interno.
    bloqueo: ["id_bloqueo", "id_profesional", "fechaInicio", "horaInicio", "fechaFinalizacion", "horaFinalizacion"],
    // Sin paciente_id: diría públicamente quién es paciente de quién.
    resena: ["id_resena", "rating", "comentario", "profesional_id", "created_at", "nombre_invitado", "apellido_invitado"],
    // Solo si la clínica cobra con Mercado Pago. NUNCA el access_token.
    pasarela: ["estado_pasarela"],
};

export const soloCampos = (filas, campos) =>
    (Array.isArray(filas) ? filas : []).map((fila) => Object.fromEntries(campos.map((campo) => [campo, fila?.[campo]])));
