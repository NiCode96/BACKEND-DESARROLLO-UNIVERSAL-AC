import Profesionales from '../model/Profesionales.js';

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

            console.log(`PROFESIONALES ENVIANDOS DESDE EL ENDPOINT:`);
            console.log(req.body);

            if (!nombreProfesional || !descripcionProfesional || !correoContacto || !numeroTelefono || !rutProfesional ) {
                return res.status(400).json({ message: "sindata" });
            }

            const profesionalClass = new Profesionales();
            const resultado = await profesionalClass.insertarProfesionalModel(
                nombreProfesional,
                descripcionProfesional,
                correoContacto,
                numeroTelefono,
                rutProfesional
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

            console.log(`PROFESIONALES ENVIANDOS DESDE EL ENDPOINT:`);
            console.log(req.body);

            if (!nombreProfesional ||
                !descripcionProfesional ||
                !id_profesional  ||
                !correoContacto ||
                !numeroTelefono ||
                !rutProfesional ) {
                return res.status(400).json({ message: "sindata" });
            }

            const profesionalClass = new Profesionales();
            const resultado = await profesionalClass.actualizarProfesionalModel(
                nombreProfesional,
                descripcionProfesional,
                correoContacto,
                numeroTelefono,
                rutProfesional,
                id_profesional
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