import { TraceoClient, createTraceoClient } from '@traceo/dashboard-sdk';

const apiUrl = (import.meta.env?.VITE_TRACEO_API_URL as string | undefined) || 'http://127.0.0.1:3030';

export const traceoClient: TraceoClient = createTraceoClient({
  baseUrl: apiUrl
});
