// Single source of truth for U-Mate legal documents shown to creators.
// When any document is materially amended, bump its VERSION string.
// The version is stored alongside the acceptance record so historical
// bindings can be reconstructed.

export const TERMS_VERSION = "2026-04-18";
export const RULES_VERSION = "2026-04-18";
export const CONTRACT_VERSION = "2026-04-18";

type Section = { title: string; paragraphs: string[] };

export const TERMS_SECTIONS: Section[] = [
  {
    title: "1. Definiciones",
    paragraphs: [
      "\"U-Mate\" es el servicio de suscripción de contenido para adultos operado dentro de la plataforma UZEED.",
      "\"Creadora\" es la persona natural mayor de edad que, habiendo sido aprobada, publica contenido dentro de U-Mate a cambio de una tarifa mensual.",
      "\"Suscriptor\" es el usuario que paga la tarifa mensual para acceder al contenido premium de una Creadora.",
      "\"Contenido\" comprende fotografías, videos, audios, textos y cualquier otro material publicado por la Creadora.",
    ],
  },
  {
    title: "2. Edad legal y capacidad",
    paragraphs: [
      "Para usar U-Mate es obligatorio ser mayor de 18 años y tener plena capacidad legal para celebrar contratos según la ley chilena.",
      "La Creadora declara bajo juramento que es mayor de 18 años y que toda persona que aparezca en su Contenido también lo es al momento de la captura del material.",
      "U-Mate podrá, en cualquier momento, exigir verificación documental de edad (cédula de identidad, pasaporte) y rechazar, suspender o eliminar cuentas que no acrediten el requisito.",
    ],
  },
  {
    title: "3. Licencia sobre el Contenido",
    paragraphs: [
      "La Creadora mantiene la titularidad de los derechos de autor sobre el Contenido que publica.",
      "Al publicar, la Creadora otorga a UZEED SpA una licencia mundial, no exclusiva, sublicenciable, libre de regalías y por todo el plazo de vigencia de la cuenta para reproducir, adaptar, mostrar, distribuir y comunicar públicamente el Contenido dentro de la plataforma y en material promocional asociado (miniaturas, previas, redes sociales oficiales).",
      "La licencia subsiste hasta por 180 días después de la eliminación del Contenido, exclusivamente para fines de respaldo, auditoría legal y cumplimiento de requerimientos de autoridad.",
    ],
  },
  {
    title: "4. Declaraciones y garantías de la Creadora",
    paragraphs: [
      "La Creadora declara y garantiza que: (a) es la única autora o tiene todos los derechos necesarios sobre el Contenido; (b) toda persona identificable en el Contenido es mayor de 18 años y otorgó consentimiento expreso para la captura y publicación; (c) el Contenido no infringe derechos de terceros (autor, marca, imagen, privacidad); (d) el Contenido no incluye menores, violencia real, bestialismo, tráfico de personas, contenido no consensuado ni ningún material ilícito bajo la ley chilena o internacional.",
      "La Creadora se obliga a conservar durante al menos 7 años evidencia documental de la edad y consentimiento de toda persona identificable en su Contenido (en línea con el 18 U.S.C. §2257 para contenidos distribuidos a usuarios fuera de Chile) y a exhibirla ante requerimiento de U-Mate o de autoridad.",
    ],
  },
  {
    title: "5. Contenido prohibido",
    paragraphs: [
      "Está absolutamente prohibido publicar: material con menores de 18 años (en cualquier forma, incluyendo aparente minoridad); violencia sexual real o simulada no consensuada; tráfico de personas; bestialismo; necrofilia; incesto; material con personas visiblemente intoxicadas o incapaces de consentir; datos personales de terceros sin su consentimiento; doxxing, amenazas, apología de delitos; y cualquier material que infrinja la Ley N° 19.927 o el Código Penal chileno.",
      "El incumplimiento configura una causal de suspensión inmediata, denuncia ante el Ministerio Público y retención de fondos pendientes a la espera de resolución judicial.",
    ],
  },
  {
    title: "6. Pagos, comisión e impuestos",
    paragraphs: [
      "El precio de la suscripción es fijado por la Creadora dentro de los rangos permitidos. Los pagos se procesan vía Flow.cl en pesos chilenos (CLP) e incluyen IVA.",
      "U-Mate retiene una comisión de plataforma sobre el neto después de IVA, publicada en el panel de la Creadora. La comisión puede ser modificada con al menos 15 días de aviso.",
      "La Creadora es responsable por sus propias obligaciones tributarias (inicio de actividades, boletas de honorarios, declaración y pago de impuestos) derivadas de los ingresos generados en U-Mate. U-Mate no es su empleador ni agente retenedor.",
      "Los pagos se acreditan al balance de la Creadora al confirmarse el cobro en Flow. Los retiros se solicitan desde el panel y están sujetos a verificación anti-fraude y al calendario de liquidaciones publicado.",
    ],
  },
  {
    title: "7. Responsabilidad y limitación",
    paragraphs: [
      "U-Mate actúa como intermediario tecnológico entre Creadoras y Suscriptores. No es editor ni productor del Contenido.",
      "En la máxima medida permitida por ley, UZEED SpA no será responsable por daños indirectos, incidentales, lucro cesante, pérdida de datos o reputación derivados del uso o imposibilidad de uso del servicio.",
      "La responsabilidad total acumulada de UZEED SpA frente a la Creadora o un Suscriptor, por cualquier causa, no excederá los montos efectivamente pagados por el reclamante a UZEED SpA en los 3 meses anteriores al hecho.",
    ],
  },
  {
    title: "8. Indemnidad",
    paragraphs: [
      "La Creadora mantendrá indemne a UZEED SpA, sus socios, directores, empleados y aliados comerciales, y los defenderá frente a cualquier reclamo, demanda, costo o sanción (incluyendo honorarios legales razonables) derivado de: (a) su Contenido; (b) la violación de sus declaraciones en la cláusula 4; (c) la infracción de leyes aplicables; (d) conductas atribuibles a ella frente a Suscriptores u otros terceros.",
    ],
  },
  {
    title: "9. Suspensión y terminación",
    paragraphs: [
      "U-Mate puede suspender o terminar el acceso de una cuenta, sin aviso previo, cuando existan indicios fundados de fraude, infracción a estos Términos, reclamo de terceros por propiedad intelectual o imagen, orden de autoridad, o riesgo reputacional.",
      "Mientras dure la suspensión, el saldo pendiente podrá ser retenido. Si se confirma la infracción, U-Mate podrá imputarlo a la reparación de daños o a terceros afectados.",
      "La Creadora puede cerrar su cuenta en cualquier momento; el Contenido dejará de estar disponible para nuevos usuarios, pero las obligaciones de respaldo legal de U-Mate subsisten por el plazo indicado en la cláusula 3.",
    ],
  },
  {
    title: "10. Datos personales y privacidad",
    paragraphs: [
      "El tratamiento de datos personales se rige por la Política de Privacidad de UZEED y la Ley N° 19.628 sobre protección de la vida privada.",
      "Los datos bancarios se almacenan cifrados y se usan únicamente para procesar pagos. La Creadora puede solicitar rectificación, cancelación u oposición escribiendo a soporte@uzeed.cl.",
    ],
  },
  {
    title: "11. Modificaciones",
    paragraphs: [
      "U-Mate puede modificar estos Términos notificando a la Creadora con al menos 15 días de anticipación a través del panel o correo registrado.",
      "Si la Creadora no acepta la nueva versión, podrá cerrar su cuenta sin penalidad antes de la fecha de vigencia. El uso continuado después de esa fecha implica aceptación.",
    ],
  },
  {
    title: "12. Ley aplicable y jurisdicción",
    paragraphs: [
      "Este acuerdo se rige por la ley de la República de Chile. Toda controversia se someterá a la jurisdicción y competencia de los Tribunales Ordinarios de Justicia con asiento en la ciudad de Santiago, renunciando las partes a cualquier otro fuero.",
    ],
  },
];

