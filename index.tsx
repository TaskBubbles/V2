import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("Starting Task Bubbles...");

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("React app mounted.");
} catch (error) {
  console.error("Failed to mount React app:", error);
}