SET NAMES utf8mb4;

-- Generado desde src/lib/firma/actaAdhesion.js, src/lib/consentimientos/textosLegales.js
-- y src/lib/consentimientos/plantillasProcedimiento.js del front.
-- No editar a mano: el SHA-256 de cada texto debe coincidir con el del front.

-- acta_adhesion_fes v1 · sha256 2eea9b4647e42aa94f77fbaf1636b21a3baaf83aabbd4d1011b86d6613f14cdc
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'acta_adhesion_fes', 'acta_fes', 1, 'Acta de adhesión a firma electrónica simple',
'En conformidad con la Ley N° 19.799 sobre Documentos Electrónicos, Firma Electrónica y Servicios de Certificación de dicha Firma, y en particular con su artículo 3°, que otorga a los actos y contratos suscritos por medio de firma electrónica la misma validez y efectos que los celebrados por escrito y en soporte de papel, declaro:

- Que adopto voluntariamente el procedimiento de firma electrónica simple que {{empresa.nombre}} dispone en esta plataforma, para suscribir los documentos clínicos y administrativos que emita en el ejercicio de mi profesión.
- Que el trazo que registro es la representación gráfica de mi firma y que lo dibujé personalmente desde mi propia cuenta.
- Que cada documento que firme quedará vinculado a mi identidad mediante la verificación de mi cuenta al momento de firmar, la fecha y hora del servidor y una huella digital SHA-256 del documento, que permite detectar cualquier alteración posterior.
- Que mantendré la confidencialidad de mis credenciales de acceso, y que toda firma realizada con ellas me es atribuible, salvo que haya informado antes su pérdida o uso indebido.
- Que conozco que las recetas médicas no se firman por este medio y deben firmarse de puño y letra.
- Que puedo revocar esta adhesión en cualquier momento, sin que ello afecte la validez de los documentos firmados con anterioridad.',
'2eea9b4647e42aa94f77fbaf1636b21a3baaf83aabbd4d1011b86d6613f14cdc', 'vigente', UTC_TIMESTAMP(3));

-- tratamiento_datos v1 · sha256 7a3ef5b0d1641d96df9f207339c4d753d668fb140fa3d65f1ac34af9350b694d
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'tratamiento_datos', 'consentimiento_publico', 1, 'Política de privacidad y tratamiento de datos personales y de salud',
'Esta política le informa cómo {{empresa.nombre}} trata sus datos personales cuando reserva una hora, paga en línea o se atiende con nosotros. Se rige por la Ley N° 19.628 sobre Protección de la Vida Privada, modificada por la Ley N° 21.719, y por la Ley N° 20.584 que regula los Derechos y Deberes de los Pacientes. Léala antes de aceptar: su aceptación es libre, y la de esta política es independiente de cualquier otra.

## 1. Responsable del tratamiento
El responsable de sus datos es {{empresa.nombre}}, con domicilio en {{empresa.direccion}}, correo {{empresa.correo}} y teléfono {{empresa.telefono}}. A esos mismos datos puede dirigir cualquier consulta o solicitud sobre su información personal.

La plataforma de agenda, ficha clínica y documentos es provista por NativeCode SpA, que actúa como encargado del tratamiento: trata sus datos solo por cuenta de {{empresa.nombre}} y según sus instrucciones, bajo contrato y deber de confidencialidad, y no puede usarlos para fines propios.

## 2. Datos que tratamos
- Identificación y contacto: nombre, apellidos, RUT o número de pasaporte, correo electrónico y teléfono.
- Reserva y pago: profesional, servicio, fecha, hora, monto y estado del pago. Si paga en línea, los datos de su tarjeta los recibe directamente el procesador de pagos; nosotros no los vemos ni los guardamos.
- Salud: los antecedentes que usted entregue y los que el equipo de salud registre en su ficha clínica (diagnósticos, tratamientos, exámenes, recetas y consentimientos). La ley los califica como datos sensibles y les otorga protección reforzada.
- Respaldo de su aceptación: fecha y hora, dirección IP, navegador y la versión exacta de los textos que aceptó.

## 3. Datos obligatorios y voluntarios
Los datos de identificación y contacto son necesarios para reservar: sin ellos no podemos agendar su hora ni confirmársela. Los datos de salud son necesarios para atenderle de forma segura; si decide no entregarlos, el profesional podría no estar en condiciones de realizar ciertas prestaciones.

## 4. Finalidades
- Agendar, confirmar, reprogramar y recordarle sus horas por correo, SMS o WhatsApp.
- Procesar el pago de su reserva, cuando corresponda.
- Llevar su ficha clínica y prestarle la atención de salud que solicita.
- Emitir y enviarle los documentos de su atención: presupuestos, órdenes de exámenes, recetas, indicaciones y consentimientos, incluidos los que se firman electrónicamente.
- Cumplir las obligaciones legales y sanitarias del centro y atender los requerimientos de la autoridad.

