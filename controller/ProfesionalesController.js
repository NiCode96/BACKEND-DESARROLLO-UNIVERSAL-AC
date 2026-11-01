import Profesionales from '../model/Profesionales.js';
import { CODIGO_CATEGORIA_INVALIDA, SIN_CAMBIO, normalizarCategoriaProfesional } from '../services/categoriaProfesional.js';

// Categoría: undefined = no vino (se conserva al editar); lanza CATEGORIA_INVALIDA si no sirve
function leerCategoria(body) {
    return normalizarCategoriaProfesional(body?.categoriaProfesional);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// correo_profesional es opcional (no todos los profesionales lo cargan de inmediato),
// pero si viene, debe tener formato válido para no guardar basura que luego rompa el envío del .ics.
// valor: null significa "guardar vacío" (el cliente mandó "" o null explícito).
function normalizarCorreoProfesional(correo_profesional) {
    const valor = String(correo_profesional).trim();
    if (!valor) return { ok: true, valor: null };
    if (!EMAIL_REGEX.test(valor)) return { ok: false, valor: null };
    return { ok: true, valor };
}

export default class ProfesionalesController {

    constructor() {
    }

    //FUNCION PARA INSERTAR UN NUEVO PROFESIONAL
    static async insertarProfesionalController(req, res) {
        try{
            const {
                nombreProfesional,
                descripcionProfesional,
                correoContacto,
                numeroTelefono,
                rutProfesional
            } = req.body;

            // Sin req.body: trae RUT, teléfono y correo (Ley 21.719). Solo qué operación y quién.
            console.log(`[profesionales] ${req.path} · usuario=${req.sesionClerk?.sub ?? "sin-sesion"}`);

            if (!nombreProfesional || !descripcionProfesional || !correoContacto || !numeroTelefono || !rutProfesional ) {
                return res.status(400).json({ message: "sindata" });
            }

            let categoriaProfesional;
            try {
                categoriaProfesional = leerCategoria(req.body);
            } catch (error) {
                if (error.code === CODIGO_CATEGORIA_INVALIDA) return res.status(400).json({ message: "categoria-invalida" });
                throw error;
            }

            const profesionalClass = new Profesionales();
            const resultado = await profesionalClass.insertarProfesionalModel(
                nombreProfesional,
                descripcionProfesional,
                correoContacto,
                numeroTelefono,
                rutProfesional,
                categoriaProfesional === SIN_CAMBIO ? null : categoriaProfesional
            );
            if (resultado.affectedRows > 0) {
                res.status(200).json({ message: true });
            }else {
                res.status(500).json({ message: false });
            }
        }catch (error) {
            res.status(500).json({ message: "serverError" + error });
        }

    }

    static async actualizarProfesionalController(req, res) {
        try{
            const {
                nombreProfesional,
                descripcionProfesional,
                correoContacto,
                numeroTelefono,
                rutProfesional,
                id_profesional
            } = req.body;

            // Sin req.body: trae RUT, teléfono y correo (Ley 21.719). Solo qué operación y quién.
            console.log(`[profesionales] ${req.path} · usuario=${req.sesionClerk?.sub ?? "sin-sesion"}`);

            if (!nombreProfesional ||
                !descripcionProfesional ||
                !id_profesional  ||
                !correoContacto ||
                !numeroTelefono ||
                !rutProfesional ) {
                return res.status(400).json({ message: "sindata" });
            }

            let categoriaProfesional;
            try {
                categoriaProfesional = leerCategoria(req.body);
            } catch (error) {
                if (error.code === CODIGO_CATEGORIA_INVALIDA) return res.status(400).json({ message: "categoria-invalida" });
                throw error;
            }

            const profesionalClass = new Profesionales();
            const resultado = await profesionalClass.actualizarProfesionalModel(
                nombreProfesional,
                descripcionProfesional,
                correoContacto,
                numeroTelefono,
                rutProfesional,
                id_profesional,
                categoriaProfesional === SIN_CAMBIO ? undefined : categoriaProfesional
            );

            if (resultado.affectedRows > 0) {
                res.status(200).json({ message: true });
            }else {
                res.status(500).json({ message: false });
            }
        }catch (error) {
            res.status(500).json({ message: "serverError" });
        }
    }


    //FUNCION PARA SELECCIONAR POR ID UN NUEVO PROFESIONAL
    static async seleccionarProfesionalController(req, res) {
        try{
            const {id_profesional} = req.body;
            if (!id_profesional) {
                return res.status(400).json({ message: "sindata" });
            }
            const profesionalClass = new Profesionales();
            const resultado = await profesionalClass.seleccionarProfesionalPorID(id_profesional);

            if (resultado) {
                res.status(200).json(resultado);
            }else {
                res.status(500).json({ message: false });
            }
        }catch (error) {
            res.status(500).json({ message: "serverError" });
        }


    }
    //FUNCION PARA ELIMINAR LOGICAMENTE CAMBIANDO ESTADO DE CERO A UNO UN PROFESIONAL
    static async eliminarProfesionalController(req, res) {
        try {
            const {id_profesional} = req.body;
            if (!id_profesional) {
                return res.status(400).json({message: "sindata"});
            }
            const profesionalClass = new Profesionales();
            const resultado = await profesionalClass.eliminarProfesionalPorId(id_profesional);

            if (resultado.affectedRows > 0) {
                res.status(200).json({message: true});
            } else {
                res.status(500).json({message: false});
            }
        } catch (error) {
            res.status(500).json({message: "serverError"});
        }
    }


    //FUNCION PARA SELECCIONAR LISTADO DE PROFESIONALES
    static async seleccionarTodosLosProfesionales(req, res) {
        try{
            const profesionalClass = new Profesionales();
            const resultado = await profesionalClass.seleccionarProfesionales();

            if (resultado) {
                res.status(200).json(resultado);
            } else {
                res.status(500).json({message: false});
            }
        } catch (error) {
            res.status(500).json({message: "serverError"});
        }
    }

}