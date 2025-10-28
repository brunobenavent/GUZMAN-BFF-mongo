import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
// Importamos 'auth.service' de forma diferida para evitar un bucle de importación
import { ensureValidSession } from './auth.service';

export const cookieJar = new CookieJar();

// Cliente Axios que usará nuestro interceptor
const apiClient = axios.create({
  baseURL: process.env.THIRD_PARTY_API_URL,
  withCredentials: true,
});

axiosCookiejarSupport(apiClient);
apiClient.defaults.jar = cookieJar;

// Interceptor: se asegura de que estemos logueados ANTES de cada petición
apiClient.interceptors.request.use(
  async (config) => {
    const accessToken = await ensureValidSession();
    config.headers['x-access-token'] = accessToken;
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;