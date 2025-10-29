import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import { AppProvider } from '@/context/AppContext';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import '@/index.css';

console.log('🌟 Application starting up...', {
  timestamp: new Date().toISOString(),
  url: window.location.href,
  referrer: document.referrer,
  userAgent: navigator.userAgent.substring(0, 100)
});

// Add global error handlers to catch any unhandled errors that might cause reloads
window.addEventListener('error', (event) => {
  console.error('🚨 Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise
  });
});

// Track page visibility changes
document.addEventListener('visibilitychange', () => {
  console.log('👁️ Page visibility changed:', {
    hidden: document.hidden,
    visibilityState: document.visibilityState,
    timestamp: new Date().toISOString()
  });
});

// Track beforeunload events
window.addEventListener('beforeunload', (event) => {
  console.log('🚪 Page about to unload:', {
    timestamp: new Date().toISOString(),
    reason: 'beforeunload event'
  });
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <AuthProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </AuthProvider>
  </>
);