// src/mappers/article.mapper.ts
import { z } from 'zod';
import 'dotenv/config'; // Para leer el CLOUDINARY_CLOUD_NAME

// --- Función Auxiliar para Capitalizar ---
function toTitleCase(str: string | undefined | null): string {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// *** URLs de Cloudinary ***
// Tu CLOUD_NAME debe estar definido en el .env
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
if (!CLOUD_NAME) {
    console.error("CRÍTICO: CLOUDINARY_CLOUD_NAME no está definido en .env. Las URLs de imagen no funcionarán.");
    // Podrías lanzar un error aquí o usar un valor por defecto / string vacío.
    // Para evitar que el servidor falle al arrancar, usaremos un string vacío.
}

const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUD_NAME || 'TU_CLOUD_NAME_POR_DEFECTO'}/image/upload`;
const CLOUDINARY_FOLDER = 'articulos_guzman'; // La carpeta donde subiste las imágenes

// Opciones de optimización (formato auto, calidad auto) que se aplicarán al servir
// Esto irá DESPUÉS de /upload/ y ANTES de la carpeta/public_id
const CLOUDINARY_TRANSFORMS = 'f_auto,q_auto'; 


// --- Esquemas de Dantia ---
const dantiaOfferSchema = z.object({ value: z.number() }).optional();

// 1. Esquema para validar el artículo "sucio" de Dantia
const dantiaArticleSchema = z.object({
    CodigoArticulo: z.string().trim().min(1, { message: "CodigoArticulo no puede estar vacío" }),
    CodigoAlternativo2: z.string().optional().default(''),
    DescripcionArticulo: z.string().optional().default(''),
    Descripcion: z.string().optional().default(''),
    Precio1: z.number().optional().default(0),
    _Maceta: z.string().optional().default(''),
    _Calibre: z.string().optional().default(''),
    _Altura: z.string().optional().default(''),
    _Presentacion: z.string().optional().default(''),
    _UndsCarro: z.number().optional().default(0),
    _UndsTabla: z.number().optional().default(0),
    _UndsCaja: z.number().optional().default(0),
    _Acabado: z.string().optional().default(''),
    _Tamano: z.string().optional().default(''),
    Descripcion2Articulo: z.string().optional().default(''),
    PrecioVentasinIVA2: z.number().optional().default(0),
    PrecioVentasinIVA3: z.number().optional().default(0),
    _OfertaNuevoEspacio: dantiaOfferSchema,
    _OfertaEuroPlanta: dantiaOfferSchema,
    _OfertaCortijo: dantiaOfferSchema,
    _OfertaFinca: dantiaOfferSchema,
    _OfertaArroyo: dantiaOfferSchema,
    _OfertaGamera: dantiaOfferSchema,
    _OfertaGarden: dantiaOfferSchema,
    _OfertaMarbella: dantiaOfferSchema,
    _OfertaEstacion: dantiaOfferSchema,
  }).passthrough();

// --- Esquema de Frontend (Datos "limpios") ---
export const articleDTOSchema = dantiaArticleSchema.transform((article) => {
  const isOferta = (ofertaField: { value: number } | undefined): boolean => {
      return ofertaField?.value === -1;
  };

  // *** Lógica para construir la URL de Cloudinary (CORREGIDA) ***
  // Formato: BASE_URL / TRANSFORMACIONES / CARPETA / PUBLIC_ID
  const imagenUrl = `${CLOUDINARY_BASE_URL}/${CLOUDINARY_TRANSFORMS}/${CLOUDINARY_FOLDER}/${article.CodigoArticulo}`;
  // Ejemplo resultante: https://res.cloudinary.com/mi_cloud/image/upload/f_auto,q_auto/articulos_guzman/000229
  // Esto asumirá la última versión subida en Cloudinary.
  // Si tienes versiones específicas (ej. v1234567890), tendrías que incluirla.
  // Pero para imágenes subidas manualmente, la última versión es lo habitual.
  // *** Fin Lógica Imagen ***

  return {
    codigoGuzman: article.CodigoArticulo,
    EAN13: article.CodigoAlternativo2,
    nombreCientifico: toTitleCase(article.DescripcionArticulo),
    familia: toTitleCase(article.Descripcion),
    PVP: article.Precio1,
    maceta: article._Maceta,
    calibre: article._Calibre,
    altura: article._Altura,
    presentacion: article._Presentacion,
    unidadesPorCarro: article._UndsCarro,
    unidadesPorTabla: article._UndsTabla,
    unidadesPorCaja: article._UndsCaja,
    acabado: article._Acabado,
    tamano: article._Tamano,
    nombreComun: toTitleCase(article.Descripcion2Articulo),
    precio2: article.PrecioVentasinIVA2,
    precio3: article.PrecioVentasinIVA3,
    imagenUrl: imagenUrl, // Asigna la URL de Cloudinary construida
    ofertas: {
        nuevoEspacio: isOferta(article._OfertaNuevoEspacio),
        euroPlanta: isOferta(article._OfertaEuroPlanta),
        cortijo: isOferta(article._OfertaCortijo),
        finca: isOferta(article._OfertaFinca),
        arroyo: isOferta(article._OfertaArroyo),
        gamera: isOferta(article._OfertaGamera),
        garden: isOferta(article._OfertaGarden),
        marbella: isOferta(article._OfertaMarbella),
        estacion: isOferta(article._OfertaEstacion),
    }
  };
});

// Inferimos el tipo DTO
export type ArticleDTO = z.infer<typeof articleDTOSchema>;