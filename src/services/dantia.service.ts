// src/services/dantia.service.ts
import apiClient from './apiClient';
import { z } from 'zod';
import { articleDTOSchema, ArticleDTO } from '../mappers/article.mapper';
import axios from 'axios';
// ¡YA NO importamos 'ensureValidSession' desde aquí!

// ... (Interface ApiResponse, PAGE_LIMIT, MAX_PAGES_TO_FETCH) ...
interface ApiResponse { $resources: any[]; $itemsPerPage: number; }
const PAGE_LIMIT = 100;
const MAX_PAGES_TO_FETCH = 25; 

export const dantiaService = {

  fetchAllArticles: async (): Promise<ArticleDTO[]> => {
    let allCleanArticles: ArticleDTO[] = [];
    let currentPage = 1;
    let hasNextPage = true;
    let totalRawFetched = 0;

    console.log('[DantiaService-V2] Iniciando descarga completa usando PAGE/COUNT...');

    // ¡ELIMINAMOS la llamada a ensureValidSession() de aquí!
    // El interceptor de apiClient lo manejará.

    // 1. Construir la cláusula WHERE
    const whereOffers = [
      '_OfertaNuevoEspacio=-1', '_OfertaEuroPlanta=-1', '_OfertaCortijo=-1',
      '_OfertaFinca=-1', '_OfertaArroyo=-1', '_OfertaGamera=-1',
      '_OfertaGarden=-1', '_OfertaMarbella=-1', '_OfertaEstacion=-1'
    ].join(' or ');
    
    if (!whereOffers) {
        console.error("[DantiaService-V2] Error: whereOffers está vacío. Abortando.");
        return []; 
    }
    
    const finalWhere = `CodigoEmpresa=1 and (${whereOffers})`;
    const ruta = '/adArticulosCatalogo/query';
    console.log(`[DantiaService-V2] Usando cláusula WHERE: ${finalWhere}`);

    // 2. Bucle para pedir páginas
    while (hasNextPage) {
      if (currentPage > MAX_PAGES_TO_FETCH) {
          console.warn(`[DantiaService-V2] Se alcanzó el límite de ${MAX_PAGES_TO_FETCH} páginas. Deteniendo.`);
          hasNextPage = false;
          continue;
      }

      try {
        const queryParams = { count: PAGE_LIMIT, page: currentPage, where: finalWhere };
        console.log(`[DantiaService-V2] Pidiendo página ${currentPage}... Params: ${JSON.stringify({count: queryParams.count, page: queryParams.page})}`);

        // 3. Llamar a la API de Dantia
        // El interceptor se activará aquí y llamará a ensureValidSession
        const response = await apiClient.get<ApiResponse>(ruta, { params: queryParams });
        const rawArticles = response.data.$resources || [];
        totalRawFetched += rawArticles.length;

        console.log(`[DantiaService-V2] Página ${currentPage} recibida: ${rawArticles.length} artículos. Total bruto: ${totalRawFetched}`);

        // 4. Validar/Transformar con Zod
        const pageCleanArticles: ArticleDTO[] = rawArticles.reduce((acc: ArticleDTO[], item) => {
          const result = articleDTOSchema.safeParse(item);
          if (result.success) acc.push(result.data);
          else console.warn(`[DantiaService-V2] Artículo mal formado omitido (ID: ${item?.CodigoArticulo}) en pág ${currentPage}`);
          return acc;
        }, []);
        
        allCleanArticles = allCleanArticles.concat(pageCleanArticles);

        // 5. Comprobar si hay más páginas
        hasNextPage = rawArticles.length === PAGE_LIMIT; 
        if (hasNextPage) currentPage++;
        else console.log(`[DantiaService-V2] Última página recibida (${rawArticles.length} artículos).`);
        
      } catch (error: any) {
        console.error(`[DantiaService-V2] Error pidiendo página ${currentPage}. Abortando.`, error.message);
        if (axios.isAxiosError(error)) console.error('[DantiaService-V2] Detalle error Dantia:', error.response?.data);
        hasNextPage = false;
        allCleanArticles = [];
      }
    } // Fin while

    console.log(`[DantiaService-V2] Descarga finalizada. Total artículos limpios: ${allCleanArticles.length}`);
    if (allCleanArticles.length === MAX_PAGES_TO_FETCH * PAGE_LIMIT) {
        console.warn(`[DantiaService-V2] ADVERTENCIA: Se alcanzó el límite máximo de páginas.`);
    }
    return allCleanArticles;
  }
};