import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import './styles/base.css';
import './styles/react.css';
const mount = document.getElementById('app');
if (!mount)
    throw new Error('앱 진입점 #app이 없습니다.');
createRoot(mount).render(<React.StrictMode><AppProvider><App /></AppProvider></React.StrictMode>);
