import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerStarterBlocks } from '@packages/pages-ui-frontend';
import { App } from './app/App';
import './globals.css';

registerStarterBlocks();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
