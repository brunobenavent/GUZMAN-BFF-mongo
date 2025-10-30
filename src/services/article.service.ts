// src/services/article.service.ts (El que usa Mongoose)
import Article from '../models/Article.model'; // Importa el modelo Mongoose
import { ArticleDTO } from '../mappers/article.mapper'; // Importa el tipo DTO limpio
import cloudinary from '../cloudinary'; // Importa la config de Cloudinary
import axios from 'axios';
import { JwtPayload } from './user.service'; // Importa la interfaz del Payload

// Interfaz para la respuesta paginada que enviaremos al frontend
export interface PaginatedArticlesResponse {
  currentPage: number;
  totalPages: number;
  totalArticles: number;
  articles: ArticleDTO[];
}

// Exporta el objeto que contiene TODAS las funciones
export const articleService = {

  /**
   * 1. OBTENER TODOS (con paginación y filtros)
   */
  getAllArticles: async (
    page: number,
    limit: number,
    searchQuery?: string,
    filters: any = {},
    userPayload?: JwtPayload // Acepta el usuario opcional
  ): Promise<PaginatedArticlesResponse> => {

    console.log(`[Service] Buscando en Mongo: page=${page}, limit=${limit}, userRole=${userPayload?.role || 'anonimo'}`);
    const skip = (page - 1) * limit;
    console.log(`[Service] Calculado para Mongo: skip=${skip}, limit=${limit}`);

    // Lógica de Proyección de Precios
    let projection = {};
    if (!userPayload) {
      projection = { PVP: 0, precio2: 0, precio3: 0 }; // Oculta precios si es anónimo
      console.log('[Service] Usuario anónimo. Ocultando precios.');
    } else {
      console.log(`[Service] Usuario autenticado (${userPayload.role}). Mostrando todos los precios.`);
    }

    // Lógica de Query
    let mongoQuery: any = {};
    if (searchQuery) {
      const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const safeSearchQuery = escapeRegExp(searchQuery);
      const regex = new RegExp(safeSearchQuery, 'i');
      mongoQuery.$or = [
        { nombreCientifico: { $regex: regex } },
        { nombreComun: { $regex: regex } },
        { codigoGuzman: { $regex: regex } },
        { EAN13: { $regex: regex } },
        { familia: { $regex: regex } }
      ];
    }
    if (filters.maceta) mongoQuery.maceta = filters.maceta;
    if (filters.altura) mongoQuery.altura = filters.altura;
    if (filters.calibre) mongoQuery.calibre = filters.calibre;
    if (filters.ofertaCortijo === 'true') mongoQuery['ofertas.cortijo'] = true;
    console.log(`[Service] Query Mongo final: ${JSON.stringify(mongoQuery)}`);

    try {
      const [articles, totalArticles] = await Promise.all([
        Article.find(mongoQuery)
          .select(projection) // Aplica la proyección de precios
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
   * 2. OBTENER UNO POR CÓDIGO
   */
  getArticleByCodigo: async (
    codigo: string,
    userPayload?: JwtPayload // Acepta el usuario opcional
  ): Promise<ArticleDTO> => {
    try {
      // Lógica de Proyección
      let projection = {};
      if (!userPayload) {
        projection = { PVP: 0, precio2: 0, precio3: 0 }; // Oculta precios
        console.log(`[Service] Anónimo. Ocultando precios para ${codigo}.`);
      } else {
        console.log(`[Service] Autenticado (${userPayload.role}). Mostrando precios para ${codigo}.`);
      }

      const article = await Article.findOne({ codigoGuzman: codigo })
          .select(projection) // Aplica la proyección
          .lean();
          
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
   * 3. ACTUALIZAR IMAGEN (PUT .../imagen)
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

  /**
   * 4. ACTUALIZAR DATOS (PUT .../:codigoGuzman)
   */
  updateArticle: async (codigoGuzman: string, updateData: Partial<ArticleDTO>): Promise<ArticleDTO> => {
    try {
      if ((updateData as any).codigoGuzman) delete (updateData as any).codigoGuzman;
      if ((updateData as any).imagenUrl) delete (updateData as any).imagenUrl;
      console.log(`[Service] Actualizando artículo ${codigoGuzman} con datos: ${JSON.stringify(updateData)}`);

      const updatedArticle = await Article.findOneAndUpdate(
        { codigoGuzman: codigoGuzman },
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean(); 

      if (!updatedArticle) {
        throw new Error(`Artículo con código ${codigoGuzman} no encontrado.`);
      }
      console.log(`[Service] Artículo ${codigoGuzman} actualizado en MongoDB.`);
      return updatedArticle as ArticleDTO;
    } catch (error: any) {
      console.error(`[Service] Error en updateArticle para ${codigoGuzman}:`, error);
      if (error.name === 'ValidationError') {
        throw new Error(`Error de Validación: ${error.message}`);
      }
      if (error.message.includes('no encontrado')) {
          throw error;
      }
      throw new Error(`Error al actualizar el artículo ${codigoGuzman} en la base de datos.`);
    }
  },

}; // <-- Cierre del objeto 'articleService'