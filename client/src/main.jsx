import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { RouterProvider } from './router.jsx';
import { AppProvider } from './state.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </RouterProvider>
  </StrictMode>,
);
