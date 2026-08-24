import { redirect } from "next/navigation";

/**
 * La sección de videollamadas fue reemplazada por el marketplace: las
 * profesionales ahora venden fotos, videos y artículos propios desde aquí.
 * Se mantiene la ruta para no romper enlaces antiguos ni notificaciones ya
 * enviadas.
 */
export default function VideocallRedirectPage() {
  redirect("/marketplace");
}
