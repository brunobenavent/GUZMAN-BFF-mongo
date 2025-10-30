// src/models/User.model.ts
import { Schema, model, Document } from 'mongoose'; // <-- 1. Importa 'Document'
import bcrypt from 'bcryptjs';

// Define los roles y tipos de precio
type UserRole = "cliente" | "comercial" | "trabajador";
type PriceType = "PVP" | "precio2" | "precio3";

// 2. Haz que la interfaz EXTIENDA (herede) de 'Document'
export interface IUser extends Document {
  email: string;
  password: string;
  nombre: string;
  role: UserRole;
  sageCustomerId: string;
  priceType: PriceType;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String, required: true, unique: true, lowercase: true, trim: true, index: true
  },
  password: {
    type: String, required: true, select: false // No incluir al consultar
  },
  nombre: { type: String, required: true },
  role: {
    type: String, required: true, enum: ["cliente", "comercial", "trabajador"], default: "cliente"
  },
  sageCustomerId: { type: String, required: false, index: true },
  priceType: {
    type: String, required: true, enum: ["PVP", "precio2", "precio3"], default: "PVP"
  },
}, {
  timestamps: true
});

// Hook de Mongoose: ANTES de guardar, hashear la contraseña
userSchema.pre('save', async function (next) { 
  // 'this' ahora es del tipo 'IUser' (que extiende Document) y TypeScript encontrará 'isModified'
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar la contraseña
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
};

const User = model<IUser>('User', userSchema);

export default User;