import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const API_URL = "http://127.0.0.1:8000/api/uploads/csv";

function InfoIcon({ texto }) {
  return (
    <div className="info-wrapper">
      <button
        type="button"
        className="info-button"
        aria-label="Ver explicação"
      >
        ?
      </button>

      <div className="info-tooltip" role="tooltip">
        {texto}
      </div>
    </div>
  );
}

function extrairDadosDoNomeArquivo(nomeArquivo) {
  const nomeSemExtensao = nomeArquivo.replace(/\.csv$/i, "");

  const correspondencia = nomeSemExtensao.match(
    /^([a-zA-ZÀ-ÿ]+)(\d+(?:[.,]\d+)?)km_processado$/i
  );

  if (!correspondencia) {
    return {
      nome: "",
      velocidade: "",
    };
  }

  const nomeExtraido = correspondencia[1];
  const velocidadeExtraida = correspondencia[2].replace(",", ".");

  const nomeFormatado =
    nomeExtraido.charAt(0).toUpperCase() +
    nomeExtraido.slice(1).toLowerCase();

  return {
    nome: nomeFormatado,
    velocidade: velocidadeExtraida,
  };
}

function formatarValor(valor, casasDecimais = 3) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "-";
  }

  return numero.toFixed(casasDecimais);
}

function calcularDiferenca(valorComparacao, valorPrincipal) {
  const comparacao = Number(valorComparacao);
  const principal = Number(valorPrincipal);

  if (!Number.isFinite(comparacao) || !Number.isFinite(principal)) {
    return "-";
  }

  const diferenca = comparacao - principal;
  const sinal = diferenca > 0 ? "+" : "";

  return `${sinal}${diferenca.toFixed(3)}`;
}

function numeroOuNulo(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : null;
}

function calcularMedia(valores) {
  if (!valores.length) {
    return null;
  }

  return (
    valores.reduce((soma, valor) => soma + valor, 0) /
    valores.length
  );
}

function diferencaNumerica(valorComparacao, valorPrincipal) {
  const comparacao = Number(valorComparacao);
  const principal = Number(valorPrincipal);

  if (!Number.isFinite(comparacao) || !Number.isFinite(principal)) {
    return null;
  }

  return comparacao - principal;
}

function formatarDiferencaTexto(valor, unidade = "") {
  if (!Number.isFinite(valor)) {
    return "-";
  }

  const sinal = valor > 0 ? "+" : "";

  return `${sinal}${valor.toFixed(3)}${unidade}`;
}
function calcularVariacaoPercentual(valorNovo, valorAnterior) {
  const novo = Number(valorNovo);
  const anterior = Number(valorAnterior);

  if (
    !Number.isFinite(novo) ||
    !Number.isFinite(anterior) ||
    anterior === 0
  ) {
    return null;
  }

  return ((novo - anterior) / Math.abs(anterior)) * 100;
}

function formatarPercentual(valor) {
  if (!Number.isFinite(valor)) {
    return "valor indisponível";
  }

  const sinal = valor > 0 ? "+" : "";

  return `${sinal}${valor.toFixed(1)}%`;
}

/*
  Converte o objeto time_series retornado pelo backend
  em uma lista de pontos utilizável pelo Recharts.
*/
function prepararSerieTemporal(resultado) {
  const timeSeries = resultado?.time_series;

  if (!timeSeries?.tempo_s?.length) {
    return [];
  }

  const pontos = timeSeries.tempo_s
    .map((tempo, indice) => ({
      tempo: numeroOuNulo(tempo),

      anguloJoelho: numeroOuNulo(
        timeSeries.angulo_joelho_graus?.[indice]
      ),

      jerkCoxa: numeroOuNulo(
        timeSeries.jerk_coxa_m_s3?.[indice]
      ),

      jerkPerna: numeroOuNulo(
        timeSeries.jerk_perna_m_s3?.[indice]
      ),
    }))
    .filter((ponto) => ponto.tempo !== null);

  /*
    Mantém a lógica atual de agrupamento dos tempos,
    calculando a média quando mais de um ponto possui
    a mesma marca temporal.
  */
  const pontosAgrupadosPorTempo = pontos.reduce(
    (acumulador, ponto) => {
      const chaveTempo = ponto.tempo.toFixed(4);

      if (!acumulador[chaveTempo]) {
        acumulador[chaveTempo] = {
          tempo: ponto.tempo,
          angulos: [],
          jerksCoxa: [],
          jerksPerna: [],
        };
      }

      if (ponto.anguloJoelho !== null) {
        acumulador[chaveTempo].angulos.push(
          ponto.anguloJoelho
        );
      }

      if (ponto.jerkCoxa !== null) {
        acumulador[chaveTempo].jerksCoxa.push(
          ponto.jerkCoxa
        );
      }

      if (ponto.jerkPerna !== null) {
        acumulador[chaveTempo].jerksPerna.push(
          ponto.jerkPerna
        );
      }

      return acumulador;
    },
    {}
  );

  return Object.values(pontosAgrupadosPorTempo)
    .map((grupo) => ({
      tempo: grupo.tempo,
      anguloJoelho: calcularMedia(grupo.angulos),
      jerkCoxa: calcularMedia(grupo.jerksCoxa),
      jerkPerna: calcularMedia(grupo.jerksPerna),
    }))
    .sort((a, b) => a.tempo - b.tempo);
}

