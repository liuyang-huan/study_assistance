import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import CreateGoal from './pages/CreateGoal'
import GoalDetail from './pages/GoalDetail'
import HistoryPage from './pages/HistoryPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/goals/new" element={<CreateGoal />} />
          <Route path="/goals/:id" element={<GoalDetail />} />
          <Route path="/goals/:id/history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
