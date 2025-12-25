import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Import design system styles
import '@humanizer/ui/styles/tokens.css';
import '@humanizer/ui/styles/reset.css';
import '@humanizer/ui/styles/utilities.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
