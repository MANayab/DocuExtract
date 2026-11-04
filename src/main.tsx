import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { Providers } from './app/providers';
import { App } from './app/App';
import { registerPwa } from './features/pwa/register';

registerPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
);