export const RULES_SECTIONS: Section[] = [
  {
    title: "1. Contenido permitido",
    paragraphs: [
      "Fotografías, videos, audios y textos originales producidos por la Creadora o sobre los que acredite derechos suficientes.",
      "Contenido con personas identificables solo si son mayores de 18 años y otorgaron consentimiento escrito para su publicación.",
    ],
  },
  {
    title: "2. Contenido prohibido (sin excepción)",
    paragraphs: [
      "Menores de 18 años en cualquier forma, incluso insinuación o apariencia.",
      "Violencia sexual real o simulada no consensuada; tráfico de personas; bestialismo; necrofilia; incesto.",
      "Personas visiblemente intoxicadas, inconscientes o incapaces de consentir.",
      "Grabaciones obtenidas sin autorización (cámaras ocultas, cabinas, vestidores).",
      "Datos personales de terceros (cédula, teléfono, dirección) sin su consentimiento expreso; doxxing; amenazas.",
      "Material con símbolos de odio, apología de delitos, extremismo violento o autolesión.",
    ],
  },
  {
    title: "3. Verificación de edad e identidad",
    paragraphs: [
      "La Creadora debe acreditar 18+ mediante cédula o pasaporte y selfie de verificación.",
      "Si publica contenido con otra persona identificable, debe conservar copia de la cédula y del consentimiento firmado de ella por al menos 7 años y exhibirlo ante U-Mate cuando se le requiera.",
    ],
  },
  {
    title: "4. Comportamiento con Suscriptores",
    paragraphs: [
      "Está prohibido acordar encuentros presenciales, intercambiar datos personales de contacto fuera de la plataforma antes de 7 días de suscripción, u ofrecer servicios sexuales presenciales a cambio del pago del plan.",
      "No se permite acoso, insultos, amenazas ni uso de lenguaje discriminatorio.",
    ],
  },
  {
    title: "5. Originalidad y reventa",
    paragraphs: [
      "Está prohibido republicar contenido de terceros sin licencia (re-subidas desde otras plataformas, \"packs\" comprados, etc.).",
      "Está prohibido revender contenido de otras creadoras o descargar y redistribuir material de U-Mate fuera de la plataforma.",
    ],
  },
  {
    title: "6. Moderación y sanciones",
    paragraphs: [
      "U-Mate audita publicaciones en forma manual y automatizada. Las infracciones pueden conllevar: aviso, eliminación del contenido, suspensión temporal, suspensión permanente, retención de saldo y/o denuncia penal según gravedad.",
      "Reincidencias o infracciones graves (menores, no consensuado, tráfico) implican baja definitiva inmediata y reporte a autoridades.",
    ],
  },
];