/*
  Une os pontos das duas coletas em uma única lista.

  Cada coleta continua usando seu próprio eixo de tempo.
  A união permite que o mesmo LineChart desenhe as duas.
*/
function juntarSeriesTemporais(
  seriePrincipal,
  serieComparativa
) {
  const pontosPorTempo = new Map();

  seriePrincipal.forEach((ponto) => {
    const chaveTempo = ponto.tempo.toFixed(4);

    pontosPorTempo.set(chaveTempo, {
      tempo: ponto.tempo,
      anguloPrincipal: ponto.anguloJoelho,
      jerkCoxaPrincipal: ponto.jerkCoxa,
      jerkPernaPrincipal: ponto.jerkPerna,
      anguloComparacao: null,
      jerkCoxaComparacao: null,
      jerkPernaComparacao: null,
    });
  });

  serieComparativa.forEach((ponto) => {
    const chaveTempo = ponto.tempo.toFixed(4);

    const pontoExistente = pontosPorTempo.get(chaveTempo);

    if (pontoExistente) {
      pontoExistente.anguloComparacao =
        ponto.anguloJoelho;

      pontoExistente.jerkCoxaComparacao =
        ponto.jerkCoxa;

      pontoExistente.jerkPernaComparacao =
        ponto.jerkPerna;
    } else {
      pontosPorTempo.set(chaveTempo, {
        tempo: ponto.tempo,
        anguloPrincipal: null,
        jerkCoxaPrincipal: null,
        jerkPernaPrincipal: null,
        anguloComparacao: ponto.anguloJoelho,
        jerkCoxaComparacao: ponto.jerkCoxa,
        jerkPernaComparacao: ponto.jerkPerna,
      });
    }
  });

  return Array.from(pontosPorTempo.values()).sort(
    (a, b) => a.tempo - b.tempo
  );
}

