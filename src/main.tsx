import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { FlashMessages } from './FlashMessage';
import './styles.css';
import './alvorada.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <FlashMessages />
  </React.StrictMode>,
);

import './journey.css';

import './theme.css';

import './disclosures.css';
import './page-header.css';
import './npc-speech.css';
import './profile-menu.css';
