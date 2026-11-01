/*
    rolesClinica.js
    Quién administra la clínica, con las MISMAS reglas que el front
    (FRONTEND/src/lib/dashboard-access.js → esAdministradorClinica):

      - el técnico NativeCode ("tecnico-nativecode" y sus alias),
      - los perfiles administrador ("admin-…"),
      - un profesional con publicMetadata.administraClinica = true.

    Recepción, profesionales sin el interruptor, suspendidos y roles
    desconocidos NO administran. Si se agrega un perfil allá, hay que agregarlo
    aquí o el backend lo rechazará (falla cerrado, nunca abierto).

    Funciones puras: se prueban en pruebas/datosEmpresa/.
*/

export const ROL_TECNICO = "tecnico-nativecode";

const PERFILES_ADMINISTRADOR = new Set([
    "admin-centro-salud",
    "admin-clinica-medica",
    "admin-clinica-odontologica",
    "admin-centro-oftalmologico",
    "admin-centro-estetico",
    "admin-clinica",
]);

const PERFILES_PROFESIONALES = new Set([
    "profesional-salud",
    "profesional-medico",
    "profesional-odontologo",
    "profesional-matrona",
    "profesional-oftalmologia",
    "profesional-estetica",
]);

// Nombres antiguos que todavía pueden estar en Clerk (mismo mapa que el front)
const ALIAS_ROLES = {
    admin: ROL_TECNICO,
    default: ROL_TECNICO,
    "super-usuario-nativecode": ROL_TECNICO,
    "administrador-clinico": "admin-clinica",
    configuracion: "admin-clinica",
    "operador-clinico": "profesional-salud",
    basico: "profesional-salud",
    agenda: "profesional-salud",
    "operador-medico": "profesional-medico",
    "clinico-medico": "profesional-medico",
    "operador-odontologico": "profesional-odontologo",
    odontologico: "profesional-odontologo",
    oftalmologia: "profesional-oftalmologia",
    "centro-estetico": "profesional-estetica",
};

export function normalizarRol(rol) {
    const base = String(rol ?? "").trim().toLowerCase().replace(/\+admin$/, "");
    // hasOwn: "constructor" o "__proto__" no deben resolverse a propiedades heredadas
    return Object.hasOwn(ALIAS_ROLES, base) ? ALIAS_ROLES[base] : base;
}

/* metadata = publicMetadata del usuario de Clerk ({ role | rol, administraClinica }) */
export function esAdministradorClinica(metadata) {
    if (!metadata || typeof metadata !== "object") return false;
    const crudo = metadata.role ?? metadata.rol;
    // Solo texto: un arreglo ["admin-clinica"] se convertiría en "admin-clinica" con String()
    if (typeof crudo !== "string") return false;
    const rol = normalizarRol(crudo);
    if (rol === ROL_TECNICO || PERFILES_ADMINISTRADOR.has(rol)) return true;
    const administra = metadata.administraClinica === true || metadata.administraClinica === "true"
        || crudo.trim().toLowerCase().endsWith("+admin");
    return administra && PERFILES_PROFESIONALES.has(rol);
}
