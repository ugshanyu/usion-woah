import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
  const { installDevUsionMock } = await import('./dev/usion-mock');
  installDevUsionMock();
}

createRoot(document.getElementById('root')!).render(<App />);
