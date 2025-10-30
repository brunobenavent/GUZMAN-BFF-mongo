// src/models/Article.model.ts
import { Schema, model } from 'mongoose';
import { ArticleDTO } from '../mappers/article.mapper'; // Importa el tipo DTO limpio

// El esquema ahora coincide 1:1 con el DTO limpio
const articleSchema = new Schema<ArticleDTO>({
  codigoGuzman: { type: String, required: true, unique: true, index: true },
  EAN13: { type: String, index: true },
  nombreCientifico: { type: String, required: true },
  familia: { type: String, index: true },
  PVP: { type: Number, required: true },
  maceta: { type: String },
  calibre: { type: String },
  altura: { type: String },
  presentacion: { type: String },
  unidadesPorCarro: { type: Number, default: 0 },
  unidadesPorTabla: { type: Number, default: 0 },
  unidadesPorCaja: { type: Number, default: 0 },
  acabado: { type: String },
  tamano: { type: String },
  nombreComun: { type: String },
  precio2: { type: Number, default: 0 },
  precio3: { type: Number, default: 0 },
  imagenUrl: { type: String, default: '' }, // Campo para la URL Cloudinary
  ofertas: { /* ... (tus ofertas booleanas) ... */ }
}, {
  timestamps: true
});

// Índice de texto (igual que antes)
articleSchema.index({
    nombreCientifico: 'text',
    nombreComun: 'text',
    codigoGuzman: 'text',
    EAN13: 'text',
    familia: 'text'
});

const Article = model<ArticleDTO>('Article', articleSchema);

export default Article;