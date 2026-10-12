import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { esApiError } from './api/errors';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: true,
      // No reintentar errores del cliente (4xx): solo fallos de red o 5xx, máximo 2 veces
      retry: (intentos, error) => {
        if (esApiError(error) && error.status >= 400 && error.status < 500) return false;
        return intentos < 2;
      },
    },
    mutations: { retry: false },
  },
});

const raiz = document.getElementById('root');
if (!raiz) throw new Error('No se encontró #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