No usamos sus datos para publicidad, no elaboramos perfiles comerciales y no tomamos decisiones que le afecten basadas únicamente en un tratamiento automatizado. No vendemos ni cedemos sus datos con fines comerciales. Si quisiéramos enviarle información promocional, le pediremos una autorización aparte, que será opcional.

## 5. Bases de licitud
- Sus datos de salud: su consentimiento expreso, que otorga al marcar la casilla correspondiente, y lo necesario para la prestación de salud que solicita.
- La reserva y el pago: la ejecución de la prestación que usted pide.
- La ficha clínica y su conservación: el cumplimiento de obligaciones legales de los prestadores de salud.

## 6. Destinatarios
Solo accede a sus datos el personal del centro que lo necesita para su función, y los proveedores que nos prestan servicios como encargados de tratamiento, obligados por contrato a protegerlos y a usarlos solo para ese fin:
- Alojamiento de la plataforma, base de datos y almacenamiento de documentos.
- Autenticación de los usuarios del centro.
- Envío de correos electrónicos, SMS y mensajes de WhatsApp.
- Procesamiento de pagos en línea, cuando usted paga al reservar.

También comunicaremos sus datos cuando una ley o una autoridad competente lo exija, o a otro prestador de salud cuando usted lo solicite o sea necesario para su atención.

## 7. Transferencia internacional
Algunos de estos proveedores almacenan o procesan datos fuera de Chile. En esos casos la transferencia se hace con las garantías que exige la ley, como cláusulas contractuales que aseguran un nivel de protección adecuado.

## 8. Plazo de conservación
La ficha clínica, y los documentos y consentimientos que forman parte de ella, se conservan por un mínimo de quince años desde la última atención, como exigen la Ley N° 20.584 y su reglamento. Los demás datos se conservan mientras sean necesarios para las finalidades indicadas y para atender reclamos, y después se eliminan o anonimizan.

## 9. Seguridad
Aplicamos medidas técnicas y organizativas proporcionales al riesgo: acceso restringido según la función de cada persona, autenticación de los usuarios, cifrado de las comunicaciones y del almacenamiento, registro de cada acceso a los documentos, respaldos y deber de confidencialidad de todo el personal. Si ocurre una vulneración de seguridad que afecte sus datos, la comunicaremos a la Agencia de Protección de Datos Personales y, cuando corresponda, a usted, en los términos que establece la ley.

## 10. Sus derechos
En cualquier momento, y en forma gratuita, puede:
- Acceder a sus datos y saber cómo los tratamos.
- Rectificarlos si son inexactos, están desactualizados o incompletos.
- Solicitar su supresión cuando ya no sean necesarios o retire su consentimiento, salvo los que la ley nos obliga a conservar, como la ficha clínica durante su plazo legal.
- Oponerse a determinados tratamientos.
- Solicitar la portabilidad de sus datos en un formato estructurado y de uso común.
- Solicitar el bloqueo temporal de sus datos mientras se resuelve una solicitud.

Para ejercerlos, escriba a {{empresa.correo}} indicando su nombre, RUT o pasaporte y lo que solicita. Podremos pedirle que acredite su identidad. Le responderemos dentro de los plazos que fija la ley. Si considera que no hemos respetado sus derechos, puede reclamar ante la Agencia de Protección de Datos Personales.

Además, como paciente, tiene derecho a acceder a su ficha clínica y a obtener copia de ella conforme a la Ley N° 20.584.

## 11. Retiro del consentimiento
Puede retirar su consentimiento en cualquier momento, sin expresión de causa, escribiendo a {{empresa.correo}}. El retiro rige desde que lo comunica: no afecta el tratamiento realizado antes ni los datos que la ley nos obliga a conservar.

## 12. Niñas, niños, adolescentes y personas representadas
Los datos de niñas y niños menores de 14 años, y los datos de salud de adolescentes menores de 16 años, solo se tratan con el consentimiento de su madre, padre o representante legal. Si reserva para otra persona, declara contar con la facultad legal para hacerlo y para otorgar este consentimiento en su nombre.

## 13. Cambios a esta política
Si modificamos esta política, publicaremos la nueva versión en este sitio y, cuando el cambio requiera un nuevo consentimiento, se lo pediremos antes de su próxima reserva. Cada aceptación queda asociada a la versión exacta que usted leyó.',
'7a3ef5b0d1641d96df9f207339c4d753d668fb140fa3d65f1ac34af9350b694d', 'vigente', UTC_TIMESTAMP(3));

