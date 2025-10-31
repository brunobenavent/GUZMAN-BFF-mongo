// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import apiRoutes from './routes';
import { connectDB } from './db';
import { startSyncJob } from './jobs/sync.job';
import { createInitialAdmin } from './controllers/auth.controller';
import rateLimit from 'express-rate-limit';

// --- 1. Definiciones de 'app' y 'PORT' ---
const app = express();
const PORT = process.env.PORT || 4001; // Asegúrate de usar el puerto correcto

// --- Middlewares ---
app.use(express.json()); // Para parsear JSON
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Demasiadas peticiones desde esta IP.',
}));
app.use(cors({ origin: process.env.FRONTEND_URL }));

// --- Rutas ---
app.use('/api', apiRoutes);

// --- Manejador de Errores ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  if (err.message.includes('no encontrado')) {
    return res.status(404).json({ message: err.message });
  }
  res.status(500).json({ message: 'Error interno del servidor' });
});

// --- Función de Arranque ---
const startServer = async () => {
  try {
    await connectDB();
    await createInitialAdmin();
    startSyncJob();

    // --- 2. 'app' y 'PORT' se usan aquí ---
    app.listen(PORT, () => {
      console.log(`[BFF] Servidor V2 (MongoDB) corriendo en ${process.env.BACKEND_URL}:${PORT}`);
    });
    
  } catch (error) {
    console.error("[BFF] Fallo al arrancar el servidor", error);
    process.exit(1);
  }
};

startServer();