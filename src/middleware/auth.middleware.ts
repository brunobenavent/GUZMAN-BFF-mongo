// src/middleware/auth.middleware.ts (Archivo nuevo)
import { Request, Response, NextFunction } from 'express';

// Ejemplo: Verifica un token simple en una cabecera (¡NO USAR EN PRODUCCIÓN!)
// Deberías usar JWT, sesiones, etc.
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    const adminToken = req.headers['x-admin-token']; // O donde sea que envíes tu token
    if (adminToken === process.env.ADMIN_SECRET_TOKEN) { // Compara con un secreto en .env
        next(); // El usuario es admin, continuar
    } else {
        res.status(403).json({ message: 'Acceso denegado: Se requiere permiso de administrador.' });
    }
};

// No olvides añadir ADMIN_SECRET_TOKEN a tu .env