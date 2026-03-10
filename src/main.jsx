import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
/*
 * File: src/main.jsx
 * Description: Uygulamanın giriş dosyası. React kökünü oluşturur ve `App` bileşenini DOM'a bağlar.
 */
import App from './App';
import { FeedbackProvider } from './context/FeedbackContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FeedbackProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </FeedbackProvider>
  </React.StrictMode>
);
