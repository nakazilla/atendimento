# Protótipo Navegável - Evoluir a Construção do Relato no Atendimento

Protótipo de alta fidelidade desenvolvido para **testes de usabilidade com usuários reais**, baseado nas especificações do Figma e nas diretrizes do **Digix UI** (Tema Papel Zero).

---

## 🚀 Como Executar

Você pode executar o protótipo de três formas simples:

### Opção 1: Clique Duplo (Windows)
Dê um duplo clique no arquivo:
```
iniciar-prototipo.bat
```
Ele iniciará automaticamente o servidor local e abrirá o navegador em `http://localhost:3000`.

### Opção 2: Linha de Comando (Node.js)
No terminal, dentro da pasta `prototipo-relato`:
```bash
node server.js
```
Em seguida, acesse no navegador: `http://localhost:3000`.

### Opção 3: Abertura Direta
Abra diretamente o arquivo `index.html` em qualquer navegador web moderno (Edge, Chrome, Firefox, Safari).

---

## ⚙️ Onde Configurar a Resposta e o Delay da IA

Toda a simulação e conteúdo da IA estão centralizados exclusivamente em um único arquivo:
👉 **`config.js`**

```javascript
const AI_CONFIG = {
  // 1. ONDE ALTERAR O TEMPO DE SIMULAÇÃO (em milissegundos):
  simulatedDelayMs: 1500, // Altere para 1000, 2000, etc.

  // 2. ONDE ALTERAR O TEXTO E SUGESTÕES DA IA:
  response: {
    // Texto que será inserido no campo "Relato":
    relato: `No dia 15/07/2026, o consumidor realizou a compra...`,

    // Sugestões de melhoria exibidas no alerta:
    sugestoesMelhoria: [
      "Quando ocorreu a compra / contratação?",
      "Por que o consumidor entende que deve receber a solução?"
    ],

    // Sugestões de anexos exibidas no alerta:
    sugestoesAnexos: [
      "Nota fiscal",
      "Protocolo de atendimento"
    ]
  },

  // 3. MENSAGEM DO TOAST DE SUCESSO:
  toastFeedback: {
    titulo: "Sucesso",
    mensagem: "Relato gerado com sucesso. Faça a revisão e, se necessário, edite o conteúdo no campo Relato."
  }
};
```

---

## 🎯 Comportamentos e Estados Implementados

1. **Seleção do Tipo de Atendimento (Gatilho da Solução)**:
   - A tela inicia com o campo **Tipo de Atendimento** desmarcado (`Selecione...`).
   - Os campos adicionais (**Tipo de Reclamação**, **Tipo de Denúncia**) e o bloco **Construção de relato de reclamação** começam **completamente ocultos**, mantendo a interface inicial idêntica ao Figma e ao sistema real.
   - **"Consulta"**: não invoca nenhum campo adicional nem a construção de relato.
   - **"Denúncia"**: invoca ao lado o campo **Tipo de Denúncia** (com opções: *Atendimento Preferencial*, *Ausência de Preços*, *Divergência de Preços*, *Fila de Banco*, *Produtos Vencidos*, *Propaganda Enganosa*). A construção de relato permanece oculta.
   - **"Reclamação"**: invoca ao lado o campo **Tipo de Reclamação** (*CIP* / *Abertura Direta*) e o bloco **Construção de relato de reclamação** logo abaixo, iniciando **recolhido** com o link `Mostrar mais`.

2. **Construção de Relato e Estado Inicial dos Campos**:
   - Ao clicar em `Mostrar mais`, o bloco se expande revelando a introdução, o alerta explicativo e os 4 campos direcionadores.
   - **O 1º campo (*Relação de consumo*) já vem aberto por padrão**, com o título em azul ativo, chevron para cima (`⌃`), texto de apoio e textarea pronto para digitação.
   - **Os campos 2, 3 e 4 (*Problema*, *Tentativas de resolução* e *Solução esperada*) vêm recolhidos**: exibem o título, o chevron para baixo (`⌄`) e o texto explicativo de apoio, mantendo a área de digitação oculta até o clique no cabeçalho do campo.
   - Todos os campos iniciam vazios (sem respostas pré-definidas), permitindo observar a reação e interpretação natural do participante.
   - O botão `[Analisar e gerar relato]` inicia desabilitado e se habilita dinamicamente quando houver preenchimento.

3. **Geração Simulada com IA**:
   - Ao clicar em `[Analisar e gerar relato]`, exibe overlay de carregamento com o spinner circular do Digix UI durante o delay configurado (padrão de 1,5 segundos).
   - Não há chamadas a APIs externas: funcionamento garantido 100% offline.

