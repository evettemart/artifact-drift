import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { FindingsPage } from './pages/FindingsPage';
import { GraphPage } from './pages/GraphPage';
import { ReportsPage } from './pages/ReportsPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/findings" element={<FindingsPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;