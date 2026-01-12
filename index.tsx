
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppConfigProvider } from './contexts/AppConfigContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Aplicar tema inicial
const savedConfig = localStorage.getItem('app_config');
if (savedConfig) {
  try {
    const config = JSON.parse(savedConfig);
    if (config.theme) {
      document.documentElement.setAttribute('data-theme', config.theme);
    }
  } catch {
    // Ignorar erro
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppConfigProvider>
      <App />
    </AppConfigProvider>
  </React.StrictMode>
);