export const CONTRACT_SECTIONS: Section[] = [
  {
    title: "Comparecientes",
    paragraphs: [
      "De una parte, UZEED SpA, RUT 77.xxx.xxx-x, en adelante \"UZEED\" o \"la Plataforma\".",
      "De la otra parte, la persona natural mayor de edad que acepta este contrato mediante su cuenta U-Mate, en adelante \"la Creadora\".",
    ],
  },
  {
    title: "Primero — Objeto",
    paragraphs: [
      "El presente contrato tiene por objeto regular la prestación de servicios digitales de publicación de contenido para adultos por parte de la Creadora dentro de U-Mate, a cambio de una contraprestación económica pagada por los Suscriptores y liquidada por UZEED conforme a las reglas de la Plataforma.",
      "Queda expresamente establecido que no existe vínculo de subordinación ni dependencia laboral entre la Creadora y UZEED. La Creadora es trabajadora independiente y asume sus propias obligaciones previsionales y tributarias.",
    ],
  },
  {
    title: "Segundo — Declaraciones de la Creadora",
    paragraphs: [
      "La Creadora declara: (a) ser mayor de 18 años a la fecha de aceptación; (b) ser la única autora o tener todos los derechos necesarios sobre el contenido a publicar; (c) que toda persona identificable en su contenido es mayor de 18 años y otorgó consentimiento expreso, escrito y revocable; (d) que su contenido no infringe leyes chilenas ni extranjeras aplicables; (e) que ha leído y acepta las Reglas y los Términos de U-Mate.",
    ],
  },
  {
    title: "Tercero — Licencia de uso",
    paragraphs: [
      "La Creadora otorga a UZEED una licencia mundial, no exclusiva, sublicenciable, libre de regalías y por el plazo de vigencia de la cuenta, para utilizar el contenido publicado dentro de U-Mate y en piezas promocionales asociadas (miniaturas, previas, anuncios).",
      "La licencia permanece por 180 días tras la eliminación del contenido, exclusivamente para fines de respaldo, auditoría legal y cumplimiento regulatorio.",
    ],
  },
  {
    title: "Cuarto — Contraprestación",
    paragraphs: [
      "UZEED retiene una comisión de plataforma sobre el neto después de IVA de cada suscripción, según el porcentaje publicado en el panel de la Creadora. El saldo restante se abona a la Creadora.",
      "Los retiros se realizan a la cuenta bancaria declarada por la Creadora, sujetos a verificación anti-fraude y al calendario de liquidaciones. Los eventuales contracargos (chargebacks) se descuentan del saldo pendiente.",
    ],
  },
  {
    title: "Quinto — Indemnidad",
    paragraphs: [
      "La Creadora mantendrá indemne a UZEED, sus socios, directores y empleados frente a cualquier reclamo, demanda, costo o sanción derivada del contenido publicado, del incumplimiento de sus declaraciones o de conductas atribuibles a ella, incluyendo honorarios legales razonables.",
    ],
  },
  {
    title: "Sexto — Terminación",
    paragraphs: [
      "Cualquiera de las partes puede terminar este contrato en cualquier momento mediante comunicación a través del panel o correo registrado.",
      "UZEED podrá terminar de forma inmediata y sin aviso en caso de infracción grave (contenido prohibido, fraude, reclamo de terceros con mérito), reteniendo los saldos hasta resolución.",
    ],
  },
  {
    title: "Séptimo — Confidencialidad y datos",
    paragraphs: [
      "Las partes se obligan a mantener reserva sobre toda información comercial no pública a la que accedan con ocasión del contrato.",
      "El tratamiento de datos personales se regirá por la Política de Privacidad de UZEED y la Ley N° 19.628.",
    ],
  },
  {
    title: "Octavo — Ley aplicable y jurisdicción",
    paragraphs: [
      "Este contrato se rige por la ley de la República de Chile. Toda controversia se someterá a los Tribunales Ordinarios de Justicia con asiento en Santiago, renunciando las partes a cualquier otro fuero.",
    ],
  },
];

export type LegalDocKey = "terms" | "rules" | "contract";

export function getDocMeta(key: LegalDocKey) {
  switch (key) {
    case "terms":
      return {
        title: "Términos y condiciones de U-Mate",
        sections: TERMS_SECTIONS,
        version: TERMS_VERSION,
      };
    case "rules":
      return {
        title: "Reglas de U-Mate",
        sections: RULES_SECTIONS,
        version: RULES_VERSION,
      };
    case "contract":
      return {
        title: "Contrato de prestación de servicios U-Mate",
        sections: CONTRACT_SECTIONS,
        version: CONTRACT_VERSION,
      };
  }
}

export const ATTESTATION_VERSION = "2026-04-18";
export const ATTESTATION_TEXT =
  "Declaro bajo juramento que: (1) soy mayor de 18 años; (2) soy dueña del contenido publicado o cuento con los derechos necesarios; (3) toda persona identificable es mayor de 18 años y otorgó consentimiento expreso; (4) el contenido no infringe leyes ni derechos de terceros. Comprendo que U-Mate puede exigir documentación que acredite lo anterior en cualquier momento.";
