import mongoose from 'mongoose';
import 'dotenv/config';

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI no está definida en .env');
    }
    await mongoose.connect(mongoUri);
    console.log('[BFF] MongoDB Conectado');
  } catch (err: any) {
    console.error('[BFF] Error al conectar a MongoDB:', err.message);
    process.exit(1);
  }
};