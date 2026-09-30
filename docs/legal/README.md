# Documentos legales de UZEED

| Fuente (editar aquí) | PDF publicado en el sitio |
|---|---|
| `terminos-usuario-final.md` | `apps/web/public/terms/terminos-cliente.pdf` → `/terms/terminos-cliente.pdf` |
| `terminos-usuario-oferente.md` | `apps/web/public/terms/terminos-oferente.pdf` → `/terms/terminos-oferente.pdf` |

El modal de registro (`apps/web/components/TermsModal.tsx`) y la página `/terminos`
enlazan esas rutas, así que al reemplazar los PDF no hay que tocar código.

## Cómo publicar una versión nueva

1. Pedir a un abogado que revise los `.md` (los PDF `*-BORRADOR.pdf` de esta carpeta sirven para enviárselos).
2. Completar `DATOS_EMPRESA` en `scripts/legal/build-terms.py` (razón social exacta según SII, domicilio y fecha de vigencia).
3. Generar los PDF:
   ```bash
   python3 scripts/legal/build-terms.py
   ```
   Requiere Chrome o Chromium instalado. Con `--draft` genera solo borradores en esta carpeta.
4. Hacer commit de los PDF y desplegar (Coolify).
5. Si el cambio es relevante, avisar a los usuarios por correo con al menos 10 días (Usuario Final) o 15 días (Oferente) de anticipación, como indican los propios Términos.
