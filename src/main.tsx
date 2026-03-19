import './patch-fetch';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { Web3ModalProvider } from './Web3Provider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Web3ModalProvider>
      <App />
    </Web3ModalProvider>
  </StrictMode>,
);
