import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { DriftPage } from './pages/DriftPage';
import { GraphPage } from './pages/GraphPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ScansPage } from './pages/ScansPage';
import { GlobalScopeProvider } from './context/GlobalScopeContext';

function App() {
  return (
    <GlobalScopeProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="/scans" element={<ScansPage />} />
          <Route path="/drift" element={<DriftPage />} />
          <Route path="/findings" element={<Navigate to="/drift" replace />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </Layout>
    </GlobalScopeProvider>
  );
}

export default App;