import { redirect } from "next/navigation";

/**
 * El sistema de videollamadas ya no existe: las profesionales venden sus
 * fotos y videos en Contenido. Se mantiene la ruta para no romper enlaces
 * antiguos ni notificaciones ya enviadas.
 */
export default function VideocallRedirectPage() {
  redirect("/contenido");
}
