import { useRef, useState } from "react";
import "./App.css";

function App() {
  const fileInputRef = useRef(null);

  const [arquivo, setArquivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);

  function abrirSeletorDeArquivo() {
    fileInputRef.current?.click();
  }

  function selecionarArquivo(event) {
    const arquivoSelecionado = event.target.files?.[0];

    if (!arquivoSelecionado) return;

    if (!arquivoSelecionado.name.toLowerCase().endsWith(".csv")) {
      setErro("Selecione um arquivo no formato CSV.");
      setArquivo(null);
      setResultado(null);
      return;
    }

    setArquivo(arquivoSelecionado);
    setErro("");
    setResultado(null);
  }

  async function enviarArquivo() {
    if (!arquivo) {
      setErro("Selecione um arquivo CSV antes de continuar.");
      return;
    }

    setLoading(true);
    setErro("");

    const formData = new FormData();
    formData.append("file", arquivo);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/uploads/csv",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Não foi possível processar o arquivo."
        );
      }

      setResultado(data);
    } catch (error) {
      setErro(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-page">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={selecionarArquivo}
        hidden
      />

      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Análise biomecânica</p>

          <h1>Dashboard de Corrida</h1>

          <p className="dashboard-description">
            Visualização de dados processados de sensores IMU.
          </p>
        </div>

        <button
          className="upload-button"
          onClick={abrirSeletorDeArquivo}
        >
          Selecionar coleta
        </button>
      </header>

      <main className="dashboard-content">
        {!resultado ? (
          <section className="empty-state">
            <div className="empty-icon">📈</div>

            <h2>
              {arquivo
                ? "Coleta selecionada"
                : "Nenhuma coleta carregada"}
            </h2>

            <p>
              {arquivo
                ? arquivo.name
                : "Selecione um arquivo CSV para visualizar os dados do atleta, as métricas do joelho e os gráficos de jerk."}
            </p>

            {!arquivo ? (
              <button
                className="main-upload-button"
                onClick={abrirSeletorDeArquivo}
              >
                Fazer upload do CSV
              </button>
            ) : (
              <div className="upload-actions">
                <button
                  className="secondary-button"
                  onClick={abrirSeletorDeArquivo}
                  disabled={loading}
                >
                  Trocar arquivo
                </button>

                <button
                  className="main-upload-button"
                  onClick={enviarArquivo}
                  disabled={loading}
                >
                  {loading ? "Analisando..." : "Analisar coleta"}
                </button>
              </div>
            )}

            {erro && <div className="error-message">{erro}</div>}
          </section>
        ) : (
          <section className="success-state">
            <div className="success-header">
              <div>
                <p className="success-label">Arquivo processado</p>
                <h2>{resultado.filename}</h2>
              </div>

              <button
                className="secondary-button"
                onClick={abrirSeletorDeArquivo}
              >
                Selecionar outro CSV
              </button>
            </div>

            <div className="success-grid">
              <div className="info-card">
                <span>Linhas</span>
                <strong>{resultado.rows}</strong>
              </div>

              <div className="info-card">
                <span>Colunas</span>
                <strong>{resultado.columns_count}</strong>
              </div>

              <div className="info-card">
                <span>Duração vetorizada</span>
                <strong>
                  {resultado.summary?.duracao_vetorizada_s ?? "-"} s
                </strong>
              </div>

              <div className="info-card">
                <span>Cobertura</span>
                <strong>
                  {resultado.summary?.cobertura_percentual ?? "-"}%
                </strong>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;