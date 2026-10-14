/**
 * CONFIGURAÇÃO DA RESPOSTA E SIMULAÇÃO DA IA
 * ===================================================
 * Altere aqui as respostas da IA, sugestões e tempo de simulação
 * sem precisar mexer nos arquivos de lógica ou interface.
 */

const AI_CONFIG = {
  // Tempo de delay simulado em milissegundos (ex: 1500 = 1.5 segundos)
  simulatedDelayMs: 1500,

  // Resposta padrão gerada pela IA para o campo "Relato"
  // Caso os campos do participante estejam preenchidos, podemos usar este texto
  // ou compor um texto coerente com os dados inseridos.
  response: {
    // Texto principal do relato que será inserido no editor
    relato: `No dia 15/07/2026, a consumidora realizou a compra de um aparelho Smartphone na filial física da empresa reclamada (LOJAS AMERICANAS S.A), no valor de R$ 1.899,00, com garantia de 12 meses. Ocorre que, após 5 dias de uso regular, o aparelho apresentou vício de funcionamento, desligando-se espontaneamente e não mais reinicializando. A consumidora procurou o estabelecimento comercial e o serviço de atendimento ao cliente (Protocolo nº 20260718-99214), solicitando a troca do produto ou envio para assistência técnica autorizada, contudo não obteve retorno efetivo no prazo legal de 30 dias. Diante do exposto e com base no art. 18 do Código de Defesa do Consumidor, requer a restituição imediata da quantia paga ou a substituição do produto por outro de mesma espécie e em perfeitas condições de uso.`,

    // Sugestões de melhoria que aparecem no alerta informativo acima do relato
    sugestoesMelhoria: [
      "Qual é a marca e o modelo do aparelho?",
      "Qual foi a forma de pagamento utilizada (à vista, cartão, parcelado)?"
    ],

    // Sugestões de documentos complementares (seção Anexos)
    sugestoesAnexos: [
      "Nota fiscal",
      "Protocolo de atendimento"
    ]
  },

  // Mensagem do toast flutuante exibido após gerar o relato
  toastFeedback: {
    titulo: "Sucesso",
    mensagem: "Relato gerado com sucesso. Faça a revisão e, se necessário, edite o conteúdo no campo Relato."
  }
};

// Disponibiliza globalmente
if (typeof window !== 'undefined') {
  window.AI_CONFIG = AI_CONFIG;
}

