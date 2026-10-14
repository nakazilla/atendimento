/**
 * TELEMETRIA SILENCIOSA E COLETA DE DADOS DE USABILIDADE
 * =======================================================
 * Módulo para captura 100% invisível ao participante durante testes de usabilidade.
 * Coleta métricas de tempo, dinâmica de preenchimento, hesitação (backspaces),
 * transições entre campos, recortes/colas, conteúdo digitado e revisão da IA.
 * 
 * Acesso ao painel do moderador:
 * - Atalho: Ctrl + Shift + D (ou Cmd + Shift + D no Mac)
 * - Triplo clique no logotipo do sistema na barra superior
 * - Método de console: Telemetry.openDashboard()
 */

(function (window, document) {
  'use strict';

  // Chaves de armazenamento local
  const STORAGE_CURRENT = 'usability_telemetry_current';
  const STORAGE_HISTORY = 'usability_telemetry_history';
  const STORAGE_PARTICIPANT = 'usability_participant_id';

  // --------------------------------------------------------------------------
  // ALGORITMO DE DISTÂNCIA LEVENSHTEIN (Para cálculo exato de % de edição da IA)
  // --------------------------------------------------------------------------
  function levenshteinDistance(a, b) {
    if (!a) a = '';
    if (!b) b = '';
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const matrix = [];
    for (let i = 0; i <= n; i++) matrix[i] = [i];
    for (let j = 0; j <= m; j++) matrix[0][j] = j;

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substituição
            matrix[i][j - 1] + 1,     // inserção
            matrix[i - 1][j] + 1      // deleção
          );
        }
      }
    }
    return matrix[n][m];
  }

  function countWords(str) {
    if (!str || typeof str !== 'string') return 0;
    const trimmed = str.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }

  function formatDuration(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return '--';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min === 0) return `${sec}s`;
    return `${min}m ${sec}s`;
  }

  // --------------------------------------------------------------------------
  // ESTADO DA SESSÃO DE TELEMETRIA
  // --------------------------------------------------------------------------
  const Telemetry = {
    sessionId: 'sess_' + Date.now(),
    participantId: localStorage.getItem(STORAGE_PARTICIPANT) || 'P01',
    sessionStartTime: Date.now(),
    
    // Hesitação inicial
    firstActionTimeMs: null,
    firstActionType: null,
    firstActionTarget: null,

    // Métricas por campo
    fields: {
      relacao: {
        key: 'relacao',
        id: 'inputRelacao',
        label: 'Relação de consumo',
        activeTimeMs: 0,
        focusStart: null,
        focusCount: 0,
        backspaceCount: 0,
        deleteCount: 0,
        cutCount: 0,
        pasteCount: 0,
        firstTypingTimeMs: null,
        charCount: 0,
        wordCount: 0,
        finalText: ''
      },
      problema: {
        key: 'problema',
        id: 'inputProblema',
        label: 'Qual é o problema',
        activeTimeMs: 0,
        focusStart: null,
        focusCount: 0,
        backspaceCount: 0,
        deleteCount: 0,
        cutCount: 0,
        pasteCount: 0,
        firstTypingTimeMs: null,
        charCount: 0,
        wordCount: 0,
        finalText: ''
      },
      tentativas: {
        key: 'tentativas',
        id: 'inputTentativas',
        label: 'Tentativa de solução',
        activeTimeMs: 0,
        focusStart: null,
        focusCount: 0,
        backspaceCount: 0,
        deleteCount: 0,
        cutCount: 0,
        pasteCount: 0,
        firstTypingTimeMs: null,
        charCount: 0,
        wordCount: 0,
        finalText: ''
      },
      solucao: {
        key: 'solucao',
        id: 'inputSolucao',
        label: 'Solução esperada',
        activeTimeMs: 0,
        focusStart: null,
        focusCount: 0,
        backspaceCount: 0,
        deleteCount: 0,
        cutCount: 0,
        pasteCount: 0,
        firstTypingTimeMs: null,
        charCount: 0,
        wordCount: 0,
        finalText: ''
      },
      relatoEditor: {
        key: 'relatoEditor',
        id: 'relatoEditor',
        label: 'Editor de Relato (IA/Final)',
        activeTimeMs: 0,
        focusStart: null,
        focusCount: 0,
        backspaceCount: 0,
        deleteCount: 0,
        charCount: 0,
        wordCount: 0,
        firstEditTimeAfterAiMs: null,
        finalText: '',
        initialAiHtml: '',
        initialAiText: '',
        wasEdited: false,
        diffPercentage: 0
      }
    },

    // Dinâmica de preenchimento
    fieldFillingOrder: [], // Ordem em que os campos começaram a ser preenchidos
    currentFocusedField: null,
    transitions: [], // Registro de idas e vindas [ { from, to, timeMs } ]
    cutAndPasteLog: [], // Transferências entre campos [ { from, to, snippet, timeMs } ]
    disabledClicks: 0,

    // Geração da IA
    ai: {
      generationRequestedAt: null,
      generationCompletedAt: null,
      reviewStartTime: null,
      reviewTimeMs: 0,
      reviewEndTime: null,
      hasReviewed: false,
      regenerationModalOpened: 0,
      regenerationConfirmed: 0,
      regenerationCancelled: 0
    },

    // Tempos gerais consolidados
    timing: {
      firstTypingAnyFieldMs: null,
      totalFillingTimeMs: null, // Da 1ª digitação até o clique em Gerar Relato
      totalSessionTimeMs: null
    },

    // Log cronológico de eventos para auditoria detalhada
    events: [],

    // ------------------------------------------------------------------------
    // MÉTODOS DE CAPTURA DE EVENTOS
    // ------------------------------------------------------------------------
    logEvent: function (type, details = {}) {
      const now = Date.now();
      const elapsedMs = now - this.sessionStartTime;

      const evt = {
        type,
        timeMs: elapsedMs,
        timestamp: new Date(now).toISOString(),
        details
      };

      this.events.push(evt);

      // Registra a 1ª ação do participante (Hesitação / TTFA)
      if (this.firstActionTimeMs === null && !['session_start', 'moderator_action'].includes(type)) {
        this.firstActionTimeMs = elapsedMs;
        this.firstActionType = type;
        this.firstActionTarget = details.fieldKey || details.target || 'tela';
      }

      this.persistState();
    },

    recordFocus: function (fieldKey) {
      const field = this.fields[fieldKey];
      if (!field) return;

      const now = Date.now();
      field.focusStart = now;
      field.focusCount++;

      // Registra transição de foco
      if (this.currentFocusedField && this.currentFocusedField !== fieldKey) {
        const trans = {
          from: this.currentFocusedField,
          to: fieldKey,
          timeMs: now - this.sessionStartTime
        };
        this.transitions.push(trans);
        this.logEvent('field_transition', trans);
      }

      this.currentFocusedField = fieldKey;
      this.logEvent('field_focus', { fieldKey });
    },

    recordBlur: function (fieldKey, currentValue) {
      const field = this.fields[fieldKey];
      if (!field) return;

      const now = Date.now();
      if (field.focusStart) {
        field.activeTimeMs += (now - field.focusStart);
        field.focusStart = null;
      }

      if (currentValue !== undefined) {
        field.finalText = currentValue;
        field.charCount = currentValue.length;
        field.wordCount = countWords(currentValue);
      }

      // Se estamos revisando a IA e o editor foi editado
      if (fieldKey === 'relatoEditor' && this.ai.generationCompletedAt) {
        this.updateAiReviewStats();
      }

      this.logEvent('field_blur', {
        fieldKey,
        charCount: field.charCount,
        wordCount: field.wordCount
      });
    },

    recordInput: function (fieldKey, currentValue) {
      const field = this.fields[fieldKey];
      if (!field) return;

      const now = Date.now();
      const elapsed = now - this.sessionStartTime;

      // Primeiro preenchimento no campo
      if (field.firstTypingTimeMs === null && currentValue.trim().length > 0) {
        field.firstTypingTimeMs = elapsed;

        if (!this.fieldFillingOrder.includes(fieldKey)) {
          this.fieldFillingOrder.push(fieldKey);
        }

        if (this.timing.firstTypingAnyFieldMs === null) {
          this.timing.firstTypingAnyFieldMs = elapsed;
        }

        this.logEvent('field_first_typing', { fieldKey, timeMs: elapsed });
      }

      field.finalText = currentValue;
      field.charCount = currentValue.length;
      field.wordCount = countWords(currentValue);

      // Se é edição no editor pós-IA
      if (fieldKey === 'relatoEditor' && this.ai.generationCompletedAt) {
        if (!field.firstEditTimeAfterAiMs) {
          field.firstEditTimeAfterAiMs = elapsed;
        }
        field.wasEdited = true;
        this.updateAiDiff();
      }

      this.persistState();
    },

    recordKey: function (fieldKey, e) {
      const field = this.fields[fieldKey];
      if (!field) return;

      if (e.key === 'Backspace') {
        field.backspaceCount++;
      } else if (e.key === 'Delete') {
        field.deleteCount++;
      }
    },

    recordCut: function (fieldKey, selectedText) {
      const field = this.fields[fieldKey];
      if (field) field.cutCount++;
      this.lastCutText = {
        from: fieldKey,
        text: selectedText || '',
        timeMs: Date.now() - this.sessionStartTime
      };
      this.logEvent('cut', { fieldKey, textLength: (selectedText || '').length });
    },

    recordPaste: function (fieldKey, pastedText) {
      const field = this.fields[fieldKey];
      if (field) field.pasteCount++;

      // Detecta se foi recorte e cola entre campos direcionadores
      if (this.lastCutText && (Date.now() - this.sessionStartTime - this.lastCutText.timeMs) < 60000) {
        if (this.lastCutText.from !== fieldKey) {
          const cutPasteTrans = {
            from: this.lastCutText.from,
            to: fieldKey,
            snippet: (pastedText || this.lastCutText.text).slice(0, 50),
            timeMs: Date.now() - this.sessionStartTime
          };
          this.cutAndPasteLog.push(cutPasteTrans);
          this.logEvent('cut_and_paste_across_fields', cutPasteTrans);
        }
      }

      this.logEvent('paste', { fieldKey, textLength: (pastedText || '').length });
    },

    recordDisabledClick: function () {
      this.disabledClicks++;
      this.logEvent('disabled_button_click', { button: 'btnAnalyze' });
    },

    recordAiRequest: function () {
      const now = Date.now();
      const elapsed = now - this.sessionStartTime;

      this.ai.generationRequestedAt = elapsed;

      // Calcula tempo total de preenchimento (da 1ª digitação até o clique em gerar)
      if (this.timing.firstTypingAnyFieldMs !== null) {
        this.timing.totalFillingTimeMs = elapsed - this.timing.firstTypingAnyFieldMs;
      } else {
        this.timing.totalFillingTimeMs = elapsed;
      }

      this.logEvent('ai_generation_requested', {
        fillingTimeMs: this.timing.totalFillingTimeMs
      });
    },

    recordAiResult: function (aiRelatoHtml, aiRelatoRawText) {
      const now = Date.now();
      const elapsed = now - this.sessionStartTime;

      this.ai.generationCompletedAt = elapsed;
      this.ai.reviewStartTime = elapsed;

      const editorField = this.fields.relatoEditor;
      editorField.initialAiHtml = aiRelatoHtml || '';
      editorField.initialAiText = aiRelatoRawText || '';
      editorField.finalText = aiRelatoRawText || '';
      editorField.charCount = (aiRelatoRawText || '').length;
      editorField.wordCount = countWords(aiRelatoRawText || '');
      editorField.wasEdited = false;
      editorField.diffPercentage = 0;

      this.logEvent('ai_generation_completed', {
        initialLength: editorField.charCount
      });
    },

    recordRegenerateModal: function (action) {
      if (action === 'open') {
        this.ai.regenerationModalOpened++;
        this.logEvent('regenerate_modal_opened');
      } else if (action === 'confirm') {
        this.ai.regenerationConfirmed++;
        this.logEvent('regenerate_modal_confirmed');
      } else if (action === 'cancel') {
        this.ai.regenerationCancelled++;
        this.logEvent('regenerate_modal_cancelled');
      }
    },

    updateAiReviewStats: function () {
      if (!this.ai.reviewStartTime) return;
      const now = Date.now();
      const elapsed = now - this.sessionStartTime;

      this.ai.reviewEndTime = elapsed;
      this.ai.reviewTimeMs = elapsed - this.ai.reviewStartTime;
      this.ai.hasReviewed = true;
    },

    updateAiDiff: function () {
      const editorField = this.fields.relatoEditor;
      const initial = (editorField.initialAiText || '').trim();
      const current = (editorField.finalText || '').trim();

      if (!initial) {
        editorField.diffPercentage = 0;
        return;
      }

      if (initial === current) {
        editorField.diffPercentage = 0;
        editorField.wasEdited = false;
      } else {
        editorField.wasEdited = true;
        const dist = levenshteinDistance(initial, current);
        const maxLen = Math.max(initial.length, 1);
        editorField.diffPercentage = Math.min(100, Math.round((dist / maxLen) * 100));
      }
    },

    // ------------------------------------------------------------------------
    // CONSOLIDAÇÃO E RELATÓRIO DE MÉTRICAS
    // ------------------------------------------------------------------------
    getSummary: function () {
      const now = Date.now();
      const totalSessionMs = now - this.sessionStartTime;

      // Atualiza tempos de foco correntes antes de consolidar
      Object.keys(this.fields).forEach(key => {
        const f = this.fields[key];
        if (f.focusStart) {
          f.activeTimeMs += (now - f.focusStart);
          f.focusStart = now; // reinicia ciclo corrente
        }
      });

      // Atualiza revisão da IA se gerado
      if (this.ai.generationCompletedAt && !this.ai.reviewEndTime) {
        this.ai.reviewTimeMs = (now - this.sessionStartTime) - this.ai.generationCompletedAt;
      }

      this.updateAiDiff();

      const totalBackspaces = Object.values(this.fields).reduce((acc, f) => acc + f.backspaceCount, 0);
      const totalTransitions = this.transitions.length;
      const totalCutPastes = this.cutAndPasteLog.length;

      return {
        sessionId: this.sessionId,
        participantId: this.participantId,
        sessionStartTime: new Date(this.sessionStartTime).toLocaleString('pt-BR'),
        totalSessionDuration: formatDuration(totalSessionMs),
        totalSessionMs,

        // Métricas de Tempo
        hesitationTTFAMs: this.firstActionTimeMs,
        hesitationTTFAFormatted: formatDuration(this.firstActionTimeMs),
        firstActionDescription: this.firstActionType ? `${this.firstActionType} em ${this.firstActionTarget}` : 'Nenhuma',
        
        fillingTimeMs: this.timing.totalFillingTimeMs,
        fillingTimeFormatted: formatDuration(this.timing.totalFillingTimeMs),

        aiReviewTimeMs: this.ai.reviewTimeMs,
        aiReviewTimeFormatted: formatDuration(this.ai.reviewTimeMs),

        // Comportamento
        fillingSequence: this.fieldFillingOrder.map(k => this.fields[k] ? this.fields[k].label : k),
        totalFocusTransitions: totalTransitions,
        totalBackspaces,
        cutAndPasteAcrossFields: totalCutPastes,
        disabledClickAttempts: this.disabledClicks,

        // Revisão da IA
        aiGenerated: !!this.ai.generationCompletedAt,
        aiWasEdited: this.fields.relatoEditor.wasEdited,
        aiDiffPercentage: this.fields.relatoEditor.diffPercentage,
        regenerationTriggers: {
          opened: this.ai.regenerationModalOpened,
          confirmed: this.ai.regenerationConfirmed,
          cancelled: this.ai.regenerationCancelled
        },

        // Campos Detalhados
        fields: {
          relacao: { ...this.fields.relacao, activeTimeFormatted: formatDuration(this.fields.relacao.activeTimeMs) },
          problema: { ...this.fields.problema, activeTimeFormatted: formatDuration(this.fields.problema.activeTimeMs) },
          tentativas: { ...this.fields.tentativas, activeTimeFormatted: formatDuration(this.fields.tentativas.activeTimeMs) },
          solucao: { ...this.fields.solucao, activeTimeFormatted: formatDuration(this.fields.solucao.activeTimeMs) },
          relatoEditor: { ...this.fields.relatoEditor, activeTimeFormatted: formatDuration(this.fields.relatoEditor.activeTimeMs) }
        }
      };
    },

    // ------------------------------------------------------------------------
    // PERSISTÊNCIA NO LOCALSTORAGE
    // ------------------------------------------------------------------------
    persistState: function () {
      try {
        const payload = {
          sessionId: this.sessionId,
          participantId: this.participantId,
          sessionStartTime: this.sessionStartTime,
          firstActionTimeMs: this.firstActionTimeMs,
          firstActionType: this.firstActionType,
          firstActionTarget: this.firstActionTarget,
          fields: this.fields,
          fieldFillingOrder: this.fieldFillingOrder,
          transitions: this.transitions,
          cutAndPasteLog: this.cutAndPasteLog,
          disabledClicks: this.disabledClicks,
          ai: this.ai,
          timing: this.timing,
          events: this.events
        };
        localStorage.setItem(STORAGE_CURRENT, JSON.stringify(payload));
      } catch (err) {
        console.warn('Erro ao salvar telemetria localmente:', err);
      }
    },

    saveSessionToHistory: function () {
      try {
        const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
        history.push(this.getSummary());
        localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
      } catch (err) {
        console.warn('Erro ao arquivar histórico:', err);
      }
    },

    resetSession: function (newParticipantId) {
      this.saveSessionToHistory();
      
      const nextId = newParticipantId || this.generateNextParticipantId();
      localStorage.setItem(STORAGE_PARTICIPANT, nextId);
      localStorage.removeItem(STORAGE_CURRENT);

      // Recarrega a página de forma limpa para novo participante
      window.location.reload();
    },

    generateNextParticipantId: function () {
      const match = (this.participantId || '').match(/^([a-zA-Z]+)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2], 10) + 1;
        return `${prefix}${num < 10 ? '0' + num : num}`;
      }
      return 'P02';
    },

    setParticipantId: function (id) {
      if (!id) return;
      this.participantId = id.trim();
      localStorage.setItem(STORAGE_PARTICIPANT, this.participantId);
      this.persistState();
    },

    // ------------------------------------------------------------------------
    // EXPORTAÇÕES (CSV, JSON, CLIPBOARD)
    // ------------------------------------------------------------------------
    exportCSV: function () {
      const s = this.getSummary();
      const headers = [
        'Participante',
        'Data/Hora',
        'Hesitacao Inicial (s)',
        'Primeira Acao',
        'Ordem de Preenchimento',
        'Tempo Total Preenchimento (s)',
        'Tempo Relacao (s)',
        'Palavras Relacao',
        'Tempo Problema (s)',
        'Palavras Problema',
        'Tempo Tentativas (s)',
        'Palavras Tentativas',
        'Tempo Solucao (s)',
        'Palavras Solucao',
        'Trocas de Foco',
        'Total Backspaces',
        'Recortes/Colas Entre Campos',
        'Cliques Botao Desabilitado',
        'Tempo Revisao IA (s)',
        'Relato IA Editado?',
        'Taxa Edicao IA (%)',
        'Tentativas Nova Geracao'
      ];

      const row = [
        `"${s.participantId}"`,
        `"${s.sessionStartTime}"`,
        s.hesitationTTFAMs ? (s.hesitationTTFAMs / 1000).toFixed(1) : '0',
        `"${s.firstActionDescription}"`,
        `"${s.fillingSequence.join(' -> ')}"`,
        s.fillingTimeMs ? (s.fillingTimeMs / 1000).toFixed(1) : '0',
        (s.fields.relacao.activeTimeMs / 1000).toFixed(1),
        s.fields.relacao.wordCount,
        (s.fields.problema.activeTimeMs / 1000).toFixed(1),
        s.fields.problema.wordCount,
        (s.fields.tentativas.activeTimeMs / 1000).toFixed(1),
        s.fields.tentativas.wordCount,
        (s.fields.solucao.activeTimeMs / 1000).toFixed(1),
        s.fields.solucao.wordCount,
        s.totalFocusTransitions,
        s.totalBackspaces,
        s.cutAndPasteAcrossFields,
        s.disabledClickAttempts,
        s.aiReviewTimeMs ? (s.aiReviewTimeMs / 1000).toFixed(1) : '0',
        s.aiWasEdited ? 'Sim' : 'Não',
        s.aiDiffPercentage + '%',
        s.regenerationTriggers.opened
      ];

      const csvContent = '\uFEFF' + headers.join(';') + '\n' + row.join(';') + '\n';
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `matriz-usabilidade-${s.participantId}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    exportJSON: function () {
      const fullData = {
        summary: this.getSummary(),
        rawEvents: this.events,
        transitions: this.transitions,
        cutAndPasteLog: this.cutAndPasteLog,
        exportedAt: new Date().toISOString()
      };

      const jsonStr = JSON.stringify(fullData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telemetria-${this.participantId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    generateFormattedReport: function () {
      const s = this.getSummary();
      return `=====================================================
RELATÓRIO DE TELEMETRIA: TESTE DE USABILIDADE
Participante: ${s.participantId}
Início: ${s.sessionStartTime} | Duração: ${s.totalSessionDuration}
=====================================================

1. MÉTRICAS TEMPORAIS E HESITAÇÃO
- Hesitação inicial (TTFA): ${s.hesitationTTFAFormatted} (${s.firstActionDescription})
- Tempo total de preenchimento: ${s.fillingTimeFormatted}
- Tempo de revisão da IA: ${s.aiReviewTimeFormatted}

2. DINÂMICA DE PREENCHIMENTO
- Ordem de preenchimento: ${s.fillingSequence.length ? s.fillingSequence.join(' ➔ ') : 'Nenhum campo preenchido'}
- Trocas de foco entre campos: ${s.totalFocusTransitions} vezes
- Backspaces digitados (hesitação/correções): ${s.totalBackspaces}
- Recortes/Colas entre campos direcionadores: ${s.cutAndPasteAcrossFields}
- Tentativas de clique com botão desabilitado: ${s.disabledClickAttempts}

3. CAMPOS DIRECIONADORES
- Relação de consumo: ${s.fields.relacao.activeTimeFormatted} | ${s.fields.relacao.wordCount} palavras (${s.fields.relacao.charCount} caracteres) | ${s.fields.relacao.backspaceCount} backspaces
- Qual é o problema: ${s.fields.problema.activeTimeFormatted} | ${s.fields.problema.wordCount} palavras (${s.fields.problema.charCount} caracteres) | ${s.fields.problema.backspaceCount} backspaces
- Tentativa de solução: ${s.fields.tentativas.activeTimeFormatted} | ${s.fields.tentativas.wordCount} palavras (${s.fields.tentativas.charCount} caracteres) | ${s.fields.tentativas.backspaceCount} backspaces
- Solução esperada: ${s.fields.solucao.activeTimeFormatted} | ${s.fields.solucao.wordCount} palavras (${s.fields.solucao.charCount} caracteres) | ${s.fields.solucao.backspaceCount} backspaces

4. RESULTADO E REVISÃO DA IA
- Geração acionada: ${s.aiGenerated ? 'Sim' : 'Não'}
- Relato editado após geração: ${s.aiWasEdited ? 'Sim' : 'Não'}
- Taxa de alteração do texto da IA: ${s.aiDiffPercentage}% modificado
- Modal de sobreposição disparado: ${s.regenerationTriggers.opened} vez(es) (Confirmado: ${s.regenerationTriggers.confirmed}, Cancelado: ${s.regenerationTriggers.cancelled})

5. CONTEÚDO DIGITADO PELO PARTICIPANTE:
[Relação de Consumo]
${s.fields.relacao.finalText || '(Vazio)'}

[Qual é o Problema]
${s.fields.problema.finalText || '(Vazio)'}

[Tentativa de Solução]
${s.fields.tentativas.finalText || '(Vazio)'}

[Solução Esperada]
${s.fields.solucao.finalText || '(Vazio)'}

[Relato Final no Editor]
${s.fields.relatoEditor.finalText || '(Vazio)'}
=====================================================`;
    },

    copySummaryToClipboard: function () {
      const text = this.generateFormattedReport();
      navigator.clipboard.writeText(text).then(() => {
        alert('Relatório copiado para a área de transferência com sucesso!');
      }).catch(err => {
        console.error('Falha ao copiar:', err);
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('Relatório copiado para a área de transferência!');
      });
    },

    // ------------------------------------------------------------------------
    // INTERFACE DO PAINEL DO MODERADOR (DRAWER / MODAL)
    // ------------------------------------------------------------------------
    openDashboard: function () {
      let drawer = document.getElementById('moderatorDrawer');
      if (!drawer) {
        this.renderDashboardDOM();
        drawer = document.getElementById('moderatorDrawer');
      }
      this.updateDashboardUI();
      drawer.classList.add('is-open');

      // Inicia atualização contínua enquanto aberto
      if (this.dashboardInterval) clearInterval(this.dashboardInterval);
      this.dashboardInterval = setInterval(() => {
        if (drawer.classList.contains('is-open')) {
          this.updateDashboardUI();
        }
      }, 1000);
    },

    closeDashboard: function () {
      const drawer = document.getElementById('moderatorDrawer');
      if (drawer) {
        drawer.classList.remove('is-open');
      }
      if (this.dashboardInterval) {
        clearInterval(this.dashboardInterval);
      }
    },

    toggleDashboard: function () {
      const drawer = document.getElementById('moderatorDrawer');
      if (drawer && drawer.classList.contains('is-open')) {
        this.closeDashboard();
      } else {
        this.openDashboard();
      }
    },

    renderDashboardDOM: function () {
      const container = document.createElement('div');
      container.id = 'moderatorDrawer';
      container.className = 'moderator-drawer';
      container.innerHTML = `
        <div class="mod-drawer__overlay" id="modDrawerOverlay"></div>
        <div class="mod-drawer__content">
          <div class="mod-drawer__header">
            <div class="mod-drawer__title-area">
              <span class="mod-badge-live"><span class="mod-live-dot"></span> GRAVANDO SILENCIOSAMENTE</span>
              <h2 class="mod-drawer__title">Painel do Moderador • Telemetria</h2>
            </div>
            <button type="button" class="mod-btn-close" id="btnModClose" title="Fechar painel (Ctrl+Shift+D)">&times;</button>
          </div>

          <div class="mod-drawer__body">
            <!-- Barra Superior de Controle do Participante -->
            <div class="mod-ctrl-bar">
              <div class="mod-ctrl-group">
                <label for="modParticipantInput" class="mod-label">Identificador do Participante:</label>
                <div class="mod-input-wrap">
                  <input type="text" id="modParticipantInput" class="mod-input-id" value="${this.participantId}" placeholder="Ex: P01, A1...">
                  <button type="button" id="btnModSaveId" class="mod-btn-secondary" title="Salvar ID">Salvar</button>
                </div>
              </div>
              <div class="mod-timer-group">
                <span class="mod-timer-label">Duração da Sessão:</span>
                <span class="mod-timer-val" id="modSessionTimer">00:00</span>
              </div>
              <button type="button" id="btnModReset" class="mod-btn-danger" title="Arquiva e limpa para o próximo participante">
                <i class="fa-solid fa-arrows-rotate"></i> Novo Participante
              </button>
            </div>

            <!-- Cards de Métricas Principais (KPIs) -->
            <div class="mod-kpi-grid">
              <div class="mod-kpi-card">
                <span class="mod-kpi-title">Hesitação Inicial (TTFA)</span>
                <span class="mod-kpi-value" id="kpiHesitation">--</span>
                <span class="mod-kpi-sub" id="kpiFirstAction">Até a 1ª ação</span>
              </div>
              <div class="mod-kpi-card">
                <span class="mod-kpi-title">Tempo de Preenchimento</span>
                <span class="mod-kpi-value" id="kpiFillingTime">--</span>
                <span class="mod-kpi-sub">Até acionar a IA</span>
              </div>
              <div class="mod-kpi-card">
                <span class="mod-kpi-title">Revisão da IA</span>
                <span class="mod-kpi-value" id="kpiAiReview">--</span>
                <span class="mod-kpi-sub" id="kpiAiStatus">Pós-geração</span>
              </div>
              <div class="mod-kpi-card">
                <span class="mod-kpi-title">Taxa de Edição da IA</span>
                <span class="mod-kpi-value" id="kpiAiDiff">0%</span>
                <span class="mod-kpi-sub" id="kpiAiEdited">Texto intacto</span>
              </div>
              <div class="mod-kpi-card">
                <span class="mod-kpi-title">Insegurança (Backspaces)</span>
                <span class="mod-kpi-value" id="kpiBackspaces">0</span>
                <span class="mod-kpi-sub">Correções / reescrita</span>
              </div>
              <div class="mod-kpi-card">
                <span class="mod-kpi-title">Trocas de Foco</span>
                <span class="mod-kpi-value" id="kpiTransitions">0</span>
                <span class="mod-kpi-sub">Idas e vindas</span>
              </div>
            </div>

            <!-- Sequência de Preenchimento -->
            <div class="mod-section">
              <h3 class="mod-section-title"><i class="fa-solid fa-route"></i> Sequência em que os campos foram iniciados:</h3>
              <div class="mod-sequence-wrap" id="modSequenceContainer">
                <span class="mod-sequence-empty">Nenhum campo iniciado ainda.</span>
              </div>
            </div>

            <!-- Tabela dos 4 Campos Direcionadores -->
            <div class="mod-section">
              <h3 class="mod-section-title"><i class="fa-solid fa-table-list"></i> Métricas por Campo Direcionador</h3>
              <div class="mod-table-responsive">
                <table class="mod-table">
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Tempo Ativo</th>
                      <th>Focos</th>
                      <th>Backspaces</th>
                      <th>Cut / Paste</th>
                      <th>Palavras</th>
                      <th>Caracteres</th>
                    </tr>
                  </thead>
                  <tbody id="modFieldsTableBody">
                    <!-- Gerado dinamicamente -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Inspeção do Conteúdo Digitado -->
            <div class="mod-section">
              <h3 class="mod-section-title"><i class="fa-solid fa-quote-left"></i> Conteúdo Digitado pelo Participante</h3>
              <div class="mod-accordion-list" id="modContentsAccordion">
                <!-- Preenchido dinamicamente -->
              </div>
            </div>

            <!-- Recortes e Colas entre Campos (Detecção de Dúvidas de Limites) -->
            <div class="mod-section" id="modCutPasteSection" style="display: none;">
              <h3 class="mod-section-title" style="color: #b78103;"><i class="fa-solid fa-scissors"></i> Recortes e Colas Entre Campos (Possível ambiguidade)</h3>
              <ul class="mod-cutpaste-list" id="modCutPasteList"></ul>
            </div>
          </div>

          <!-- Rodapé de Ações do Moderador -->
          <div class="mod-drawer__footer">
            <button type="button" class="mod-btn-action" id="btnModCopyReport">
              <i class="fa-regular fa-copy"></i> Copiar Resumo
            </button>
            <button type="button" class="mod-btn-action" id="btnModExportCSV">
              <i class="fa-solid fa-file-csv"></i> Baixar CSV (Matriz)
            </button>
            <button type="button" class="mod-btn-action" id="btnModExportJSON">
              <i class="fa-solid fa-file-code"></i> Baixar JSON Completo
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      // Event listeners do painel
      document.getElementById('btnModClose').addEventListener('click', () => this.closeDashboard());
      document.getElementById('modDrawerOverlay').addEventListener('click', () => this.closeDashboard());

      document.getElementById('btnModSaveId').addEventListener('click', () => {
        const val = document.getElementById('modParticipantInput').value;
        this.setParticipantId(val);
        alert(`ID do participante atualizado para: ${this.participantId}`);
      });

      document.getElementById('btnModReset').addEventListener('click', () => {
        if (confirm(`Deseja finalizar o participante ${this.participantId} e iniciar um novo teste limpo?`)) {
          this.resetSession();
        }
      });

      document.getElementById('btnModCopyReport').addEventListener('click', () => this.copySummaryToClipboard());
      document.getElementById('btnModExportCSV').addEventListener('click', () => this.exportCSV());
      document.getElementById('btnModExportJSON').addEventListener('click', () => this.exportJSON());
    },

    updateDashboardUI: function () {
      const s = this.getSummary();

      // Timer da sessão
      const timerEl = document.getElementById('modSessionTimer');
      if (timerEl) {
        const totalSec = Math.floor(s.totalSessionMs / 1000);
        const m = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        timerEl.textContent = `${m < 10 ? '0' + m : m}:${sec < 10 ? '0' + sec : sec}`;
      }

      // KPIs
      const elHesitation = document.getElementById('kpiHesitation');
      if (elHesitation) elHesitation.textContent = s.hesitationTTFAFormatted;

      const elFirstAction = document.getElementById('kpiFirstAction');
      if (elFirstAction) elFirstAction.textContent = s.firstActionDescription;

      const elFillingTime = document.getElementById('kpiFillingTime');
      if (elFillingTime) elFillingTime.textContent = s.fillingTimeFormatted;

      const elAiReview = document.getElementById('kpiAiReview');
      if (elAiReview) elAiReview.textContent = s.aiReviewTimeFormatted;

      const elAiStatus = document.getElementById('kpiAiStatus');
      if (elAiStatus) elAiStatus.textContent = s.aiGenerated ? 'Gerado com sucesso' : 'Aguardando ação';

      const elAiDiff = document.getElementById('kpiAiDiff');
      if (elAiDiff) elAiDiff.textContent = s.aiDiffPercentage + '%';

      const elAiEdited = document.getElementById('kpiAiEdited');
      if (elAiEdited) elAiEdited.textContent = s.aiWasEdited ? 'Texto alterado' : 'Texto original';

      const elBackspaces = document.getElementById('kpiBackspaces');
      if (elBackspaces) elBackspaces.textContent = s.totalBackspaces;

      const elTransitions = document.getElementById('kpiTransitions');
      if (elTransitions) elTransitions.textContent = s.totalFocusTransitions;

      // Sequência
      const seqEl = document.getElementById('modSequenceContainer');
      if (seqEl) {
        if (s.fillingSequence.length === 0) {
          seqEl.innerHTML = '<span class="mod-sequence-empty">Nenhum campo preenchido ainda.</span>';
        } else {
          seqEl.innerHTML = s.fillingSequence.map((name, idx) => `
            <div class="mod-step-chip">
              <span class="mod-step-num">${idx + 1}º</span>
              <span class="mod-step-name">${name}</span>
            </div>
          `).join('<span class="mod-step-arrow"><i class="fa-solid fa-arrow-right"></i></span>');
        }
      }

      // Tabela de campos
      const tbody = document.getElementById('modFieldsTableBody');
      if (tbody) {
        const fieldKeys = ['relacao', 'problema', 'tentativas', 'solucao', 'relatoEditor'];
        tbody.innerHTML = fieldKeys.map(k => {
          const f = s.fields[k];
          const isEditor = k === 'relatoEditor';
          return `
            <tr class="${isEditor ? 'is-editor-row' : ''}">
              <td><strong>${f.label}</strong> ${isEditor ? '<span class="mod-tag-pill">IA</span>' : ''}</td>
              <td>${f.activeTimeFormatted}</td>
              <td>${f.focusCount}</td>
              <td>${f.backspaceCount}</td>
              <td>${(f.cutCount || 0)} / ${(f.pasteCount || 0)}</td>
              <td><strong>${f.wordCount}</strong></td>
              <td>${f.charCount}</td>
            </tr>
          `;
        }).join('');
      }

      // Conteúdos digitados
      const accEl = document.getElementById('modContentsAccordion');
      if (accEl) {
        const fieldKeys = ['relacao', 'problema', 'tentativas', 'solucao', 'relatoEditor'];
        accEl.innerHTML = fieldKeys.map(k => {
          const f = s.fields[k];
          const hasText = f.finalText && f.finalText.trim().length > 0;
          return `
            <div class="mod-content-item">
              <div class="mod-content-header">
                <strong>${f.label}</strong>
                <span class="mod-content-badge">${f.wordCount} palavras • ${f.charCount} caracteres</span>
              </div>
              <div class="mod-content-text ${!hasText ? 'is-empty' : ''}">
                ${hasText ? escapeHtml(f.finalText) : '<em>(Nenhum conteúdo digitado ainda)</em>'}
              </div>
            </div>
          `;
        }).join('');
      }

      // Recortes e Colas
      const cutSection = document.getElementById('modCutPasteSection');
      const cutList = document.getElementById('modCutPasteList');
      if (cutSection && cutList) {
        if (this.cutAndPasteLog.length > 0) {
          cutSection.style.display = 'block';
          cutList.innerHTML = this.cutAndPasteLog.map(item => `
            <li>
              <strong>${this.fields[item.from]?.label || item.from}</strong> ➔ 
              <strong>${this.fields[item.to]?.label || item.to}</strong>: 
              <em>"${escapeHtml(item.snippet)}..."</em> (${formatDuration(item.timeMs)})
            </li>
          `).join('');
        } else {
          cutSection.style.display = 'none';
        }
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
              .replace(/\n/g, '<br>');
  }

  // --------------------------------------------------------------------------
  // ATIVAÇÃO DOS LISTENERS GLOBAIS DE TELEMETRIA
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    Telemetry.logEvent('session_start', { participantId: Telemetry.participantId });

    // 1. Mapeamento dos 4 campos direcionadores
    const fieldMapping = [
      { key: 'relacao', id: 'inputRelacao' },
      { key: 'problema', id: 'inputProblema' },
      { key: 'tentativas', id: 'inputTentativas' },
      { key: 'solucao', id: 'inputSolucao' }
    ];

    fieldMapping.forEach(item => {
      const el = document.getElementById(item.id);
      if (!el) return;

      el.addEventListener('focus', () => {
        Telemetry.recordFocus(item.key);
      });

      el.addEventListener('blur', () => {
        Telemetry.recordBlur(item.key, el.value);
      });

      el.addEventListener('input', () => {
        Telemetry.recordInput(item.key, el.value);
      });

      el.addEventListener('keydown', (e) => {
        Telemetry.recordKey(item.key, e);
      });

      el.addEventListener('cut', () => {
        const sel = window.getSelection().toString();
        Telemetry.recordCut(item.key, sel);
      });

      el.addEventListener('paste', (e) => {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        Telemetry.recordPaste(item.key, text);
      });
    });

    // 2. Mapeamento do Editor de Relato
    const relatoEditor = document.getElementById('relatoEditor');
    if (relatoEditor) {
      relatoEditor.addEventListener('focus', () => {
        Telemetry.recordFocus('relatoEditor');
      });

      relatoEditor.addEventListener('blur', () => {
        Telemetry.recordBlur('relatoEditor', relatoEditor.innerText || relatoEditor.textContent);
      });

      relatoEditor.addEventListener('input', () => {
        Telemetry.recordInput('relatoEditor', relatoEditor.innerText || relatoEditor.textContent);
      });

      relatoEditor.addEventListener('keydown', (e) => {
        Telemetry.recordKey('relatoEditor', e);
      });

      relatoEditor.addEventListener('cut', () => {
        const sel = window.getSelection().toString();
        Telemetry.recordCut('relatoEditor', sel);
      });

      relatoEditor.addEventListener('paste', (e) => {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        Telemetry.recordPaste('relatoEditor', text);
      });
    }

    // 3. Captura de clique com botão de geração desabilitado
    const btnAnalyze = document.getElementById('btnAnalyze');
    if (btnAnalyze) {
      // Quando um botão HTML está disabled, cliques nativos não disparam diretamente nele,
      // mas se clicado em seu wrapper ou via mousedown capturado na fase de captura:
      const parent = btnAnalyze.parentElement;
      if (parent) {
        parent.addEventListener('click', (e) => {
          if (btnAnalyze.disabled && (e.target === btnAnalyze || btnAnalyze.contains(e.target))) {
            Telemetry.recordDisabledClick();
          }
        }, true);
      }
    }

    // 4. Atalho de Teclado do Moderador: Ctrl + Shift + D (ou Cmd + Shift + D)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        Telemetry.toggleDashboard();
      }
    });

    // 5. Gatilho Discreto: Clicar 3 vezes no Logo da Navbar
    const logoEl = document.querySelector('.top-nav__logo');
    let logoClicks = 0;
    let logoTimer = null;
    if (logoEl) {
      logoEl.addEventListener('click', (e) => {
        e.preventDefault();
        logoClicks++;
        clearTimeout(logoTimer);
        logoTimer = setTimeout(() => {
          logoClicks = 0;
        }, 800);

        if (logoClicks >= 3) {
          logoClicks = 0;
          Telemetry.toggleDashboard();
        }
      });
    }

    // 6. Pausa de cálculo quando a janela perde o foco
    window.addEventListener('blur', () => {
      if (Telemetry.currentFocusedField) {
        const f = Telemetry.fields[Telemetry.currentFocusedField];
        if (f && f.focusStart) {
          f.activeTimeMs += (Date.now() - f.focusStart);
          f.focusStart = null;
        }
      }
    });

    window.addEventListener('focus', () => {
      if (Telemetry.currentFocusedField) {
        const f = Telemetry.fields[Telemetry.currentFocusedField];
        if (f && !f.focusStart) {
          f.focusStart = Date.now();
        }
      }
    });
  });

  // Exporta globalmente
  window.Telemetry = Telemetry;

})(window, document);
