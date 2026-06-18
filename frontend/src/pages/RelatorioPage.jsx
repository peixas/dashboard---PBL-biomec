import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useDashboard } from "../context/DashboardContext";
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

function numeroOuNulo(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : null;
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

  if (
    !Number.isFinite(comparacao) ||
    !Number.isFinite(principal)
  ) {
    return "-";
  }

  const diferenca = comparacao - principal;
  const sinal = diferenca > 0 ? "+" : "";

  return `${sinal}${diferenca.toFixed(3)}`;
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

  const pontosAgrupados = pontos.reduce(
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

  return Object.values(pontosAgrupados)
    .map((grupo) => ({
      tempo: grupo.tempo,
      anguloJoelho: calcularMedia(grupo.angulos),
      jerkCoxa: calcularMedia(grupo.jerksCoxa),
      jerkPerna: calcularMedia(grupo.jerksPerna),
    }))
    .sort((a, b) => a.tempo - b.tempo);
}

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

    const pontoExistente =
      pontosPorTempo.get(chaveTempo);

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
function calcularVariacaoPercentual(
  valorComparacao,
  valorPrincipal
) {
  const comparacao = Number(valorComparacao);
  const principal = Number(valorPrincipal);

  if (
    !Number.isFinite(comparacao) ||
    !Number.isFinite(principal) ||
    principal === 0
  ) {
    return null;
  }

  return (
    ((comparacao - principal) /
      Math.abs(principal)) *
    100
  );
}

function formatarVariacaoPercentual(valor) {
  if (!Number.isFinite(valor)) {
    return "-";
  }

  const sinal = valor > 0 ? "+" : "";

  return `${sinal}${valor.toFixed(1)}%`;
}

function classeDaVariacao(valor) {
  if (!Number.isFinite(valor) || valor === 0) {
    return "variation-neutral";
  }

  return valor > 0
    ? "variation-increase"
    : "variation-decrease";
}

function interpretarRPE(valor) {
  const rpe = Number(valor);

  if (Number.isNaN(rpe)) {
    return {
      classificacao: "Não informado",
      descricao:
        "Informe a percepção subjetiva de esforço do atleta para complementar a análise biomecânica.",
      classe: "rpe-empty",
    };
  }

  if (rpe <= 2) {
    return {
      classificacao: "Esforço muito baixo",
      descricao:
        "O atleta relatou pouca percepção de esforço ao final da coleta.",
      classe: "rpe-low",
    };
  }

  if (rpe <= 4) {
    return {
      classificacao: "Esforço leve a moderado",
      descricao:
        "O atleta relatou esforço controlado, com baixa a moderada percepção de fadiga.",
      classe: "rpe-light",
    };
  }

  if (rpe <= 6) {
    return {
      classificacao: "Esforço moderado",
      descricao:
        "O atleta relatou esforço perceptível, que deve ser analisado em conjunto com os indicadores de movimento.",
      classe: "rpe-moderate",
    };
  }

  if (rpe <= 8) {
    return {
      classificacao: "Esforço elevado",
      descricao:
        "O atleta relatou alta percepção de esforço, sugerindo possível fadiga percebida ao final da coleta.",
      classe: "rpe-high",
    };
  }

  return {
    classificacao: "Esforço máximo",
    descricao:
      "O atleta relatou esforço muito intenso. A interpretação deve considerar os dados biomecânicos e o contexto da coleta.",
    classe: "rpe-maximum",
  };
}

function RelatorioPage() {
  const [rpeFadiga, setRpeFadiga] = useState("");
  const interpretacaoRPE = interpretarRPE(rpeFadiga);
  
  useEffect(() => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "auto",
  });
}, []);

  const {
    resultado,
    resultadoComparacao,
    nomeAtleta,
    velocidade,
    dataColeta,
    observacoes,
  } = useDashboard();

  if (!resultado) {
    return (
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">
              Análise detalhada
            </p>

            <h1>Relatório completo</h1>

            <p className="dashboard-description">
              Métricas técnicas e visualizações detalhadas da
              coleta.
            </p>
          </div>

          <Link
            className="secondary-button page-link"
            to="/"
          >
            Voltar para a Home
          </Link>
        </header>

        <main className="dashboard-content">
          <section className="empty-state">
            <div className="empty-icon">📄</div>

            <h2>Nenhuma coleta disponível</h2>

            <p>
              Volte para a Home, selecione um arquivo CSV e
              processe a coleta antes de abrir o relatório.
            </p>

            <Link
              className="main-upload-button page-link"
              to="/"
            >
              Ir para a Home
            </Link>
          </section>
        </main>
      </div>
    );
  }
  
  const angulo =
  resultado?.summary?.angulo_joelho;

  const jerkCoxa =
    resultado?.jerk_summary?.coxa;

  const jerkPerna =
    resultado?.jerk_summary?.perna;

  // Cole os textos explicativos aqui
  const explicacaoAnguloMinimo =
    "Menor ângulo registrado pelo joelho durante a coleta.";

  const explicacaoAnguloMaximo =
    "Maior ângulo registrado pelo joelho durante a coleta.";

  const explicacaoAnguloMedio =
    "Média dos ângulos registrados durante toda a coleta.";

  const explicacaoAmplitude =
    "Diferença entre o maior e o menor ângulo registrado, indicando a variação total do movimento do joelho.";

  const explicacaoDesvioPadrao =
    "Indica o quanto o ângulo variou ao longo da coleta. Valores maiores representam maior variabilidade do movimento.";

  const explicacaoJerkMedio =
    "Representa a variação média da aceleração. Valores maiores indicam movimentos menos suaves ou mais bruscos.";

  const explicacaoPercentil95 =
    "Representa um valor elevado de jerk: 95% dos registros ficaram abaixo dele e apenas 5% ficaram acima.";

  const anguloComparacao =
    resultadoComparacao?.summary?.angulo_joelho;

  const jerkCoxaComparacao =
    resultadoComparacao?.jerk_summary?.coxa;

  const jerkPernaComparacao =
    resultadoComparacao?.jerk_summary?.perna;

  const seriePrincipal =
    prepararSerieTemporal(resultado);

  const serieComparativa =
    prepararSerieTemporal(resultadoComparacao);

  const dadosGraficos =
    juntarSeriesTemporais(
      seriePrincipal,
      serieComparativa
    );
  
  const variacaoAmplitude =
    calcularVariacaoPercentual(
      anguloComparacao?.amplitude,
      angulo?.amplitude
    );

  const variacaoDesvioAngulo =
    calcularVariacaoPercentual(
      anguloComparacao?.desvio_padrao,
      angulo?.desvio_padrao
    );

  const variacaoJerkCoxa =
    calcularVariacaoPercentual(
      jerkCoxaComparacao?.media,
      jerkCoxa?.media
    );

  const variacaoJerkPerna =
    calcularVariacaoPercentual(
      jerkPernaComparacao?.media,
      jerkPerna?.media
    );

  function interpretarVariacaoJerk(
    variacao,
    segmento
  ) {
    if (!Number.isFinite(variacao)) {
      return `Não foi possível calcular a variação do jerk da ${segmento}.`;
    }

    if (variacao > 0) {
      return `O jerk médio da ${segmento} aumentou ${formatarVariacaoPercentual(
        variacao
      )}. Isso indica menor suavidade e maior variação da aceleração nesse segmento na coleta comparativa.`;
    }

    if (variacao < 0) {
      return `O jerk médio da ${segmento} diminuiu ${Math.abs(
        variacao
      ).toFixed(
        1
      )}%. Isso indica um movimento relativamente mais suave na coleta comparativa.`;
    }

    return `O jerk médio da ${segmento} permaneceu estável entre as coletas.`;
  }

  const interpretacaoAmplitude =
    Number.isFinite(variacaoAmplitude)
      ? variacaoAmplitude > 0
        ? `A amplitude do joelho aumentou ${formatarVariacaoPercentual(
            variacaoAmplitude
          )}, indicando uma faixa de movimento maior na coleta comparativa.`
        : variacaoAmplitude < 0
          ? `A amplitude do joelho diminuiu ${Math.abs(
              variacaoAmplitude
            ).toFixed(
              1
            )}%, indicando uma faixa de movimento menor na coleta comparativa.`
          : "A amplitude do joelho permaneceu estável entre as coletas."
      : "Não foi possível calcular a variação percentual da amplitude.";

  const interpretacaoJerkCoxa =
    interpretarVariacaoJerk(
      variacaoJerkCoxa,
      "coxa"
    );

  const interpretacaoJerkPerna =
    interpretarVariacaoJerk(
      variacaoJerkPerna,
      "perna"
    );

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">
            Análise detalhada
          </p>

          <h1>Relatório completo</h1>

          <p className="dashboard-description">
            Métricas técnicas e visualizações detalhadas da
            coleta.
          </p>
        </div>

        <Link
          className="secondary-button page-link"
          to="/"
        >
          Voltar para a Home
        </Link>
      </header>

      <main className="dashboard-content">
        {/* Identificação da coleta */}
        <section className="success-state">
          <div className="success-header">
            <div>
              <p className="success-label">
                Coleta analisada
              </p>

              <h2>{resultado.filename}</h2>
            </div>
          </div>

          <div className="metadata-grid">
            <div className="input-group">
              <label>Nome do atleta</label>

              <input
                type="text"
                value={nomeAtleta || "-"}
                readOnly
              />
            </div>

            <div className="input-group">
              <label>Velocidade da coleta</label>

              <input
                type="text"
                value={
                  velocidade
                    ? `${velocidade} km/h`
                    : "-"
                }
                readOnly
              />
            </div>

            <div className="input-group">
              <label>Data da coleta</label>

              <input
                type="text"
                value={dataColeta || "-"}
                readOnly
              />
            </div>
          </div>

          {observacoes && (
            <div
              className="input-group"
              style={{ marginTop: "16px" }}
            >
              <label>Observações</label>

              <textarea
                value={observacoes}
                readOnly
                rows={3}
              />
            </div>
          )}

          <div className="collection-chips">
            <div className="collection-chip">
              <span>Arquivo</span>
              <strong>{resultado.filename}</strong>
            </div>

            <div className="collection-chip">
              <span>Duração</span>

              <strong>
                {resultado.summary
                  ?.duracao_vetorizada_s ?? "-"}{" "}
                s
              </strong>
            </div>

            <div className="collection-chip">
              <span>Cobertura</span>

              <strong>
                {resultado.summary
                  ?.cobertura_percentual ?? "-"}
                %
              </strong>
            </div>

            <div className="collection-chip">
              <span>Registros</span>
              <strong>{resultado.rows}</strong>
            </div>

            <div className="collection-chip">
              <span>Colunas</span>
              <strong>
                {resultado.columns_count}
              </strong>
            </div>
          </div>
        </section>

        {/* Métricas do ângulo */}
        <section className="dashboard-section report-metrics-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                Movimento articular
              </span>

              <h2>Métricas do ângulo do joelho</h2>
            </div>

            <p>
              Valores que descrevem a posição e a variação angular do
              joelho durante a coleta.
            </p>
          </div>

          <div className="report-indicators-grid">
            <article className="main-indicator-card indicator-angle-min">
              <div className="main-indicator-header">
                <span className="main-indicator-icon">↓</span>
                <span>Ângulo mínimo</span>

                <InfoIcon texto={explicacaoAnguloMinimo} />
              </div>

              <strong>
                {formatarValor(angulo?.minimo)}°
              </strong>

              <p>Menor ângulo registrado durante a coleta.</p>
            </article>

            <article className="main-indicator-card indicator-angle-max">
              <div className="main-indicator-header">
                <span className="main-indicator-icon">↑</span>
                <span>Ângulo máximo</span>

                <InfoIcon texto={explicacaoAnguloMaximo} />
              </div>

              <strong>
                {formatarValor(angulo?.maximo)}°
              </strong>

              <p>Maior ângulo registrado durante a coleta.</p>
            </article>

            <article className="main-indicator-card indicator-angle-mean">
              <div className="main-indicator-header">
                <span className="main-indicator-icon">—</span>
                <span>Ângulo médio</span>

                <InfoIcon texto={explicacaoAnguloMedio} />
              </div>

              <strong>
                {formatarValor(angulo?.media)}°
              </strong>

              <p>Valor médio do ângulo ao longo do registro.</p>
            </article>

            <article className="main-indicator-card indicator-amplitude">
              <div className="main-indicator-header">
                <span className="main-indicator-icon">↕</span>
                <span>Amplitude</span>

                <InfoIcon texto={explicacaoAmplitude} />
              </div>

              <strong>
                {formatarValor(angulo?.amplitude)}°
              </strong>

              <p>Diferença entre os ângulos máximo e mínimo.</p>
            </article>

            <article className="main-indicator-card indicator-variation">
              <div className="main-indicator-header">
                <span className="main-indicator-icon">≈</span>
                <span>Desvio-padrão</span>

                <InfoIcon texto={explicacaoDesvioPadrao} />
              </div>

              <strong>
                {formatarValor(angulo?.desvio_padrao)}°
              </strong>

              <p>Variabilidade do ângulo durante a coleta.</p>
            </article>
          </div>
        </section>

        {/* Métricas do jerk */}
        <section className="dashboard-section report-metrics-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                Suavidade do movimento
              </span>

              <h2>Métricas de jerk</h2>
            </div>

            <p>
              Medidas da rapidez com que a aceleração mudou na coxa e
              na perna durante a corrida.
            </p>
          </div>

          <div className="report-indicators-grid report-jerk-grid">
            <article className="main-indicator-card indicator-coxa">
              <div className="main-indicator-header">
                <span className="main-indicator-icon">⌁</span>
                <span>Jerk médio da coxa</span>

                <InfoIcon texto={explicacaoJerkMedio} />
              </div>

              <strong>
                {formatarValor(jerkCoxa?.media)}
                <small className="indicator-unit"> m/s³</small>
              </strong>

              <p>
                Variação média da aceleração registrada na coxa.
              </p>
            </article>

            <article className="main-indicator-card indicator-coxa-peak">
              <div className="main-indicator-header">
                <span className="main-indicator-icon">▲</span>
                <span>Percentil 95 da coxa</span>

                <InfoIcon texto={explicacaoPercentil95} />
              </div>

              <strong>
                {formatarValor(jerkCoxa?.percentil_95)}
                <small className="indicator-unit"> m/s³</small>
              </strong>

              <p>
                Limite abaixo do qual ficaram 95% dos registros.
              </p>
            </article>

            <article className="main-indicator-card indicator-perna">
              <div className="main-indicator-header">
                <span className="main-indicator-icon">⌁</span>
                <span>Jerk médio da perna</span>

                <InfoIcon texto={explicacaoJerkMedio} />
              </div>

              <strong>
                {formatarValor(jerkPerna?.media)}
                <small className="indicator-unit"> m/s³</small>
              </strong>

              <p>
                Variação média da aceleração registrada na perna.
              </p>
            </article>

            <article className="main-indicator-card indicator-perna-peak">
              <div className="main-indicator-header">
                <span className="main-indicator-icon">▲</span>
                <span>Percentil 95 da perna</span>

                <InfoIcon texto={explicacaoPercentil95} />
              </div>

              <strong>
                {formatarValor(jerkPerna?.percentil_95)}
                <small className="indicator-unit"> m/s³</small>
              </strong>

              <p>
                Limite abaixo do qual ficaram 95% dos registros.
              </p>
            </article>
          </div>
        </section>

        {/* Gráficos detalhados */}
        <section className="charts-section">
          <h2 className="section-title">
            Visualizações detalhadas
          </h2>

          <p className="charts-description">
            Evolução das métricas biomecânicas ao longo do
            tempo.
            {resultadoComparacao &&
              " As duas coletas estão sobrepostas para comparação."}
          </p>

          <div className="charts-grid">
            {/* Ângulo */}
            <article className="chart-card chart-card-wide">
              <div className="chart-header">
                <div>
                  <h3>Ângulo do joelho</h3>

                  <p>
                    Variação angular do joelho ao longo da
                    coleta.
                  </p>
                </div>
              </div>

              <div className="chart-area">
                <ResponsiveContainer
                  width="100%"
                  height={370}
                >
                  <LineChart
                    data={dadosGraficos}
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
                        value: "Ângulo (°)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />

                    <Tooltip
                      formatter={(valor, nome) => [
                        `${Number(valor).toFixed(3)}°`,
                        nome,
                      ]}
                      labelFormatter={(tempo) =>
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
                      name="Ângulo — coleta principal"
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
                        name="Ângulo — coleta comparativa"
                        stroke="#e98072"
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

            {/* Jerk da coxa */}
            <article className="chart-card">
              <div className="chart-header">
                <div>
                  <h3>Jerk da coxa</h3>

                  <p>
                    Mudança da aceleração da coxa ao longo do
                    tempo.
                  </p>
                </div>
              </div>

              <div className="chart-area">
                <ResponsiveContainer
                  width="100%"
                  height={340}
                >
                  <LineChart
                    data={dadosGraficos}
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
                        `${Number(valor).toFixed(
                          3
                        )} m/s³`,
                        nome,
                      ]}
                      labelFormatter={(tempo) =>
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
                      type="monotone"
                      dataKey="jerkCoxaPrincipal"
                      name="Coxa — coleta principal"
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
                        name="Coxa — coleta comparativa"
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

            {/* Jerk da perna */}
            <article className="chart-card">
              <div className="chart-header">
                <div>
                  <h3>Jerk da perna</h3>

                  <p>
                    Mudança da aceleração da perna ao longo do
                    tempo.
                  </p>
                </div>
              </div>

              <div className="chart-area">
                <ResponsiveContainer
                  width="100%"
                  height={340}
                >
                  <LineChart
                    data={dadosGraficos}
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
                        `${Number(valor).toFixed(
                          3
                        )} m/s³`,
                        nome,
                      ]}
                      labelFormatter={(tempo) =>
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
                      type="monotone"
                      dataKey="jerkPernaPrincipal"
                      name="Perna — coleta principal"
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
                        name="Perna — coleta comparativa"
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
          </div>
        </section>

        <section className="report-section rpe-section">
          <div className="rpe-section-header-card">
            <div className="section-heading">
              <div>
                <span className="section-kicker">
                  Fadiga percebida
                </span>

                <h2>Escala RPE de fadiga</h2>
              </div>

              <p>
                Registro subjetivo do esforço percebido pelo atleta ao final da coleta.
              </p>
            </div>
          </div>

          <div className="rpe-panel">
            <div className="rpe-scale-card">
              <div className="rpe-scale-header">
                <div>
                  <span className="rpe-mini-label">
                    RPE informado
                  </span>

                  <strong>
                    {rpeFadiga === "" ? "--" : rpeFadiga}
                    <small>/10</small>
                  </strong>
                </div>

                <span className={`rpe-pill ${interpretacaoRPE.classe}`}>
                  {interpretacaoRPE.classificacao}
                </span>
              </div>

              <input
                id="rpe-fadiga"
                type="range"
                min="0"
                max="10"
                step="1"
                value={rpeFadiga === "" ? 0 : rpeFadiga}
                onChange={(event) => setRpeFadiga(event.target.value)}
                className="rpe-slider"
              />

              <div className="rpe-scale-numbers">
                <span>0</span>
                <span>2</span>
                <span>4</span>
                <span>6</span>
                <span>8</span>
                <span>10</span>
              </div>

              <p>
                0 representa nenhum esforço e 10 representa esforço máximo.
              </p>
            </div>

            <div className="rpe-interpretation-card">
              <span className="rpe-mini-label">
                Interpretação
              </span>

              <p>
                {interpretacaoRPE.descricao}
              </p>
            </div>
          </div>

          <div className="rpe-note">
            A escala RPE complementa os dados dos sensores, mas não deve ser
            interpretada isoladamente. A análise deve considerar também jerk,
            amplitude do joelho, variação angular e condições da coleta.
          </div>
        </section>

        {/* Comparação detalhada */}
        {resultadoComparacao && (
          <section className="comparison-section">
            <h2 className="section-title">
              Comparação detalhada entre coletas
            </h2>

            <p className="comparison-description">
              Os valores da diferença representam a coleta
              comparativa menos a coleta principal.
            </p>

            <div className="comparison-grid">
              <div className="comparison-card">
                <h4>Coleta principal</h4>

                <div className="comparison-row">
                  <span>Arquivo</span>
                  <strong>{resultado.filename}</strong>
                </div>

                <div className="comparison-row">
                  <span>Ângulo mínimo</span>
                  <strong>
                    {formatarValor(angulo?.minimo)}°
                  </strong>
                </div>

                <div className="comparison-row">
                  <span>Ângulo máximo</span>
                  <strong>
                    {formatarValor(angulo?.maximo)}°
                  </strong>
                </div>

                <div className="comparison-row">
                  <span>Ângulo médio</span>
                  <strong>
                    {formatarValor(angulo?.media)}°
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
                  <span>Jerk médio da coxa</span>
                  <strong>
                    {formatarValor(jerkCoxa?.media)}
                  </strong>
                </div>

                <div className="comparison-row">
                  <span>Jerk médio da perna</span>
                  <strong>
                    {formatarValor(jerkPerna?.media)}
                  </strong>
                </div>
              </div>

              <div className="comparison-card">
                <h4>Coleta comparativa</h4>

                <div className="comparison-row">
                  <span>Arquivo</span>

                  <strong>
                    {resultadoComparacao.filename}
                  </strong>
                </div>

                <div className="comparison-row">
                  <span>Ângulo mínimo</span>
                  <strong>
                    {formatarValor(
                      anguloComparacao?.minimo
                    )}
                    °
                  </strong>
                </div>

                <div className="comparison-row">
                  <span>Ângulo máximo</span>
                  <strong>
                    {formatarValor(
                      anguloComparacao?.maximo
                    )}
                    °
                  </strong>
                </div>

                <div className="comparison-row">
                  <span>Ângulo médio</span>
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
                  <span>Jerk médio da coxa</span>
                  <strong>
                    {formatarValor(
                      jerkCoxaComparacao?.media
                    )}
                  </strong>
                </div>

                <div className="comparison-row">
                  <span>Jerk médio da perna</span>
                  <strong>
                    {formatarValor(
                      jerkPernaComparacao?.media
                    )}
                  </strong>
                </div>
              </div>
              <div className="comparison-card comparison-variation">
                <h4>Diferença entre coletas</h4>

                <div className="comparison-row">
                  <span>Ângulo mínimo</span>

                  <strong>
                    {calcularDiferenca(
                      anguloComparacao?.minimo,
                      angulo?.minimo
                    )}
                    °
                  </strong>
                </div>

                <div className="comparison-row">
                  <span>Ângulo máximo</span>

                  <strong>
                    {calcularDiferenca(
                      anguloComparacao?.maximo,
                      angulo?.maximo
                    )}
                    °
                  </strong>
                </div>

                <div className="comparison-row">
                  <span>Ângulo médio</span>

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

                  <div className="comparison-value-stack">
                    <strong>
                      {calcularDiferenca(
                        anguloComparacao?.amplitude,
                        angulo?.amplitude
                      )}
                      °
                    </strong>

                    <small
                      className={classeDaVariacao(
                        variacaoAmplitude
                      )}
                    >
                      {formatarVariacaoPercentual(
                        variacaoAmplitude
                      )}
                    </small>
                  </div>
                </div>

                <div className="comparison-row">
                  <span>Desvio-padrão</span>

                  <div className="comparison-value-stack">
                    <strong>
                      {calcularDiferenca(
                        anguloComparacao?.desvio_padrao,
                        angulo?.desvio_padrao
                      )}
                      °
                    </strong>

                    <small
                      className={classeDaVariacao(
                        variacaoDesvioAngulo
                      )}
                    >
                      {formatarVariacaoPercentual(
                        variacaoDesvioAngulo
                      )}
                    </small>
                  </div>
                </div>

                <div className="comparison-row">
                  <span>Jerk médio da coxa</span>

                  <div className="comparison-value-stack">
                    <strong>
                      {calcularDiferenca(
                        jerkCoxaComparacao?.media,
                        jerkCoxa?.media
                      )}{" "}
                      m/s³
                    </strong>

                    <small
                      className={classeDaVariacao(
                        variacaoJerkCoxa
                      )}
                    >
                      {formatarVariacaoPercentual(
                        variacaoJerkCoxa
                      )}
                    </small>
                  </div>
                </div>

                <div className="comparison-row">
                  <span>Jerk médio da perna</span>

                  <div className="comparison-value-stack">
                    <strong>
                      {calcularDiferenca(
                        jerkPernaComparacao?.media,
                        jerkPerna?.media
                      )}{" "}
                      m/s³
                    </strong>

                    <small
                      className={classeDaVariacao(
                        variacaoJerkPerna
                      )}
                    >
                      {formatarVariacaoPercentual(
                        variacaoJerkPerna
                      )}
                    </small>
                  </div>
                </div>
              </div>

              {/* Fecha a grade dos três cards */}
              </div>

              {/* Fica fora do card e abaixo da grade */}
              <div className="comparison-insights">
                <h3>Interpretação das mudanças</h3>

                <div className="comparison-insights-grid">
                  <article>
                    <strong>Amplitude do joelho</strong>
                    <p>{interpretacaoAmplitude}</p>
                  </article>

                  <article>
                    <strong>Jerk da coxa</strong>
                    <p>{interpretacaoJerkCoxa}</p>
                  </article>

                  <article>
                    <strong>Jerk da perna</strong>
                    <p>{interpretacaoJerkPerna}</p>
                  </article>
                </div>

                <p className="comparison-caution">
                  Essas mudanças descrevem diferenças entre os registros.
                  Devem ser analisadas considerando velocidade, protocolo,
                  percepção de esforço, dor e condições da coleta.
                </p>
              </div>
            </section>
          )}
        </main>
      </div>
    );
}

export default RelatorioPage;