-- derechos_deberes_paciente v1 · sha256 e8d624bfe3a2bf4b185c7485f6da483ff4ec5f44373fbeed07f707dc0c756a04
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'derechos_deberes_paciente', 'consentimiento_publico', 1, 'Derechos y deberes del paciente',
'Como paciente de {{empresa.nombre}}, la Ley N° 20.584, que regula los Derechos y Deberes de las Personas en relación con acciones vinculadas a su atención en salud, le reconoce los siguientes derechos y deberes.

## Sus derechos
- Recibir una atención oportuna y sin discriminación arbitraria, con trato digno, amable y respetuoso.
- Que se resguarde su privacidad y la confidencialidad de su información de salud durante la atención.
- Conocer el nombre y la función de quienes lo atienden.
- Recibir información clara, oportuna y comprensible sobre su estado de salud, el diagnóstico, las alternativas de tratamiento disponibles, sus riesgos y el pronóstico.
- Recibir información sobre el valor de las prestaciones y la forma de pago antes de realizarlas.
- Aceptar o rechazar libremente cualquier procedimiento o tratamiento, salvo las excepciones que establece la ley. Antes de cada procedimiento se le pedirá un consentimiento informado específico.
- Que su ficha clínica sea reservada, y acceder a ella o solicitar una copia en los términos que fija la ley.
- Ser acompañado por un familiar o persona de su confianza, según las normas del centro.
- Presentar reclamos y sugerencias, y recibir una respuesta.

## Sus deberes
- Entregar información veraz y completa sobre su identidad, su salud, sus alergias y los medicamentos que usa.
- Informarse sobre el funcionamiento del centro, sus horarios y la forma de pedir y cancelar horas.
- Tratar con respeto al equipo de salud, al personal y a los demás pacientes.
- Cuidar las instalaciones y el equipamiento del centro.
- Avisar con anticipación si no puede asistir a su hora.

## Reclamos
Puede presentar un reclamo o sugerencia escribiendo a {{empresa.correo}} o en {{empresa.direccion}}. Si no queda conforme con la respuesta, puede recurrir a la Superintendencia de Salud.',
'e8d624bfe3a2bf4b185c7485f6da483ff4ec5f44373fbeed07f707dc0c756a04', 'vigente', UTC_TIMESTAMP(3));

-- consentimiento_base v1 · sha256 defa509fe7d90c0a873dcc4fc19aec2405ea65e9c1c6baa57d521b77fa27d0b9
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'consentimiento_base', 'consentimiento_base', 1, 'Consentimiento informado',
'Yo, {{paciente.nombre}}, {{paciente.documento}}{{paciente.representacion}}, declaro que {{profesional.nombre}}{{profesional.rut}}, {{profesional.profesion}}{{profesional.registro}}, de {{empresa.nombre}}, me ha informado en forma clara, comprensible y suficiente sobre el procedimiento {{procedimiento.nombre}}, cuya información se detalla en este documento.

## Declaraciones del paciente
Declaro que:
- Se me explicó en qué consiste el procedimiento, su objetivo y los beneficios que razonablemente se pueden esperar.
- Se me informaron sus riesgos frecuentes y poco frecuentes, las alternativas disponibles y las consecuencias de no realizarlo, conforme al artículo 14 de la Ley N° 20.584.
- Tuve la oportunidad de hacer preguntas y todas fueron respondidas de forma satisfactoria.
- Informé de manera veraz mis antecedentes de salud, alergias, medicamentos que uso, embarazo o lactancia y tratamientos previos. Entiendo que ocultar información puede aumentar los riesgos.
- Comprendo que la medicina y la odontología no son ciencias exactas y que no se me ha garantizado un resultado determinado.
- Si durante el procedimiento surge una situación imprevista que lo requiera, autorizo al profesional a adoptar las medidas necesarias para resguardar mi salud.

## Anestesia local
Cuando el procedimiento lo requiera, se usará anestesia local. Puede producir adormecimiento temporal, hematoma o dolor en el sitio de punción, palpitaciones transitorias y, en forma excepcional, reacciones alérgicas o alteración prolongada de la sensibilidad.

## Revocación
Sé que puedo revocar este consentimiento en cualquier momento antes de realizar el procedimiento, sin expresión de causa, y que esa decisión no afectará mi atención futura en el centro.

## Protección de datos personales
Los datos de este documento y de mi ficha clínica son datos sensibles y serán tratados con reserva, solo para mi atención y para cumplir las obligaciones legales del centro, conforme a la Ley N° 19.628 sobre Protección de la Vida Privada, modificada por la Ley N° 21.719, y a la Ley N° 20.584. Puedo ejercer mis derechos escribiendo a {{empresa.correo}}.

