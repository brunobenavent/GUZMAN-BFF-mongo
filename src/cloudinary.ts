// src/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';

// Check if Cloudinary credentials are provided
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('[Cloudinary Config] ADVERTENCIA: Faltan credenciales de Cloudinary en .env. La subida de imágenes fallará.');
}

// Configura Cloudinary con las credenciales del .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Forzar HTTPS
});

// Exporta la instancia configurada para usarla en otros archivos
export default cloudinary;