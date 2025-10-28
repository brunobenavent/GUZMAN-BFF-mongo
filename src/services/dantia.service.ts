// src/services/dantia.service.ts

import apiClient from './apiClient';
import { z } from 'zod';
import { articleDTOSchema, ArticleDTO } from '../mappers/article.mapper';
import axios from 'axios'; // Para comprobar errores específicos de Axios

// Estructura de respuesta de la API de Dantia
interface ApiResponse {
  $resources: any[]; // 'any' porque Zod validará
  $itemsPerPage: number;
}

const PAGE_LIMIT = 100; // Artículos por página pedidos a Dantia

// *** LÍMITE DE SEGURIDAD *** (Ajusta si es necesario, pero 25 debería ser suficiente para ~1355)
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
    
    // Asegurarse de que whereOffers no esté vacío antes de crear la cláusula final
    if (!whereOffers) {
        console.error("[DantiaService-V2] Error: El array whereOffers está vacío o es inválido. Abortando sincronización.");
        return []; // Devolver vacío para prevenir errores
    }
    
    const finalWhere = `CodigoEmpresa=1 and (${whereOffers})`; // Construcción correcta
    const ruta = '/adArticulosCatalogo/query';
    console.log(`[DantiaService-V2] Usando cláusula WHERE: ${finalWhere}`);

    // 2. Bucle para pedir páginas (con límite de seguridad)
    while (hasNextPage) {
      // Comprobación de seguridad
      if (currentPage > MAX_PAGES_TO_FETCH) {
          console.warn(`[DantiaService-V2] Se alcanzó el límite de seguridad (${MAX_PAGES_TO_FETCH} páginas). Deteniendo descarga.`);
          hasNextPage = false;
          continue; // Salir del bucle pero mantener los datos obtenidos
      }

      try {
        // *** USAR 'page' y 'count' para Dantia ***
        const queryParams = {
          count: PAGE_LIMIT,
          page: currentPage, // Usar el número de página actual
          where: finalWhere
        };
        // *************************************

        console.log(`[DantiaService-V2] Pidiendo página ${currentPage}... Params: ${JSON.stringify({count: queryParams.count, page: queryParams.page})}`); // Log menos verboso

        // 3. Llamar a la API de Dantia
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

        // 5. Comprobar si existen más páginas (Dantia devuelve menos artículos que los pedidos)
        // IMPORTANTE: Dantia podría devolver 100 incluso en la última página si el total es múltiplo de 100.
        // Confiamos en que Dantia *no* devuelva la página 1 de nuevo para páginas inexistentes.
        hasNextPage = rawArticles.length === PAGE_LIMIT; 
        
        if (hasNextPage) {
            currentPage++;
        } else {
            console.log(`[DantiaService-V2] Última página recibida (${rawArticles.length} artículos). La descarga debería estar completa.`);
        }
        
      } catch (error: any) {
        console.error(`[DantiaService-V2] Error pidiendo página ${currentPage}. Abortando sincronización.`, error.message);
        if (axios.isAxiosError(error)) console.error('[DantiaService-V2] Detalle error Dantia:', error.response?.data);
        hasNextPage = false; // Detener bucle en caso de error
        allCleanArticles = []; // Indicar fallo devolviendo array vacío
      }
    } // Fin while

    console.log(`[DantiaService-V2] Descarga finalizada. Total artículos limpios obtenidos: ${allCleanArticles.length}`);
    // Si el total obtenido es igual al límite, registrar advertencia
    if (allCleanArticles.length === MAX_PAGES_TO_FETCH * PAGE_LIMIT) {
        console.warn(`[DantiaService-V2] ADVERTENCIA: Se alcanzó el límite máximo de páginas durante la descarga. Los datos podrían estar incompletos si el bug de paginación de Dantia aún existe.`);
    }
    return allCleanArticles;
  }
};