## Autorización
Por lo anterior, en forma libre, voluntaria e informada, autorizo la realización del procedimiento indicado.',
'defa509fe7d90c0a873dcc4fc19aec2405ea65e9c1c6baa57d521b77fa27d0b9', 'vigente', UTC_TIMESTAMP(3));

-- anexo_toxina_botulinica v1 · sha256 0d95623302a9bc248cb293589dc4a568f7097cc28f7d8258e954f21f49532243
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_toxina_botulinica', 'anexo_procedimiento', 1, 'Armonización facial · Aplicación de toxina botulínica',
'## En qué consiste
Inyección de toxina botulínica tipo A en músculos específicos de la cara, con agujas finas, para relajar su contracción y suavizar las arrugas de expresión (frente, entrecejo, patas de gallo u otras zonas indicadas). El efecto aparece entre 3 y 14 días después y dura en promedio entre 3 y 6 meses.

## Riesgos frecuentes
- Dolor leve, enrojecimiento, hinchazón o hematoma en los puntos de inyección.
- Dolor de cabeza transitorio.
- Asimetría leve que puede requerir un ajuste.

## Riesgos poco frecuentes
- Caída transitoria del párpado o de la ceja (ptosis), que se resuelve en semanas.
- Sensación de pesadez en la frente, visión doble o sequedad ocular.
- Reacción alérgica.
- Resultado menor al esperado o ausencia de respuesta.

## Alternativas
Rellenos con ácido hialurónico, tratamientos de superficie de la piel (peeling, láser) o no realizar el tratamiento.

## Contraindicaciones
Embarazo y lactancia, enfermedades neuromusculares (miastenia gravis, síndrome de Eaton-Lambert), infección activa en la zona y alergia a la toxina o a la albúmina.

## Si no se realiza
Las arrugas de expresión siguen su evolución natural. No hay consecuencias para la salud.

## Cuidados posteriores
No acostarse ni masajear la zona durante 4 horas, evitar ejercicio intenso, calor y alcohol por 24 horas, y asistir al control indicado.',
'0d95623302a9bc248cb293589dc4a568f7097cc28f7d8258e954f21f49532243', 'vigente', UTC_TIMESTAMP(3));

-- anexo_acido_hialuronico v1 · sha256 104fc8c692c67ccbac81b98feaed5c7df1ceb093b6b75263facc827208da5647
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_acido_hialuronico', 'anexo_procedimiento', 1, 'Armonización facial · Relleno con ácido hialurónico',
'## En qué consiste
Inyección de ácido hialurónico, sustancia reabsorbible, en zonas como labios, surcos, pómulos, mentón, mandíbula u ojeras, para dar volumen, contorno o hidratación. El efecto es inmediato y dura en promedio entre 6 y 18 meses según la zona y el producto.

## Riesgos frecuentes
- Hinchazón, enrojecimiento, dolor y hematomas por varios días.
- Pequeños nódulos o irregularidades palpables, que suelen mejorar con masaje o con el tiempo.
- Asimetría.

## Riesgos poco frecuentes
- Infección o reacción inflamatoria tardía.
- Reactivación de herpes labial.
- Coloración azulada bajo la piel (efecto Tyndall).
- Oclusión vascular: el producto puede comprimir u obstruir un vaso sanguíneo y producir daño de la piel (necrosis) y, de forma excepcional, alteraciones de la visión. Es una urgencia: si nota dolor intenso, palidez o manchas en la piel, o cambios en la visión, debe avisar de inmediato. El ácido hialurónico puede disolverse con hialuronidasa.

## Alternativas
Bioestimuladores de colágeno, injerto de grasa, cirugía o no realizar el tratamiento.

## Contraindicaciones
Embarazo y lactancia, infección activa en la zona, enfermedades autoinmunes no controladas, tendencia a cicatrización anómala y alergia conocida al producto o a la lidocaína.

## Si no se realiza
Se mantiene la condición actual. No hay consecuencias para la salud.

## Cuidados posteriores
Frío local las primeras horas, evitar maquillaje por 12 horas, y calor intenso, sauna y ejercicio por 48 horas. No masajear salvo indicación.',
'104fc8c692c67ccbac81b98feaed5c7df1ceb093b6b75263facc827208da5647', 'vigente', UTC_TIMESTAMP(3));

-- anexo_bioestimuladores v1 · sha256 3112cc6b00f4221aeeee964414f3fe494935f7e561ff15afec21956da379781b
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_bioestimuladores', 'anexo_procedimiento', 1, 'Armonización facial · Bioestimuladores de colágeno',
'## En qué consiste
Inyección de sustancias como hidroxiapatita de calcio o ácido poli-L-láctico que estimulan la producción de colágeno propio, para mejorar firmeza, flacidez y calidad de la piel. El resultado es progresivo, se aprecia entre 1 y 3 meses y puede requerir varias sesiones.

