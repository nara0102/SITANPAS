import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { toast } from 'sonner'

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  toast.error(`Terjadi kesalahan: ${event.error?.message || 'Unknown error'}`);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  toast.error(`Terjadi kesalahan jaringan: ${event.reason?.message || 'Network error'}`);
  // Prevent the default browser behavior
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
