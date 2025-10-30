// src/services/apiClient.ts
import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { cookieJar } from '../cookieJar'; // <-- 1. Importa desde el nuevo archivo
import { ensureValidSession } from './auth.service'; // <-- 2. Vuelve a importar ensureValidSession (ahora es seguro)

const apiClient = axios.create({
  baseURL: process.env.THIRD_PARTY_API_URL,
  withCredentials: true,
});

axiosCookiejarSupport(apiClient);
apiClient.defaults.jar = cookieJar; // Usa el cookieJar compartido

// *** 3. RE-AÑADIR EL INTERCEPTOR DE REQUEST ***
// Este interceptor se ejecutará ANTES de CADA petición (ej. Pidiendo página 1, 2, 3...)
apiClient.interceptors.request.use(
  async (config) => {
    // 1. Asegura que tenemos un token válido (se loguea/refresca si es necesario)
    const accessToken = await ensureValidSession();
    
    // 2. Añade el token a la cabecera de la petición
    config.headers['x-access-token'] = accessToken;
    
    return config; // Continúa con la petición (ahora autenticada)
  },
  (error) => {
    // Maneja errores en la configuración de la petición
    return Promise.reject(error);
  }
);
// *** FIN DE LA MODIFICACIÓN ***

export default apiClient;