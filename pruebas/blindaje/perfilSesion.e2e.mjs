/*
    Sesión con perfil: un token válido de Clerk NO basta. Si el registro de la instancia
    de Clerk queda en "Public", cualquiera se crea una cuenta y obtiene un token válido
    sin perfil; esa cuenta debe recibir 403 en todo lo protegido.

    Middlewares reales (exigirSesionClerk y exigirUsuarioClerk); Clerk y la base se SIMULAN.
    No necesita base de datos:
      node --experimental-test-module-mocks --test pruebas/blindaje/perfilSesion.e2e.mjs
*/
import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import express from "express";

process.env.CLERK_SECRET_KEY = "sk_test_falsa";
process.env.CLERK_TIEMPO_LIMITE_MS = "300";

// token "t:<idUsuario>" → sesión de ese usuario; cualquier otro token es inválido.
const PERFILES = {
    sinPerfil: undefined,
    vacio: "",
    suspendido: "suspendido",
    cancelado: "cancelado",          // alias antiguo de "suspendido"
    sinAcceso: "sin-acceso",
    inventado: "super-admin",
    tecnico: "tecnico-nativecode",
    aliasTecnico: "admin",           // alias antiguo del técnico
    admin: "admin-clinica",
    medico: "profesional-medico",
    medicoAdmin: "profesional-medico+admin",
    recepcion: "recepcion",
    secretaria: "secretaria",        // alias antiguo de recepción
    clerkLento: "admin-clinica",
};
const registrados = [];

mock.module("@clerk/backend", {
    namedExports: {
        verifyToken: async (token) => {
            if (!String(token).startsWith("t:")) throw new Error("token inválido");
            return { sub: token.slice(2), sid: "sess_prueba" };
        },
        createClerkClient: () => ({
            users: {
                getUser: async (id) => {
                    if (id === "clerkLento") await new Promise((r) => setTimeout(r, 1000));
                    const role = PERFILES[id];
                    return { firstName: id, publicMetadata: role === undefined ? {} : { role }, emailAddresses: [] };
                },
            },
        }),
    },
});
mock.module("../../model/UsuarioPlataforma.js", {
    defaultExport: class { async asegurar({ clerkId }) { registrados.push(clerkId); return 1; } },
});

const { exigirSesionClerk } = await import("../../middleware/exigirSesionClerk.js");
const { exigirUsuarioClerk } = await import("../../middleware/exigirUsuarioClerk.js");

const app = express();
app.get("/sesion", exigirSesionClerk, (_req, res) => res.json({ ok: true }));
app.get("/usuario", exigirUsuarioClerk, (req, res) => res.json({ ok: true, rol: req.usuario.rol }));
let servidor, base;
before(async () => {
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor?.close());

const pedir = (ruta, token) => fetch(`${base}${ruta}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});

for (const ruta of ["/sesion", "/usuario"]) {
    test(`${ruta}: sin token o con token inválido → 401`, async () => {
        assert.equal((await pedir(ruta)).status, 401);
        assert.equal((await pedir(ruta, "falso")).status, 401);
    });

    for (const id of ["sinPerfil", "vacio", "suspendido", "cancelado", "sinAcceso", "inventado"]) {
        test(`${ruta}: token válido con perfil "${PERFILES[id] ?? "(ninguno)"}" → 403`, async () => {
            const r = await pedir(ruta, `t:${id}`);
            assert.equal(r.status, 403);
            assert.deepEqual(await r.json(), { message: "sinPermiso" });
        });
    }

    for (const id of ["tecnico", "aliasTecnico", "admin", "medico", "medicoAdmin", "recepcion", "secretaria"]) {
        test(`${ruta}: perfil "${PERFILES[id]}" → pasa`, async () => {
            const r = await pedir(ruta, `t:${id}`);
            assert.equal(r.status, 200);
        });
    }
}

test("Clerk no responde al pedir el perfil → 503 (no se deja pasar)", async () => {
    assert.equal((await pedir("/sesion", "t:clerkLento")).status, 503);
});

test("una cuenta sin perfil no queda registrada en usuario_plataforma", () => {
    for (const id of ["sinPerfil", "vacio", "suspendido", "cancelado", "sinAcceso", "inventado"]) {
        assert.equal(registrados.includes(id), false, id);
    }
    assert.equal(registrados.includes("admin"), true);
});