4. **Resultado da Geração e Feedbacks Visuais**:
   - O texto estruturado é inserido no editor rico de **Relato**.
   - O alerta informativo `Sugestões de melhoria do relato` aparece com os tópicos de refinamento.
   - O alerta `Sugestões de anexos` é exibido na seção de Anexos.
   - Um toast flutuante verde de confirmação surge no canto inferior direito.
   - A página realiza scroll suave para posicionar o foco no Relato gerado.

5. **Revisão e Edição Livre**:
   - O campo de Relato é um editor rico funcional (`contenteditable`) com suporte a negrito (**B**), itálico (*I*), sublinhado (<u>U</u>), alinhamentos e listas.
   - Botão de maximizar/expandir a altura do editor.

6. **Confirmação ao Regerar (Modal de Sobrescrita)**:
   - Se o usuário alterar os campos e clicar novamente em `[Analisar e gerar relato]`, o protótipo aciona a caixa de diálogo modal de confirmação:
     *"Deseja gerar um novo relato? O relato atual será substituído com as alterações realizadas."*
   - Opções `[Cancelar]` e `[Gerar relato]`.

7. **Atalhos para Demonstração / QA**:
   Você pode carregar diretamente qualquer estado adicionando `?state=...` na URL:
   - `http://localhost:3000/?state=preenchido` → Carrega os 4 campos com exemplo preenchido.
   - `http://localhost:3000/?state=loading` → Exibe o overlay de loading.
   - `http://localhost:3000/?state=resultado` → Exibe o relato gerado com os alertas da IA.
   - `http://localhost:3000/?state=modal` → Exibe o modal de confirmação de sobreposição.

---

## 📊 Telemetria Silenciosa e Painel do Moderador

O protótipo conta com um **motor de telemetria 100% invisível ao participante**, projetado especificamente para apoiar a equipe de UX Research durante as sessões de teste e preenchimento da Matriz de Observação.

### Como Acessar o Painel do Moderador:
1. **Atalho de Teclado**: Pressione `Ctrl + Shift + D` (ou `Cmd + Shift + D` no macOS).
2. **Gatilho Discreto**: Dê um **triplo clique** no logotipo do sistema no canto superior esquerdo da barra de navegação.
3. **Console**: Digite `Telemetry.openDashboard()` no DevTools.

### Métricas Coletadas Automaticamente:
- **Hesitação Inicial (TTFA - Time to First Action)**: Tempo decorrido desde o carregamento da tela até o primeiro clique ou digitação do participante.
- **Tempo Ativo por Campo**: Mede o tempo real com foco ativo em cada um dos 4 campos direcionadores e no editor final (ignora automaticamente momentos em que a janela perde o foco).
- **Tempo Total de Preenchimento**: Da primeira digitação até o clique em *Analisar e gerar relato*.
- **Tempo de Revisão da IA**: Tempo gasto lendo e revisando a sugestão gerada pela IA.
- **Sequência de Preenchimento**: Identifica a ordem cronológica em que os campos foram iniciados (ex: se o usuário começou por *Qual é o problema* antes de *Relação de consumo*).
- **Trocas de Foco**: Quantidade de idas e vindas entre os campos.
- **Insegurança (Backspaces/Deletes)**: Contagem de correções por campo, indicando dúvidas de formulação ou compreensão.
- **Recorte e Cola entre Campos**: Alerta inteligente quando o participante recorta texto de um campo e cola em outro (indicativo clássico de ambiguidade nos limites dos campos direcionadores).
- **Tentativas de Clique Desabilitado**: Registra se o usuário tentou acionar a IA antes de preencher campos.
- **Taxa de Alteração da IA (% Diff)**: Cálculo exato (via distância Levenshtein) do percentual do texto sugerido que foi modificado pelo participante no editor.
- **Conteúdo Verbatim**: Armazena o texto final exato de cada campo com contagem de palavras e caracteres.

### Recursos de Exportação no Painel:
- **Copiar Resumo Formatado**: Gera um relatório limpo em texto/markdown pronto para colar em notas de observação, Notion ou Miro.
- **Baixar CSV (Matriz)**: Exporta planilha compatível diretamente com a Matriz de Observação do roteiro de usabilidade.
- **Baixar JSON Completo**: Arquivo com todos os timestamps, transições e log de eventos brutos.
- **Novo Participante**: Arquiva a sessão no histórico do navegador e inicia um novo teste limpo (`P01` ➔ `P02` ➔ `P03`...).