## Riesgos frecuentes
- Hinchazón, enrojecimiento, dolor y hematomas transitorios.
- Sensibilidad en la zona por algunos días.

## Riesgos poco frecuentes
- Nódulos o granulomas palpables o visibles, que pueden aparecer meses después y requerir tratamiento.
- Infección.
- Oclusión vascular con daño de la piel; de forma excepcional, alteraciones visuales. A diferencia del ácido hialurónico, estos productos no se pueden disolver.
- Resultado menor al esperado.

## Alternativas
Rellenos con ácido hialurónico, tecnologías de radiofrecuencia o ultrasonido, cirugía o no realizar el tratamiento.

## Contraindicaciones
Embarazo y lactancia, infección activa, enfermedades autoinmunes no controladas y antecedente de cicatrización anómala.

## Si no se realiza
La piel sigue su envejecimiento natural. No hay consecuencias para la salud.

## Cuidados posteriores
Masaje según la indicación del profesional (en el caso del ácido poli-L-láctico, habitualmente 5 minutos, 5 veces al día, por 5 días) y evitar calor intenso por 48 horas.',
'3112cc6b00f4221aeeee964414f3fe494935f7e561ff15afec21956da379781b', 'vigente', UTC_TIMESTAMP(3));

-- anexo_hilos_tensores v1 · sha256 2134df6ebb86599716f0e020c4234d75fb5af069a77286dd385b0ba474e6d3c2
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_hilos_tensores', 'anexo_procedimiento', 1, 'Armonización facial · Hilos tensores reabsorbibles',
'## En qué consiste
Inserción bajo la piel, con cánula o aguja, de hilos reabsorbibles (polidioxanona u otros) para reposicionar tejidos y estimular colágeno en zonas con flacidez. Los hilos se reabsorben en meses y el efecto puede durar entre 6 y 18 meses.

## Riesgos frecuentes
- Hinchazón, hematomas y dolor por varios días.
- Irregularidades u hoyuelos en la piel, que suelen corregirse solos.
- Molestia al abrir la boca o al gesticular durante los primeros días.

## Riesgos poco frecuentes
- Infección, que puede requerir antibióticos o retirar el hilo.
- Asomo o palpación del hilo bajo la piel.
- Asimetría o resultado menor al esperado.
- Lesión de nervios o glándulas, generalmente transitoria.

## Alternativas
Bioestimuladores, rellenos, tecnologías de tensado no invasivas, cirugía o no realizar el tratamiento.

## Contraindicaciones
Embarazo y lactancia, infección activa, trastornos de coagulación, enfermedades autoinmunes no controladas y tendencia a cicatrización anómala.

## Si no se realiza
La flacidez sigue su evolución natural. No hay consecuencias para la salud.

## Cuidados posteriores
Evitar gesticulación exagerada, masajes faciales, tratamientos dentales prolongados y ejercicio intenso por 2 a 3 semanas. Dormir boca arriba la primera semana.',
'2134df6ebb86599716f0e020c4234d75fb5af069a77286dd385b0ba474e6d3c2', 'vigente', UTC_TIMESTAMP(3));

-- anexo_skinbooster_mesoterapia v1 · sha256 957e7663227501d75962f3f0f55b8a6e63600ed5319e43ac84b09c6ef64465ea
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_skinbooster_mesoterapia', 'anexo_procedimiento', 1, 'Armonización facial · Skinbooster y mesoterapia facial',
'## En qué consiste
Microinyecciones superficiales de ácido hialurónico no reticulado, vitaminas, aminoácidos u otros activos para mejorar hidratación, luminosidad y textura de la piel. Habitualmente requiere varias sesiones.

## Riesgos frecuentes
- Pequeñas pápulas en los puntos de inyección por 24 a 72 horas.
- Enrojecimiento, hinchazón y hematomas leves.

## Riesgos poco frecuentes
- Infección.
- Reacción alérgica.
- Reactivación de herpes.
- Nódulos persistentes.

## Alternativas
Tratamientos tópicos, peeling, láser o no realizar el tratamiento.

## Contraindicaciones
Embarazo y lactancia, infección o herpes activo en la zona y alergia a los componentes.

## Si no se realiza
No hay consecuencias para la salud.

## Cuidados posteriores
No maquillarse por 12 horas y evitar sol directo, sauna y ejercicio intenso por 48 horas. Usar protector solar.',
'957e7663227501d75962f3f0f55b8a6e63600ed5319e43ac84b09c6ef64465ea', 'vigente', UTC_TIMESTAMP(3));

