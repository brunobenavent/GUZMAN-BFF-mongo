// src/routes/index.ts
import { Router } from 'express';
import multer from 'multer';
import { articleController } from '../controllers/article.controller';
import { authController } from '../controllers/auth.controller';
// 1. Importar los 3 middlewares
import { authenticate, authorize, tryAuthenticate } from '../middleware/auth.middleware'; 

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- Rutas Públicas (Sin Auth) ---
router.get('/status', (req, res) => res.json({ status: 'ok' }));
router.post('/auth/login', authController.login);

// --- Rutas de Artículos (CON AUTENTICACIÓN OPCIONAL) ---
// 2. Cambiamos 'authenticate' por 'tryAuthenticate'
router.get('/articulos', 
    tryAuthenticate, // <-- CAMBIO AQUÍ
    articleController.getAll
);
router.get('/articulos/:codigoGuzman', 
    tryAuthenticate, // <-- CAMBIO AQUÍ
    articleController.getByCodigo
);

// --- Rutas de Administración (CON AUTENTICACIÓN ESTRICTA) ---
const isComercial = authorize(['comercial']);
const canEditImage = authorize(['comercial', 'trabajador']);

router.post(
    '/auth/register',
    authenticate, // <-- ESTRICTO
    isComercial,
    authController.register
);
router.put(
    '/articulos/:codigoGuzman',
    authenticate, // <-- ESTRICTO
    isComercial,
    articleController.updateArticle
);
router.put(
    '/articulos/:codigoGuzman/imagen',
    authenticate, // <-- ESTRICTO
    canEditImage,
    upload.single('imagen'),
    articleController.updateImage
);

export default router;