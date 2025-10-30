// src/services/dantia.service.ts

import apiClient from './apiClient';
import { z } from 'zod';
import { articleDTOSchema, ArticleDTO } from '../mappers/article.mapper';
import axios from 'axios';
import { ensureValidSession } from './auth.service'; // <-- 1. IMPORTA ensureValidSession AQUÍ

// Estructura de respuesta de la API de Dantia
interface ApiResponse {
  $resources: any[]; // 'any' porque Zod validará
  $itemsPerPage: number;
}

const PAGE_LIMIT = 100; // Artículos por página pedidos a Dantia

// *** LÍMITE DE SEGURIDAD ***
const MAX_PAGES_TO_FETCH = 25; 

export const dantiaService = {

  fetchAllArticles: async (): Promise<ArticleDTO[]> => {
    let allCleanArticles: ArticleDTO[] = [];
    let currentPage = 1; // Empezar en la página 1
    let hasNextPage = true;
    let totalRawFetched = 0;

    console.log('[DantiaService-V2] Iniciando descarga completa usando PAGE/COUNT...');



    // 1. **CRÍTICO:** Construir la cláusula WHERE *una vez* y correctamente.
    const whereOffers = [
      '_OfertaNuevoEspacio=-1', '_OfertaEuroPlanta=-1', '_OfertaCortijo=-1',
      '_OfertaFinca=-1', '_OfertaArroyo=-1', '_OfertaGamera=-1',
      '_OfertaGarden=-1', '_OfertaMarbella=-1', '_OfertaEstacion=-1'
      // Añade más condiciones de oferta si es necesario
    ].join(' or ');
    
    // Asegurarse de que whereOffers no esté vacío
    if (!whereOffers) {
        console.error("[DantiaService-V2] Error: El array whereOffers está vacío. Abortando.");
        return []; 
    }
    
    const finalWhere = `CodigoEmpresa=1 and (${whereOffers})`; 
    const ruta = '/adArticulosCatalogo/query';
    console.log(`[DantiaService-V2] Usando cláusula WHERE: ${finalWhere}`);

    // 2. Bucle para pedir páginas (con límite de seguridad)
    while (hasNextPage) {
      // Comprobación de seguridad
      if (currentPage > MAX_PAGES_TO_FETCH) {
          console.warn(`[DantiaService-V2] Se alcanzó el límite de seguridad (${MAX_PAGES_TO_FETCH} páginas). Deteniendo descarga.`);
          hasNextPage = false;
          continue;
      }

      try {
        // *** USAR 'page' y 'count' para Dantia ***
        const queryParams = {
          count: PAGE_LIMIT,
          page: currentPage, // Usar el número de página actual
          where: finalWhere
        };

        console.log(`[DantiaService-V2] Pidiendo página ${currentPage}... Params: ${JSON.stringify({count: queryParams.count, page: queryParams.page})}`);

        // 3. Llamar a la API de Dantia
        // Ya no necesitamos el interceptor, porque el token se verificó al inicio.
        // Si el token expira A MITAD del bucle (improbable si dura 1h y esto tarda <1h),
        // tendríamos que añadir el interceptor de nuevo, pero por ahora esto es más limpio.
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

        // 5. Comprobar si existen más páginas
        hasNextPage = rawArticles.length === PAGE_LIMIT; 
        
        if (hasNextPage) {
            currentPage++;
        } else {
            console.log(`[DantiaService-V2] Última página recibida (${rawArticles.length} artículos). La descarga debería estar completa.`);
        }
        
      } catch (error: any) {
        console.error(`[DantiaService-V2] Error pidiendo página ${currentPage}. Abortando sincronización.`, error.message);
        // Si el error es 401/403 (Token Inválido), forzamos un re-login para la próxima vez
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
            console.error('[DantiaService-V2] Error de autenticación. Se forzará re-login en la próxima ejecución.');
            // (El auth.service se encargará de esto automáticamente la próxima vez que se llame ensureValidSession)
        }
        hasNextPage = false;
        allCleanArticles = []; 
      }
    } // Fin while

    console.log(`[DantiaService-V2] Descarga finalizada. Total artículos limpios obtenidos: ${allCleanArticles.length}`);
    if (allCleanArticles.length === MAX_PAGES_TO_FETCH * PAGE_LIMIT) {
        console.warn(`[DantiaService-V2] ADVERTENCIA: Se alcanzó el límite máximo de páginas. Los datos podrían estar incompletos.`);
    }
    return allCleanArticles;
  }
};