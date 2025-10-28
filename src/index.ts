import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import apiRoutes from './routes';
import { connectDB } from './db'; // Importa la conexión a BBDD
import { startSyncJob } from './jobs/sync.job'; // Importa el worker
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 4000;

// --- Middlewares ---
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Podemos permitir más, las consultas a Mongo son baratas
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
    // 1. Conecta a la BBDD
    await connectDB();
    
    // 2. Arranca el Job de Sincronización
    // (Se ejecutará 1 vez al inicio y luego cada 5 min)
    startSyncJob();

    // 3. Arranca el servidor web
    app.listen(PORT, () => {
      console.log(`[BFF] Servidor V2 (MongoDB) corriendo en http://localhost:${PORT}`);
    });
    
  } catch (error) {
    console.error("[BFF] Fallo al arrancar el servidor", error);
    process.exit(1);
  }
};

startServer();