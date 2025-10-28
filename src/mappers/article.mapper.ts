// src/mappers/article.mapper.ts
import { z } from 'zod';
import 'dotenv/config'; // Importa dotenv para leer las variables aquí

// --- Función Auxiliar para Capitalizar ---
function toTitleCase(str: string | undefined | null): string {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// --- URLs Base desde .env (con valores por defecto por si fallan) ---
const imgBaseLow = process.env.IMAGE_BASE_URL_LOW || 'URL_BAJA_POR_DEFECTO';
const imgBaseMid = process.env.IMAGE_BASE_URL_MID || 'URL_MEDIA_POR_DEFECTO';
const imgBaseHigh = process.env.IMAGE_BASE_URL_HIGH || 'URL_ALTA_POR_DEFECTO';

// --- Esquemas de Dantia ---
const dantiaOfferSchema = z.object({ value: z.number() }).optional();
const dantiaBooleanSchema = z.object({ value: z.number() }).optional();

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

// --- Esquema del DTO Limpio (con URL de imagen) ---
export const articleDTOSchema = dantiaArticleSchema.transform((article) => {
  const isOferta = (ofertaField: { value: number } | undefined): boolean => {
      return ofertaField?.value === -1;
  };

  // *** Lógica para construir la URL de la imagen ***
  let imagenUrl = ''; // Valor por defecto si el código no es numérico o está fuera de rango
  const codigoNum = parseInt(article.CodigoArticulo, 10); // Intenta convertir el código a número

  if (!isNaN(codigoNum)) { // Solo si es un número válido
      if (codigoNum >= 0 && codigoNum <= 130000) {
          imagenUrl = `${imgBaseLow}/${article.CodigoArticulo}-0.jpg`;
      } else if (codigoNum >= 130001 && codigoNum <= 170000) {
          imagenUrl = `${imgBaseMid}/${article.CodigoArticulo}-0.jpg`;
      } else if (codigoNum >= 170001 && codigoNum <= 300000) {
          imagenUrl = `${imgBaseHigh}/${article.CodigoArticulo}-0.jpg`;
      }
      // Puedes añadir un 'else' aquí si quieres manejar códigos fuera de 0-300000
  } else {
      console.warn(`[Mapper] CodigoArticulo "${article.CodigoArticulo}" no es numérico, no se puede generar URL de imagen.`);
  }
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
    // *** NUEVO CAMPO AÑADIDO ***
    imagenUrl: imagenUrl,
    // *** FIN NUEVO CAMPO ***
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

// Inferimos el tipo DTO (ahora incluirá imagenUrl)
export type ArticleDTO = z.infer<typeof articleDTOSchema>;