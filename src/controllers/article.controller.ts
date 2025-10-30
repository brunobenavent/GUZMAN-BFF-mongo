// src/controllers/article.controller.ts
import { Request, Response, NextFunction } from 'express';
import { articleService } from '../services/article.service';

export const articleController = {

  /**
   * GET /api/articulos
   */
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const { page: _page, limit: _limit, search, ...filters } = req.query;

      console.log(`[Controller] Petición: page=${page}, limit=${limit}, search=${search}, filters=${JSON.stringify(filters)}`);

      // 1. Pasa el objeto 'req.user' (o undefined) al servicio
      const paginatedResponse = await articleService.getAllArticles(
        page,
        limit,
        search as string | undefined,
        filters,
        req.user // <-- CAMBIO AQUÍ
      );
      
      res.json(paginatedResponse);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/articulos/:codigoGuzman
   */
  getByCodigo: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { codigoGuzman } = req.params; 
      if (!codigoGuzman) {
        return res.status(400).json({ message: 'El código es obligatorio' });
      }

      // 2. Pasa el objeto 'req.user' (o undefined) al servicio
      const article = await articleService.getArticleByCodigo(
          codigoGuzman,
          req.user // <-- CAMBIO AQUÍ
      );
      res.json(article);

    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/articulos/:codigoGuzman/imagen
   */
  updateImage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { codigoGuzman } = req.params;
      const file = req.file; 
      if (!codigoGuzman) return res.status(400).json({ message: 'Falta el código del artículo.' });
      if (!file) return res.status(400).json({ message: 'No se ha subido ningún archivo de imagen.' });
      const updatedArticle = await articleService.updateArticleImage(codigoGuzman, file.buffer, file.originalname);
      res.json({ message: 'Imagen actualizada correctamente', article: updatedArticle });
    } catch (error) {
      if (error instanceof Error && error.message.includes('no encontrado')) {
          return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  },
  
  /**
   * PUT /api/articulos/:codigoGuzman
   */
  updateArticle: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { codigoGuzman } = req.params;
      const updateData = req.body; 
      if (!codigoGuzman) return res.status(400).json({ message: 'Falta el código del artículo.' });
      if (!updateData || Object.keys(updateData).length === 0) return res.status(400).json({ message: 'No se han enviado datos para actualizar.' });
      const updatedArticle = await articleService.updateArticle(codigoGuzman, updateData);
      res.json({ message: 'Artículo actualizado correctamente', article: updatedArticle });
    } catch (error) {
      if (error instanceof Error && error.message.includes('no encontrado')) {
          return res.status(404).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('Validación')) {
          return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  },

};