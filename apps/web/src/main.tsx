import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, readStoredTheme } from './lib/theme';

// Apply the remembered theme before the first paint so a phone in the dark
// does not flash a white screen on every PWA restart.
applyTheme(readStoredTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
