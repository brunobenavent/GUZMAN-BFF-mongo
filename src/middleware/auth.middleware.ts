// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../services/user.service'; // Importamos la interfaz del payload

/**
 * Middleware de Autenticación ESTRICTA (verificar JWT).
 * Si no hay token, o es inválido, RECHAZA la petición.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    const token = authHeader.split(' ')[1]; // Quita "Bearer "
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET no está definido en el servidor.');
    }

    // Verifica el token
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    req.user = decoded; // Añade el payload al request
    next(); // Pasa al siguiente middleware/controlador

  } catch (error) {
    console.error('[Auth Error]', (error as Error).message);
    if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: 'Token expirado.' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ message: 'Token inválido.' });
    }
    return res.status(500).json({ message: 'Error interno de autenticación.' });
  }
};

/**
 * Middleware de Autorización (verificar Rol).
 * Se usa *después* de 'authenticate'.
 */
export const authorize = (allowedRoles: Array<"cliente" | "comercial" | "trabajador">) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autenticado.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Acceso denegado. No tienes permisos suficientes.',
        requiredRole: allowedRoles,
        yourRole: req.user.role 
      });
    }
    next(); // Permiso concedido
  };
};

/**
 * Middleware de Autenticación OPCIONAL (tryAuthenticate).
 * Intenta verificar un token JWT si existe, pero no falla si no se proporciona.
 */
export const tryAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Si no hay cabecera o no es Bearer, simplemente pasa (usuario anónimo)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); 
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.warn('[Auth Opcional] JWT_SECRET no definido. Omitiendo.');
      return next(); // Pasa pero no autentica
    }

    // Intenta verificar el token
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // ¡Éxito! Añade el usuario al request
    req.user = decoded;
    next();

  } catch (error) {
    // Si el token existe pero es inválido o expirado, lo tratamos como anónimo
    console.warn('[Auth Opcional] Token inválido o expirado. Tratando como anónimo.', (error as Error).message);
    next(); // Continúa sin 'req.user'
  }
};