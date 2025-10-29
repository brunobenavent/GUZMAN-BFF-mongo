// src/jobs/sync.job.ts
import cron from 'node-cron';
import cloudinary from '../cloudinary'; // Importa la instancia configurada
import { dantiaService } from '../services/dantia.service'; // Servicio que habla con Dantia
import Article from '../models/Article.model'; // Modelo Mongoose
import { ArticleDTO } from '../mappers/article.mapper'; // Tipo DTO (incluye imagenUrlOriginal)
// Importa fetch si usas Node < 18
// import fetch from 'node-fetch';

let isSyncing = false; // Flag para evitar solapamientos

// Opciones para la subida a Cloudinary
const cloudinaryUploadOptions = {
    folder: 'articulos_guzman', // Carpeta destino en Cloudinary
    overwrite: false, // No volver a subir/procesar si ya existe con ese public_id
    fetch_format: 'auto', // Optimizar formato (webp, avif)
    quality: 'auto:good', // Balance calidad/peso (puedes usar 'auto:eco', 'auto:low')
    // Opcional: añadir transformaciones al subir (ej. limitar tamaño)
    // transformation: [
    //   { width: 1200, height: 1200, crop: "limit" } // Limita a 1200px max
    // ]
};

// URL placeholder si una imagen falla al subirse
const IMAGE_ERROR_PLACEHOLDER = ''; // O una URL a una imagen genérica