-- anexo_peeling_quimico v1 · sha256 bb3fc9bebd7980eadd8741d498865adbf61400e9d1217ad6bed5d9603358f277
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_peeling_quimico', 'anexo_procedimiento', 1, 'Armonización facial · Peeling químico',
'## En qué consiste
Aplicación de uno o más agentes químicos sobre la piel para producir una exfoliación controlada, con el fin de mejorar manchas, textura, acné o fotoenvejecimiento. Según su profundidad puede producir descamación por varios días.

## Riesgos frecuentes
- Ardor y enrojecimiento durante y después de la aplicación.
- Descamación y sensibilidad por varios días.

## Riesgos poco frecuentes
- Manchas oscuras (hiperpigmentación) o claras (hipopigmentación), más probables en fototipos altos o con exposición solar.
- Infección o reactivación de herpes.
- Cicatrices, de forma excepcional.

## Alternativas
Tratamientos tópicos, láser, microdermoabrasión o no realizar el tratamiento.

## Contraindicaciones
Embarazo y lactancia, uso reciente de isotretinoína, herpes o heridas activas en la zona y exposición solar intensa reciente o prevista.

## Si no se realiza
No hay consecuencias para la salud.

## Cuidados posteriores
No arrancar la piel que se descama, hidratar según indicación y usar protector solar de amplio espectro de forma estricta.',
'bb3fc9bebd7980eadd8741d498865adbf61400e9d1217ad6bed5d9603358f277', 'vigente', UTC_TIMESTAMP(3));

-- anexo_lipolisis_inyectable v1 · sha256 e2b27395c36cf6e1741e6b34c8616a30eb2c11f7618f127b3d9962aae5f6969a
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_lipolisis_inyectable', 'anexo_procedimiento', 1, 'Armonización facial · Lipólisis inyectable (papada u otras zonas)',
'## En qué consiste
Inyección de sustancias lipolíticas, como el ácido deoxicólico, en depósitos localizados de grasa (por ejemplo, la papada) para reducir su volumen. Suele requerir entre 2 y 4 sesiones separadas por algunas semanas.

## Riesgos frecuentes
- Hinchazón marcada, enrojecimiento, dolor y endurecimiento de la zona por varios días.
- Hematomas y adormecimiento transitorio.

## Riesgos poco frecuentes
- Lesión transitoria del nervio que mueve la comisura de la boca (sonrisa asimétrica).
- Dificultad para tragar, transitoria.
- Úlcera o daño de la piel, alopecia en la zona y nódulos.

## Alternativas
Cambios de estilo de vida, tecnologías no invasivas de reducción de grasa, liposucción o no realizar el tratamiento.

## Contraindicaciones
Embarazo y lactancia, infección activa en la zona, trastornos de deglución y bocio o patología tiroidea en estudio.

## Si no se realiza
No hay consecuencias para la salud.

## Cuidados posteriores
Frío local, analgesia según indicación y control para evaluar una nueva sesión.',
'e2b27395c36cf6e1741e6b34c8616a30eb2c11f7618f127b3d9962aae5f6969a', 'vigente', UTC_TIMESTAMP(3));

-- anexo_exodoncia v1 · sha256 1c2be228267cccf3ddc0e56d2c4dee9ad44c35996e322efbde5c1194d9862211
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_exodoncia', 'anexo_procedimiento', 1, 'Odontología · Extracción dental (exodoncia)',
'## En qué consiste
Retiro de una o más piezas dentarias bajo anestesia local. Puede requerir separar la pieza, retirar hueso o suturar. Incluye la extracción de terceros molares (muelas del juicio) cuando corresponda.

## Riesgos frecuentes
- Dolor, inflamación y hematoma por algunos días.
- Sangrado leve las primeras horas.
- Dificultad transitoria para abrir la boca.

## Riesgos poco frecuentes
- Alveolitis (infección o inflamación del alvéolo) con dolor intenso entre el 2° y 4° día.
- Infección.
- Alteración de la sensibilidad del labio, mentón o lengua por cercanía a nervios, generalmente transitoria y excepcionalmente permanente.
- Fractura de raíz o de la pieza, que puede dejar un fragmento.
- Comunicación con el seno maxilar en piezas superiores.
- Daño a piezas vecinas o restauraciones.

## Alternativas
Según el caso: endodoncia, tratamiento periodontal, restauración, controles periódicos o no realizar el tratamiento.

## Si no se realiza
Pueden persistir o aumentar el dolor, la infección y el daño a piezas vecinas o al hueso.

## Cuidados posteriores
Morder la gasa 30 minutos, no escupir ni enjuagar con fuerza ni usar bombilla por 24 horas, no fumar, frío local, dieta blanda y tomar la medicación indicada.',
'1c2be228267cccf3ddc0e56d2c4dee9ad44c35996e322efbde5c1194d9862211', 'vigente', UTC_TIMESTAMP(3));

