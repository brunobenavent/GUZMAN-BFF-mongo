// src/services/auth.service.ts

import axios from 'axios';
import 'dotenv/config';
// Asegúrate de que esta importación sea correcta según tu instalación
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support'; 
// Importamos el cookieJar compartido desde apiClient
import { cookieJar } from './apiClient'; 

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
 * Guarda la cookie en el cookieJar compartido.
 * Guarda el accessToken y su expiración en sessionCache.
 * @returns {Promise<string>} El accessToken obtenido.
 */
async function login(): Promise<string> {
  try {
    console.log('[AuthService] Realizando login en la API de terceros...');
    
    // Verifica que la URL base esté definida en .env
    const baseURL = process.env.THIRD_PARTY_API_URL;
    if (!baseURL || baseURL.trim() === '') { // Comprueba también que no esté vacía
        throw new Error('La variable de entorno THIRD_PARTY_API_URL no está definida o está vacía en .env');
    }
    // *** Log de Depuración ***
    console.log(`[AuthService DEBUG] Usando baseURL para autenticación: ${baseURL}`); 
    // *** Fin Log ***

    // Cliente Axios temporal SOLO para el login (evita bucles de interceptor)
    const authClient = axios.create({
      baseURL: baseURL, // Usa la URL base verificada
      withCredentials: true, // Importante para manejar cookies
    });
    // Aplica el soporte de cookies usando el MISMO cookieJar que apiClient
    axiosCookiejarSupport(authClient);
    authClient.defaults.jar = cookieJar; 

    // Credenciales desde .env
    const loginParams = {
      name: process.env.THIRD_PARTY_USERNAME,
      password: process.env.THIRD_PARTY_PASSWORD,
    };
    
    // Endpoint específico para el login
    const loginEndpoint = '/autentificar'; 

    // *** Logs de Depuración Detallados ***
    // Construye la URL completa aproximada solo para mostrarla en el log
    const fullLoginURL = `${baseURL}${loginEndpoint}?name=${loginParams.name}&password=${loginParams.password}`; // Axios manejará la codificación
    console.log(`[AuthService DEBUG] Intentando GET a (URL aproximada): ${fullLoginURL}`); 
    console.log(`[AuthService DEBUG] Parámetros reales para Axios: ${JSON.stringify(loginParams)}`); 
    // *** Fin Logs Detallados ***

    // Hacemos la petición GET al endpoint de login con los parámetros
    const response = await authClient.get<LoginResponse>(loginEndpoint, { 
      params: loginParams 
    });

    // *** Logs de Depuración de la Respuesta ***
    console.log(`[AuthService DEBUG] Respuesta Login Raw: ${JSON.stringify(response.data)}`);
    const { token, expiresIn } = response.data;
    // Verifica que expiresIn sea un número válido
    if (typeof expiresIn !== 'number' || expiresIn <= 0) {
        console.warn(`[AuthService WARN] 'expiresIn' recibido no es un número válido o es <= 0: ${expiresIn}. Usando 3600s por defecto.`);
        // Asigna un valor por defecto si expiresIn es inválido, ej. 1 hora
        const defaultExpiresIn = 3600; 
        sessionCache.expiresAt = Date.now() + (defaultExpiresIn - 60) * 1000; // Usa el valor por defecto
    } else {
        console.log(`[AuthService DEBUG] expiresIn recibido: ${expiresIn} (tipo: ${typeof expiresIn})`);
        const marginSeconds = 60; // Margen de seguridad
        // Calcula la expiración en milisegundos desde epoch
        sessionCache.expiresAt = Date.now() + (expiresIn - marginSeconds) * 1000;
    }
    // *** Fin Logs ***

    // Verifica que el token exista
    if (!token) {
         throw new Error('Respuesta de login inválida (token faltante)');
    }
    sessionCache.accessToken = token;

    // *** Log de Depuración de la Expiración Calculada ***
    const expiryDate = new Date(sessionCache.expiresAt);
    const calculatedDuration = sessionCache.expiresAt > 0 ? ((sessionCache.expiresAt - Date.now()) / 1000).toFixed(0) : 'N/A';
    console.log(`[AuthService DEBUG] Token guardado. Válido hasta (estimado): ${expiryDate.toISOString()} (aprox. ${calculatedDuration} segundos restantes)`);
    // *** Fin Log ***

    console.log('[AuthService] Login exitoso.');
    return token; // Devuelve el token obtenido

  } catch (error: any) {
    // Log más detallado si es un error de Axios
    if (axios.isAxiosError(error)) {
        console.error('[AuthService] Error Axios al hacer login:', {
            message: error.message,
            url: error.config?.url, // La URL relativa que intentó usar
            baseURL: error.config?.baseURL, // La URL base configurada
            method: error.config?.method,
            code: error.code, // Código de error (ej. ENOTFOUND, ECONNREFUSED)
            status: error.response?.status // Código HTTP si hubo respuesta
        });
        // Si el error es específico de URL inválida
        if (error.message.includes('Invalid URL') || error.code === 'ERR_INVALID_URL') {
            console.error('[AuthService] -> Causa probable: La URL base o el endpoint son incorrectos. Verifica THIRD_PARTY_API_URL en .env y el path "/autentificar".');
        }
    } else {
        // Error genérico (ej. problema con .env, error de código)
        console.error('[AuthService] Error Genérico al hacer login:', error.message);
    }
    // Resetea la caché en caso de error
    sessionCache.accessToken = null;
    sessionCache.expiresAt = 0; 
    // Lanza un error claro para que el proceso que llamó (el worker) sepa que falló
    throw new Error(`No se pudo autenticar con Dantia: ${error.message}`); 
  }
}

/**
 * Función pública usada por el interceptor de apiClient.
 * Asegura que haya un token válido en sessionCache, refrescándolo (llamando a login) si es necesario.
 * @returns {Promise<string>} El accessToken válido.
 */
export async function ensureValidSession(): Promise<string> {
  const now = Date.now();
  const expiresAt = sessionCache.expiresAt;
  // Considera el token válido si existe Y su tiempo de expiración es mayor que el tiempo actual
  const isValid = !!sessionCache.accessToken && expiresAt > now;

  // *** Log de Depuración de la Comprobación ***
  const nowISO = new Date(now).toISOString();
  const expiresAtISO = expiresAt > 0 ? new Date(expiresAt).toISOString() : 'N/A'; // Muestra N/A si nunca se ha logueado
  console.log(`[AuthService Check] Ahora: ${nowISO}, Token Expira: ${expiresAtISO}, ¿Válido?: ${isValid}`);
  // *** Fin Log ***

  if (isValid) {
    return sessionCache.accessToken!; // Sabemos que no es null si isValid es true
  }

  // Si no es válido (null, undefined o expirado)
  console.log('[AuthService] Token no válido o expirado. Refrescando sesión...');
  return await login(); // Llama a la función de login para obtener uno nuevo
}