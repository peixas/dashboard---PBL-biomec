import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useDashboard } from "./context/DashboardContext";
import { Link } from "react-router";
import logoProjeto from "./assets/logo-projeto.png";
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

function calcularPercentil(valores, percentual) {
  const valoresValidos = valores
    .map(Number)
    .filter((valor) => Number.isFinite(valor))
    .sort((a, b) => a - b);

  if (!valoresValidos.length) {
    return null;
  }

  const posicao =
    (percentual / 100) * (valoresValidos.length - 1);

  const indiceInferior = Math.floor(posicao);
  const indiceSuperior = Math.ceil(posicao);

  if (indiceInferior === indiceSuperior) {
    return valoresValidos[indiceInferior];
  }

  const proporcao = posicao - indiceInferior;

  return (
    valoresValidos[indiceInferior] +
    proporcao *
      (valoresValidos[indiceSuperior] -
        valoresValidos[indiceInferior])
  );
}

function calcularDistribuicaoJerk(valores) {
  const valoresValidos = valores
    .map(Number)
    .filter((valor) => Number.isFinite(valor));

  if (!valoresValidos.length) {
    return null;
  }

  const p50 = calcularPercentil(valoresValidos, 50);
  const p75 = calcularPercentil(valoresValidos, 75);
  const p95 = calcularPercentil(valoresValidos, 95);

  const contagens = {
    habitual: 0,
    moderada: 0,
    elevada: 0,
    picos: 0,
  };

  valoresValidos.forEach((valor) => {
    if (valor <= p50) {
      contagens.habitual += 1;
    } else if (valor <= p75) {
      contagens.moderada += 1;
    } else if (valor <= p95) {
      contagens.elevada += 1;
    } else {
      contagens.picos += 1;
    }
  });

  const total = valoresValidos.length;

  return {
    habitual: (contagens.habitual / total) * 100,
    moderada: (contagens.moderada / total) * 100,
    elevada: (contagens.elevada / total) * 100,
    picos: (contagens.picos / total) * 100,
    limites: {
      p50,
      p75,
      p95,
    },
  };
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

  const {
    arquivo,
    setArquivo,

    resultado,
    setResultado,

    loading,
    setLoading,

    erro,
    setErro,

    arquivoComparacao,
    setArquivoComparacao,

    resultadoComparacao,
    setResultadoComparacao,

    loadingComparacao,
    setLoadingComparacao,

    erroComparacao,
    setErroComparacao,

    nomeAtleta,
    setNomeAtleta,

    velocidade,
    setVelocidade,

    dataColeta,
    setDataColeta,

    observacoes,
    setObservacoes,
  } = useDashboard();

  const [exportando, setExportando] = useState(false);

  const [visualizacaoJerk, setVisualizacaoJerk] =
    useState("tempo");

  const [
    mostrarExplicacaoDistribuicao,
    setMostrarExplicacaoDistribuicao,
  ] = useState(false);

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

  const distribuicaoJerkCoxa = calcularDistribuicaoJerk(
    dadosGraficosPrincipal
      .map((ponto) => ponto.jerkCoxa)
      .filter((valor) => valor !== null)
  );

  const distribuicaoJerkPerna = calcularDistribuicaoJerk(
    dadosGraficosPrincipal
      .map((ponto) => ponto.jerkPerna)
      .filter((valor) => valor !== null)
  );

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
            <div className="dashboard-header-brand">
              <img
                src={logoProjeto}
                alt="Nome do projeto"
                className="dashboard-project-logo"
              />

              <div>
                <p className="dashboard-eyebrow">
                  Análise biomecânica
                </p>

                <h1>Dashboard de Corrida</h1>

                <p className="dashboard-description">
                  Visualização de dados processados de sensores IMU.
                </p>
              </div>
            </div>
          </header>
        

        <main className="dashboard-content">
          {!resultado ? (
            <section className="empty-state">
              <img
                src={logoProjeto}
                alt="Nome do projeto"
                className="empty-state-logo"
              />

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

                <div className="collection-chips">
                  <div className="collection-chip">
                    <span>Arquivo</span>
                    <strong>{resultado.filename}</strong>
                  </div>

                  <div className="collection-chip">
                    <span>Duração</span>
                    <strong>
                      {resultado.summary?.duracao_vetorizada_s ?? "-"} s
                    </strong>
                  </div>

                  <div className="collection-chip">
                    <span>Cobertura</span>
                    <strong>
                      {resultado.summary?.cobertura_percentual ?? "-"}%
                    </strong>
                  </div>

                  <div className="collection-chip">
                    <span>Registros</span>
                    <strong>{resultado.rows}</strong>
                  </div>
                </div>
              </section>

              {/* Indicadores principais */}
              <section className="dashboard-section section-indicators">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      Visão geral
                    </span>

                    <h2>Indicadores principais</h2>
                  </div>

                  <p>
                    Medidas mais relevantes extraídas da coleta atual.
                  </p>
                </div>

                <div className="home-metrics-grid">
                  <article className="main-indicator-card indicator-amplitude">
                    <div className="main-indicator-header">
                      <span className="main-indicator-icon">↕</span>
                      <span>Amplitude do joelho</span>
                    </div>

                    <strong>{angulo?.amplitude ?? "-"}°</strong>

                    <p>Diferença entre o maior e o menor ângulo registrado durante a corrida. Indica a faixa total do movimento do joelho.</p>
                  </article>

                  <article className="main-indicator-card indicator-variation">
                    <div className="main-indicator-header">
                      <span className="main-indicator-icon">≈</span>
                      <span>Variação do ângulo</span>
                    </div>

                    <strong>{angulo?.desvio_padrao ?? "-"}°</strong>

                    <p>Mostra o quanto o ângulo do joelho mudou ao longo da coleta. Quanto maior o valor, menos constante foi o movimento.</p>
                  </article>

                  <article className="main-indicator-card indicator-coxa">
                    <div className="main-indicator-header">
                      <span className="main-indicator-icon">⌁</span>
                      <span>Jerk médio da coxa</span>

                      <InfoIcon texto={explicacaoJerk} />
                    </div>

                    <strong>{jerkCoxa?.media ?? "-"}</strong>

                    <p>Suavidade média do movimento da coxa.</p>
                  </article>

                  <article className="main-indicator-card indicator-perna">
                    <div className="main-indicator-header">
                      <span className="main-indicator-icon">⌁</span>
                      <span>Jerk médio da perna</span>

                      <InfoIcon texto={explicacaoJerk} />
                    </div>

                    <strong>{jerkPerna?.media ?? "-"}</strong>

                    <p>Suavidade média do movimento da perna.</p>
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

                 {/* Área de visualização do jerk */}
                  <div className="jerk-view-controls chart-card-wide">
                    <div>
                      <h3>Análise do jerk</h3>

                      <p>
                        Escolha como visualizar a variação da aceleração
                        registrada na coxa e na perna.
                      </p>
                    </div>

                    <div
                      className="jerk-view-buttons"
                      data-html2canvas-ignore="true"
                    >
                      <button
                        type="button"
                        className={
                          visualizacaoJerk === "tempo"
                            ? "jerk-view-button active"
                            : "jerk-view-button"
                        }
                        onClick={() => setVisualizacaoJerk("tempo")}
                      >
                        Ao longo do tempo
                      </button>

                      <button
                        type="button"
                        className={
                          visualizacaoJerk === "distribuicao"
                            ? "jerk-view-button active"
                            : "jerk-view-button"
                        }
                        onClick={() =>
                          setVisualizacaoJerk("distribuicao")
                        }
                      >
                        Distribuição
                      </button>
                    </div>
                  </div>

                  {visualizacaoJerk === "tempo" ? (
                    <>
                      {/* Gráfico de jerk da coxa */}
                      <article className="chart-card">
                        <div className="chart-header">
                          <div>
                            <h3>Jerk da coxa</h3>

                            <p>
                              Variação da aceleração da coxa ao longo da
                              coleta.
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
                                  stroke="#22a6a1"
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
                              Variação da aceleração da perna ao longo da
                              coleta.
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
                                stroke="#e98072"
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
                                  stroke="#c68d2f"
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
                    </>
                  ) : (
                    <div className="jerk-distribution-area chart-card-wide">
                      <div
                        className="distribution-help-row"
                        data-html2canvas-ignore="true"
                      >
                        <div>
                          <h3>Distribuição do jerk</h3>

                          <p>
                            Veja como os valores de jerk se distribuem entre
                            diferentes faixas da própria coleta.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="distribution-help-button"
                          onClick={() =>
                            setMostrarExplicacaoDistribuicao(true)
                          }
                        >
                          ? Como interpretar
                        </button>
                      </div>

                      <div className="jerk-distribution-grid">
                        <article className="chart-card distribution-card">
                          <div className="chart-header">
                            <div>
                              <h3>Distribuição do jerk da coxa</h3>

                              <p>
                                Proporção dos valores de jerk em cada faixa da
                                própria coleta.
                              </p>
                            </div>
                          </div>

                          {distribuicaoJerkCoxa ? (
                            <>
                              <div className="distribution-bar">
                                <div
                                  className="distribution-segment distribution-habitual"
                                  style={{
                                    width: `${distribuicaoJerkCoxa.habitual}%`,
                                  }}
                                />

                                <div
                                  className="distribution-segment distribution-moderate"
                                  style={{
                                    width: `${distribuicaoJerkCoxa.moderada}%`,
                                  }}
                                />

                                <div
                                  className="distribution-segment distribution-high"
                                  style={{
                                    width: `${distribuicaoJerkCoxa.elevada}%`,
                                  }}
                                />

                                <div
                                  className="distribution-segment distribution-peak"
                                  style={{
                                    width: `${distribuicaoJerkCoxa.picos}%`,
                                  }}
                                />
                              </div>

                              <div className="distribution-values">
                                <div>
                                  <span className="distribution-dot distribution-habitual" />
                                  <span>Faixa habitual</span>
                                  <strong>
                                    {distribuicaoJerkCoxa.habitual.toFixed(1)}%
                                  </strong>
                                </div>

                                <div>
                                  <span className="distribution-dot distribution-moderate" />
                                  <span>Variação moderada</span>
                                  <strong>
                                    {distribuicaoJerkCoxa.moderada.toFixed(1)}%
                                  </strong>
                                </div>

                                <div>
                                  <span className="distribution-dot distribution-high" />
                                  <span>Variação elevada</span>
                                  <strong>
                                    {distribuicaoJerkCoxa.elevada.toFixed(1)}%
                                  </strong>
                                </div>

                                <div>
                                  <span className="distribution-dot distribution-peak" />
                                  <span>Picos de movimento</span>
                                  <strong>
                                    {distribuicaoJerkCoxa.picos.toFixed(1)}%
                                  </strong>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="distribution-empty">
                              Não foi possível calcular a distribuição da coxa.
                            </p>
                          )}
                        </article>

                        <article className="chart-card distribution-card">
                          <div className="chart-header">
                            <div>
                              <h3>Distribuição do jerk da perna</h3>

                              <p>
                                Proporção dos valores de jerk em cada faixa da
                                própria coleta.
                              </p>
                            </div>
                          </div>

                          {distribuicaoJerkPerna ? (
                            <>
                              <div className="distribution-bar">
                                <div
                                  className="distribution-segment distribution-habitual"
                                  style={{
                                    width: `${distribuicaoJerkPerna.habitual}%`,
                                  }}
                                />

                                <div
                                  className="distribution-segment distribution-moderate"
                                  style={{
                                    width: `${distribuicaoJerkPerna.moderada}%`,
                                  }}
                                />

                                <div
                                  className="distribution-segment distribution-high"
                                  style={{
                                    width: `${distribuicaoJerkPerna.elevada}%`,
                                  }}
                                />

                                <div
                                  className="distribution-segment distribution-peak"
                                  style={{
                                    width: `${distribuicaoJerkPerna.picos}%`,
                                  }}
                                />
                              </div>

                              <div className="distribution-values">
                                <div>
                                  <span className="distribution-dot distribution-habitual" />
                                  <span>Faixa habitual</span>
                                  <strong>
                                    {distribuicaoJerkPerna.habitual.toFixed(1)}%
                                  </strong>
                                </div>

                                <div>
                                  <span className="distribution-dot distribution-moderate" />
                                  <span>Variação moderada</span>
                                  <strong>
                                    {distribuicaoJerkPerna.moderada.toFixed(1)}%
                                  </strong>
                                </div>

                                <div>
                                  <span className="distribution-dot distribution-high" />
                                  <span>Variação elevada</span>
                                  <strong>
                                    {distribuicaoJerkPerna.elevada.toFixed(1)}%
                                  </strong>
                                </div>

                                <div>
                                  <span className="distribution-dot distribution-peak" />
                                  <span>Picos de movimento</span>
                                  <strong>
                                    {distribuicaoJerkPerna.picos.toFixed(1)}%
                                  </strong>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="distribution-empty">
                              Não foi possível calcular a distribuição da perna.
                            </p>
                          )}
                        </article>
                      </div>
                    </div>
                  )}
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
              <section
                className="home-final-actions"
                data-html2canvas-ignore="true"
              >
                <div className="home-final-actions-content">
                  <span className="section-kicker">
                    Relatório
                  </span>

                  <h2>Finalize a análise da coleta</h2>

                  <p>
                    Exporte a visualização atual ou acesse o relatório completo
                    com todas as métricas e comparações.
                  </p>
                </div>

                <div className="home-final-actions-buttons">
                  <button
                    type="button"
                    className="report-action-button report-action-secondary"
                    onClick={exportarPDF}
                    disabled={exportando}
                  >
                    <span className="report-action-icon">↓</span>

                    <span>
                      <small>Salvar visualização</small>

                      <strong>
                        {exportando
                          ? "Exportando..."
                          : "Exportar PDF"}
                      </strong>
                    </span>
                  </button>

                  <Link
                    to="/relatorio"
                    className="report-action-button report-action-primary"
                  >
                    <span className="report-action-icon">→</span>

                    <span>
                      <small>Análise detalhada</small>
                      <strong>Obter relatório completo</strong>
                    </span>
                  </Link>
                </div>
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

              {mostrarExplicacaoDistribuicao && (
              
        <div
          className="distribution-modal-overlay"
          role="presentation"
          onClick={() => setMostrarExplicacaoDistribuicao(false)}
          data-html2canvas-ignore="true"
        >
          <section
            className="distribution-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="distribution-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="distribution-modal-header">
              <div>
                <span className="distribution-info-eyebrow">
                  Como interpretar
                </span>

                <h2 id="distribution-modal-title">
                  Entenda a distribuição do jerk
                </h2>
              </div>

              <button
                type="button"
                className="distribution-modal-close"
                aria-label="Fechar explicação"
                onClick={() =>
                  setMostrarExplicacaoDistribuicao(false)
                }
              >
                ×
              </button>
            </div>

            <p className="distribution-modal-introduction">
              O jerk representa o quanto a aceleração muda durante o
              movimento. Valores menores correspondem a movimentos
              relativamente mais suaves, enquanto valores maiores indicam
              mudanças mais rápidas ou bruscas da aceleração.
            </p>

            <div className="distribution-modal-grid">
              <article>
                <span className="distribution-info-color distribution-habitual" />

                <div>
                  <h3>Faixa habitual da coleta</h3>

                  <p>
                    Reúne os 50% menores valores registrados. São os
                    movimentos relativamente mais suaves da própria coleta.
                  </p>
                </div>
              </article>

              <article>
                <span className="distribution-info-color distribution-moderate" />

                <div>
                  <h3>Variação moderada</h3>

                  <p>
                    Inclui os valores entre P50 e P75, com mudanças de
                    aceleração maiores que as da faixa habitual.
                  </p>
                </div>
              </article>

              <article>
                <span className="distribution-info-color distribution-high" />

                <div>
                  <h3>Variação elevada</h3>

                  <p>
                    Inclui os valores entre P75 e P95, representando momentos
                    de maior mudança da aceleração.
                  </p>
                </div>
              </article>

              <article>
                <span className="distribution-info-color distribution-peak" />

                <div>
                  <h3>Picos de movimento</h3>

                  <p>
                    Reúne os valores acima de P95, ou seja, os 5% maiores
                    valores registrados.
                  </p>
                </div>
              </article>
            </div>

            <div className="distribution-modal-percentiles">
              <div>
                <strong>P50</strong>
                <span>Metade dos valores está abaixo desse limite.</span>
              </div>

              <div>
                <strong>P75</strong>
                <span>75% dos valores está abaixo desse limite.</span>
              </div>

              <div>
                <strong>P95</strong>
                <span>Somente os 5% maiores valores ficam acima.</span>
              </div>
            </div>

            <div className="distribution-warning">
              <strong>Importante:</strong> as faixas são calculadas com base
              na própria coleta. Elas não representam limites clínicos nem
              permitem concluir isoladamente que houve fadiga ou risco de
              lesão.
            </div>
          </section>
        </div>
      )}

    </div>
  );
}

export default App;