-- anexo_endodoncia v1 · sha256 d232aca45a2680690617f033559baf4c045523c7e085300a1f67f67e8359999c
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_endodoncia', 'anexo_procedimiento', 1, 'Odontología · Tratamiento de conducto (endodoncia)',
'## En qué consiste
Retiro de la pulpa (nervio) dañada o infectada del interior del diente, limpieza y desinfección de los conductos y su sellado, bajo anestesia local. Puede requerir una o más sesiones y, después, una restauración definitiva o corona.

## Riesgos frecuentes
- Molestia o dolor al masticar por algunos días.
- Sensibilidad de la zona.

## Riesgos poco frecuentes
- Reagudización de la infección o inflamación.
- Fractura de un instrumento dentro del conducto o perforación de la raíz.
- Imposibilidad de tratar conductos muy curvos o calcificados.
- Fractura del diente, más probable si no se restaura a tiempo.
- Fracaso del tratamiento, que puede requerir retratamiento, cirugía o extracción.

## Alternativas
Extracción de la pieza (y luego su reemplazo con implante, puente o prótesis) o no realizar el tratamiento.

## Si no se realiza
La infección puede avanzar, producir dolor, abscesos y pérdida del diente.

## Cuidados posteriores
No masticar con la pieza hasta su restauración definitiva, tomar la medicación indicada y asistir a la restauración final.',
'd232aca45a2680690617f033559baf4c045523c7e085300a1f67f67e8359999c', 'vigente', UTC_TIMESTAMP(3));

-- anexo_implante_dental v1 · sha256 52a00ced394a436648520c5077dc109a1531bdd55cf202a7c3f337b51f94e537
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_implante_dental', 'anexo_procedimiento', 1, 'Odontología · Implante dental',
'## En qué consiste
Colocación quirúrgica, bajo anestesia local, de un tornillo de titanio u otro material biocompatible en el hueso maxilar o mandibular para reemplazar la raíz de un diente perdido. Tras un período de integración (habitualmente de 3 a 6 meses) se instala la corona o prótesis. Puede requerir injerto de hueso o elevación del seno maxilar.

## Riesgos frecuentes
- Dolor, inflamación y hematoma por algunos días.
- Sangrado leve.

## Riesgos poco frecuentes
- Falta de integración del implante con el hueso, con necesidad de retirarlo.
- Infección (periimplantitis), más probable en fumadores, diabéticos o con higiene deficiente.
- Alteración de la sensibilidad del labio o mentón por cercanía al nervio.
- Comunicación con el seno maxilar o con la cavidad nasal.
- Fractura del implante o de sus componentes a largo plazo.

## Alternativas
Puente fijo, prótesis removible o no reemplazar la pieza.

## Contraindicaciones
Enfermedades no controladas (diabetes, inmunosupresión), tratamiento con bifosfonatos o radioterapia en la zona, consumo intenso de tabaco y embarazo, según evaluación.

## Si no se realiza
Puede haber desplazamiento de piezas vecinas, pérdida de hueso y dificultades para masticar.

## Cuidados posteriores
Dieta blanda, no fumar, higiene cuidadosa, medicación indicada y controles periódicos de por vida.',
'52a00ced394a436648520c5077dc109a1531bdd55cf202a7c3f337b51f94e537', 'vigente', UTC_TIMESTAMP(3));

-- anexo_blanqueamiento v1 · sha256 ae18fedecebaddb45443e263e8381b45c7c932b849f213ae6734dcd7312fd7cf
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_blanqueamiento', 'anexo_procedimiento', 1, 'Odontología · Blanqueamiento dental',
'## En qué consiste
Aplicación de agentes aclaradores (peróxido de hidrógeno o de carbamida) sobre los dientes, en clínica, en casa con cubetas o combinado, para aclarar su color. El resultado varía según cada persona y no es permanente.

## Riesgos frecuentes
- Sensibilidad dental durante el tratamiento y algunos días después.
- Irritación transitoria de las encías.

## Riesgos poco frecuentes
- Resultado desigual o menor al esperado.
- Las restauraciones, coronas o carillas no cambian de color y pueden requerir reemplazo para armonizar.

## Alternativas
Limpieza y pulido, carillas o coronas, o no realizar el tratamiento.

## Contraindicaciones
Embarazo y lactancia, caries o enfermedad de encías sin tratar, sensibilidad dental severa y menores de edad, según evaluación.

## Si no se realiza
No hay consecuencias para la salud.

