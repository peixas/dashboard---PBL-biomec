import {
  createContext,
  useContext,
  useState,
} from "react";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  // Coleta principal
  const [arquivo, setArquivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Coleta comparativa
  const [arquivoComparacao, setArquivoComparacao] =
    useState(null);

  const [resultadoComparacao, setResultadoComparacao] =
    useState(null);

  const [loadingComparacao, setLoadingComparacao] =
    useState(false);

  const [erroComparacao, setErroComparacao] =
    useState("");

  // Informações editáveis
  const [nomeAtleta, setNomeAtleta] = useState("");
  const [velocidade, setVelocidade] = useState("");
  const [dataColeta, setDataColeta] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const valoresCompartilhados = {
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
  };

  return (
    <DashboardContext.Provider value={valoresCompartilhados}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const contexto = useContext(DashboardContext);

  if (!contexto) {
    throw new Error(
      "useDashboard precisa ser utilizado dentro de DashboardProvider."
    );
  }

  return contexto;
}