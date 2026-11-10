/* Autor de una ficha clínica y quién puede verla (Ley 20.584, reserva de la ficha).
 *
 * La tabla fichaClinica no guarda el id del profesional: el autor va como texto en
 * `observaciones` ("Nombre · RUT: 12.345.678-9"). Misma regla que el front
 * (src/lib/profesional.js → profesionalDeRegistro): el RUT identifica a la persona y
 * el nombre desempata si dos profesionales comparten RUT; si no calza, nadie.
 *
 * Regla de acceso (decidida con el usuario, 10-11-2026): un profesional ve solo las
 * fichas que escribió él; la administración del centro ve todas; el resto, ninguna. */

import { limpiarRut } from "./firma/rut.js";
import { esAdministrador, esProfesional } from "./firma/roles.js";
import Profesionales from "../model/Profesionales.js";

const normalizarNombre = (texto) => String(texto ?? "").trim().toLowerCase().replace(/\s+/g, " ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "Nombre · RUT: 12.345.678-9" → { nombre, rut } */
export function separarNombreYRut(texto) {
    const limpio = String(texto ?? "").trim();
    const m = limpio.match(/^(.*?)\s*[·|-]\s*RUT:?\s*(.+)$/i);
    return m ? { nombre: m[1].trim(), rut: m[2].trim() } : { nombre: limpio, rut: "" };
}

export function profesionalDeRegistro(profesionales, nombre, rut) {
    if (!Array.isArray(profesionales)) return null;
    const buscado = limpiarRut(rut);
    const conRut = buscado ? profesionales.filter((p) => limpiarRut(p.rutProfesional) === buscado) : [];
    const porNombre = (lista) => lista.find((p) => normalizarNombre(p.nombreProfesional) === normalizarNombre(nombre)) || null;
    if (conRut.length === 1) return conRut[0];
    if (conRut.length > 1) return normalizarNombre(nombre) ? porNombre(conRut) : null;
    return normalizarNombre(nombre) ? porNombre(profesionales) : null;
}

/** "12.345.678-9" a partir de cualquier formato. */
export function formatearRut(rut) {
    const limpio = limpiarRut(rut);
    if (limpio.length < 2) return String(rut ?? "");
    const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${cuerpo}-${limpio.slice(-1)}`;
}

/** Etiqueta que se guarda como autor: igual que etiquetaProfesionalConRut del front. */
export function etiquetaAutor(profesional) {
    const nombre = String(profesional?.nombreProfesional ?? "").trim();
    const rut = profesional?.rutProfesional ? formatearRut(profesional.rutProfesional) : "";
    return rut ? `${nombre} · RUT: ${rut}` : nombre;
}

/**
 * Deja solo las fichas que el usuario puede ver. Una sola consulta de profesionales
 * por petición (no por ficha).
 */
export async function fichasVisibles(usuario, fichas) {
    if (!Array.isArray(fichas) || fichas.length === 0) return [];
    if (esAdministrador(usuario)) return fichas;
    if (!esProfesional(usuario) || !usuario?.idProfesional) return [];
    const profesionales = await new Profesionales().seleccionarProfesionales();
    return fichas.filter((f) => {
        const { nombre, rut } = separarNombreYRut(f.observaciones);
        return Number(profesionalDeRegistro(profesionales, nombre, rut)?.id_profesional) === Number(usuario.idProfesional);
    });
}

/** Profesional (fila completa) de la sesión, o null. */
export async function profesionalDeUsuario(usuario) {
    if (!usuario?.idProfesional) return null;
    return (await new Profesionales().seleccionarProfesionalPorID(usuario.idProfesional))?.[0] || null;
}
