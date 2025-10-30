// src/jobs/sync.job.ts
import cron from 'node-cron';
// ¡YA NO importamos 'cloudinary'!
import { dantiaService } from '../services/dantia.service';
import Article from '../models/Article.model';
import { ArticleDTO } from '../mappers/article.mapper';

let isSyncing = false;

const syncArticles = async () => {
  if (isSyncing) {
    console.log('[CronJob] Sincronización anterior sigue en curso. Omitiendo.');
    return;
  }
  
  isSyncing = true;
  console.log('[CronJob] Iniciando tarea de sincronización...');

  try {
    // 1. Obtener artículos de Dantia
    // 'fetchedArticles' ya contiene las URLs de Cloudinary gracias al mapper
    const fetchedArticles: ArticleDTO[] = await dantiaService.fetchAllArticles();

    if (fetchedArticles.length === 0) {
      console.log('[CronJob] No se obtuvieron artículos válidos de Dantia. MongoDB no actualizado.');
      isSyncing = false;
      return;
    }

    // 2. Filtrar artículos sin ID válido (sigue siendo una buena práctica)
    const articlesToSave = fetchedArticles.filter(article => {
        if (!article.codigoGuzman || typeof article.codigoGuzman !== 'string' || article.codigoGuzman.trim() === '') {
            console.warn(`[CronJob] Omitiendo artículo SIN codigoGuzman válido: ${JSON.stringify(article)}`);
            return false;
        }
        return true;
    });

    if (articlesToSave.length === 0) {
        console.log('[CronJob] Ningún artículo tenía un codigoGuzman válido. MongoDB no actualizado.');
        isSyncing = false;
        return;
    }

    console.log(`[CronJob] ${articlesToSave.length} artículos válidos listos para guardar.`);

    // 3. Borrar datos antiguos de MongoDB
    console.log('[CronJob] Borrando artículos antiguos de MongoDB...');
    await Article.deleteMany({});

    // 4. Insertar los nuevos datos
    console.log(`[CronJob] Insertando ${articlesToSave.length} artículos actualizados en MongoDB...`);
    await Article.insertMany(articlesToSave, { ordered: false });

    console.log('[CronJob] Sincronización completada con éxito.');

  } catch (error: any) {
    console.error('[CronJob] Error durante la sincronización:', error.message);
  } finally {
     isSyncing = false;
     console.log('[CronJob] Tarea de sincronización finalizada.');
  }
};

// Planificador (ejecuta cada día a las 3 AM)
export const startSyncJob = () => {
  const cronSchedule = '0 3 * * *'; // Cada día a las 3 AM
  console.log(`[BFF] Tarea de sincronización configurada para: ${cronSchedule}`);
  
  cron.schedule(cronSchedule, () => {
    syncArticles();
  });

  console.log('[BFF] Ejecutando sincronización inicial...');
  syncArticles();
};