// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import User from '../models/User.model'; // <-- RUTA CORREGIDA

export const createInitialAdmin = async () => {
  try {
    const adminEmail = 'comercial@tuempresa.com'; // Cambia esto
    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
      console.log('[BFF] No se encontró admin. Creando usuario "comercial" inicial...');
      await userService.registerUser({
        email: adminEmail,
        nombre: 'Comercial Admin',
        password: process.env.ADMIN_SECRET_PASSWORD,
        role: 'comercial',
        priceType: 'PVP',
      });
      console.log('[BFF] Usuario "comercial" creado. Email: ' + adminEmail);
    }
  } catch (error: any) {
    console.error('[BFF] Error al crear admin inicial:', error.message);
  }
};

export const authController = {
  login: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
      }
      const { token, user } = await userService.loginUser(email, password);
      res.json({ message: 'Login exitoso', token, user });
    } catch (error: any) {
      console.error('[Login Error]', error.message);
      if (error.message.includes('Credenciales inválidas')) {
        return res.status(401).json({ message: error.message });
      }
      next(error);
    }
  },

  register: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, nombre, sageCustomerId, priceType, role } = req.body;
      if (!email || !password || !nombre || !role) {
         return res.status(400).json({ message: 'Faltan campos requeridos (email, password, nombre, role).' });
      }
      const newUser = await userService.registerUser({
          email, password, nombre, role: role || 'cliente', sageCustomerId, priceType
      });
      const userResponse = newUser.toObject();
      delete userResponse.password; 
      res.status(201).json({ message: 'Usuario creado con éxito', user: userResponse });
    } catch (error: any) {
      if (error.message.includes('El email ya está registrado')) {
        return res.status(409).json({ message: error.message });
      }
      next(error);
    }
  },
};