## Cuidados posteriores
Evitar alimentos y bebidas con colorantes (café, té, vino tinto) y tabaco durante el tratamiento y 48 horas después. Usar pasta desensibilizante si se indica.',
'ae18fedecebaddb45443e263e8381b45c7c932b849f213ae6734dcd7312fd7cf', 'vigente', UTC_TIMESTAMP(3));

-- anexo_ortodoncia v1 · sha256 5511f0a481b27542de96184177b5ea8df1882934bccee4cccd2958c1a0d614c3
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_ortodoncia', 'anexo_procedimiento', 1, 'Odontología · Tratamiento de ortodoncia',
'## En qué consiste
Corrección de la posición de los dientes y de la mordida mediante aparatos fijos (brackets) o removibles (alineadores), durante un período que habitualmente va de 12 a 36 meses, seguido de una etapa de contención con retenedores.

## Riesgos frecuentes
- Molestias o dolor leve tras cada activación.
- Úlceras o roces en la mucosa.
- Acumulación de placa y mayor riesgo de caries o inflamación de encías si la higiene es deficiente.

## Riesgos poco frecuentes
- Manchas blancas en el esmalte (descalcificación).
- Reabsorción de las raíces.
- Molestias en la articulación temporomandibular.
- Recidiva (los dientes vuelven a moverse) si no se usan los retenedores.
- Duración mayor a la estimada si no se cumplen las indicaciones o los controles.

## Alternativas
Tratamientos restauradores o protésicos, cirugía ortognática en casos indicados o no realizar el tratamiento.

## Si no se realiza
Puede mantenerse o agravarse la mala posición dentaria, con dificultad de higiene, desgaste o problemas de mordida.

## Cuidados posteriores
Higiene rigurosa, evitar alimentos duros o pegajosos, asistir a todos los controles y usar los retenedores según indicación.',
'5511f0a481b27542de96184177b5ea8df1882934bccee4cccd2958c1a0d614c3', 'vigente', UTC_TIMESTAMP(3));

-- anexo_periodoncia v1 · sha256 24d6f466203513fead14d7bedb54dec98de60c0ce71851cf7bbae8be9986f010
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_periodoncia', 'anexo_procedimiento', 1, 'Odontología · Tratamiento periodontal (destartraje y pulido radicular)',
'## En qué consiste
Retiro del sarro y la placa bacteriana sobre y bajo la encía, y alisado de las raíces, generalmente bajo anestesia local y en una o más sesiones, para tratar la enfermedad de las encías.

## Riesgos frecuentes
- Sensibilidad dental al frío o al calor por algunas semanas.
- Sangrado y molestia leve de encías.
- Retracción de las encías al desinflamarse, con dientes que se ven más largos o espacios entre ellos.

## Riesgos poco frecuentes
- Movilidad dentaria transitoria.
- Necesidad de cirugía periodontal si la enfermedad no se controla.

## Alternativas
Cirugía periodontal en casos avanzados o no realizar el tratamiento.

## Si no se realiza
La enfermedad periodontal puede avanzar, con pérdida de hueso, movilidad y pérdida de dientes.

## Cuidados posteriores
Higiene diaria con cepillo y elementos interdentales, enjuagues indicados y controles de mantención periódicos.',
'24d6f466203513fead14d7bedb54dec98de60c0ce71851cf7bbae8be9986f010', 'vigente', UTC_TIMESTAMP(3));

-- anexo_rehabilitacion_protesis v1 · sha256 df767d4ad0d32b00298976dc0de6e48ff7a47a19f6d6ca9ccc14fbbcd6b0f84a
INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde)
VALUES (UUID_TO_BIN(UUID(), 1), 'anexo_rehabilitacion_protesis', 'anexo_procedimiento', 1, 'Odontología · Rehabilitación con coronas o prótesis',
'## En qué consiste
Reemplazo o restauración de dientes mediante coronas, puentes, incrustaciones o prótesis removibles. Puede requerir desgastar dientes, tomar impresiones y usar provisorios durante el tratamiento.

## Riesgos frecuentes
- Sensibilidad dental tras el tallado.
- Período de adaptación a la prótesis, con molestias o roces.

## Riesgos poco frecuentes
- Inflamación de la pulpa que obligue a una endodoncia.
- Descementación, fractura o desgaste de la corona o la prótesis.
- Diferencias de color con los dientes naturales.

## Alternativas
Restauraciones directas, implantes, otro tipo de prótesis o no realizar el tratamiento.

## Si no se realiza
Puede haber fractura o pérdida de dientes debilitados, desplazamiento de piezas y dificultad para masticar.

## Cuidados posteriores
Higiene cuidadosa, evitar morder objetos duros y controles periódicos.',
'df767d4ad0d32b00298976dc0de6e48ff7a47a19f6d6ca9ccc14fbbcd6b0f84a', 'vigente', UTC_TIMESTAMP(3));