const syncArticles = async () => {
  if (isSyncing) {
    console.log('[CronJob] Sincronización anterior sigue en curso. Omitiendo.');
    return;
  }

  isSyncing = true;
  console.log('[CronJob] Iniciando tarea de sincronización con Cloudinary...');

  try {
    // 1. Obtener artículos de Dantia (ya transformados por Zod, con imagenUrlOriginal)
    const fetchedArticles: ArticleDTO[] = await dantiaService.fetchAllArticles();
    if (fetchedArticles.length === 0) {
      console.log('[CronJob] No se obtuvieron artículos válidos de Dantia. MongoDB no actualizado.');
      isSyncing = false;
      return;
    }

    console.log(`[CronJob] ${fetchedArticles.length} artículos obtenidos de Dantia. Procesando imágenes con Cloudinary...`);

    // Array para los artículos finales (con URL Cloudinary) a guardar en Mongo
    const articlesToSave = [];
    let processedCount = 0;
    let newUploads = 0;
    let existingCount = 0;
    let failedCount = 0;

    // 2. Procesar cada artículo para subir/verificar imagen en Cloudinary
    // Usamos un bucle for...of para poder usar await dentro
    for (const article of fetchedArticles) {
      processedCount++;
      let finalImageUrl = IMAGE_ERROR_PLACEHOLDER; // Empezar con placeholder

      // Solo procesar si tenemos URL original válida y codigoGuzman
      if (article.imagenUrlOriginal && article.codigoGuzman && article.imagenUrlOriginal.startsWith('http')) {
        const publicId = article.codigoGuzman; // Usamos codigoGuzman como ID único en Cloudinary

        try {
            // A) Comprobar si ya existe usando el public_id
            // cloudinary.api.resource pide info de un recurso existente. Si no existe, lanza error.
            const existingResource = await cloudinary.api.resource(publicId, { type: 'upload', resource_type: 'image' });
            // Si no lanzó error, la imagen existe
            finalImageUrl = existingResource.secure_url; // Usar la URL segura existente
            existingCount++;
            // console.log(`[Cloudinary] Imagen ${publicId} ya existe.`); // Log opcional

        } catch (error: any) {
            // Si el error es 'Not found', intentamos subirla
            if (error.error?.http_code === 404) {
                console.log(`[Cloudinary] Imagen ${publicId} no encontrada. Subiendo desde ${article.imagenUrlOriginal}...`);
                try {
                    // B) Subir la imagen desde la URL original
                    const uploadResult = await cloudinary.uploader.upload(article.imagenUrlOriginal, {
                        ...cloudinaryUploadOptions,
                        public_id: publicId, // Asignar el ID único
                    });
                    finalImageUrl = uploadResult.secure_url; // Usar la nueva URL segura
                    newUploads++;
                    console.log(`[Cloudinary] Imagen ${publicId} subida OK. URL: ${finalImageUrl}`);
                } catch (uploadError: any) {
                    failedCount++;
                    console.error(`[Cloudinary] ERROR AL SUBIR imagen ${publicId} desde ${article.imagenUrlOriginal}:`, uploadError?.message || uploadError);
                    // finalImageUrl ya es el placeholder
                }
            } else {
                // Otro error al comprobar la existencia
                failedCount++;
                console.error(`[Cloudinary] ERROR AL COMPROBAR imagen ${publicId}:`, error?.error?.message || error);
                // finalImageUrl ya es el placeholder
            }
        }
      } else {
          // Log si falta URL original o codigoGuzman
          if(article.codigoGuzman) console.warn(`[CronJob] Omitiendo procesamiento Cloudinary para ${article.codigoGuzman} (falta URL original válida).`);
          // Si falta codigoGuzman, ya fue logueado/filtrado antes si aplicaste esa lógica
          failedCount++; // Contar como fallo si no podemos procesar
      }

      // Crear el objeto final para Mongo (sin imagenUrlOriginal)
      const articleForMongo = { ...article, imagenUrl: finalImageUrl };
      // Eliminar el campo temporal antes de guardar
      delete (articleForMongo as any).imagenUrlOriginal; 
      articlesToSave.push(articleForMongo);

      // Log de progreso (menos frecuente para no llenar la consola)
      if (processedCount % 200 === 0 || processedCount === fetchedArticles.length) {
          console.log(`[CronJob] Progreso Cloudinary: ${processedCount}/${fetchedArticles.length} artículos procesados (Nuevas: ${newUploads}, Existentes: ${existingCount}, Fallos: ${failedCount}).`);
      }
    } // Fin del bucle for

    console.log(`[CronJob] Procesamiento Cloudinary finalizado. Nuevas: ${newUploads}, Existentes: ${existingCount}, Fallos: ${failedCount}.`);

    // Verificar si quedan artículos para guardar (podrían haber fallado todos)
    if (articlesToSave.length === 0) {
        console.error('[CronJob] Error crítico: Ningún artículo para guardar después del procesamiento de imágenes.');
        isSyncing = false;
        return;
    }

    // 3. Borrar datos antiguos de MongoDB
    console.log('[CronJob] Borrando artículos antiguos de MongoDB...');
    await Article.deleteMany({});

    // 4. Insertar los nuevos datos (con URLs de Cloudinary)
    console.log(`[CronJob] Insertando ${articlesToSave.length} artículos actualizados en MongoDB...`);
    await Article.insertMany(articlesToSave, { ordered: false }); // ordered:false intenta seguir aunque haya duplicados

    console.log('[CronJob] Sincronización con Cloudinary completada con éxito.');

  } catch (error: any) {
    console.error('[CronJob] Error CRÍTICO durante la sincronización:', error.message);
  } finally {
     isSyncing = false;
     console.log('[CronJob] Tarea de sincronización finalizada.');
  }
};

// Planificador (ejecuta cada día a las 3 AM o cada 5 min, según configures)
export const startSyncJob = () => {
  const cronSchedule = '0 3 * * *'; // Cada día a las 3 AM
  // const cronSchedule = '*/5 * * * *'; // Cada 5 minutos (para pruebas)
  console.log(`[BFF] Tarea de sincronización con Cloudinary configurada para ejecutarse según: ${cronSchedule}`);
  
  cron.schedule(cronSchedule, () => {
    syncArticles();
  });

  // Ejecuta la tarea una vez al arrancar
  console.log('[BFF] Ejecutando sincronización inicial con Cloudinary...');
  syncArticles();
};