function App() {
  const fileInputRef = useRef(null);
  const comparisonInputRef = useRef(null);
  const exportRef = useRef(null);

  const [arquivo, setArquivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);

  const [arquivoComparacao, setArquivoComparacao] =
    useState(null);

  const [resultadoComparacao, setResultadoComparacao] =
    useState(null);

  const [loadingComparacao, setLoadingComparacao] =
    useState(false);

  const [erroComparacao, setErroComparacao] =
    useState("");

  // Informações editáveis da coleta principal
  const [nomeAtleta, setNomeAtleta] = useState("");
  const [velocidade, setVelocidade] = useState("");
  const [dataColeta, setDataColeta] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function abrirSeletorDeArquivo() {
    fileInputRef.current?.click();
  }

  function abrirSeletorComparacao() {
    comparisonInputRef.current?.click();
  }

  function selecionarArquivo(event) {
    const arquivoSelecionado = event.target.files?.[0];

    if (!arquivoSelecionado) {
      return;
    }

    if (
      !arquivoSelecionado.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      setErro("Selecione um arquivo no formato CSV.");
      setArquivo(null);
      setResultado(null);
      return;
    }

    const dadosArquivo = extrairDadosDoNomeArquivo(
      arquivoSelecionado.name
    );

    setNomeAtleta(dadosArquivo.nome);
    setVelocidade(dadosArquivo.velocidade);

    setArquivo(arquivoSelecionado);
    setErro("");
    setResultado(null);

    // Ao trocar a coleta principal, remove a comparação anterior.
    setArquivoComparacao(null);
    setResultadoComparacao(null);
    setErroComparacao("");

    event.target.value = "";
  }

  function selecionarArquivoComparacao(event) {
    const arquivoSelecionado = event.target.files?.[0];

    if (!arquivoSelecionado) {
      return;
    }

    if (
      !arquivoSelecionado.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      setErroComparacao(
        "Selecione um arquivo no formato CSV."
      );

      setArquivoComparacao(null);
      setResultadoComparacao(null);
      return;
    }

    setArquivoComparacao(arquivoSelecionado);
    setResultadoComparacao(null);
    setErroComparacao("");

    event.target.value = "";
  }

  async function processarArquivo(arquivoSelecionado) {
    const formData = new FormData();
    formData.append("file", arquivoSelecionado);

    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail ||
          "Não foi possível processar o arquivo."
      );
    }

    return data;
  }

  async function enviarArquivo() {
    if (!arquivo) {
      setErro(
        "Selecione um arquivo CSV antes de continuar."
      );
      return;
    }

    setLoading(true);
    setErro("");

    try {
      const data = await processarArquivo(arquivo);
      setResultado(data);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível processar o arquivo."
      );
    } finally {
      setLoading(false);
    }
  }

  async function enviarArquivoComparacao() {
    if (!arquivoComparacao) {
      setErroComparacao(
        "Selecione uma segunda coleta antes de comparar."
      );
      return;
    }

    setLoadingComparacao(true);
    setErroComparacao("");

    try {
      const data = await processarArquivo(
        arquivoComparacao
      );

      setResultadoComparacao(data);
    } catch (error) {
      setErroComparacao(
        error instanceof Error
          ? error.message
          : "Não foi possível processar a coleta comparativa."
      );
    } finally {
      setLoadingComparacao(false);
    }
  }

  async function exportarPDF() {
    if (
      !resultado ||
      !exportRef.current ||
      exportando
    ) {
      return;
    }

    setExportando(true);
    setErro("");

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const elemento = exportRef.current;

      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#07111f",
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: elemento.scrollWidth,
        windowHeight: elemento.scrollHeight,
      });

      const imagem = canvas.toDataURL("image/png", 1);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const larguraPagina =
        pdf.internal.pageSize.getWidth();

      const alturaPagina =
        pdf.internal.pageSize.getHeight();

      const margem = 8;
      const larguraUtil = larguraPagina - margem * 2;
      const alturaUtil = alturaPagina - margem * 2;

      const alturaImagem =
        (canvas.height * larguraUtil) / canvas.width;

      let alturaRestante = alturaImagem;
      let deslocamento = 0;

      while (alturaRestante > 0) {
        if (deslocamento > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          imagem,
          "PNG",
          margem,
          margem - deslocamento,
          larguraUtil,
          alturaImagem,
          undefined,
          "FAST"
        );

        alturaRestante -= alturaUtil;
        deslocamento += alturaUtil;
      }

      const nomeBase = (
        nomeAtleta ||
        resultado.filename?.replace(/\.csv$/i, "") ||
        "coleta"
      )
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_");

      const velocidadeArquivo = velocidade
        ? `_${velocidade}kmh`
        : "";

      pdf.save(
        `relatorio_${nomeBase}${velocidadeArquivo}.pdf`
      );
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);

      setErro(
        "Não foi possível exportar o PDF."
      );
    } finally {
      setExportando(false);
    }
  }

  const angulo =
    resultado?.summary?.angulo_joelho;

  const jerkCoxa =
    resultado?.jerk_summary?.coxa;

  const jerkPerna =
    resultado?.jerk_summary?.perna;

  const anguloComparacao =
    resultadoComparacao?.summary?.angulo_joelho;

  const jerkCoxaComparacao =
    resultadoComparacao?.jerk_summary?.coxa;

  const jerkPernaComparacao =
    resultadoComparacao?.jerk_summary?.perna;

  const dadosGraficosPrincipal =
    prepararSerieTemporal(resultado);

  const dadosGraficosComparacao =
    prepararSerieTemporal(resultadoComparacao);

  const dadosGraficosCombinados =
    juntarSeriesTemporais(
      dadosGraficosPrincipal,
      dadosGraficosComparacao
    );

  const dadosNomeComparacao = arquivoComparacao
    ? extrairDadosDoNomeArquivo(
        arquivoComparacao.name
      )
    : {
        nome: "",
        velocidade: "",
      };

  const nomeColetaPrincipal = velocidade
    ? `${velocidade} km/h`
    : "Coleta principal";

  const nomeColetaComparativa =
    dadosNomeComparacao.velocidade
      ? `${dadosNomeComparacao.velocidade} km/h`
      : "Coleta comparativa";

  const explicacaoJerk =
    "Jerk mede o quão suave foi seu movimento durante a corrida. Valores menores indicam movimentos mais fluidos e controlados, enquanto valores maiores podem indicar movimentos mais bruscos.";

  const explicacaoPercentil95 =
    "O percentil 95 indica o nível de jerk observado nos momentos mais exigentes da corrida. Valores mais altos podem sugerir aumento da irregularidade do movimento, fadiga ou alterações no controle motor durante o treino.";

  const jerkMedioCoxa = Number(jerkCoxa?.media);
  const jerkMedioPerna = Number(jerkPerna?.media);

  const velocidadePrincipalNumero = Number(velocidade);
  const velocidadeComparacaoNumero = Number(
    dadosNomeComparacao.velocidade
  );

  const velocidadesSemelhantes =
    Number.isFinite(velocidadePrincipalNumero) &&
    Number.isFinite(velocidadeComparacaoNumero) &&
    Math.abs(
      velocidadePrincipalNumero - velocidadeComparacaoNumero
    ) < 0.1;

  const variacaoPercentualJerkCoxa =
    calcularVariacaoPercentual(
      jerkCoxaComparacao?.media,
      jerkCoxa?.media
    );

  const variacaoPercentualJerkPerna =
    calcularVariacaoPercentual(
      jerkPernaComparacao?.media,
      jerkPerna?.media
    );

  const aumentouJerkCoxa =
    Number.isFinite(variacaoPercentualJerkCoxa) &&
    variacaoPercentualJerkCoxa > 0;

  const aumentouJerkPerna =
    Number.isFinite(variacaoPercentualJerkPerna) &&
    variacaoPercentualJerkPerna > 0;

  const textoSegmentoMaisExigido =
    Number.isFinite(jerkMedioCoxa) &&
    Number.isFinite(jerkMedioPerna)
      ? jerkMedioPerna > jerkMedioCoxa
        ? `A perna apresentou jerk médio maior que a coxa (${formatarValor(
            jerkMedioPerna
          )} contra ${formatarValor(
            jerkMedioCoxa
          )}). Isso indica maior variação da aceleração nesse segmento durante a coleta.`
        : jerkMedioCoxa > jerkMedioPerna
          ? `A coxa apresentou jerk médio maior que a perna (${formatarValor(
              jerkMedioCoxa
            )} contra ${formatarValor(
              jerkMedioPerna
            )}). Isso indica maior variação da aceleração nesse segmento durante a coleta.`
          : "Coxa e perna apresentaram valores semelhantes de jerk médio."
      : "Não foi possível identificar o segmento com maior variação da aceleração.";

  const textoRespostaEntreColetas = resultadoComparacao
    ? `Em relação à coleta principal, o jerk médio da coxa variou ${formatarPercentual(
        variacaoPercentualJerkCoxa
      )} e o jerk médio da perna variou ${formatarPercentual(
        variacaoPercentualJerkPerna
      )}.`
    : "Adicione uma segunda coleta para avaliar como o padrão de movimento mudou entre os registros.";

  let textoSinalAtencao =
    "Uma única coleta não permite identificar fadiga ou estimar risco de lesão. Compare registros realizados em condições semelhantes.";

  if (resultadoComparacao) {
    if (!velocidadesSemelhantes) {
      textoSinalAtencao =
        "As coletas foram realizadas em velocidades diferentes. O aumento do jerk pode estar relacionado à maior velocidade e não deve ser interpretado isoladamente como fadiga.";
    } else if (aumentouJerkCoxa && aumentouJerkPerna) {
      textoSinalAtencao =
        "Houve aumento do jerk médio na coxa e na perna em condições semelhantes de velocidade. Esse padrão indica menor suavidade do movimento e merece acompanhamento, especialmente se aparecer junto com fadiga percebida, dor ou perda de desempenho.";
    } else if (aumentouJerkCoxa || aumentouJerkPerna) {
      const segmento = aumentouJerkCoxa ? "coxa" : "perna";

      textoSinalAtencao =
        `O jerk médio aumentou na ${segmento}. Isso indica maior irregularidade do movimento nesse segmento e pode justificar uma avaliação mais cuidadosa do treino.`;
    } else {
      textoSinalAtencao =
        "Não houve aumento simultâneo do jerk médio da coxa e da perna entre as duas coletas.";
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

      <input
        ref={comparisonInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={selecionarArquivoComparacao}
        hidden
      />

      <div
        ref={exportRef}
        className="export-area"
      >
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">
              Análise biomecânica
            </p>

            <h1>Dashboard de Corrida</h1>

            <p className="dashboard-description">
              Visualização de dados processados de sensores IMU.
            </p>
          </div>

          <button
            type="button"
            className="upload-button"
            onClick={abrirSeletorDeArquivo}
            data-html2canvas-ignore="true"
          >
            Selecionar coleta
          </button>
        </header>

        <main className="dashboard-content">
          {!resultado ? (
            <section className="empty-state">
              <div className="empty-icon">
                📈
              </div>

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
                  type="button"
                  className="main-upload-button"
                  onClick={abrirSeletorDeArquivo}
                >
                  Fazer upload do CSV
                </button>
              ) : (
                <div className="upload-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={abrirSeletorDeArquivo}
                    disabled={loading}
                  >
                    Trocar arquivo
                  </button>

                  <button
                    type="button"
                    className="main-upload-button"
                    onClick={enviarArquivo}
                    disabled={loading}
                  >
                    {loading
                      ? "Analisando..."
                      : "Analisar coleta"}
                  </button>
                </div>
              )}

              {erro && (
                <div className="error-message">
                  {erro}
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Informações gerais */}
              <section className="success-state">
                <div className="success-header">
                  <div>
                    <p className="success-label">
                      Arquivo processado
                    </p>

                    <h2>{resultado.filename}</h2>
                  </div>

                  <div
                    className="success-actions"
                    data-html2canvas-ignore="true"
                  >
                    <button
                      type="button"
                      className="export-button"
                      onClick={exportarPDF}
                      disabled={exportando}
                    >
                      {exportando
                        ? "Exportando..."
                        : "Exportar PDF"}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={abrirSeletorDeArquivo}
                      disabled={exportando}
                    >
                      Selecionar outro CSV
                    </button>
                  </div>
                </div>

                <div className="metadata-grid">
                  <div className="input-group">
                    <label htmlFor="nome-atleta">
                      Nome do atleta
                    </label>

                    <input
                      id="nome-atleta"
                      type="text"
                      value={nomeAtleta}
                      onChange={(event) =>
                        setNomeAtleta(
                          event.target.value
                        )
                      }
                      placeholder="Ex.: Lucas"
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="velocidade">
                      Velocidade da coleta (km/h)
                    </label>

                    <input
                      id="velocidade"
                      type="number"
                      min="0"
                      step="0.1"
                      value={velocidade}
                      onChange={(event) =>
                        setVelocidade(
                          event.target.value
                        )
                      }
                      placeholder="Ex.: 4"
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="data-coleta">
                      Data da coleta
                    </label>

                    <input
                      id="data-coleta"
                      type="date"
                      value={dataColeta}
                      onChange={(event) =>
                        setDataColeta(
                          event.target.value
                        )
                      }
                    />
                  </div>
                </div>

                <div
                  className="input-group"
                  style={{ marginTop: "16px" }}
                >
                  <label htmlFor="observacoes">
                    Observações
                  </label>

                  <textarea
                    id="observacoes"
                    value={observacoes}
                    onChange={(event) =>
                      setObservacoes(
                        event.target.value
                      )
                    }
                    placeholder="Adicione observações sobre a coleta, o atleta ou o protocolo."
                    rows={3}
                  />
                </div>

                <div
                  className="success-grid"
                  style={{ marginTop: "24px" }}
                >
                  <div className="info-card">
                    <span>Linhas</span>
                    <strong>
                      {resultado.rows}
                    </strong>
                  </div>

                  <div className="info-card">
                    <span>Colunas</span>
                    <strong>
                      {resultado.columns_count}
                    </strong>
                  </div>

                  <div className="info-card">
                    <span>
                      Duração vetorizada
                    </span>

                    <strong>
                      {resultado.summary
                        ?.duracao_vetorizada_s ??
                        "-"}{" "}
                      s
                    </strong>
                  </div>

                  <div className="info-card">
                    <span>Cobertura</span>

                    <strong>
                      {resultado.summary
                        ?.cobertura_percentual ??
                        "-"}
                      %
                    </strong>
                  </div>
                </div>
              </section>

              {/* Métricas do ângulo */}
              <section className="metrics-section">
                <h2 className="section-title">
                  Métricas do ângulo do joelho
                </h2>

                <div className="metrics-grid">
                  <div className="metric-card metric-blue">
                    <span>Ângulo mínimo</span>
                    <strong>
                      {angulo?.minimo ?? "-"}°
                    </strong>
                  </div>

                  <div className="metric-card metric-cyan">
                    <span>Ângulo máximo</span>
                    <strong>
                      {angulo?.maximo ?? "-"}°
                    </strong>
                  </div>

                  <div className="metric-card metric-green">
                    <span>Ângulo médio</span>
                    <strong>
                      {angulo?.media ?? "-"}°
                    </strong>
                  </div>

                  <div className="metric-card metric-yellow">
                    <span>Amplitude</span>
                    <strong>
                      {angulo?.amplitude ?? "-"}°
                    </strong>
                  </div>

                  <div className="metric-card metric-coral">
                    <span>Desvio-padrão</span>

                    <strong>
                      {angulo?.desvio_padrao ??
                        "-"}
                      °
                    </strong>
                  </div>
                </div>
              </section>

              {/* Métricas de jerk */}
              <section className="metrics-section">
                <h2 className="section-title">
                  Métricas de jerk
                </h2>

                <div className="metrics-grid">
                  <div className="metric-card metric-blue">
                    <div className="metric-title-row">
                      <span>
                        Jerk médio da coxa
                      </span>

                      <InfoIcon
                        texto={explicacaoJerk}
                      />
                    </div>

                    <strong>
                      {jerkCoxa?.media ?? "-"}
                    </strong>
                  </div>

                  <div className="metric-card metric-purple">
                    <div className="metric-title-row">
                      <span>
                        Percentil 95 da coxa
                      </span>

                      <InfoIcon
                        texto={
                          explicacaoPercentil95
                        }
                      />
                    </div>

                    <strong>
                      {jerkCoxa?.percentil_95 ??
                        "-"}
                    </strong>
                  </div>

                  <div className="metric-card metric-green">
                    <div className="metric-title-row">
                      <span>
                        Jerk médio da perna
                      </span>

                      <InfoIcon
                        texto={explicacaoJerk}
                      />
                    </div>

                    <strong>
                      {jerkPerna?.media ?? "-"}
                    </strong>
                  </div>

                  <div className="metric-card metric-coral">
                    <div className="metric-title-row">
                      <span>
                        Percentil 95 da perna
                      </span>

                      <InfoIcon
                        texto={
                          explicacaoPercentil95
                        }
                      />
                    </div>

                    <strong>
                      {jerkPerna?.percentil_95 ??
                        "-"}
                    </strong>
                  </div>
                </div>
              </section>
              {/* Resumo descritivo da coleta */}
              <section className="collection-summary-section">
                <div className="summary-heading">
                  <div>
                    <p className="summary-eyebrow">Leitura geral</p>

                    <h2 className="section-title">
                      Resumo da coleta
                    </h2>
                  </div>

                  <InfoIcon
                    texto="Este resumo traduz os valores calculados pelo sistema. Ele não substitui a avaliação do treinador, fisioterapeuta ou profissional responsável e não representa uma conclusão clínica."
                  />
                </div>

                <div className="collection-summary-grid">
                  <article className="collection-summary-card summary-pattern">
                    <div className="summary-card-icon">↕</div>

                    <div>
                      <span className="summary-card-label">
                        Segmento mais exigido
                      </span>

                      <p>{textoSegmentoMaisExigido}</p>
                    </div>
                  </article>

                  <article className="collection-summary-card summary-change">
                    <div className="summary-card-icon">⇄</div>

                    <div>
                      <span className="summary-card-label">
                        Resposta entre coletas
                      </span>

                      <p>{textoRespostaEntreColetas}</p>
                    </div>
                  </article>

                  <article className="collection-summary-card summary-technical">
                    <div className="summary-card-icon">!</div>

                    <div>
                      <span className="summary-card-label">
                        Sinal de atenção
                      </span>

                      <p>{textoSinalAtencao}</p>
                    </div>
                  </article>
                </div>
              </section>

              {/* Gráficos */}
              <section className="charts-section">
                <h2 className="section-title">
                  Evolução das métricas ao longo da coleta
                </h2>

                <p className="charts-description">
                  Os gráficos apresentam as variações registradas pelos sensores ao longo do tempo.
                  {resultadoComparacao &&
                    " As curvas das duas coletas estão sobrepostas para comparação."}
                </p>

                <div className="charts-grid">
                  {/* Gráfico do ângulo */}
                  <article className="chart-card chart-card-wide">
                    <div className="chart-header">
                      <div>
                        <h3>
                          Ângulo do joelho
                        </h3>

                        <p>
                          Variação angular do joelho durante a coleta.
                        </p>
                      </div>
                    </div>

                    <div className="chart-area">
                      <ResponsiveContainer
                        width="100%"
                        height={360}
                      >
                        <LineChart
                          data={
                            dadosGraficosCombinados
                          }
                          margin={{
                            top: 24,
                            right: 24,
                            bottom: 24,
                            left: 12,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="4 4"
                            stroke="rgba(100, 116, 139, 0.25)"
                          />

                          <XAxis
                            dataKey="tempo"
                            type="number"
                            domain={[
                              "dataMin",
                              "dataMax",
                            ]}
                            tickFormatter={(valor) =>
                              Number(
                                valor
                              ).toFixed(1)
                            }
                            label={{
                              value: "Tempo (s)",
                              position:
                                "insideBottom",
                              offset: -10,
                            }}
                          />

                          <YAxis
                            tickFormatter={(valor) =>
                              Number(
                                valor
                              ).toFixed(0)
                            }
                            label={{
                              value: "Ângulo (°)",
                              angle: -90,
                              position:
                                "insideLeft",
                            }}
                          />

                          <Tooltip
                            formatter={(
                              valor,
                              nome
                            ) => [
                              `${Number(
                                valor
                              ).toFixed(3)}°`,
                              nome,
                            ]}
                            labelFormatter={(
                              tempo
                            ) =>
                              `Tempo: ${Number(
                                tempo
                              ).toFixed(3)} s`
                            }
                          />

                          <Legend
                            verticalAlign="top"
                            align="center"
                            height={36}
                          />

                          <Line
                            type="linear"
                            dataKey="anguloPrincipal"
                            name={`Ângulo — ${nomeColetaPrincipal}`}
                            stroke="#4ea8de"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                          />

                          {resultadoComparacao && (
                            <Line
                              type="linear"
                              dataKey="anguloComparacao"
                              name={`Ângulo — ${nomeColetaComparativa}`}
                              stroke="#e98072"
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                              isAnimationActive={
                                false
                              }
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </article>

                  {/* Gráfico de jerk da coxa */}
                  <article className="chart-card">
                    <div className="chart-header">
                      <div>
                        <h3>Jerk da coxa</h3>

                        <p>
                          Comparação da variação da aceleração da coxa entre as
                          coletas.
                        </p>
                      </div>
                    </div>

                    <div className="chart-area">
                      <ResponsiveContainer width="100%" height={340}>
                        <LineChart
                          data={dadosGraficosCombinados}
                          margin={{
                            top: 24,
                            right: 24,
                            bottom: 24,
                            left: 12,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="4 4"
                            stroke="rgba(100, 116, 139, 0.25)"
                          />

                          <XAxis
                            dataKey="tempo"
                            type="number"
                            domain={["dataMin", "dataMax"]}
                            tickFormatter={(valor) =>
                              Number(valor).toFixed(1)
                            }
                            label={{
                              value: "Tempo (s)",
                              position: "insideBottom",
                              offset: -10,
                            }}
                          />

                          <YAxis
                            tickFormatter={(valor) =>
                              Number(valor).toFixed(0)
                            }
                            label={{
                              value: "Jerk (m/s³)",
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />

                          <Tooltip
                            formatter={(valor, nome) => [
                              `${Number(valor).toFixed(3)} m/s³`,
                              nome,
                            ]}
                            labelFormatter={(tempo) =>
                              `Tempo: ${Number(tempo).toFixed(3)} s`
                            }
                          />

                          <Legend
                            verticalAlign="top"
                            align="center"
                            height={36}
                          />

                          <Line
                            type="monotone"
                            dataKey="jerkCoxaPrincipal"
                            name={nomeColetaPrincipal}
                            stroke="#818cf8"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                          />

                          {resultadoComparacao && (
                            <Line
                              type="monotone"
                              dataKey="jerkCoxaComparacao"
                              name={nomeColetaComparativa}
                              stroke="#72c7a0"
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                              isAnimationActive={false}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </article>

                  {/* Gráfico de jerk da perna */}
                  <article className="chart-card">
                    <div className="chart-header">
                      <div>
                        <h3>Jerk da perna</h3>

                        <p>
                          Comparação da variação da aceleração da perna entre as
                          coletas.
                        </p>
                      </div>
                    </div>

                    <div className="chart-area">
                      <ResponsiveContainer width="100%" height={340}>
                        <LineChart
                          data={dadosGraficosCombinados}
                          margin={{
                            top: 24,
                            right: 24,
                            bottom: 24,
                            left: 12,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="4 4"
                            stroke="rgba(100, 116, 139, 0.25)"
                          />

                          <XAxis
                            dataKey="tempo"
                            type="number"
                            domain={["dataMin", "dataMax"]}
                            tickFormatter={(valor) =>
                              Number(valor).toFixed(1)
                            }
                            label={{
                              value: "Tempo (s)",
                              position: "insideBottom",
                              offset: -10,
                            }}
                          />

                          <YAxis
                            tickFormatter={(valor) =>
                              Number(valor).toFixed(0)
                            }
                            label={{
                              value: "Jerk (m/s³)",
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />

                          <Tooltip
                            formatter={(valor, nome) => [
                              `${Number(valor).toFixed(3)} m/s³`,
                              nome,
                            ]}
                            labelFormatter={(tempo) =>
                              `Tempo: ${Number(tempo).toFixed(3)} s`
                            }
                          />

                          <Legend
                            verticalAlign="top"
                            align="center"
                            height={36}
                          />

                          <Line
                            type="monotone"
                            dataKey="jerkPernaPrincipal"
                            name={nomeColetaPrincipal}
                            stroke="#818cf8"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                          />

                          {resultadoComparacao && (
                            <Line
                              type="monotone"
                              dataKey="jerkPernaComparacao"
                              name={nomeColetaComparativa}
                              stroke="#72c7a0"
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                              isAnimationActive={false}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </article>
                </div>
              </section>

              {/* Comparação entre duas coletas */}
              <section className="comparison-section">
                <h2 className="section-title">
                  Comparação entre coletas
                </h2>

                <p className="comparison-description">
                  Adicione uma segunda coleta para comparar as métricas do atleta em diferentes velocidades, treinos ou repetições.
                </p>

                {!resultadoComparacao ? (
                  <div
                    className="comparison-card"
                    data-html2canvas-ignore="true"
                  >
                    <h4>Segunda coleta</h4>

                    <div className="comparison-row">
                      <span>
                        Arquivo selecionado
                      </span>

                      <strong>
                        {arquivoComparacao?.name ||
                          "Nenhum arquivo"}
                      </strong>
                    </div>

                    <div
                      className="upload-actions"
                      style={{
                        marginTop: "18px",
                      }}
                    >
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={
                          abrirSeletorComparacao
                        }
                        disabled={
                          loadingComparacao
                        }
                      >
                        {arquivoComparacao
                          ? "Trocar coleta"
                          : "Selecionar coleta"}
                      </button>

                      {arquivoComparacao && (
                        <button
                          type="button"
                          className="main-upload-button"
                          onClick={
                            enviarArquivoComparacao
                          }
                          disabled={
                            loadingComparacao
                          }
                        >
                          {loadingComparacao
                            ? "Analisando..."
                            : "Comparar coletas"}
                        </button>
                      )}
                    </div>

                    {erroComparacao && (
                      <div className="error-message">
                        {erroComparacao}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="comparison-grid">
                    <div className="comparison-card">
                      <h4>Coleta principal</h4>

                      <div className="comparison-row">
                        <span>Arquivo</span>

                        <strong>
                          {resultado.filename}
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>Velocidade</span>

                        <strong>
                          {velocidade
                            ? `${velocidade} km/h`
                            : "-"}
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Ângulo médio
                        </span>

                        <strong>
                          {formatarValor(
                            angulo?.media
                          )}
                          °
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>Amplitude</span>

                        <strong>
                          {formatarValor(
                            angulo?.amplitude
                          )}
                          °
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Desvio-padrão
                        </span>

                        <strong>
                          {formatarValor(
                            angulo?.desvio_padrao
                          )}
                          °
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Jerk médio da coxa
                        </span>

                        <strong>
                          {formatarValor(
                            jerkCoxa?.media
                          )}
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Jerk médio da perna
                        </span>

                        <strong>
                          {formatarValor(
                            jerkPerna?.media
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="comparison-card">
                      <h4>
                        Coleta comparativa
                      </h4>

                      <div className="comparison-row">
                        <span>Arquivo</span>

                        <strong>
                          {
                            resultadoComparacao.filename
                          }
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>Velocidade</span>

                        <strong>
                          {dadosNomeComparacao.velocidade
                            ? `${dadosNomeComparacao.velocidade} km/h`
                            : "-"}
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Ângulo médio
                        </span>

                        <strong>
                          {formatarValor(
                            anguloComparacao?.media
                          )}
                          °
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>Amplitude</span>

                        <strong>
                          {formatarValor(
                            anguloComparacao?.amplitude
                          )}
                          °
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Desvio-padrão
                        </span>

                        <strong>
                          {formatarValor(
                            anguloComparacao?.desvio_padrao
                          )}
                          °
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Jerk médio da coxa
                        </span>

                        <strong>
                          {formatarValor(
                            jerkCoxaComparacao?.media
                          )}
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Jerk médio da perna
                        </span>

                        <strong>
                          {formatarValor(
                            jerkPernaComparacao?.media
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="comparison-card comparison-variation">
                      <div className="comparison-title-row">
                        <h4>
                          Diferença entre coletas
                        </h4>

                        <InfoIcon
                          texto="Os valores representam a coleta comparativa menos a coleta principal. Valores positivos indicam aumento na segunda coleta; valores negativos indicam redução."
                        />
                      </div>

                      <div className="comparison-row">
                        <span>
                          Ângulo médio
                        </span>

                        <strong>
                          {calcularDiferenca(
                            anguloComparacao?.media,
                            angulo?.media
                          )}
                          °
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>Amplitude</span>

                        <strong>
                          {calcularDiferenca(
                            anguloComparacao?.amplitude,
                            angulo?.amplitude
                          )}
                          °
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Desvio-padrão
                        </span>

                        <strong>
                          {calcularDiferenca(
                            anguloComparacao?.desvio_padrao,
                            angulo?.desvio_padrao
                          )}
                          °
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Jerk médio da coxa
                        </span>

                        <strong>
                          {calcularDiferenca(
                            jerkCoxaComparacao?.media,
                            jerkCoxa?.media
                          )}
                        </strong>
                      </div>

                      <div className="comparison-row">
                        <span>
                          Jerk médio da perna
                        </span>

                        <strong>
                          {calcularDiferenca(
                            jerkPernaComparacao?.media,
                            jerkPerna?.media
                          )}
                        </strong>
                      </div>

                      <div
                        className="upload-actions"
                        style={{
                          marginTop: "18px",
                        }}
                        data-html2canvas-ignore="true"
                      >
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={
                            abrirSeletorComparacao
                          }
                        >
                          Trocar comparação
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {erro && (
                <div className="error-message">
                  {erro}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;