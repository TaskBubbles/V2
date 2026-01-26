import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("Starting Task Bubbles...");

// Add type definition for our global error handler
declare global {
  interface Window {
    showError?: (title: string, details: string) => void;
  }
}

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
  // Pipe critical startup errors to the visual logger
  if (window.showError) {
      window.showError('React Mount Failed', error instanceof Error ? error.message : String(error));
  }
}