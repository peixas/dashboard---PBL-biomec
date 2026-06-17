import "./App.css";

function App() {
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Análise biomecânica</p>
          <h1>Dashboard de Corrida</h1>
          <p className="dashboard-description">
            Visualização de dados processados de sensores IMU.
          </p>
        </div>

        <button className="upload-button">
          Selecionar coleta
        </button>
      </header>

      <main className="dashboard-content">
        <section className="empty-state">
          <div className="empty-icon">📈</div>

          <h2>Nenhuma coleta carregada</h2>

          <p>
            Selecione um arquivo CSV para visualizar os dados do atleta,
            as métricas do joelho e os gráficos de jerk.
          </p>

          <button className="main-upload-button">
            Fazer upload do CSV
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;