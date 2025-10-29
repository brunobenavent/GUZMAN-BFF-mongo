// src/services/article.service.ts
import Article from '../models/Article.model';
import { ArticleDTO } from '../mappers/article.mapper';
import cloudinary from '../cloudinary';
import axios from 'axios'; // Importa axios por si lo necesitas en el futuro

// Interfaz para la respuesta paginada
export interface PaginatedArticlesResponse {
  currentPage: number;
  totalPages: number;
  totalArticles: number;
  articles: ArticleDTO[];
}

// Exporta el objeto que contiene TODAS las funciones
export const articleService = {

  /**
   * Obtiene artículos paginados y filtrados desde MongoDB.
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
    if (searchQuery) mongoQuery.$text = { $search: searchQuery };
    if (filters.maceta) mongoQuery.maceta = filters.maceta;
    if (filters.altura) mongoQuery.altura = filters.altura;
    if (filters.calibre) mongoQuery.calibre = filters.calibre;
    if (filters.ofertaCortijo === 'true') mongoQuery['ofertas.cortijo'] = true;
    console.log(`[Service] Query Mongo final: ${JSON.stringify(mongoQuery)}`);

    try {
      const [articles, totalArticles] = await Promise.all([
        Article.find(mongoQuery).limit(limit).skip(skip).sort({ nombreCientifico: 1 }).lean(),
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
   * Obtiene un artículo por su 'codigoGuzman' desde MongoDB.
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
      if (error.message.includes('no encontrado')) throw error;
      throw new Error(`Error al obtener el artículo ${codigo} de la base de datos.`);
    }
  },

  /**
   * Actualiza la imagen de un artículo en Cloudinary y MongoDB.
   */
  updateArticleImage: async (codigoGuzman: string, imageBuffer: Buffer, originalFilename: string): Promise<ArticleDTO> => {
    const existingArticle = await Article.findOne({ codigoGuzman: codigoGuzman });
    if (!existingArticle) {
      throw new Error(`Artículo con código ${codigoGuzman} no encontrado.`);
    }
    try {
      const imageMimeType = 'image/jpeg'; // Asunción
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
}; // <-- Fin de 'articleService'