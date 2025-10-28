import Article from '../models/Article.model'; // Importa el modelo Mongoose
import { ArticleDTO } from '../mappers/article.mapper'; // Importa el tipo DTO limpio

// Interfaz para la respuesta paginada que enviaremos al frontend
export interface PaginatedArticlesResponse {
  currentPage: number;
  totalPages: number;
  totalArticles: number;
  articles: ArticleDTO[];
}

export const articleService = {

  /**
   * Obtiene artículos paginados y filtrados desde la base de datos MongoDB.
   * @param page Número de página.
   * @param limit Artículos por página.
   * @param searchQuery Término de búsqueda opcional (texto completo).
   * @param filters Objeto con filtros adicionales (ej. { maceta: 'valor' }).
   * @returns Respuesta paginada con total de páginas y artículos.
   */
  getAllArticles: async (
    page: number,
    limit: number,
    searchQuery?: string,
    filters: any = {} // Objeto genérico para filtros, puedes tiparlo mejor si quieres
  ): Promise<PaginatedArticlesResponse> => {

    // --- Log de Depuración ---
    console.log(`[Service] Buscando en Mongo: page=${page}, limit=${limit}, searchQuery=${searchQuery}, filters=${JSON.stringify(filters)}`);
    // --- Fin Log ---

    // Calcular el 'skip' para la paginación de Mongoose
    const skip = (page - 1) * limit;

    // --- Log de Depuración ---
    console.log(`[Service] Calculado para Mongo: skip=${skip}, limit=${limit}`);
    // --- Fin Log ---

    // Construir la consulta para MongoDB dinámicamente
    let mongoQuery: any = {};

    // 1. Añadir búsqueda de texto si existe
    if (searchQuery) {
      // $text requiere que tengas un índice de texto en tu modelo (ya lo añadimos)
      mongoQuery.$text = { $search: searchQuery };
    }

    // 2. Añadir otros filtros exactos (case-sensitive por defecto en Mongo)
    //    Usamos notación de punto para consultar subdocumentos como 'ofertas.cortijo'
    if (filters.maceta) mongoQuery.maceta = filters.maceta;
    if (filters.altura) mongoQuery.altura = filters.altura;
    if (filters.calibre) mongoQuery.calibre = filters.calibre; // Asumiendo que 'calibre' existe en tu DTO/Modelo
    // Filtros booleanos para ofertas (ej. ?ofertaCortijo=true)
    if (filters.ofertaCortijo === 'true') mongoQuery['ofertas.cortijo'] = true;
    if (filters.ofertaFinca === 'true') mongoQuery['ofertas.finca'] = true;
    // ... añade más 'if' para otros filtros que necesites ...

    // --- Log de Depuración ---
    console.log(`[Service] Query Mongo final: ${JSON.stringify(mongoQuery)}`);
    // --- Fin Log ---


    try {
      // Ejecutar dos consultas a MongoDB en paralelo para eficiencia:
      // - Una para obtener los documentos de la página actual.
      // - Otra para obtener el conteo total de documentos que coinciden.
      const [articles, totalArticles] = await Promise.all([
        Article.find(mongoQuery) // Aplica los filtros/búsqueda
          .limit(limit)          // Limita al número por página
          .skip(skip)            // Salta los documentos de páginas anteriores
          .sort({ nombre: 1 })   // Ordena alfabéticamente por nombre (opcional)
          .lean(), // .lean() devuelve objetos JS planos, más rápido que documentos Mongoose

        Article.countDocuments(mongoQuery) // Obtiene el conteo total con los mismos filtros
      ]);

      // --- Log de Depuración ---
      console.log(`[Service] Mongo devolvió ${articles.length} artículos para la página ${page}. Total coincidente: ${totalArticles}`);
      // --- Fin Log ---

      // Calcular el total de páginas
      const totalPages = Math.ceil(totalArticles / limit);

      // Devolver la respuesta estructurada
      return {
        currentPage: page,
        totalPages: totalPages,
        totalArticles: totalArticles,
        articles: articles, // Mongoose ya devuelve objetos que coinciden con ArticleDTO gracias a .lean()
      };

    } catch (error: any) {
        console.error('[Service] Error al consultar MongoDB:', error);
        throw new Error('Error al obtener artículos de la base de datos.');
    }
  },

  /**
   * Obtiene un artículo específico por su ID ('CodigoArticulo') desde MongoDB.
   */
  getArticleByCodigo: async (codigo: string): Promise<ArticleDTO> => {
    try {
        // Busca directamente en Mongo por el campo 'id' que definimos en el Schema
        const article = await Article.findOne({ id: codigo }).lean();

        if (!article) {
          throw new Error(`Artículo con código ${codigo} no encontrado.`);
        }
        return article; // Devuelve el objeto JS plano

    } catch (error: any) {
        console.error(`[Service] Error al buscar artículo ${codigo} en MongoDB:`, error);
         // Si el error ya es "no encontrado", relánzalo
        if (error.message.includes('no encontrado')) {
            throw error;
        }
        throw new Error(`Error al obtener el artículo ${codigo} de la base de datos.`);
    }
  },
};