// src/routes/index.ts
import { Router } from 'express';
import multer from 'multer';
import { articleController } from '../controllers/article.controller';
import { isAdmin } from '../middleware/auth.middleware'; // Asegúrate de tener este archivo o comenta la línea

const router = Router();

// Configuración de Multer
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB
});

// --- Rutas ---
router.get('/status', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Esta es la línea 17 que fallaba. Ahora 'articleController.getAll' debería estar definido.
router.get('/articulos', articleController.getAll); 

router.get('/articulos/:codigoGuzman', articleController.getByCodigo);

// Ruta protegida para actualizar imagen
router.put(
    '/articulos/:codigoGuzman/imagen',
    // isAdmin, // Comenta esta línea si aún no has creado el middleware 'auth.middleware.ts'
    upload.single('imagen'),
    articleController.updateImage
);

export default router; 