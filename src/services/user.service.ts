// src/services/user.service.ts
import User, { IUser } from '../models/User.model'; // Asegúrate que la ruta es ../models/
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  role: "cliente" | "comercial" | "trabajador";
  priceType: "PVP" | "precio2" | "precio3";
}

function generateToken(user: IUser): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no está definido en .env');
  }

  const payload: JwtPayload = {
    id: user.id, // <-- CAMBIO AQUÍ: usa .id en lugar de ._id.toString()
    role: user.role,
    priceType: user.priceType,
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

export const userService = {
  registerUser: async (userData: Partial<IUser>): Promise<IUser> => {
    try {
      const user = new User(userData);
      await user.save();
      return user;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error('El email ya está registrado.');
      }
      throw error;
    }
  },

  loginUser: async (email: string, password: string): Promise<{ token: string; user: JwtPayload }> => {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      throw new Error('Credenciales inválidas (email).');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Credenciales inválidas (contraseña).');
    }
    
    const finalPriceType = user.priceType;
    console.log(`[Login] Usuario ${user.email} logueado. Usando precio de BBDD: ${finalPriceType}`);

    const token = generateToken(user);
    
    return {
      token,
      user: {
        id: user.id, // <-- CAMBIO AQUÍ: usa .id en lugar de ._id.toString()
        role: user.role,
        priceType: finalPriceType,
      }
    };
  },
};