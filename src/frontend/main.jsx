import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Neo-Brutalist Design System (Tailwind + custom tokens)
import './design-system/tokens/index.css';
import { installGlobalErrorHandlers } from './utils/logger';

installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
