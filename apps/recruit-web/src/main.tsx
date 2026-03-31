import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Register all field type UI definitions (must run before any component renders)
import '@packages/eav-attributes-ui/field-types/register-all';
import { App } from './app/App';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
