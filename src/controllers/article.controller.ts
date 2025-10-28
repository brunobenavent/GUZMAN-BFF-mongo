import { Request, Response, NextFunction } from 'express';
import { articleService } from '../services/article.service'; // Asegúrate que la ruta es correcta

export const articleController = {

  /**
   * GET /api/articulos
   * Obtiene artículos paginados desde MongoDB, aceptando filtros.
   */
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Extraer paginación y filtros de los query params
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // O tu default preferido

      // Separamos 'page', 'limit', 'search' de los otros posibles filtros
      const { page: _page, limit: _limit, search, ...filters } = req.query;

      // --- Log de Depuración ---
      console.log(`[Controller] Recibida petición para page=${page}, limit=${limit}, search=${search}, filters=${JSON.stringify(filters)}`);
      // --- Fin Log ---

      // 2. Llamar al servicio que consulta MongoDB
      const paginatedResponse = await articleService.getAllArticles(
        page,
        limit,
        search as string | undefined,
        filters // Pasa el resto de query params como objeto de filtros
      );

      // 3. Enviar la respuesta
      res.json(paginatedResponse);

    } catch (error) {
      // Pasa el error al manejador global
      next(error);
    }
  },

  /**
   * GET /api/articulos/:codigo
   * Obtiene un artículo específico por su ID desde MongoDB.
   */
  getByCodigo: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { codigo } = req.params;
      if (!codigo) {
        return res.status(400).json({ message: 'El código es obligatorio' });
      }

      // Llama al servicio que consulta MongoDB
      const article = await articleService.getArticleByCodigo(codigo);
      res.json(article);

    } catch (error) {
      // Pasa el error al manejador global
      next(error);
    }
  },
};