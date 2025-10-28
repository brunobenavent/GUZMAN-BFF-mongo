import { Schema, model } from 'mongoose';
import { ArticleDTO } from '../mappers/article.mapper';

// El esquema de Mongoose debe coincidir con nuestro DTO limpio
const articleSchema = new Schema<ArticleDTO>({
  id: { type: String, required: true, unique: true, index: true },
  nombre: { type: String, required: true },
  descripcion: { type: String },
  precio: { type: Number, required: true },
  maceta: { type: String },
  altura: { type: String },
  ofertas: {
    nuevoEspacio: { type: Boolean },
    euroPlanta: { type: Boolean },
    cortijo: { type: Boolean },
    finca: { type: Boolean },
    arroyo: { type: Boolean },
    gamera: { type: Boolean },
    garden: { type: Boolean },
    marbella: { type: Boolean },
    estacion: { type: Boolean },
  }
});

// ¡Importante! Creamos un índice de texto para poder buscar
articleSchema.index({ nombre: 'text', descripcion: 'text', id: 'text' });

const Article = model<ArticleDTO>('Article', articleSchema);

export default Article;