import { Route, Routes } from "react-router";
import { DashboardProvider } from "./context/DashboardContext";
import HomePage from "./pages/HomePage";
import RelatorioPage from "./pages/RelatorioPage";
import "./App.css";

function App() {
  return (
    <DashboardProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/relatorio"
          element={<RelatorioPage />}
        />
      </Routes>
    </DashboardProvider>
  );
}

export default App;