import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { DriftPage } from './pages/DriftPage';
import { GraphPage } from './pages/GraphPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { ReportsPage } from './pages/ReportsPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/drift" element={<DriftPage />} />
        <Route path="/findings" element={<Navigate to="/drift" replace />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;