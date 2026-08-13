import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const parameters = new URLSearchParams(location.search);
let Root = App;

if (import.meta.env.DEV && parameters.has('preview')) {
  const { MatchPreview } = await import('./dev/match-preview');
  Root = MatchPreview;
} else if (import.meta.env.DEV && parameters.has('mock')) {
  const { installDevUsionMock } = await import('./dev/usion-mock');
  installDevUsionMock();
}

createRoot(document.getElementById('root')!).render(<Root />);
