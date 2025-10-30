// Importa la interfaz del payload que definiste en user.service
import { JwtPayload } from '../../services/user.service';

declare global {
  namespace Express {
    interface Request {
      // Ahora TypeScript sabe que 'req.user' puede existir y es de tipo JwtPayload
      user?: JwtPayload; 
    }
  }
}