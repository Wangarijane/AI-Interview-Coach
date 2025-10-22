import React from 'react';
// FIX: `createRoot` is imported from `react-dom/client` in React 18 and later.
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);