import './types';
import { useAppProvider } from './hooks/useAppProvider';
import { AppGate } from './components/AppGate';

export default function App() {
  const app = useAppProvider();
  return <AppGate app={app} />;
}
