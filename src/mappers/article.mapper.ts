import { z } from 'zod';

// Esquema para los objetos de oferta de Dantia
const dantiaOfferSchema = z.object({
  value: z.number(),
});

// Esquema para el artículo "sucio" de Dantia
// .passthrough() ignora campos extra que no definimos
const dantiaArticleSchema = z.object({
    CodigoArticulo: z.string(),
    DescripcionArticulo: z.string(),
    Descripcion2Articulo: z.string().optional().default(''),
    Precio1: z.number(),
    _Maceta: z.string().optional().default(''),
    _Altura: z.string().optional().default(''),
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

// Esquema de transformación al DTO "limpio" que guardaremos
export const articleDTOSchema = dantiaArticleSchema.transform((article) => {
  return {
    id: article.CodigoArticulo,
    nombre: article.DescripcionArticulo,
    descripcion: article.Descripcion2Articulo,
    precio: article.Precio1,
    maceta: article._Maceta,
    altura: article._Altura,
    ofertas: {
      nuevoEspacio: article._OfertaNuevoEspacio.value === -1,
      euroPlanta: article._OfertaEuroPlanta.value === -1,
      cortijo: article._OfertaCortijo.value === -1,
      finca: article._OfertaFinca.value === -1,
      arroyo: article._OfertaArroyo.value === -1,
      gamera: article._OfertaGamera.value === -1,
      garden: article._OfertaGarden.value === -1,
      marbella: article._OfertaMarbella.value === -1,
      estacion: article._OfertaEstacion.value === -1,
    }
  };
});

// Este es el "Tipo" de nuestro artículo limpio
export type ArticleDTO = z.infer<typeof articleDTOSchema>;