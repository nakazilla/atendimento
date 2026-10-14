/**
 * PROTÓTIPO DE USABILIDADE: CONSTRUÇÃO DE RELATO NO ATENDIMENTO
 * =============================================================
 * Gerencia os estados de formulário, acordeão, simulação da IA,
 * editor de texto e feedbacks visuais em conformidade com o Figma.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // 1. REFERÊNCIAS DO DOM
  // --------------------------------------------------------------------------
  const selectTipoAtendimento = document.getElementById('selectTipoAtendimento');
  const fieldTipoReclamacao = document.getElementById('fieldTipoReclamacao');
  const selectTipoReclamacao = document.getElementById('selectTipoReclamacao');
  const fieldTipoDenuncia = document.getElementById('fieldTipoDenuncia');
  const selectTipoDenuncia = document.getElementById('selectTipoDenuncia');
  const builderContainer = document.getElementById('relatoBuilderContainer');
  const btnToggleBuilder = document.getElementById('btnToggleBuilder');
  const builderCollapsible = document.getElementById('builderCollapsible');
  
  // 4 Campos direcionadores
  const inputRelacao = document.getElementById('inputRelacao');
  const inputProblema = document.getElementById('inputProblema');
  const inputTentativas = document.getElementById('inputTentativas');
  const inputSolucao = document.getElementById('inputSolucao');
  const directionalInputs = [inputRelacao, inputProblema, inputTentativas, inputSolucao];

  // Ação de geração
  const btnAnalyze = document.getElementById('btnAnalyze');
  
  // Elementos do Relato e Validação
  const relatoSection = document.getElementById('relatoSection');
  const relatoEditor = document.getElementById('relatoEditor');
  const editorContainer = document.getElementById('editorContainer');
  const errorRelato = document.getElementById('errorRelato');
  const errorTipoAtendimento = document.getElementById('errorTipoAtendimento');
  const selectArea = document.getElementById('selectArea');
  const errorArea = document.getElementById('errorArea');
  const selectAssunto = document.getElementById('selectAssunto');
  const errorAssunto = document.getElementById('errorAssunto');
  const selectProblema = document.getElementById('selectProblema');
  const errorProblema = document.getElementById('errorProblema');
  const aiSuggestionsAlert = document.getElementById('aiSuggestionsAlert');
  const aiSuggestionsList = document.getElementById('aiSuggestionsList');
  
  // Elementos de Anexos
  const anexosTitle = document.getElementById('anexosTitle');
  const btnUploadFile = document.getElementById('btnUploadFile');
  const inputUploadFile = document.getElementById('inputUploadFile');
  const anexosList = document.getElementById('anexosList');
  const anexosSuggestionsAlert = document.getElementById('anexosSuggestionsAlert');
  const anexosSuggestionsList = document.getElementById('anexosSuggestionsList');

  // Modal de Exclusão de Anexo
  const deleteAttachmentModalOverlay = document.getElementById('deleteAttachmentModalOverlay');
  const deleteAttachmentFileName = document.getElementById('deleteAttachmentFileName');
  const btnCancelDeleteAttachment = document.getElementById('btnCancelDeleteAttachment');
  const btnConfirmDeleteAttachment = document.getElementById('btnConfirmDeleteAttachment');

  // Loading Overlay
  const loadingOverlay = document.getElementById('loadingOverlay');

  // Modal de Confirmação (Sobrescrever relato)
  const confirmModalOverlay = document.getElementById('confirmModalOverlay');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalConfirm = document.getElementById('btnModalConfirm');
  const btnModalClose = document.getElementById('btnModalClose');

  // Toast de feedback
  const toastFeedback = document.getElementById('toastFeedback');
  const toastTitle = document.getElementById('toastTitle');
  const toastText = document.getElementById('toastText');
  const btnToastClose = document.getElementById('btnToastClose');

  // Estado interno
  let hasGeneratedBefore = false;
  let toastTimeout = null;
  let attachedFiles = [];
  let fileToDeleteId = null;

  // --------------------------------------------------------------------------
  // 2. EXIBIÇÃO CONDICIONAL POR TIPO DE ATENDIMENTO
  // --------------------------------------------------------------------------
  function updateTipoAtendimentoState() {
    if (!selectTipoAtendimento) return;
    const value = selectTipoAtendimento.value;
    const isReclamacao = value === 'Reclamação' || value === 'PIP Processo de Investigação Preliminar';
    const isDenuncia = value === 'Denúncia';

    if (value) {
      if (errorTipoAtendimento) errorTipoAtendimento.style.display = 'none';
      selectTipoAtendimento.classList.remove('has-error');
    }

    if (fieldTipoReclamacao) {
      fieldTipoReclamacao.style.display = isReclamacao ? 'flex' : 'none';
    }

    if (fieldTipoDenuncia) {
      fieldTipoDenuncia.style.display = isDenuncia ? 'flex' : 'none';
    }

    if (builderContainer) {
      builderContainer.style.display = isReclamacao ? 'block' : 'none';
    }

    if (typeof window !== 'undefined' && window.Telemetry) {
      window.Telemetry.logEvent('select_tipo_atendimento', { value });
    }

    updateFinishButtonState();
  }

  if (selectTipoAtendimento) {
    selectTipoAtendimento.addEventListener('change', updateTipoAtendimentoState);
    updateTipoAtendimentoState();
  }

  if (selectTipoReclamacao) {
    selectTipoReclamacao.addEventListener('change', () => {
      if (typeof window !== 'undefined' && window.Telemetry) {
        window.Telemetry.logEvent('select_tipo_reclamacao', { value: selectTipoReclamacao.value });
      }
    });
  }

  if (selectTipoDenuncia) {
    selectTipoDenuncia.addEventListener('change', () => {
      updateFinishButtonState();
      if (typeof window !== 'undefined' && window.Telemetry) {
        window.Telemetry.logEvent('select_tipo_denuncia', { value: selectTipoDenuncia.value });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 3. TOGGLE DO BLOCO PRINCIPAL (MOSTRAR MENOS / MOSTRAR MAIS)
  // --------------------------------------------------------------------------
  if (btnToggleBuilder && builderCollapsible) {
    btnToggleBuilder.addEventListener('click', () => {
      const isHidden = builderCollapsible.style.display === 'none';
      if (isHidden) {
        builderCollapsible.style.display = 'block';
        btnToggleBuilder.textContent = 'Mostrar menos';
        if (typeof window !== 'undefined' && window.Telemetry) {
          window.Telemetry.logEvent('builder_expanded');
        }
      } else {
        builderCollapsible.style.display = 'none';
        btnToggleBuilder.textContent = 'Mostrar mais';
        if (typeof window !== 'undefined' && window.Telemetry) {
          window.Telemetry.logEvent('builder_collapsed');
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 4. EXPANDIR / RECOLHER CADA UM DOS 4 CAMPOS DIRECIONADORES
  // --------------------------------------------------------------------------
  document.querySelectorAll('.stepper-header').forEach((header) => {
    header.addEventListener('click', () => {
      const targetId = header.getAttribute('data-target');
      const body = document.getElementById(targetId);
      const icon = header.querySelector('.stepper-icon-toggle i');

      const title = header.querySelector('.stepper-title');

      if (!body) return;

      const isCollapsed = body.classList.contains('is-collapsed');
      if (isCollapsed) {
        body.classList.remove('is-collapsed');
        if (icon) {
          icon.classList.remove('fa-chevron-down');
          icon.classList.add('fa-chevron-up');
        }
        if (title) {
          title.classList.add('is-active');
        }
        if (typeof window !== 'undefined' && window.Telemetry) {
          window.Telemetry.logEvent('field_expanded', { targetId });
        }
      } else {
        body.classList.add('is-collapsed');
        if (icon) {
          icon.classList.remove('fa-chevron-up');
          icon.classList.add('fa-chevron-down');
        }
        if (title) {
          title.classList.remove('is-active');
        }
        if (typeof window !== 'undefined' && window.Telemetry) {
          window.Telemetry.logEvent('field_collapsed', { targetId });
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. HABILITAÇÃO DO BOTÃO "ANALISAR E GERAR RELATO"
  // --------------------------------------------------------------------------
  function checkDirectionalInputsFilled() {
    // Conforme especificação no Figma: habilita se houver preenchimento
    const hasAnyContent = directionalInputs.every(input => input && input.value.trim().length > 0);
    if (btnAnalyze) {
      btnAnalyze.disabled = !hasAnyContent;
    }
  }

  directionalInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', checkDirectionalInputsFilled);
    }
  });

  // Executa checagem inicial (vazio por padrão)
  checkDirectionalInputsFilled();

  // --------------------------------------------------------------------------
  // 5. FLUXO DE GERAÇÃO PELA IA (COM SIMULAÇÃO DE DELAY E FEEDBACK)
  // --------------------------------------------------------------------------
  if (btnAnalyze) {
    btnAnalyze.addEventListener('click', () => {
      if (btnAnalyze.disabled) return;

      // Se já gerou anteriormente, exibe diálogo de confirmação de sobreposição
      if (hasGeneratedBefore) {
        openConfirmModal();
      } else {
        triggerAiGeneration();
      }
    });
  }

  function getAiConfig() {
    if (typeof window !== 'undefined' && window.AI_CONFIG) return window.AI_CONFIG;
    if (typeof AI_CONFIG !== 'undefined') return AI_CONFIG;
    return {};
  }

  function triggerAiGeneration() {
	if (builderCollapsible) builderCollapsible.style.display = 'none';
	if (btnToggleBuilder) btnToggleBuilder.textContent = 'Mostrar mais';
    // 1. Notifica telemetria
    if (typeof window !== 'undefined' && window.Telemetry) {
      window.Telemetry.recordAiRequest();
    }

    // 2. Exibe estado de carregamento simulado
    showLoading();

    // 3. Tempo de espera simulado definido em config.js
    const config = getAiConfig();
    const delay = (config && config.simulatedDelayMs) ? config.simulatedDelayMs : 1500;

    setTimeout(() => {
      hideLoading();
      applyAiResult();
      hasGeneratedBefore = true;
    }, delay);
  }

  function showLoading() {
    if (loadingOverlay) {
      loadingOverlay.classList.add('is-active');
    }
  }

  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.classList.remove('is-active');
    }
  }

  function applyAiResult() {
    const config = getAiConfig();
    const res = config.response || {};

    // 1. Atualiza conteúdo do editor de Relato
    if (relatoEditor && res.relato) {
      relatoEditor.innerHTML = res.relato;
      if (errorRelato) errorRelato.style.display = 'none';
      if (editorContainer) editorContainer.classList.remove('has-error');
      
      // Registra na telemetria o texto original gerado pela IA
      if (typeof window !== 'undefined' && window.Telemetry) {
        window.Telemetry.recordAiResult(res.relato, relatoEditor.innerText || relatoEditor.textContent);
      }
      updateFinishButtonState();
    }

    // 2. Exibe alerta de "Sugestões de melhoria do relato"
    if (aiSuggestionsAlert && res.sugestoesMelhoria && res.sugestoesMelhoria.length > 0) {
      if (aiSuggestionsList) {
        aiSuggestionsList.innerHTML = '';
        res.sugestoesMelhoria.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item;
          aiSuggestionsList.appendChild(li);
        });
      }
      aiSuggestionsAlert.style.display = 'flex';
    }

    // 3. Exibe alerta de "Sugestões de anexos"
    if (anexosSuggestionsAlert && res.sugestoesAnexos && res.sugestoesAnexos.length > 0) {
      if (anexosSuggestionsList) {
        anexosSuggestionsList.innerHTML = '';
        res.sugestoesAnexos.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item;
          anexosSuggestionsList.appendChild(li);
        });
      }
      anexosSuggestionsAlert.style.display = 'flex';
    }

    // 4. Exibe o toast flutuante de Sucesso
    showToastFeedback();

    // 5. Rola suavemente até o campo Relato para guiar o participante
    if (relatoSection) {
      relatoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // --------------------------------------------------------------------------
  // 6. MODAL DE CONFIRMAÇÃO DE SOBREPOSIÇÃO
  // --------------------------------------------------------------------------
  function openConfirmModal() {
    if (confirmModalOverlay) {
      confirmModalOverlay.classList.add('is-open');
      if (typeof window !== 'undefined' && window.Telemetry) {
        window.Telemetry.recordRegenerateModal('open');
      }
    }
  }

  function closeConfirmModal(action = 'cancel') {
    if (confirmModalOverlay) {
      confirmModalOverlay.classList.remove('is-open');
      if (action === 'cancel' && typeof window !== 'undefined' && window.Telemetry) {
        window.Telemetry.recordRegenerateModal('cancel');
      }
    }
  }

  if (btnModalCancel) {
    btnModalCancel.addEventListener('click', () => closeConfirmModal('cancel'));
  }
  if (btnModalClose) {
    btnModalClose.addEventListener('click', () => closeConfirmModal('cancel'));
  }
  if (btnModalConfirm) {
    btnModalConfirm.addEventListener('click', () => {
      if (typeof window !== 'undefined' && window.Telemetry) {
        window.Telemetry.recordRegenerateModal('confirm');
      }
      closeConfirmModal('confirm');
      triggerAiGeneration();
    });
  }

  // Fechar modal ao clicar fora
  if (confirmModalOverlay) {
    confirmModalOverlay.addEventListener('click', (e) => {
      if (e.target === confirmModalOverlay) {
        closeConfirmModal('cancel');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 7. TOAST DE FEEDBACK FLUTUANTE
  // --------------------------------------------------------------------------
  function showToastFeedback() {
    const config = getAiConfig();
    const feedback = config.toastFeedback || {
      titulo: "Sucesso",
      mensagem: "Relato gerado com sucesso. Faça a revisão e, se necessário, edite o conteúdo no campo Relato."
    };

    if (toastTitle) toastTitle.textContent = feedback.titulo;
    if (toastText) toastText.textContent = feedback.mensagem;

    if (toastFeedback) {
      toastFeedback.classList.add('is-visible');

      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        hideToastFeedback();
      }, 7000);
    }
  }

  function hideToastFeedback() {
    if (toastFeedback) {
      toastFeedback.classList.remove('is-visible');
    }
  }

  if (btnToastClose) {
    btnToastClose.addEventListener('click', hideToastFeedback);
  }

  // --------------------------------------------------------------------------
  // 8. BARRA DE FERRAMENTAS DO EDITOR RICO (FORMATO WYSIWYG)
  // --------------------------------------------------------------------------
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      // Impede que o clique no botão desfoque o editor ou limpe o texto selecionado
      e.preventDefault();
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const command = btn.getAttribute('data-command');
      if (command) {
        document.execCommand(command, false, null);
        if (relatoEditor) relatoEditor.focus();
        updateToolbarState();
      }
    });
  });

  function updateToolbarState() {
    document.querySelectorAll('.toolbar-btn[data-command]').forEach(btn => {
      const command = btn.getAttribute('data-command');
      try {
        if (document.queryCommandState(command)) {
          btn.classList.add('is-active');
        } else {
          btn.classList.remove('is-active');
        }
      } catch (err) {}
    });
  }

  if (relatoEditor) {
    relatoEditor.addEventListener('keyup', () => {
      updateToolbarState();
      updateFinishButtonState();
    });
    relatoEditor.addEventListener('mouseup', updateToolbarState);
    relatoEditor.addEventListener('input', () => {
      const text = (relatoEditor.innerText || relatoEditor.textContent || '').trim();
      if (text) {
        if (errorRelato) errorRelato.style.display = 'none';
        if (editorContainer) editorContainer.classList.remove('has-error');
      }
      updateFinishButtonState();
    });
  }
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === relatoEditor) {
      updateToolbarState();
    }
  });

  // Botão de Maximizar / Expandir editor (Ocupa a página inteira)
  function toggleEditorFullscreen() {
    if (!relatoSection) return;
    const isFullscreen = relatoSection.classList.toggle('is-fullscreen');
    document.body.classList.toggle('editor-is-fullscreen', isFullscreen);
    
    if (btnMaximize) {
      const icon = btnMaximize.querySelector('i');
      if (isFullscreen) {
        if (icon) icon.className = 'fa-solid fa-compress';
        btnMaximize.setAttribute('title', 'Restaurar editor');
        if (typeof window !== 'undefined' && window.Telemetry) {
          window.Telemetry.logEvent('editor_fullscreen_opened');
        }
      } else {
        if (icon) icon.className = 'fa-solid fa-expand';
        btnMaximize.setAttribute('title', 'Expandir editor');
        if (typeof window !== 'undefined' && window.Telemetry) {
          window.Telemetry.logEvent('editor_fullscreen_closed');
        }
      }
    }
  }

  const btnMaximize = document.getElementById('btnMaximize');
  if (btnMaximize && relatoSection) {
    btnMaximize.addEventListener('click', toggleEditorFullscreen);
  }

  // --------------------------------------------------------------------------
  // 9. BOTÃO DA BARRA DE IA: "GERAR SUGESTÕES AUTOMÁTICAS" (CAMPOS INFERIORES)
  // --------------------------------------------------------------------------
  const btnAiAutoSuggest = document.getElementById('btnAiAutoSuggest');
  if (btnAiAutoSuggest) {
    btnAiAutoSuggest.addEventListener('click', () => {
      showLoading();
      setTimeout(() => {
        hideLoading();
        // Sugere respostas nos selects abaixo
        const radioSim = document.getElementById('radioSim');
        if (radioSim) radioSim.checked = true;

        const selectForma = document.getElementById('selectForma');
        if (selectForma) selectForma.value = 'Loja Física';

        if (selectArea) {
          selectArea.value = 'Produtos de Telefonia e Informática';
          selectArea.classList.remove('has-error');
          if (errorArea) errorArea.style.display = 'none';
        }

        if (selectAssunto) {
          selectAssunto.value = 'Aparelho Celular';
          selectAssunto.classList.remove('has-error');
          if (errorAssunto) errorAssunto.style.display = 'none';
        }

        if (selectProblema) {
          selectProblema.value = 'Vício De Qualidade';
          selectProblema.classList.remove('has-error');
          if (errorProblema) errorProblema.style.display = 'none';
        }

        updateFinishButtonState();

        if (toastTitle) toastTitle.textContent = "Sugestões aplicadas";
        if (toastText) toastText.textContent = "Os campos foram preenchidos com sugestões automáticas baseadas no relato.";
        if (toastFeedback) toastFeedback.classList.add('is-visible');
      }, 1000);
    });
  }

  // --------------------------------------------------------------------------
  // 10. GESTÃO DE ANEXOS (UPLOAD SIMULADO E EXCLUSÃO)
  // --------------------------------------------------------------------------
  function renderAttachments() {
    if (anexosTitle) {
      anexosTitle.textContent = `Anexos (${attachedFiles.length})`;
    }

    if (!anexosList) return;
    anexosList.innerHTML = '';

    attachedFiles.forEach((file) => {
      const item = document.createElement('div');
      item.className = 'anexo-item';
      item.setAttribute('data-id', file.id);

      const info = document.createElement('div');
      info.className = 'anexo-item__info';

      const icon = document.createElement('i');
      icon.className = 'fa-regular fa-file-lines anexo-item__icon';

      const name = document.createElement('span');
      name.className = 'anexo-item__name';
      name.textContent = file.name;
      name.title = file.name;

      info.appendChild(icon);
      info.appendChild(name);

      const actions = document.createElement('div');
      actions.className = 'anexo-item__actions';

      const btnRename = document.createElement('button');
      btnRename.type = 'button';
      btnRename.className = 'anexo-item__btn-rename';
      btnRename.innerHTML = '<i class="fa-solid fa-pencil"></i> Renomear';

      const btnDelete = document.createElement('button');
      btnDelete.type = 'button';
      btnDelete.className = 'anexo-item__btn-delete';
      btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> Excluir';
      btnDelete.addEventListener('click', () => {
        openDeleteAttachmentModal(file.id);
      });

      actions.appendChild(btnRename);
      actions.appendChild(btnDelete);

      item.appendChild(info);
      item.appendChild(actions);

      anexosList.appendChild(item);
    });
  }

  function openDeleteAttachmentModal(fileId) {
    const file = attachedFiles.find(f => f.id === fileId);
    if (!file) return;

    fileToDeleteId = fileId;
    if (deleteAttachmentFileName) {
      deleteAttachmentFileName.textContent = `"${file.name}"`;
    }

    if (deleteAttachmentModalOverlay) {
      deleteAttachmentModalOverlay.classList.add('is-open');
    }

    if (typeof window !== 'undefined' && window.Telemetry) {
      window.Telemetry.logEvent('attachment_delete_prompt', {
        fileId,
        fileName: file.name
      });
    }
  }

  function closeDeleteAttachmentModal() {
    fileToDeleteId = null;
    if (deleteAttachmentModalOverlay) {
      deleteAttachmentModalOverlay.classList.remove('is-open');
    }
  }

  if (btnUploadFile && inputUploadFile) {
    btnUploadFile.addEventListener('click', () => {
      inputUploadFile.click();
    });

    inputUploadFile.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      files.forEach((file) => {
        const fileObj = {
          id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          name: file.name,
          size: file.size
        };
        attachedFiles.push(fileObj);

        if (typeof window !== 'undefined' && window.Telemetry) {
          window.Telemetry.logEvent('attachment_uploaded', {
            fileName: fileObj.name,
            fileSize: fileObj.size,
            totalAttachments: attachedFiles.length
          });
        }
      });

      inputUploadFile.value = '';
      renderAttachments();
    });
  }

  if (btnCancelDeleteAttachment) {
    btnCancelDeleteAttachment.addEventListener('click', () => {
      if (typeof window !== 'undefined' && window.Telemetry && fileToDeleteId) {
        const file = attachedFiles.find(f => f.id === fileToDeleteId);
        window.Telemetry.logEvent('attachment_delete_cancelled', {
          fileId: fileToDeleteId,
          fileName: file ? file.name : ''
        });
      }
      closeDeleteAttachmentModal();
    });
  }

  if (btnConfirmDeleteAttachment) {
    btnConfirmDeleteAttachment.addEventListener('click', () => {
      if (!fileToDeleteId) return;

      const fileIndex = attachedFiles.findIndex(f => f.id === fileToDeleteId);
      if (fileIndex !== -1) {
        const deletedFile = attachedFiles[fileIndex];
        attachedFiles.splice(fileIndex, 1);

        if (typeof window !== 'undefined' && window.Telemetry) {
          window.Telemetry.logEvent('attachment_deleted', {
            fileId: fileToDeleteId,
            fileName: deletedFile.name,
            remainingAttachments: attachedFiles.length
          });
        }
      }

      closeDeleteAttachmentModal();
      renderAttachments();
    });
  }

  if (deleteAttachmentModalOverlay) {
    deleteAttachmentModalOverlay.addEventListener('click', (e) => {
      if (e.target === deleteAttachmentModalOverlay) {
        closeDeleteAttachmentModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (relatoSection && relatoSection.classList.contains('is-fullscreen')) {
        toggleEditorFullscreen();
        return;
      }
      if (deleteAttachmentModalOverlay && deleteAttachmentModalOverlay.classList.contains('is-open')) {
        closeDeleteAttachmentModal();
      }
      if (confirmModalOverlay && confirmModalOverlay.classList.contains('is-open')) {
        closeConfirmModal('cancel');
      }
    }
  });

  // --------------------------------------------------------------------------
  // 11. BOTÕES FINAIS DE ATENDIMENTO E VALIDAÇÃO DE OBRIGATORIEDADE
  // --------------------------------------------------------------------------
  function validateRequiredFields() {
    let isValid = true;
    const errors = [];

    // 1. Validar Tipo de Atendimento
    const tipoVal = selectTipoAtendimento ? (selectTipoAtendimento.value || '').trim() : '';
    if (!tipoVal) {
      isValid = false;
      errors.push('tipo_atendimento');
      if (errorTipoAtendimento) errorTipoAtendimento.style.display = 'block';
      if (selectTipoAtendimento) selectTipoAtendimento.classList.add('has-error');
    } else {
      if (errorTipoAtendimento) errorTipoAtendimento.style.display = 'none';
      if (selectTipoAtendimento) selectTipoAtendimento.classList.remove('has-error');
    }

    // 2. Validar Relato
    const relatoText = relatoEditor ? (relatoEditor.innerText || relatoEditor.textContent || '').trim() : '';
    if (!relatoText) {
      isValid = false;
      errors.push('relato');
      if (errorRelato) errorRelato.style.display = 'block';
      if (editorContainer) editorContainer.classList.add('has-error');
    } else {
      if (errorRelato) errorRelato.style.display = 'none';
      if (editorContainer) editorContainer.classList.remove('has-error');
    }

    // 3. Validar Área
    const areaVal = selectArea ? (selectArea.value || '').trim() : '';
    if (!areaVal) {
      isValid = false;
      errors.push('area');
      if (errorArea) errorArea.style.display = 'block';
      if (selectArea) selectArea.classList.add('has-error');
    } else {
      if (errorArea) errorArea.style.display = 'none';
      if (selectArea) selectArea.classList.remove('has-error');
    }

    // 4. Validar Assunto
    const assuntoVal = selectAssunto ? (selectAssunto.value || '').trim() : '';
    if (!assuntoVal) {
      isValid = false;
      errors.push('assunto');
      if (errorAssunto) errorAssunto.style.display = 'block';
      if (selectAssunto) selectAssunto.classList.add('has-error');
    } else {
      if (errorAssunto) errorAssunto.style.display = 'none';
      if (selectAssunto) selectAssunto.classList.remove('has-error');
    }

    // 5. Validar Problema (Item Problema)
    const problemaVal = selectProblema ? (selectProblema.value || '').trim() : '';
    if (!problemaVal) {
      isValid = false;
      errors.push('problema');
      if (errorProblema) errorProblema.style.display = 'block';
      if (selectProblema) selectProblema.classList.add('has-error');
    } else {
      if (errorProblema) errorProblema.style.display = 'none';
      if (selectProblema) selectProblema.classList.remove('has-error');
    }

    updateFinishButtonState();
    return { isValid, errors };
  }

  function isFormValid() {
    const tipoVal = selectTipoAtendimento ? (selectTipoAtendimento.value || '').trim() : '';
    if (!tipoVal) return false;

    if (tipoVal === 'Denúncia') {
      const denunciaVal = selectTipoDenuncia ? (selectTipoDenuncia.value || '').trim() : '';
      if (!denunciaVal) return false;
    }

    const relatoText = relatoEditor ? (relatoEditor.innerText || relatoEditor.textContent || '').trim() : '';
    if (!relatoText) return false;

    const areaVal = selectArea ? (selectArea.value || '').trim() : '';
    if (!areaVal) return false;

    const assuntoVal = selectAssunto ? (selectAssunto.value || '').trim() : '';
    if (!assuntoVal) return false;

    const problemaVal = selectProblema ? (selectProblema.value || '').trim() : '';
    if (!problemaVal) return false;

    return true;
  }

  function updateFinishButtonState() {
    const btn = document.getElementById('btnFinish');
    if (!btn) return;
    const valid = isFormValid();
    btn.disabled = !valid;
    if (valid) {
      btn.classList.remove('is-disabled');
    } else {
      btn.classList.add('is-disabled');
    }
  }

  // Limpeza de erros em tempo real e atualização de estado do botão
  if (selectArea) {
    selectArea.addEventListener('change', () => {
      if ((selectArea.value || '').trim()) {
        if (errorArea) errorArea.style.display = 'none';
        selectArea.classList.remove('has-error');
      }
      updateFinishButtonState();
    });
    selectArea.addEventListener('blur', () => {
      if (!(selectArea.value || '').trim()) {
        if (errorArea) errorArea.style.display = 'block';
        selectArea.classList.add('has-error');
      }
      updateFinishButtonState();
    });
  }

  if (selectAssunto) {
    selectAssunto.addEventListener('change', () => {
      if ((selectAssunto.value || '').trim()) {
        if (errorAssunto) errorAssunto.style.display = 'none';
        selectAssunto.classList.remove('has-error');
      }
      updateFinishButtonState();
    });
    selectAssunto.addEventListener('blur', () => {
      if (!(selectAssunto.value || '').trim()) {
        if (errorAssunto) errorAssunto.style.display = 'block';
        selectAssunto.classList.add('has-error');
      }
      updateFinishButtonState();
    });
  }

  if (selectProblema) {
    selectProblema.addEventListener('change', () => {
      if ((selectProblema.value || '').trim()) {
        if (errorProblema) errorProblema.style.display = 'none';
        selectProblema.classList.remove('has-error');
      }
      updateFinishButtonState();
    });
    selectProblema.addEventListener('blur', () => {
      if (!(selectProblema.value || '').trim()) {
        if (errorProblema) errorProblema.style.display = 'block';
        selectProblema.classList.add('has-error');
      }
      updateFinishButtonState();
    });
  }

  const btnFinish = document.getElementById('btnFinish');
  const btnFinishWrapper = document.getElementById('btnFinishWrapper');

  if (btnFinishWrapper) {
    btnFinishWrapper.addEventListener('click', () => {
      if (btnFinish && btnFinish.disabled) {
        const { isValid, errors } = validateRequiredFields();
        if (typeof window !== 'undefined' && window.Telemetry) {
          window.Telemetry.logEvent('validation_failed', { missingFields: errors });
          window.Telemetry.recordDisabledClick();
        }

        // Rola suavemente até o primeiro campo obrigatório pendente para orientar o usuário
        if (errors.includes('tipo_atendimento') && selectTipoAtendimento) {
          selectTipoAtendimento.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (errors.includes('relato') && relatoSection) {
          relatoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (errors.includes('area') && selectArea) {
          selectArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (errors.includes('assunto') && selectAssunto) {
          selectAssunto.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (errors.includes('problema') && selectProblema) {
          selectProblema.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  if (btnFinish) {
    btnFinish.addEventListener('click', (e) => {
      if (btnFinish.disabled) {
        e.preventDefault();
        return;
      }
      const { isValid, errors } = validateRequiredFields();

      if (!isValid) return;

      if (typeof window !== 'undefined' && window.Telemetry) {
        window.Telemetry.updateAiReviewStats();
        window.Telemetry.logEvent('session_finish');
        window.Telemetry.persistState();
      }
      alert('Atendimento concluído com sucesso no protótipo de teste!');
    });
  }

  // --------------------------------------------------------------------------
  // 12. SUPORTE A PARÂMETROS DE DEMONSTRAÇÃO / QA (?state=...)
  // --------------------------------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const demoState = urlParams.get('state') || urlParams.get('demo');

  if (demoState) {
    if (selectTipoAtendimento) {
      selectTipoAtendimento.value = 'Reclamação';
      updateTipoAtendimentoState();
    }
    if (builderCollapsible) {
      builderCollapsible.style.display = 'block';
      if (btnToggleBuilder) btnToggleBuilder.textContent = 'Mostrar menos';
    }
    document.querySelectorAll('.stepper-body').forEach(b => b.classList.remove('is-collapsed'));
    document.querySelectorAll('.stepper-icon-toggle i').forEach(i => {
      i.classList.remove('fa-chevron-down');
      i.classList.add('fa-chevron-up');
    });
  }

  if (demoState === 'preenchido') {
    if (inputRelacao) inputRelacao.value = 'Compra de um smartphone no dia 15/07/2026 na loja física por R$ 1.899,00.';
    if (inputProblema) inputProblema.value = 'Aparelho desliga sozinho após 5 dias de uso e não liga mais.';
    if (inputTentativas) inputTentativas.value = 'Procurou a loja física e o SAC (Protocolo 20260718-99214).';
    if (inputSolucao) inputSolucao.value = 'Troca do aparelho ou devolução integral do valor pago.';
    checkDirectionalInputsFilled();
  } else if (demoState === 'loading') {
    if (inputRelacao) inputRelacao.value = 'Dados preenchidos...';
    checkDirectionalInputsFilled();
    showLoading();
  } else if (demoState === 'resultado' || demoState === 'gerado') {
    if (inputRelacao) inputRelacao.value = 'Compra de smartphone nas Lojas Americanas.';
    if (inputProblema) inputProblema.value = 'Aparelho desliga sozinho e não reinicia.';
    if (inputTentativas) inputTentativas.value = 'Contato com a loja e SAC sem resolução.';
    if (inputSolucao) inputSolucao.value = 'Restituição da quantia paga ou substituição.';
    checkDirectionalInputsFilled();
    applyAiResult();
    hasGeneratedBefore = true;
  } else if (demoState === 'anexo') {
    if (inputRelacao) inputRelacao.value = 'Compra de smartphone nas Lojas Americanas.';
    if (inputProblema) inputProblema.value = 'Aparelho desliga sozinho e não reinicia.';
    if (inputTentativas) inputTentativas.value = 'Contato com a loja e SAC sem resolução.';
    if (inputSolucao) inputSolucao.value = 'Restituição da quantia paga ou substituição.';
    checkDirectionalInputsFilled();
    applyAiResult();
    hasGeneratedBefore = true;
    attachedFiles = [
      { id: 'att_demo_1', name: 'RASCUNHO DE PESQUISA DE CLIMA ORGANIZACIONAL (1).pdf', size: 102400 }
    ];
    renderAttachments();
  } else if (demoState === 'validacao' || demoState === 'erro') {
    validateRequiredFields();
  } else if (demoState === 'modal') {
    if (inputRelacao) inputRelacao.value = 'Exemplo de dados preenchidos';
    checkDirectionalInputsFilled();
    applyAiResult();
    hasGeneratedBefore = true;
    openConfirmModal();
  }

  // Inicializa o estado de habilitação do botão de finalizar
  updateFinishButtonState();
});

