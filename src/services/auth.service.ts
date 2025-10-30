import axios from 'axios';
import 'dotenv/config';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { cookieJar } from '../cookieJar'; // <-- ¡CAMBIO IMPORTANTE! Importa desde el nuevo archivo

// Interfaz para la respuesta esperada del login de Dantia
interface LoginResponse {
  token: string;      // El access token
  expiresIn: number; // Duración en segundos
}

// Caché en memoria para guardar el token y su expiración
let sessionCache = {
  accessToken: null as string | null,
  expiresAt: 0, // Timestamp UNIX (en milisegundos) de cuándo expira
};

/**
 * Realiza el proceso de login contra la API de Dantia.
 * Esta función es INTERNA y es llamada por ensureValidSession.
 */
async function login(): Promise<string> {
  try {
    console.log('[AuthService] Realizando login en la API de terceros...');
    
    // Verifica que la URL base esté definida en .env
    const baseURL = process.env.THIRD_PARTY_API_URL;
    if (!baseURL || baseURL.trim() === '') {
        throw new Error('La variable de entorno THIRD_PARTY_API_URL no está definida o está vacía en .env');
    }
    console.log(`[AuthService DEBUG] Usando baseURL para autenticación: ${baseURL}`); 

    // Cliente Axios temporal SOLO para el login
    const authClient = axios.create({
      baseURL: baseURL,
      withCredentials: true,
    });
    axiosCookiejarSupport(authClient);
    authClient.defaults.jar = cookieJar; // Usa el cookieJar compartido

    const loginParams = {
      name: process.env.THIRD_PARTY_USERNAME,
      password: process.env.THIRD_PARTY_PASSWORD,
    };
    
    const loginEndpoint = '/autentificar'; 

    console.log(`[AuthService DEBUG] Intentando GET a (URL aproximada): ${baseURL}${loginEndpoint}?name=${loginParams.name}&password=${loginParams.password}`); 
    console.log(`[AuthService DEBUG] Parámetros reales para Axios: ${JSON.stringify(loginParams)}`); 

    // Hacemos la petición GET al endpoint de login
    const response = await authClient.get<LoginResponse>(loginEndpoint, { 
      params: loginParams 
    });

    console.log(`[AuthService DEBUG] Respuesta Login Raw: ${JSON.stringify(response.data)}`);
    const { token, expiresIn } = response.data;

    let effectiveExpiresIn = expiresIn;

    // Verifica que expiresIn sea un número válido
    if (typeof expiresIn !== 'number' || expiresIn <= 0) {
        console.warn(`[AuthService WARN] 'expiresIn' recibido no es un número válido: ${expiresIn}. Usando 3600s por defecto.`);
        effectiveExpiresIn = 3600; // Asigna 1 hora por defecto
    } else {
        console.log(`[AuthService DEBUG] expiresIn recibido: ${expiresIn} (tipo: ${typeof expiresIn})`);
    }

    const marginSeconds = 60; // Margen de seguridad
    sessionCache.expiresAt = Date.now() + (effectiveExpiresIn - marginSeconds) * 1000;

    // Verifica que el token exista
    if (!token) {
         throw new Error('Respuesta de login inválida (token faltante)');
    }
    sessionCache.accessToken = token;

    const expiryDate = new Date(sessionCache.expiresAt);
    const calculatedDuration = ((sessionCache.expiresAt - Date.now()) / 1000).toFixed(0);
    console.log(`[AuthService DEBUG] Token guardado. Válido hasta (estimado): ${expiryDate.toISOString()} (aprox. ${calculatedDuration} segundos restantes)`);

    console.log('[AuthService] Login exitoso.');
    return token; // Devuelve el token obtenido

  } catch (error: any) {
    // Log más detallado si es un error de Axios
    if (axios.isAxiosError(error)) {
        console.error('[AuthService] Error Axios al hacer login:', {
            message: error.message,
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            method: error.config?.method,
            code: error.code,
            status: error.response?.status
        });
    } else {
        console.error('[AuthService] Error Genérico al hacer login:', error.message);
    }
    sessionCache.accessToken = null;
    sessionCache.expiresAt = 0; 
    throw new Error(`No se pudo autenticar con Dantia: ${error.message}`); 
  }
}

/**
 * Función pública usada por el worker (dantia.service).
 * Asegura que haya un token válido en sessionCache, refrescándolo si es necesario.
 * ESTA FUNCIÓN SÍ SE EXPORTA.
 * @returns {Promise<string>} El accessToken válido.
 */
export async function ensureValidSession(): Promise<string> {
  const now = Date.now();
  const expiresAt = sessionCache.expiresAt;
  const isValid = !!sessionCache.accessToken && expiresAt > now;

  const nowISO = new Date(now).toISOString();
  const expiresAtISO = expiresAt > 0 ? new Date(expiresAt).toISOString() : 'N/A';
  console.log(`[AuthService Check] Ahora: ${nowISO}, Token Expira: ${expiresAtISO}, ¿Válido?: ${isValid}`);

  if (isValid) {
    return sessionCache.accessToken!; // Devuelve el token cacheado
  }

  // Si no es válido (null, undefined o expirado)
  console.log('[AuthService] Token no válido o expirado. Refrescando sesión...');
  return await login(); // Llama a la función interna login
}