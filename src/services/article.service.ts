// src/services/article.service.ts (El que usa Mongoose)
import Article from '../models/Article.model'; // Importa el modelo Mongoose
import { ArticleDTO } from '../mappers/article.mapper'; // Importa el tipo DTO limpio
import cloudinary from '../cloudinary'; // Importa la config de Cloudinary
import axios from 'axios'; // Importa axios

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
   * Utiliza $regex para búsqueda parcial (fragmentos de palabras).
   */
  getAllArticles: async (
    page: number,
    limit: number,
    searchQuery?: string,
    filters: any = {}
  ): Promise<PaginatedArticlesResponse> => {

    console.log(`[Service] Buscando en Mongo: page=${page}, limit=${limit}, searchQuery=${searchQuery}, filters=${JSON.stringify(filters)}`);

    const skip = (page - 1) * limit;
    console.log(`[Service] Calculado para Mongo: skip=${skip}, limit=${limit}`);

    let mongoQuery: any = {};

    // --- LÓGICA DE BÚSQUEDA (MODIFICADA A $regex) ---
    if (searchQuery) {
      // Función para escapar caracteres especiales de regex
      const escapeRegExp = (string: string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };
      
      const safeSearchQuery = escapeRegExp(searchQuery);
      
      // 'i' = case-insensitive (ignora mayúsculas/minúsculas)
      const regex = new RegExp(safeSearchQuery, 'i');

      // $text ya no se usa. Usamos $or y $regex para buscar el fragmento
      // en cualquiera de los campos de texto que definimos en el índice.
      mongoQuery.$or = [
        { nombreCientifico: { $regex: regex } },
        { nombreComun: { $regex: regex } },
        { codigoGuzman: { $regex: regex } },
        { EAN13: { $regex: regex } },
        { familia: { $regex: regex } }
      ];
      console.log(`[Service] Buscando FRAGMENTO (regex): /${safeSearchQuery}/i`);
    }
    // --- FIN LÓGICA DE BÚSQUEDA ---

    // Añadir otros filtros exactos
    if (filters.maceta) mongoQuery.maceta = filters.maceta;
    if (filters.altura) mongoQuery.altura = filters.altura;
    if (filters.calibre) mongoQuery.calibre = filters.calibre;
    if (filters.ofertaCortijo === 'true') mongoQuery['ofertas.cortijo'] = true;
    // ... añade más 'if' para otros filtros ...

    console.log(`[Service] Query Mongo final: ${JSON.stringify(mongoQuery)}`);

    try {
      // Ejecutar dos consultas a MongoDB en paralelo
      const [articles, totalArticles] = await Promise.all([
        Article.find(mongoQuery)
          .limit(limit)
          .skip(skip)
          .sort({ nombreCientifico: 1 })
          .lean(),
        Article.countDocuments(mongoQuery)
      ]);

      console.log(`[Service] Mongo devolvió ${articles.length} artículos. Total coincidente: ${totalArticles}`);
      const totalPages = Math.ceil(totalArticles / limit);

      return {
        currentPage: page,
        totalPages: totalPages,
        totalArticles: totalArticles,
        articles: articles as ArticleDTO[],
      };

    } catch (error: any) {
        console.error('[Service] Error al consultar MongoDB:', error);
        throw new Error('Error al obtener artículos de la base de datos.');
    }
  },

  /**
   * Obtiene un artículo específico por su ID ('codigoGuzman') desde MongoDB.
   */
  getArticleByCodigo: async (codigo: string): Promise<ArticleDTO> => {
    try {
        const article = await Article.findOne({ codigoGuzman: codigo }).lean();
        if (!article) {
          throw new Error(`Artículo con código ${codigo} no encontrado.`);
        }
        return article as ArticleDTO;
    } catch (error: any) {
        console.error(`[Service] Error al buscar artículo ${codigo} en MongoDB:`, error);
        if (error.message.includes('no encontrado')) {
            throw error;
        }
        throw new Error(`Error al obtener el artículo ${codigo} de la base de datos.`);
    }
  },

  /**
   * Sube/Actualiza la imagen de un artículo en Cloudinary y MongoDB.
   */
  updateArticleImage: async (codigoGuzman: string, imageBuffer: Buffer, originalFilename: string): Promise<ArticleDTO> => {
    const existingArticle = await Article.findOne({ codigoGuzman: codigoGuzman });
    if (!existingArticle) {
      throw new Error(`Artículo con código ${codigoGuzman} no encontrado.`);
    }

    try {
        const imageMimeType = 'image/jpeg'; 
        const base64Image = imageBuffer.toString('base64');
        const dataUri = `data:${imageMimeType};base64,${base64Image}`;

        console.log(`[Cloudinary] Subiendo ${originalFilename} para ${codigoGuzman}...`);
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
            public_id: codigoGuzman,
            folder: 'articulos_guzman',
            overwrite: true,
            fetch_format: 'auto',
            quality: 'auto:good',
        });

        const newImageUrl = uploadResult.secure_url;
        console.log(`[Cloudinary] Subida exitosa para ${codigoGuzman}. URL: ${newImageUrl}`);

        const updatedArticle = await Article.findOneAndUpdate(
            { codigoGuzman: codigoGuzman },
            { $set: { imagenUrl: newImageUrl } }, 
            { new: true }
        ).lean();

        if (!updatedArticle) {
            throw new Error(`Artículo ${codigoGuzman} no encontrado en DB después de actualizar imagen.`);
        }

        console.log(`[Service] MongoDB actualizado para ${codigoGuzman}.`);
        return updatedArticle as ArticleDTO;
    } catch (error: any) {
        console.error(`[Service] Error en updateArticleImage para ${codigoGuzman}:`, error);
        if (error.http_code || error.message?.includes('Cloudinary')) {
             throw new Error(`Fallo al subir la imagen a Cloudinary: ${error.message}`);
        }
        throw new Error(`Error al actualizar la imagen para el artículo ${codigoGuzman}.`);
    }
  },

}; // <-- Cierre del objeto 'articleService'