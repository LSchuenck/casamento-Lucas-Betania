// ==================================================
// js/confirm.js — Confirmação com popup de sucesso
// - Select com busca (Choices.js)
// - GET convidados (Xano)
// - POST confirmação no formato { info: [ {id, presenca}, ... ] }
// - Exibe popup só após sucesso e redireciona para index.html
// ==================================================

(() => {
  // 1) Endpoints do Xano
  const GET_CONVIDADOS_URL =
    'https://x8ki-letl-twmt.n7.xano.io/api:ILNGnLID/casamento/get/convidados';
  const POST_CONFIRMACAO_URL =
    'https://x8ki-letl-twmt.n7.xano.io/api:ILNGnLID/casamento/confirm';

  document.addEventListener('DOMContentLoaded', () => {
    // 2) Elementos
    const selectConvidado = document.getElementById('selectConvidado');
    const grupoArea       = document.getElementById('grupoArea');
    const grupoLista      = document.getElementById('grupoLista');
    const form            = document.getElementById('formConfirmacao');
    const btnEnviar       = document.getElementById('btnEnviar');
    const statusMsg       = document.getElementById('statusMsg');
    const popup           = document.getElementById('popupSucesso');

    // 3) Estado
    let convidados = [];            // [{ id, nome, grupo, presenca }]
    const grupos = new Map();       // grupo -> [convidados]
    let convidadoSelecionado = null;
    let choicesInstance = null;

    // 4) Utils
    const setStatus = (msg, ok = null) => {
      statusMsg.textContent = msg || '';
      statusMsg.style.color = ok === null ? '#333' : ok ? 'green' : '#b00020';
    };
    const byPt = (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

    // 5) Choices.js (select com busca)
    function initChoices() {
      if (choicesInstance) { choicesInstance.destroy(); choicesInstance = null; }
      choicesInstance = new Choices(selectConvidado, {
        searchEnabled: true,
        searchPlaceholderValue: 'Buscar nome…',
        itemSelectText: '',
        shouldSort: true,
        allowHTML: false
      });
    }

    // 6) Carrega convidados (GET)
    async function carregarConvidados() {
      try {
        setStatus('Carregando convidados…');
        btnEnviar.disabled = true;

        const res = await fetch(GET_CONVIDADOS_URL, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });
        if (!res.ok) throw new Error(`GET ${res.status}`);

        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Formato inesperado do GET');

        convidados = data
          .map(c => ({ id: c.id, nome: c.nome, grupo: c.grupo || 'Sem grupo', presenca: !!c.presenca }))
          .filter(c => c.id != null && c.nome);

        if (!convidados.length) { setStatus('Nenhum convidado encontrado.', false); return; }

        convidados.sort((a, b) => byPt(a.nome, b.nome));

        grupos.clear();
        for (const c of convidados) {
          if (!grupos.has(c.grupo)) grupos.set(c.grupo, []);
          grupos.get(c.grupo).push(c);
        }

        popularSelect(convidados);
        setStatus('');
      } catch (e) {
        console.error('[confirm.js] Erro no GET:', e);
        setStatus('Não foi possível carregar a lista. Recarregue a página.', false);
        if (location.protocol === 'file:') setStatus('Abra via http:// (servidor local), não por file://', false);
      }
    }

    // 7) Popular o select e ativar Choices
    function popularSelect(lista) {
      // limpa opções e recoloca placeholder
      [...selectConvidado.options].forEach(o => o.remove());
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— Selecione —';
      selectConvidado.appendChild(placeholder);

      // adiciona opções
      const frag = document.createDocumentFragment();
      for (const c of lista) {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        opt.textContent = c.nome;
        opt.dataset.grupo = c.grupo;
        frag.appendChild(opt);
      }
      selectConvidado.appendChild(frag);

      // inicia Choices (busca)
      initChoices();
    }

    // 8) Seleção de convidado -> render do grupo
    selectConvidado.addEventListener('change', () => {
      const id = selectConvidado.value;

      if (!id) {
        convidadoSelecionado = null;
        grupoArea.hidden = true;
        btnEnviar.disabled = true;
        grupoLista.innerHTML = '';
        setStatus('');
        return;
      }

      convidadoSelecionado = convidados.find(c => String(c.id) === String(id));
      if (!convidadoSelecionado) {
        setStatus('Convidado não encontrado.', false);
        grupoArea.hidden = true;
        btnEnviar.disabled = true;
        return;
      }

      const membros = (grupos.get(convidadoSelecionado.grupo) || [convidadoSelecionado])
        .slice()
        .sort((a, b) => byPt(a.nome, b.nome));

      renderizarCheckboxes(membros);
      grupoArea.hidden = false;
      btnEnviar.disabled = false;
      setStatus('');
    });

    // 9) Checkboxes do grupo
    function renderizarCheckboxes(membros) {
      grupoLista.innerHTML = '';
      const frag = document.createDocumentFragment();

      membros.forEach(m => {
        const label = document.createElement('label');
        label.className = 'checkbox-item';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'presenca';
        input.value = String(m.id);
        input.dataset.id = String(m.id);
        input.checked = !!m.presenca;
        input.ariaLabel = `Presença de ${m.nome}`;

        const span = document.createElement('span');
        span.textContent = m.nome;

        label.appendChild(input);
        label.appendChild(span);
        frag.appendChild(label);
      });

      grupoLista.appendChild(frag);
    }

    // 10) Envio com popup e redirecionamento
form.addEventListener('submit', onSubmit);

async function onSubmit(e) {
  e.preventDefault();
  if (!convidadoSelecionado) return;

  const checks = grupoLista.querySelectorAll('input[name="presenca"][type="checkbox"]');
  const payload = Array.from(checks).map(ch => ({
    id: isNaN(Number(ch.dataset.id)) ? ch.dataset.id : Number(ch.dataset.id),
    presenca: ch.checked === true
  }));

  if (!payload.length) { setStatus('Selecione pelo menos um convidado do grupo.', false); return; }

  try {
    btnEnviar.disabled = true;
    setStatus('Enviando sua confirmação…');

    // Xano: body no formato { info: [ { id, presenca }, ... ] }
    const res = await fetch(POST_CONFIRMACAO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ info: payload })
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`POST ${res.status} — ${t || 'falha ao enviar'}`);
    }

    // Sucesso: mostra popup
    setStatus('');
    mostrarPopupSucesso();
  } catch (err) {
    console.error('[confirm.js] Erro no POST:', err);
    setStatus('Não foi possível enviar agora. Tente novamente em instantes.', false);
    btnEnviar.disabled = false;
  }
}

// 11) Popup: abre e espera clique no OK
function mostrarPopupSucesso() {
  if (!popup) { window.location.href = 'index.html'; return; }
  popup.hidden = false;

  const btnOk = document.getElementById('btnOkPopup');
  if (btnOk) {
    btnOk.focus();
    btnOk.addEventListener('click', () => {
      window.location.href = 'index.html';
    }, { once: true });
  }
}


    // 12) Start
    carregarConvidados();
  });
})();
