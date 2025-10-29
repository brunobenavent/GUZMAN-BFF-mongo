// src/models/Article.model.ts
import { Schema, model } from 'mongoose';
import { ArticleDTO } from '../mappers/article.mapper'; // Importa el tipo DTO completo

// El esquema usa ArticleDTO como tipo base, pero solo define los campos a guardar
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
  imagenUrl: { type: String, default: '' }, // <- Solo definimos imagenUrl
  ofertas: {
    nuevoEspacio: { type: Boolean, default: false },
    euroPlanta: { type: Boolean, default: false },
    cortijo: { type: Boolean, default: false },
    finca: { type: Boolean, default: false },
    arroyo: { type: Boolean, default: false },
    gamera: { type: Boolean, default: false },
    garden: { type: Boolean, default: false },
    marbella: { type: Boolean, default: false },
    estacion: { type: Boolean, default: false },
  }
  // No definimos 'imagenUrlOriginal' aquí, Mongoose lo ignorará al guardar
}, {
  timestamps: true // Añade createdAt y updatedAt
});

// Índice de texto para búsqueda
articleSchema.index({
    nombreCientifico: 'text',
    nombreComun: 'text',
    codigoGuzman: 'text',
    EAN13: 'text',
    familia: 'text'
});

// El modelo usa ArticleDTO para el tipado, Mongoose usa el schema definido arriba
const Article = model<ArticleDTO>('Article', articleSchema);

export default Article;