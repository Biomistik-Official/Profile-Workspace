import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { BrowserShell } from './components/BrowserShell';
import './styles.css';
import './design-v2.css';
import './fluid.css';
const browser = new URLSearchParams(location.search).get('mode') === 'browser';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{browser ? <BrowserShell /> : <App />}</React.StrictMode>);
