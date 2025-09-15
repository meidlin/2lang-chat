import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// In development, ensure any previously registered SW is unregistered to avoid cache issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => Promise.all(registrations.map(reg => reg.unregister())))
    .then(() => {
      if ('caches' in window) {
        return caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))));
      }
    })
    .catch(() => {});
}
