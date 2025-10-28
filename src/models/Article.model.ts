// src/models/Article.model.ts
import { Schema, model } from 'mongoose';
import { ArticleDTO } from '../mappers/article.mapper';

// El esquema ahora incluye imagenUrl
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
  // *** NUEVO CAMPO AÑADIDO ***
  imagenUrl: { type: String }, // Guardamos la URL calculada
  // *** FIN NUEVO CAMPO ***
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
}, {
  timestamps: true
});

// Índice de texto (puedes añadir más campos si buscas por ellos)
articleSchema.index({
    nombreCientifico: 'text',
    nombreComun: 'text',
    codigoGuzman: 'text',
    EAN13: 'text',
    familia: 'text'
});

const Article = model<ArticleDTO>('Article', articleSchema);

export default Article;