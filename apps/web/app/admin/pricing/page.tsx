import { redirect } from "next/navigation";

/* Los precios por tier ya no existen: hay un solo plan mensual (tarifa fija)
   y se configura en /admin/cobros, junto con los boosts. */
export default function AdminPricingPage() {
  redirect("/admin/cobros");
}
