// src/mappers/article.mapper.ts
import { z } from 'zod';
import 'dotenv/config'; // Necesario para leer las variables de entorno aquí

// --- Función Auxiliar para Capitalizar ---
function toTitleCase(str: string | undefined | null): string {
  if (!str) return '';
  // Capitaliza la primera letra de cada palabra
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// --- URLs Base Originales (con fallback por si .env falla) ---
const imgBaseLow = process.env.IMAGE_BASE_URL_LOW || '';
const imgBaseMid = process.env.IMAGE_BASE_URL_MID || '';
const imgBaseHigh = process.env.IMAGE_BASE_URL_HIGH || '';

// --- Esquemas de Dantia ---
const dantiaOfferSchema = z.object({ value: z.number() }).optional();
const dantiaBooleanSchema = z.object({ value: z.number() }).optional();

// Esquema para validar el artículo "sucio" de Dantia
const dantiaArticleSchema = z.object({
    // Validación estricta para el ID
    CodigoArticulo: z.string().trim().min(1, { message: "CodigoArticulo no puede estar vacío" }),
    CodigoAlternativo2: z.string().optional().default(''), // EAN13
    DescripcionArticulo: z.string().optional().default(''), // nombreCientifico
    Descripcion: z.string().optional().default(''), // familia
    Precio1: z.number().optional().default(0), // PVP
    _Maceta: z.string().optional().default(''),
    _Calibre: z.string().optional().default(''),
    _Altura: z.string().optional().default(''),
    _Presentacion: z.string().optional().default(''),
    _UndsCarro: z.number().optional().default(0),
    _UndsTabla: z.number().optional().default(0),
    _UndsCaja: z.number().optional().default(0),
    _Acabado: z.string().optional().default(''),
    _Tamano: z.string().optional().default(''),
    Descripcion2Articulo: z.string().optional().default(''), // nombreComun
    PrecioVentasinIVA2: z.number().optional().default(0), // precio2
    PrecioVentasinIVA3: z.number().optional().default(0), // precio3
    _OfertaNuevoEspacio: dantiaOfferSchema,
    _OfertaEuroPlanta: dantiaOfferSchema,
    _OfertaCortijo: dantiaOfferSchema,
    _OfertaFinca: dantiaOfferSchema,
    _OfertaArroyo: dantiaOfferSchema,
    _OfertaGamera: dantiaOfferSchema,
    _OfertaGarden: dantiaOfferSchema,
    _OfertaMarbella: dantiaOfferSchema,
    _OfertaEstacion: dantiaOfferSchema,
  }).passthrough(); // Ignora campos extra no definidos

// --- Esquema del DTO Limpio (incluye URLs temporal y final) ---
export const articleDTOSchema = dantiaArticleSchema.transform((article) => {
  // Función auxiliar interna para manejar ofertas opcionales
  const isOferta = (ofertaField: { value: number } | undefined): boolean => {
      return ofertaField?.value === -1;
  };

  // Lógica para construir la URL de la imagen ORIGINAL
  let imagenUrlOriginal = '';
  const codigoNum = parseInt(article.CodigoArticulo, 10); // Intenta convertir a número
  if (!isNaN(codigoNum)) { // Solo si es un número válido
      if (codigoNum >= 0 && codigoNum <= 130000 && imgBaseLow) {
          imagenUrlOriginal = `${imgBaseLow}/${article.CodigoArticulo}-0.jpg`;
      } else if (codigoNum >= 130001 && codigoNum <= 170000 && imgBaseMid) {
          imagenUrlOriginal = `${imgBaseMid}/${article.CodigoArticulo}-0.jpg`;
      } else if (codigoNum >= 170001 && codigoNum <= 300000 && imgBaseHigh) {
          imagenUrlOriginal = `${imgBaseHigh}/${article.CodigoArticulo}-0.jpg`;
      }
      // Considera un else aquí si quieres una URL por defecto para otros rangos
  } else {
      console.warn(`[Mapper] CodigoArticulo "${article.CodigoArticulo}" no es numérico, no se generará URL original.`);
  }

  return {
    codigoGuzman: article.CodigoArticulo, // Renombrado
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
    nombreComun: toTitleCase(article.Descripcion2Articulo), // Capitalizado
    precio2: article.PrecioVentasinIVA2,
    precio3: article.PrecioVentasinIVA3,
    // Campos de URL: original (para subir) y final (placeholder)
    imagenUrlOriginal: imagenUrlOriginal, // Usada por el worker para subir a Cloudinary
    imagenUrl: '', // Será rellenada por el worker con la URL de Cloudinary
    // Objeto de Ofertas
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

// Inferimos el tipo DTO (ahora incluye ambas URLs temporalmente)
// Usamos '&' para añadir explícitamente el campo opcional que no está en el transform
export type ArticleDTO = z.infer<typeof articleDTOSchema> & { imagenUrlOriginal?: string };