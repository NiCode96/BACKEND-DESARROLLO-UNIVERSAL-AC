/* Roles de Clerk (publicMetadata.role), con la misma lógica que el front
 * (src/lib/dashboard-access.js). Si cambian allá, cambiar aquí.
 *
 *  - Administra la clínica: el técnico NativeCode, los perfiles "admin-*" y un
 *    profesional con el interruptor "También administra" (rol "profesional-x+admin").
 *  - Profesional dueño: el usuario cuyo publicMetadata.idProfesionalAgenda es el
 *    profesional del documento o de la firma.
 *  - Un rol vacío o desconocido NO da acceso (nunca se asume administrador). */

const ROL_TECNICO = "tecnico-nativecode";
const SUFIJO_ADMIN = "+admin";

const PERFILES_ADMINISTRADOR = new Set([
    "admin-centro-salud", "admin-clinica-medica", "admin-clinica-odontologica",
    "admin-centro-oftalmologico", "admin-centro-estetico", "admin-clinica",
]);

const PERFILES_PROFESIONALES = new Set([
    "profesional-salud", "profesional-medico", "profesional-odontologo",
    "profesional-matrona", "profesional-oftalmologia", "profesional-estetica",
]);

const ROL_RECEPCION = "recepcion";

// Valores antiguos guardados en Clerk → perfil vigente.
const ALIAS = {
    admin: ROL_TECNICO, default: ROL_TECNICO, "super-usuario-nativecode": ROL_TECNICO,
    "administrador-clinico": "admin-clinica", configuracion: "admin-clinica",
    "operador-clinico": "profesional-salud", basico: "profesional-salud", agenda: "profesional-salud",
    "operador-medico": "profesional-medico", "clinico-medico": "profesional-medico",
    "operador-odontologico": "profesional-odontologo", odontologico: "profesional-odontologo",
    oftalmologia: "profesional-oftalmologia", "centro-estetico": "profesional-estetica",
    secretaria: ROL_RECEPCION, recepcionista: ROL_RECEPCION, cancelado: "suspendido",
};

function separar(rol) {
    const texto = String(rol || "").trim().toLowerCase();
    return texto.endsWith(SUFIJO_ADMIN)
        ? { base: texto.slice(0, -SUFIJO_ADMIN.length), administra: true }
        : { base: texto, administra: false };
}

function perfil(rol) {
    const { base, administra } = separar(rol);
    const vigente = ALIAS[base] || base;
    return { base: vigente, administra: administra && PERFILES_PROFESIONALES.has(vigente) };
}

export const esTecnico = (usuario) => perfil(usuario?.rol).base === ROL_TECNICO;

export function esAdministrador(usuario) {
    const { base, administra } = perfil(usuario?.rol);
    return base === ROL_TECNICO || PERFILES_ADMINISTRADOR.has(base) || administra;
}

export const esProfesional = (usuario) => PERFILES_PROFESIONALES.has(perfil(usuario?.rol).base);

/** Roles que trabajan con fichas clínicas: administradores y profesionales (no recepción). */
export const esRolClinico = (usuario) => esAdministrador(usuario) || esProfesional(usuario);

export const esProfesionalDueno = (usuario, idProfesional) =>
    usuario?.idProfesional != null && Number(usuario.idProfesional) === Number(idProfesional);
