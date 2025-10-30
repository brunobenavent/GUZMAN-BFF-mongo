// src/services/apiClient.ts
import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
// 1. IMPORTAMOS 'ensureValidSession' OTRA VEZ
import { ensureValidSession } from './auth.service';

// Exportamos el cookieJar para que auth.service pueda usarlo
export const cookieJar = new CookieJar();

// Creamos la instancia de Axios que usará el worker
const apiClient = axios.create({
  baseURL: process.env.THIRD_PARTY_API_URL,
  withCredentials: true,
});

// Le añadimos el soporte para el cookie jar
axiosCookiejarSupport(apiClient);
apiClient.defaults.jar = cookieJar;

// 2. ¡RESTAURAMOS EL INTERCEPTOR!
// Se ejecutará ANTES de cada petición de apiClient (ej. Dantia pág 1, pág 2...)
apiClient.interceptors.request.use(
  async (config) => {
    // 3. Asegura que el token es válido (se loguea si es necesario)
    const accessToken = await ensureValidSession();
    
    // 4. Añade el token a la cabecera
    config.headers['x-access-token'] = accessToken;
    return config;
  },
  (error) => {
    // Maneja errores en la configuración de la petición
    return Promise.reject(error);
  }
);

export default apiClient;