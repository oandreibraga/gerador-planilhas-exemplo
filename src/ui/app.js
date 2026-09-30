/* Interface: monta a página e liga os controles ao núcleo. Nenhum valor real é exibido. */
import { A } from '../nucleo/amostra.js';

var ICONES = {
  enviar: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
  ok: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  okGrande: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16.5 9.5"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>',
  baixar: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 20h14"/></svg>',
  copiar: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg>',
  cadeado: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>',
  busca: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>'
};

// Tipos agrupados no seletor, na ordem em que aparecem.
var GRUPOS_TIPO = [
  ['Datas e horas', ['data', 'datahora', 'hora']],
  ['Números', ['inteiro', 'decimal', 'moeda', 'percentual']],
  ['Documentos e contatos', ['cpf', 'cnpj', 'chave', 'email', 'telefone', 'cep']],
  ['Lugares', ['cidade', 'uf', 'endereco', 'bairro']],
  ['Nomes e textos', ['pessoa', 'empresa', 'codigo', 'categoria', 'simnao', 'texto']],
  ['Outros', ['constante', 'vazia']]
];
var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

var PROPS = { value: 1, checked: 1, disabled: 1, hidden: 1, open: 1, selected: 1 };

function h(tag, props, filhos) {
  var el = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (PROPS[k]) el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
  }
  if (filhos) {
    (Array.isArray(filhos) ? filhos : [filhos]).forEach(function (f) {
      if (f == null || f === false) return;
      el.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
    });
  }
  return el;
}

// Único uso de innerHTML: desenhos SVG fixos de ICONES (nunca texto vindo do arquivo ou da pessoa).
// Aberta pelo site (http/https)? No arquivo baixado (file://) a pessoa já está usando a versão sem internet.
function pelaInternet() {
  var p = (typeof location !== 'undefined' && location.protocol) || '';
  return p === 'http:' || p === 'https:';
}

var ultimoId = 0;
function novoId(prefixo) { return prefixo + '-' + (++ultimoId); }

function icone(nome) {
  var el = h('span', { class: 'ico' });
  el.innerHTML = ICONES[nome]; // eslint-disable-line no-restricted-properties
  return el;
}
function giro() { return h('span', { class: 'giro', 'aria-hidden': 'true' }); }

function proximoQuadro() {
  return new Promise(function (ok) {
    var feito = false;
    function fim() { if (!feito) { feito = true; setTimeout(ok, 0); } }
    requestAnimationFrame(fim);
    setTimeout(fim, 80);
  });
}

function milhar(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function plural(n, um, varios) { return milhar(n) + ' ' + (n === 1 ? um : varios); }

function tamanhoLegivel(b) {
  if (b == null) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return Math.round(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
}

// Aceita bytes (amostra) ou um Blob já pronto (arquivo inteiro).
function baixarArquivo(nome, bytes) {
  var blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

function copiarTexto(texto) {
  function alternativo() {
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (!ok) throw new Error('O navegador não deixou copiar automaticamente.');
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texto).catch(alternativo);
  }
  alternativo();
  return Promise.resolve();
}

// ---------- como um valor aparece no Excel (para os exemplos na tela) ----------
function numeroBR(x, casas, comMilhar) {
  var s = Math.abs(x).toFixed(casas).split('.');
  var inteiro = comMilhar ? milhar(s[0]) : s[0];
  return (x < 0 ? '-' : '') + inteiro + (s[1] ? ',' + s[1] : '');
}

function exibir(cel) {
  var U = A.util;
  if (!cel) return '(vazia)';
  if (cel.t === 'b') return cel.v ? 'VERDADEIRO' : 'FALSO';
  if (cel.t !== 'n') return String(cel.v);
  var z = cel.z || 'General', k = U.tipoDoFormato(z), limpo = U.limparFormato(U.secoes(z)[0]);
  if (k === 'data' || k === 'datahora' || k === 'hora') {
    var p = U.partesDeSerial(cel.v);
    var data = /m{3,}/i.test(limpo) && !/d/i.test(limpo) ? MESES[p.m - 1] + '/' + p.y : U.pad2(p.d) + '/' + U.pad2(p.m) + '/' + p.y;
    var hora = U.pad2(p.h) + ':' + U.pad2(p.mi) + (U.formatoTemSegundos(z) ? ':' + U.pad2(p.s) : '');
    return k === 'data' ? data : k === 'hora' ? hora : data + ' ' + hora;
  }
  var casas = U.casasDoFormato(z);
  if (k === 'percentual') return numeroBR(cel.v * 100, casas || 0, false) + '%';
  if (casas == null) casas = Math.min(U.decimaisDe(cel.v), 6);
  var s = numeroBR(cel.v, casas, /[#0],[#0]/.test(limpo));
  return k === 'moeda' ? 'R$ ' + s : s;
}

function formatoLegivel(z) {
  return String(z).replace(/\[\$-[^\]]*\]/g, '').replace(/\\/g, '').replace(/"/g, '')
    .replace(/yyyy/gi, 'aaaa').replace(/yy/gi, 'aa').trim();
}

function montar(raiz, opcoes) {
  opcoes = opcoes || {};
  var DET = A.detectar, RES = A.resumo, L = A.LIMITES, U = A.util;
  var baixar = opcoes.baixar || baixarArquivo;
  var copiar = opcoes.copiar || copiarTexto;
  // modoSaida: 'amostra' (poucas linhas inventadas) ou 'inteiro' (o arquivo todo, com os dados sensíveis trocados)
  var estado = { arquivo: null, n: 20, ocupado: false, modo: 'arquivo', modoSaida: 'amostra', original: null, acoes: {} };

  // ---------- trabalho pesado fora da tela (Web Worker) ----------
  // O Worker é montado com os mesmos códigos já embutidos na página (SheetJS + biblioteca + trabalhador),
  // então não há arquivo extra nem acesso à rede. Se não der para criar o Worker, faz o trabalho na própria tela.
  var trabalhador = null, semTrabalhador = !!opcoes.semTrabalhador, pedidos = {}, proximoPedido = 1;
  function criarTrabalhador() {
    if (trabalhador || semTrabalhador) return trabalhador;
    try {
      var partes = ['sheetjs', 'biblioteca', 'trabalhador'].map(function (id) {
        var el = document.getElementById(id);
        return el ? el.textContent : '';
      });
      if (partes.some(function (p) { return !p.trim(); }) || typeof Worker === 'undefined' || !window.URL || !URL.createObjectURL) {
        semTrabalhador = true;
        return null;
      }
      var url = URL.createObjectURL(new Blob([partes.join('\n;\n')], { type: 'text/javascript' }));
      trabalhador = new Worker(url);
      trabalhador.onmessage = function (ev) {
        var p = pedidos[ev.data.id];
        if (!p) return;
        if (ev.data.progresso != null) { if (p.progresso) p.progresso(ev.data.progresso); return; }
        delete pedidos[ev.data.id];
        if (ev.data.ok) p.ok(ev.data.res);
        else p.falha(Object.assign(new Error(ev.data.erro.message), ev.data.erro));
      };
      trabalhador.onerror = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        semTrabalhador = true;
        trabalhador = null;
        Object.keys(pedidos).forEach(function (id) {
          var p = pedidos[id];
          delete pedidos[id];
          p.naTela();
        });
      };
      return trabalhador;
    } catch (e) {
      semTrabalhador = true;
      return null;
    }
  }
  // Vigia: se a leitura não responder a tempo (arquivo danificado que trava a biblioteca), o Worker é
  // encerrado e a pessoa recebe uma mensagem clara, sem a página congelar. O prazo cresce com o tamanho:
  // 20 s + 2 s por MB, até 3 min (um arquivo pequeno e danificado não deixa a pessoa esperando muito).
  function limiteLeitura(bytes) {
    if (opcoes.limiteLeituraMs) return opcoes.limiteLeituraMs;
    var mb = ((bytes && bytes.byteLength) || 0) / 1048576;
    return Math.min(180000, Math.round(20000 + 2000 * mb));
  }
  // raiz.dataset.leitura diz onde foi a última leitura ("trabalhador" ou "tela"); usado nos testes de navegador.
  // `extra`: dados a mais para o Worker (modelo e ações do arquivo inteiro); `aoProgresso(fração)` recebe o
  // andamento. Enquanto há andamento, o vigia é reiniciado (arquivo grande demora, mas não está travado).
  function foraDaTela(op, nome, bytes, naTela, extra, aoProgresso) {
    var t = criarTrabalhador();
    if (!t) {
      raiz.dataset.leitura = 'tela';
      return Promise.resolve().then(naTela);
    }
    return new Promise(function (ok, falha) {
      var id = proximoPedido++, limite = limiteLeitura(bytes), vigia = null;
      function armar() {
        clearTimeout(vigia);
        vigia = setTimeout(function () {
          if (!pedidos[id]) return;
          delete pedidos[id];
          t.terminate();
          if (trabalhador === t) trabalhador = null;
          var e = new Error('A leitura demorou demais e foi interrompida. O arquivo pode estar danificado: tente abrir no Excel e salvar de novo.');
          e.tipo = 'corrompido';
          e.amigavel = true;
          e.detalhe = 'sem resposta em ' + Math.round(limite / 1000) + ' s';
          falha(e);
        }, limite);
      }
      armar();
      pedidos[id] = {
        ok: function (r) { clearTimeout(vigia); raiz.dataset.leitura = 'trabalhador'; ok(r); },
        falha: function (e) { clearTimeout(vigia); raiz.dataset.leitura = 'trabalhador'; falha(e); },
        progresso: function (f) { armar(); if (aoProgresso) aoProgresso(f); },
        naTela: function () { clearTimeout(vigia); raiz.dataset.leitura = 'tela'; Promise.resolve().then(naTela).then(ok, falha); }
      };
      var msg = { id: id, op: op, nome: nome, bytes: bytes };
      if (extra) Object.keys(extra).forEach(function (k) { msg[k] = extra[k]; });
      t.postMessage(msg);
    });
  }

  // ---------- botões com estado (carregando / concluído) ----------
  function definirRotulo(botao, nomeIcone, texto) {
    botao._rotulo = { icone: nomeIcone, texto: texto };
    if (!botao.classList.contains('carregando') && !botao.classList.contains('ok')) aplicarRotulo(botao);
  }
  function aplicarRotulo(botao) {
    var r = botao._rotulo || { texto: '' };
    botao.textContent = '';
    if (r.icone) botao.appendChild(icone(r.icone));
    botao.appendChild(h('span', { text: r.texto }));
  }
  function botaoCarregando(botao, texto) {
    clearTimeout(botao._timer);
    botao.classList.remove('ok');
    botao.classList.add('carregando');
    botao.textContent = '';
    botao.appendChild(giro());
    botao.appendChild(h('span', { text: texto }));
  }
  function botaoConcluido(botao, texto) {
    botao.classList.remove('carregando');
    if (!texto) { aplicarRotulo(botao); return; }
    botao.classList.add('ok');
    botao.textContent = '';
    botao.appendChild(icone('ok'));
    botao.appendChild(h('span', { text: texto }));
    botao._timer = setTimeout(function () {
      botao.classList.remove('ok');
      aplicarRotulo(botao);
    }, 2400);
  }
  function botaoRestaurar(botao) {
    clearTimeout(botao._timer);
    botao.classList.remove('carregando', 'ok');
    aplicarRotulo(botao);
  }

  function executar(o) {
    if (estado.ocupado) return Promise.resolve(null);
    estado.ocupado = true;
    raiz.classList.add('ocupado');
    raiz.setAttribute('aria-busy', 'true');
    conteudo.disabled = true;
    if (o.botao) botaoCarregando(o.botao, o.texto);
    if (o.antes) o.antes();
    function liberar() {
      estado.ocupado = false;
      raiz.classList.remove('ocupado');
      raiz.removeAttribute('aria-busy');
      conteudo.disabled = false;
    }
    return proximoQuadro().then(o.tarefa).then(function (res) {
      liberar();
      if (o.botao) botaoConcluido(o.botao, o.ok);
      return res;
    }, function (e) {
      liberar();
      if (o.botao) botaoRestaurar(o.botao);
      if (o.aoErro) o.aoErro(e);
      mostrarErro(e);
      return null;
    });
  }

  // ---------- avisos ----------
  function toast(msg, tipo) {
    tipo = tipo || 'ok';
    var t = h('div', { class: 'toast ' + tipo, role: 'status' }, [icone(tipo === 'ok' ? 'ok' : 'alerta'), h('span', { text: msg })]);
    while (toasts.children.length >= 3) toasts.removeChild(toasts.firstChild);
    toasts.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('visivel'); });
    setTimeout(function () {
      t.classList.remove('visivel');
      setTimeout(function () { t.remove(); }, 300);
    }, 4000);
  }

  var TITULOS_ERRO = {
    senha: 'Esta planilha tem senha',
    corrompido: 'Não foi possível abrir este arquivo',
    formato: 'Tipo de arquivo não aceito',
    grande: 'Arquivo grande demais',
    leitura: 'O arquivo não pôde ser lido',
    recurso: 'Este arquivo tem algo que ainda não conseguimos trocar com segurança',
    vazio: 'Não há nada para ler'
  };
  function mostrarErro(e) {
    var amigavel = e && e.amigavel;
    caixaErro.textContent = '';
    var corpo = h('div', { class: 'erro-corpo' }, [
      h('strong', { text: amigavel ? (TITULOS_ERRO[e.tipo] || 'Atenção') : 'Algo deu errado' }),
      h('p', { text: amigavel ? e.message : 'Aconteceu um erro inesperado. Tente de novo; se continuar, envie o detalhe abaixo para quem mantém a ferramenta.' })
    ]);
    var detalhe = e && (e.detalhe || (!amigavel && (e.message || String(e))));
    if (detalhe) {
      corpo.appendChild(h('details', null, [h('summary', { text: 'Ver detalhe técnico' }), h('code', { text: detalhe })]));
    }
    caixaErro.appendChild(icone('alerta'));
    caixaErro.appendChild(corpo);
    caixaErro.hidden = false;
    piscar(caixaErro);
  }
  function esconderErro() { caixaErro.hidden = true; caixaErro.textContent = ''; }

  function piscar(el) {
    el.classList.remove('pisca');
    void el.offsetWidth;
    el.classList.add('pisca');
  }

  // ---------- estrutura da página ----------
  raiz.classList.add('app');
  raiz.textContent = '';

  var topo = h('header', { class: 'topo' }, [
    h('div', { class: 'topo-interno' }, [
      h('div', { class: 'marca' }, [
        h('span', { class: 'marca-linha1' }, ['GERADOR DE ', h('b', { text: 'PLANILHAS' })]),
        h('span', { class: 'marca-linha2', text: 'de exemplo' })
      ]),
      h('span', { class: 'selo' }, [icone('cadeado'), h('span', { text: 'Funciona sem internet' })])
    ])
  ]);
  var faixa = h('section', { class: 'faixa' }, [
    h('div', { class: 'faixa-interna' }, [
      h('h1', { text: 'Crie uma cópia da sua planilha com dados falsos' }),
      h('p', { text: 'A ferramenta copia só a estrutura (abas, colunas e formatos) e preenche com dados inventados. ' +
        'Use o arquivo gerado para pedir automações ou tirar dúvidas sem expor os dados reais.' }),
      h('p', { class: 'faixa-privacidade' }, [icone('cadeado'),
        h('span', { text: 'Sua planilha é lida só neste computador e nada é enviado para a internet. Os valores do arquivo gerado são inventados; nomes de abas, títulos das colunas e listas curtas (como status) continuam como no original.' })]),
      pelaInternet() ? h('p', { class: 'faixa-offline' }, [
        h('a', { class: 'faixa-baixar', href: 'gerador-planilhas-exemplo.zip', download: '' }, [icone('baixar'), h('span', { text: 'Baixar para usar sem internet' })]),
        h('span', { class: 'faixa-offline-texto', text: 'Um arquivo .zip com a ferramenta: descompacte e abra no navegador, sem instalar nada.' })
      ]) : null
    ])
  ]);

  var conteudo = h('fieldset', { class: 'conteudo' });
  conteudo.appendChild(h('legend', { class: 'so-leitor', text: 'Gerador de planilhas de exemplo' }));

  function tituloPasso(numero, titulo, texto) {
    return h('div', { class: 'passo-topo' }, [
      h('span', { class: 'passo-num', text: String(numero) }),
      h('div', null, [h('h2', { text: titulo }), texto ? h('p', { class: 'passo-texto', text: texto }) : null])
    ]);
  }

  // Passo 1
  var abaArquivo = h('button', { type: 'button', role: 'tab', class: 'modo', 'aria-selected': 'true', text: 'Tenho o arquivo' });
  var abaColar = h('button', { type: 'button', role: 'tab', class: 'modo', 'aria-selected': 'false', text: 'Só tenho os títulos das colunas' });
  var modos = h('div', { class: 'modos', role: 'tablist', 'aria-label': 'Como informar a planilha' }, [abaArquivo, abaColar]);

  var idTitulo = novoId('dz-titulo'), idSub = novoId('dz-sub');
  var entrada = h('input', {
    type: 'file', class: 'entrada-oculta', accept: '.xlsx,.xlsm,.xls,.xlsb,.ods,.csv,.zip',
    'aria-label': 'Escolher planilha', 'aria-describedby': idTitulo + ' ' + idSub
  });
  var dzIcone = h('span', { class: 'dz-icone', 'aria-hidden': 'true' });
  var dzTitulo = h('span', { class: 'dz-titulo', id: idTitulo });
  var dzSub = h('span', { class: 'dz-sub', id: idSub });
  var dropzone = h('label', { class: 'dropzone' }, [entrada, dzIcone, dzTitulo, dzSub]);
  var escolhaZip = h('div', { class: 'escolha-zip', hidden: true });
  var painelArquivo = h('div', { class: 'painel' }, [dropzone, escolhaZip]);

  var campoColado = h('textarea', {
    class: 'colado', rows: '3', spellcheck: 'false',
    placeholder: 'Exemplo: Pedido    Data    Cliente    Valor'
  });
  var campoAba = h('input', { type: 'text', value: 'Planilha1', maxlength: '31' });
  var campoNome = h('input', { type: 'text', value: 'minha_planilha' });
  var botaoAnalisar = h('button', { type: 'button', class: 'btn pri' });
  definirRotulo(botaoAnalisar, null, 'Continuar');
  var painelColar = h('div', { class: 'painel painel-colar', hidden: true }, [
    h('label', { class: 'campo' }, [
      h('span', { text: 'Cole aqui os títulos das colunas' }),
      h('small', { text: 'No Excel, selecione a linha com os títulos, aperte Ctrl+C e cole aqui com Ctrl+V.' }),
      campoColado
    ]),
    h('div', { class: 'campos-linha' }, [
      h('label', { class: 'campo' }, [h('span', { text: 'Nome da aba' }), campoAba]),
      h('label', { class: 'campo' }, [h('span', { text: 'Nome do arquivo' }), campoNome]),
      botaoAnalisar
    ]),
    h('p', { class: 'dica', text: 'Sem o arquivo, a ferramenta adivinha o tipo de cada coluna pelo título. Você pode corrigir no passo 2.' })
  ]);

  var caixaErro = h('div', { class: 'caixa-erro', role: 'alert', hidden: true });
  var passo1 = h('section', { class: 'passo' }, [
    tituloPasso(1, 'Escolha a planilha', null), modos, painelArquivo, painelColar, caixaErro
  ]);

  // Passo 2
  var resumoArquivo = h('p', { class: 'passo-texto' });
  var listaAbas = h('div', { class: 'abas' });
  var textoPasso2 = h('p', { class: 'passo-texto' });
  var notaPasso2 = h('p', { class: 'nota' });

  // O que gerar: amostra fictícia ou o arquivo inteiro com os dados sensíveis trocados
  var grupoSaida = novoId('modo-saida');
  function cartaoModo(valor, titulo, texto, selo) {
    var radio = h('input', { type: 'radio', name: grupoSaida, value: valor, class: 'modo-radio' });
    var cartao = h('label', { class: 'modo-cartao' }, [radio, h('span', { class: 'modo-textos' }, [
      h('span', { class: 'modo-titulo' }, [h('span', { text: titulo }), selo ? h('span', { class: 'selo-novo', text: selo }) : null]),
      h('span', { class: 'modo-desc', text: texto })
    ])]);
    radio.addEventListener('change', function () { if (radio.checked) definirModoSaida(valor); });
    cartao._radio = radio;
    return cartao;
  }
  var cartaoAmostra = cartaoModo('amostra', 'Amostra fictícia',
    'Poucas linhas (10, 20 ou 30) com dados inventados e a mesma estrutura. Para pedir automações ou tirar dúvidas.');
  var cartaoInteiro = cartaoModo('inteiro', 'Arquivo inteiro com dados trocados',
    'Todas as linhas. Nomes, documentos, e-mails e telefones viram fictícios (o mesmo valor vira sempre o mesmo fictício); datas, valores e o resto ficam como estão. Para testar sistemas com volume de verdade.', 'novo');
  var avisoSaida = h('p', { class: 'modo-aviso', hidden: true });
  var escolhaSaida = h('fieldset', { class: 'modo-saida' }, [
    h('legend', { text: 'O que você quer gerar?' }),
    h('div', { class: 'modo-cartoes' }, [cartaoAmostra, cartaoInteiro]),
    avisoSaida
  ]);

  var passo2 = h('section', { class: 'passo estrutura', hidden: true }, [
    h('div', { class: 'passo-topo' }, [
      h('span', { class: 'passo-num', text: '2' }),
      h('div', null, [
        h('h2', { text: 'Confira as colunas' }),
        resumoArquivo,
        textoPasso2
      ])
    ]),
    escolhaSaida,
    listaAbas,
    notaPasso2
  ]);

  // Resultado do arquivo inteiro: o que foi trocado e tirado (sem mostrar nenhum valor real)
  var painelResultado = h('section', { class: 'passo resultado', hidden: true, 'aria-live': 'polite' });

  // Passo 3 (barra fixa)
  var chips = [10, 20, 30].map(function (n) {
    return h('button', { type: 'button', class: 'chip', 'aria-pressed': n === estado.n ? 'true' : 'false', text: String(n), onclick: function () { definirLinhas(n); } });
  });
  var botaoResumo = h('button', { type: 'button', class: 'btn sec', title: 'Texto com a lista de abas e colunas, pronto para colar no pedido de automação' });
  definirRotulo(botaoResumo, 'copiar', 'Copiar descrição das colunas');
  var botaoGerar = h('button', { type: 'button', class: 'btn pri grande' });
  var grupoQtd = h('div', { class: 'qtd', role: 'group', 'aria-label': 'Linhas de exemplo em cada aba' }, [h('span', { class: 'qtd-rotulo', text: 'Linhas de exemplo em cada aba' })].concat(chips));
  var barra = h('footer', { class: 'barra', hidden: true }, [
    h('div', { class: 'barra-interna' }, [
      h('span', { class: 'passo-num pequeno', text: '3' }),
      grupoQtd,
      h('div', { class: 'acoes' }, [botaoResumo, botaoGerar])
    ])
  ]);

  conteudo.appendChild(passo1);
  conteudo.appendChild(passo2);
  conteudo.appendChild(painelResultado);
  conteudo.appendChild(barra);

  var toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  raiz.appendChild(topo);
  raiz.appendChild(faixa);
  raiz.appendChild(h('main', { class: 'principal' }, conteudo));
  raiz.appendChild(toasts);

  // ---------- estados da área de arquivo ----------
  function estadoDropzone(tipo, nome, extra) {
    dropzone.className = 'dropzone ' + tipo;
    dzIcone.textContent = '';
    if (tipo === 'carregando') dzIcone.appendChild(giro());
    else if (tipo === 'carregado' || tipo === 'escolha') dzIcone.appendChild(icone('okGrande'));
    else if (tipo === 'erro') dzIcone.appendChild(icone('alerta'));
    else dzIcone.appendChild(icone('enviar'));
    var titulos = {
      ocioso: 'Arraste a planilha para cá',
      carregando: 'Lendo ' + (nome || 'arquivo') + '…',
      carregado: nome || '',
      escolha: nome || '',
      erro: 'Não deu para abrir ' + (nome || 'o arquivo')
    };
    var subs = {
      ocioso: 'ou clique para escolher no computador · aceita .xlsx, .xls, .csv e .zip',
      escolha: (extra || '') + ' · escolha abaixo qual planilha usar',
      carregando: 'Em arquivos grandes isso pode levar alguns segundos',
      carregado: (extra || '') + ' · para trocar, clique ou arraste outro arquivo',
      erro: 'Veja o aviso abaixo e tente outro arquivo'
    };
    dzTitulo.textContent = titulos[tipo];
    dzSub.textContent = subs[tipo];
    estado.dropzone = tipo;
  }
  estadoDropzone('ocioso');

  // ---------- carregamento ----------
  function contarColunas(arq) {
    var n = 0;
    arq.abas.forEach(function (a) { n += a.colunas.length; });
    return n;
  }

  function aplicarArquivo(arq) {
    estado.arquivo = arq;
    esconderErro();
    renderizarEstrutura();
  }

  function processar(nome, bytes, tamanho) {
    if (A.leitura.ehZip(nome)) {
      return foraDaTela('listarZip', nome, bytes, function () { return A.leitura.listarZip(bytes); }).then(function (itens) {
        if (itens.length === 1) {
          estado.zip = null;
          escolhaZip.hidden = true;
          return processarPlanilha(itens[0].nome, itens[0].bytes, itens[0].tamanho, nome);
        }
        limparEstrutura();
        mostrarEscolhaZip(nome, itens);
        estadoDropzone('escolha', nome, plural(itens.length, 'planilha encontrada', 'planilhas encontradas'));
        toast('Encontramos ' + plural(itens.length, 'planilha', 'planilhas') + ' dentro do .zip. Escolha qual usar.');
        return null;
      });
    }
    estado.zip = null;
    escolhaZip.hidden = true;
    return processarPlanilha(nome, bytes, tamanho, null);
  }

  function processarPlanilha(nome, bytes, tamanho, deZip) {
    return foraDaTela('abrir', nome, bytes, function () {
      return A.leitura.abrirSeguro({ nome: nome, bytes: bytes }).then(function (a) {
        DET.analisarArquivo(a);
        return a;
      });
    }).then(function (arq) { return mostrarPlanilha(arq, nome, tamanho, deZip, bytes); });
  }

  function mostrarPlanilha(arq, nome, tamanho, deZip, bytes) {
    arq.tamanho = tamanho;
    estado.original = { nome: nome, bytes: bytes };
    estado.acoes = {};
    if (!podeInteiro()) estado.modoSaida = 'amostra';
    aplicarArquivo(arq);
    var cols = contarColunas(arq);
    estadoDropzone('carregado', nome, (deZip ? 'de dentro de ' + deZip + ' · ' : '') + tamanhoLegivel(tamanho) + ' · ' +
      plural(arq.abas.length, 'aba', 'abas') + ' · ' + plural(cols, 'coluna', 'colunas'));
    toast('Pronto! Encontramos ' + plural(arq.abas.length, 'aba', 'abas') + ' e ' + plural(cols, 'coluna', 'colunas') + '.');
    return arq;
  }

  // Lista das planilhas de um .zip; dá para trocar de planilha sem abrir o .zip de novo.
  function mostrarEscolhaZip(nomeZip, itens) {
    estado.zip = { nome: nomeZip, itens: itens, escolhido: -1 };
    escolhaZip.textContent = '';
    escolhaZip.appendChild(h('p', { class: 'escolha-titulo' }, [
      h('strong', { text: nomeZip + ' tem ' + plural(itens.length, 'planilha', 'planilhas') + '.' }),
      ' Qual você quer usar?'
    ]));
    var lista = h('div', { class: 'escolha-lista' });
    itens.forEach(function (it, i) {
      var pasta = it.caminho.length > it.nome.length ? it.caminho.slice(0, it.caminho.length - it.nome.length - 1) : '';
      var b = h('button', { type: 'button', class: 'escolha-item', 'aria-pressed': 'false' }, [
        h('span', { class: 'escolha-nome', text: it.nome }),
        h('span', { class: 'escolha-info', text: (pasta ? 'pasta ' + pasta + ' · ' : '') + tamanhoLegivel(it.tamanho) })
      ]);
      b.addEventListener('click', function () { escolherDoZip(i); });
      lista.appendChild(b);
    });
    escolhaZip.appendChild(lista);
    escolhaZip.hidden = false;
    piscar(escolhaZip);
  }

  function escolherDoZip(i) {
    if (!estado.zip || !estado.zip.itens[i]) return Promise.resolve(null);
    var it = estado.zip.itens[i], nomeZip = estado.zip.nome;
    return executar({
      antes: function () {
        esconderErro();
        estado.zip.escolhido = i;
        Array.prototype.forEach.call(escolhaZip.querySelectorAll('.escolha-item'), function (b, k) {
          b.setAttribute('aria-pressed', k === i ? 'true' : 'false');
        });
        estadoDropzone('carregando', it.nome);
      },
      tarefa: function () { return processarPlanilha(it.nome, it.bytes, it.tamanho, nomeZip); },
      aoErro: function () { limparEstrutura(); estadoDropzone('erro', it.nome); }
    });
  }

  function limparEstrutura() {
    estado.arquivo = null;
    passo2.hidden = true;
    barra.hidden = true;
    listaAbas.textContent = '';
  }

  function carregarBytes(nome, bytes, tamanho) {
    return executar({
      antes: function () { esconderErro(); estadoDropzone('carregando', nome); },
      tarefa: function () { return processar(nome, bytes, tamanho == null ? bytes.length : tamanho); },
      aoErro: function () { limparEstrutura(); escolhaZip.hidden = true; estadoDropzone('erro', nome); }
    });
  }

  function carregarArquivo(file) {
    if (!file || estado.ocupado) return Promise.resolve(null);
    trocarModo('arquivo');
    return executar({
      antes: function () { esconderErro(); estadoDropzone('carregando', file.name); },
      tarefa: function () {
        return file.arrayBuffer().then(function (buf) {
          return processar(file.name, new Uint8Array(buf), file.size);
        }, function (causa) {
          // O navegador não conseguiu ler o arquivo do disco (unidade de rede desconectada, arquivo só na
          // nuvem, movido ou aberto com bloqueio por outro programa)
          var e = new Error('Não foi possível ler este arquivo do computador. Se ele está numa pasta de rede ou na nuvem ' +
            '(OneDrive, Google Drive…), confira se está disponível, ou copie para a Área de Trabalho e tente de novo.');
          e.tipo = 'leitura';
          e.amigavel = true;
          e.detalhe = String((causa && (causa.name + ': ' + causa.message)) || causa);
          throw e;
        });
      },
      aoErro: function () { limparEstrutura(); escolhaZip.hidden = true; estadoDropzone('erro', file.name); }
    });
  }

  function analisarColado() {
    return executar({
      botao: botaoAnalisar,
      texto: 'Analisando…',
      ok: 'Pronto',
      tarefa: function () {
        var arq = A.leitura.deCabecalho(campoColado.value, campoAba.value, campoNome.value);
        DET.analisarArquivo(arq);
        estado.original = null;
        estado.acoes = {};
        estado.modoSaida = 'amostra';
        aplicarArquivo(arq);
        toast('Pronto! Encontramos ' + plural(arq.abas[0].colunas.length, 'coluna', 'colunas') + '.');
        return arq;
      }
    });
  }

  // ---------- tabela de colunas ----------
  function seletorTipos(atual, rotuloAcessivel) {
    var sel = h('select', { class: 'sel-tipo', 'aria-label': rotuloAcessivel });
    GRUPOS_TIPO.forEach(function (g) {
      sel.appendChild(h('optgroup', { label: g[0] }, g[1].map(function (t) {
        return h('option', { value: t, selected: t === atual, text: DET.TIPOS[t].rotulo });
      })));
    });
    return sel;
  }

  function exemplosDaColuna(col) {
    if (col.tipo === 'vazia') return [];
    var p = DET.perfil(col);
    var rng = U.criarAleatorio(7919 * (col.c + 1) + 17);
    return A.geradores.gerarValores(p, 3, rng, { textosReais: estado.arquivo.textosReais }).map(exibir);
  }

  // Explicação curta, sem termos técnicos, do que será gravado.
  function explicacao(col) {
    var p = DET.perfil(col), fam = DET.FAMILIA[col.tipo];
    var nativo = p.arm === 'nativo';
    if (fam === 'data') {
      var padrao = nativo ? formatoLegivel(p.z) : RES.padraoData(p.texto, col.tipo);
      return (nativo ? 'Data do Excel' : 'Texto escrito como data') + ', no formato ' + padrao + '.';
    }
    if (fam === 'numero') {
      return (nativo ? 'Número do Excel' : 'Texto escrito como número') + ', com ' + plural(col.tipo === 'percentual' ? Math.max(p.casas - 2, 0) : p.casas, 'casa decimal', 'casas decimais') +
        (p.seq ? '. Continua a sequência depois do último valor' : '') + '.';
    }
    if (fam === 'mascara' && col.tipo !== 'chave') return nativo ? 'Número do Excel com máscara (' + formatoLegivel(p.z) + ').' : 'Texto no formato ' + p.mascaras[0].m.replace(/9/g, '#') + ' (# = número).';
    if (col.tipo === 'codigo') return 'Segue o mesmo padrão do original: ' + p.modelos[0].tokens.map(function (t) { return t.k === 'L' ? t.ch : t.k === '9' ? '#' : '@'; }).join('') + ' (# = número, @ = letra).';
    if (col.tipo === 'categoria') {
      return p.rotulosReais
        ? 'Lista com ' + plural(p.pesos.length, 'opção', 'opções') + '. Os textos das opções são mantidos, na mesma proporção do original.'
        : 'As ' + plural(p.pesos.length, 'opção vira', 'opções viram') + ' "Categoria A", "Categoria B"…, na mesma proporção do original.';
    }
    if (col.tipo === 'simnao') return nativo ? 'VERDADEIRO ou FALSO do Excel.' : 'Usa as mesmas respostas do original: ' + p.tokens.map(function (t) { return t.v; }).join(' / ') + '.';
    if (col.tipo === 'constante') return 'Todas as linhas têm o mesmo valor, que é mantido: ' + exibir(p.cel) + '.';
    if (col.tipo === 'cidade') return 'Cidades brasileiras reais (lista do IBGE), sempre diferentes das que estão na sua planilha' + (p.acento === false ? ', sem acentos' : '') + (p.caixa === 'maiusculo' ? ', em MAIÚSCULAS' : '') + '.';
    if (col.tipo === 'uf') return (p.extenso ? 'Nomes de estado' : 'Siglas de estado') + ' reais. Quando existe uma coluna de cidade ligada, o estado segue a cidade da linha.';
    if (col.tipo === 'endereco') return 'Endereços inventados, começando como no original (' + p.inicios[0] + ' …)' + (p.numero ? ', com número' : '') + '.';
    if (col.tipo === 'bairro') return 'Nomes de bairro inventados, no mesmo estilo do original.';
    if (col.tipo === 'chave') return 'Chaves de 44 dígitos inventadas, com dígito verificador válido e o mesmo modelo de documento (' + p.modelo + ').';
    return 'Texto inventado' + (p.caixa === 'maiusculo' ? ', em MAIÚSCULAS como no original' : '') + '.';
  }

  function textoRepeticao(col) {
    var t = RES.descreverRepeticao(col);
    return t ? 'No original: ' + t + '. A amostra segue o mesmo padrão.' : null;
  }

  function linhaColuna(aba, col) {
    var colado = estado.arquivo.origem === 'colado';
    var tr = h('tr');
    tr._busca = U.normalizar(col.letra + ' ' + col.nome);
    var nome = col.nome !== ''
      ? h('span', { class: 'nome-col', text: col.nome, title: col.nome })
      : h('span', { class: 'nome-col sem-nome', text: '(sem título)' });
    var seletor = seletorTipos(col.tipo, 'Tipo de dado da coluna ' + col.letra);
    var marcaAjuste = h('span', { class: 'marca-ajuste', text: 'alterado por você', hidden: true });
    var celExemplo = h('td', { class: 'c-exemplo' });
    var manter = h('input', {
      type: 'checkbox', class: 'chk-manter', checked: col.manter, disabled: colado || !col.preenchidas,
      'aria-label': 'Usar os dados reais da coluna ' + col.letra
    });
    var rotManter = h('label', {
      class: 'chk',
      title: colado ? 'Sem o arquivo não há dados reais para copiar.' : 'Copia os valores verdadeiros desta coluna para o arquivo. Use só se não forem dados sensíveis.'
    }, [manter, h('span', { text: 'usar reais' })]);
    // Arquivo inteiro: o que fazer com a coluna (trocar, manter, generalizar, apagar)
    var inteiro = estado.modoSaida === 'inteiro';
    var selAcao = inteiro ? h('select', { class: 'sel-acao', 'aria-label': 'O que fazer com a coluna ' + col.letra }) : null;
    function preencherAcoes() {
      selAcao.textContent = '';
      var atual = acaoDe(aba, col);
      A.inteiro.acoesPossiveis(col.tipo).forEach(function (a) {
        selAcao.appendChild(h('option', { value: a, selected: a === atual, text: ROTULO_ACAO[a] }));
      });
    }
    if (inteiro) {
      preencherAcoes();
      selAcao.addEventListener('change', function () {
        (estado.acoes[aba.nome] = estado.acoes[aba.nome] || {})[col.c] = selAcao.value;
        protegido(function () { atualizar(); piscar(tr); });
        if (selAcao.value === 'manter' && A.inteiro.acaoPadrao(col.tipo) === 'pseudonimizar') {
          toast('Atenção: os dados reais da coluna ' + col.letra + ' vão ficar no arquivo gerado.', 'aviso');
        }
      });
    }
    tr.appendChild(h('td', { class: 'c-col' }, [h('span', { class: 'letra', text: col.letra }), nome]));
    tr.appendChild(h('td', { class: 'c-tipo' }, [seletor, marcaAjuste]));
    tr.appendChild(celExemplo);
    tr.appendChild(h('td', { class: 'c-manter' }, inteiro ? selAcao : rotManter));

    var detalhesAbertos = false;
    function atualizarInteiro() {
      var acao = acaoDe(aba, col);
      var sensivel = A.inteiro.acaoPadrao(col.tipo) === 'pseudonimizar';
      if (acao === 'manter') {
        celExemplo.appendChild(sensivel
          ? h('span', { class: 'aviso-real' }, [icone('alerta'), h('span', { text: 'Os dados reais desta coluna ficam no arquivo.' })])
          : h('span', { class: 'exemplo vazio', text: col.tipo === 'vazia' ? 'Fica vazia, como no original.' : 'Fica como está (valores do original).' }));
      } else if (acao === 'limpar') {
        celExemplo.appendChild(h('span', { class: 'exemplo vazio', text: 'Fica em branco em todas as linhas.' }));
      } else if (acao === 'generalizar') {
        celExemplo.appendChild(h('span', { class: 'exemplo vazio', text: DET.FAMILIA[col.tipo] === 'data'
          ? 'Cada data vira o dia 1 do mesmo mês (ex.: 17/05/2024 → 01/05/2024).'
          : 'Cada número é arredondado para 2 algarismos (ex.: 1.234,56 → 1.200).' }));
      } else {
        var ex = exemplosDaColuna(col);
        celExemplo.appendChild(h('div', { class: 'exemplos' }, ex.map(function (v) { return h('span', { class: 'exemplo', text: v }); })));
        celExemplo.appendChild(h('span', { class: 'exemplo vazio', text: 'Cada valor vira sempre o mesmo fictício, em todas as abas.' }));
      }
      tr.classList.toggle('manter', acao === 'manter' && sensivel);
    }
    function atualizar() {
      celExemplo.textContent = '';
      if (inteiro) {
        atualizarInteiro();
      } else if (col.manter) {
        celExemplo.appendChild(h('span', { class: 'aviso-real' }, [icone('alerta'), h('span', { text: 'Os dados reais desta coluna vão para o arquivo.' })]));
      } else if (col.tipo === 'vazia') {
        celExemplo.appendChild(h('span', { class: 'exemplo vazio', text: 'Fica vazia, como no original.' }));
      } else {
        var ex = exemplosDaColuna(col);
        celExemplo.appendChild(h('div', { class: 'exemplos' }, ex.map(function (v) { return h('span', { class: 'exemplo', text: v }); })));
        var detalhes = h('div', { class: 'detalhes', hidden: !detalhesAbertos });
        detalhes.appendChild(h('p', { text: explicacao(col) }));
        var rep = col.tipo !== 'constante' && textoRepeticao(col);
        if (rep) detalhes.appendChild(h('p', { text: rep }));
        if (col.tipo === 'categoria' && !colado) {
          var trocar = h('input', { type: 'checkbox', class: 'chk-trocar', checked: col.rotulosReais === false });
          trocar.addEventListener('change', function () {
            col.rotulosReais = !trocar.checked;
            protegido(function () { atualizar(); piscar(tr); });
          });
          detalhes.appendChild(h('label', { class: 'chk' }, [trocar, h('span', { text: 'Trocar os textos por "Categoria A", "Categoria B"…' })]));
        }
        var vaz = Math.round((col.razaoVazios || 0) * 100);
        if (vaz) detalhes.appendChild(h('p', { text: 'Cerca de ' + vaz + '% das células ficam em branco, como no original.' }));
        var arms = DET.TIPOS[col.tipo].arm;
        if (arms.length > 1) {
          var selArm = h('select', { class: 'sel-arm', 'aria-label': 'Como gravar a coluna ' + col.letra }, arms.map(function (a) {
            var rot = a === 'texto' ? 'Texto' : DET.FAMILIA[col.tipo] === 'data' ? 'Data do Excel' : col.tipo === 'simnao' ? 'VERDADEIRO/FALSO do Excel' : 'Número do Excel';
            return h('option', { value: a, selected: a === col.armazenamento, text: rot });
          }));
          selArm.addEventListener('change', function () {
            protegido(function () {
              DET.definirArmazenamento(col, selArm.value);
              atualizar();
              piscar(tr);
            });
          });
          detalhes.appendChild(h('label', { class: 'rot-arm' }, [h('span', { text: 'Gravar no arquivo como:' }), selArm]));
        }
        var botaoDet = h('button', { type: 'button', class: 'link', 'aria-expanded': detalhesAbertos ? 'true' : 'false', text: detalhesAbertos ? 'Ocultar detalhes' : 'Detalhes' });
        botaoDet.addEventListener('click', function () {
          detalhesAbertos = !detalhesAbertos;
          detalhes.hidden = !detalhesAbertos;
          botaoDet.textContent = detalhesAbertos ? 'Ocultar detalhes' : 'Detalhes';
          botaoDet.setAttribute('aria-expanded', detalhesAbertos ? 'true' : 'false');
        });
        celExemplo.appendChild(botaoDet);
        celExemplo.appendChild(detalhes);
      }
      var ajustado = col.tipo !== col.tipoDetectado;
      marcaAjuste.hidden = !ajustado;
      tr.classList.toggle('ajustado', ajustado);
      if (!inteiro) tr.classList.toggle('manter', !!col.manter);
    }
    seletor.addEventListener('change', function () {
      protegido(function () {
        DET.definirTipo(col, seletor.value);
        if (inteiro) {
          // Tipo novo, ação padrão do tipo novo (a escolha anterior pode nem existir para ele)
          if (estado.acoes[aba.nome]) delete estado.acoes[aba.nome][col.c];
          preencherAcoes();
        }
        atualizar();
        piscar(tr);
      });
    });
    manter.addEventListener('change', function () {
      col.manter = manter.checked;
      atualizar();
      piscar(tr);
      if (col.manter) toast('Atenção: os dados reais da coluna ' + col.letra + ' vão para o arquivo gerado.', 'aviso');
    });
    protegido(atualizar);
    tr._col = col;
    return tr;
  }

  function protegido(fn) {
    try { fn(); } catch (e) { mostrarErro(e); }
  }

  function tabelaColunas(aba) {
    var corpo = h('tbody', null, aba.colunas.map(function (col) { return linhaColuna(aba, col); }));
    var tabela = h('table', { class: 'colunas' }, [
      h('caption', { class: 'so-leitor', text: 'Colunas da aba ' + aba.nome }),
      h('thead', null, h('tr', null, [
        h('th', { scope: 'col', text: 'Coluna' }),
        h('th', { scope: 'col', text: 'Tipo de dado' }),
        h('th', { scope: 'col', text: 'Exemplo do que vai aparecer' }),
        h('th', { scope: 'col', text: estado.modoSaida === 'inteiro' ? 'O que fazer' : 'Dados reais' })
      ])),
      corpo
    ]);
    var partes = [];
    if (aba.colunas.length > 12) {
      var semResultado = h('p', { class: 'sem-resultado', text: 'Nenhuma coluna com esse nome.', hidden: true });
      var busca = h('input', { type: 'search', class: 'busca', placeholder: 'Procurar coluna pelo título', 'aria-label': 'Procurar coluna na aba ' + aba.nome });
      busca.addEventListener('input', function () {
        var termo = U.normalizar(busca.value);
        var visiveis = 0;
        Array.prototype.forEach.call(corpo.children, function (tr) {
          var mostra = !termo || tr._busca.indexOf(termo) >= 0;
          tr.hidden = !mostra;
          if (mostra) visiveis++;
        });
        semResultado.hidden = visiveis > 0;
      });
      partes.push(h('label', { class: 'caixa-busca' }, [icone('busca'), busca]));
      partes.push(h('div', { class: 'rolagem' }, tabela));
      partes.push(semResultado);
    } else {
      partes.push(h('div', { class: 'rolagem' }, tabela));
    }
    return h('div', null, partes);
  }

  function metaAba(aba) {
    if (aba.linhaCab < 0 || !aba.colunas.length) return 'aba vazia';
    var partes = [plural(aba.colunas.length, 'coluna', 'colunas')];
    if (estado.arquivo.origem !== 'colado') {
      partes.push(aba.totalDados > aba.nDados ? 'cerca de ' + plural(aba.totalDados, 'linha', 'linhas') : plural(aba.nDados, 'linha', 'linhas'));
    }
    return partes.join(' · ');
  }

  function controleCabecalho(aba, cartao) {
    var maximo = Math.max(1, Math.min(L.BUSCA_CABECALHO, aba.linhas.length));
    var texto = aba.linhaCab >= 0
      ? 'Os títulos das colunas estão na linha ' + (aba.linhaCab + 1) + '.'
      : 'Não encontramos títulos nesta aba.';
    var abrir = h('button', { type: 'button', class: 'link', text: 'Não é essa linha?' });
    var campo = h('input', { type: 'number', class: 'num', min: '1', max: String(maximo), value: String(Math.max(aba.linhaCab, 0) + 1), 'aria-label': 'Linha dos títulos da aba ' + aba.nome });
    var botao = h('button', { type: 'button', class: 'btn sec peq' });
    definirRotulo(botao, null, 'Usar esta linha');
    var editor = h('div', { class: 'editor-cab', hidden: true }, [
      h('label', { class: 'rot-inline' }, [h('span', { text: 'Os títulos estão na linha' }), campo]),
      botao,
      aba.linhaCabDetectada >= 0 && aba.linhaCab !== aba.linhaCabDetectada
        ? h('span', { class: 'dica', text: 'A ferramenta tinha encontrado a linha ' + (aba.linhaCabDetectada + 1) + '.' }) : null
    ]);
    abrir.addEventListener('click', function () {
      editor.hidden = !editor.hidden;
      if (!editor.hidden) campo.focus();
    });
    function aplicar() {
      var v = parseInt(campo.value, 10);
      if (!(v >= 1 && v <= maximo)) {
        campo.classList.add('invalido');
        piscar(campo);
        toast('Digite um número de linha entre 1 e ' + maximo + '.', 'erro');
        return;
      }
      campo.classList.remove('invalido');
      executar({
        botao: botao,
        texto: 'Atualizando…',
        ok: 'Pronto',
        tarefa: function () {
          DET.analisarAba(aba, estado.arquivo, v - 1);
          var novo = cartaoAba(aba, true);
          cartao.replaceWith(novo);
          piscar(novo);
          toast('Aba "' + aba.nome + '": agora usando a linha ' + v + ' como títulos.');
        }
      });
    }
    botao.addEventListener('click', aplicar);
    campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); aplicar(); } });
    return h('div', { class: 'ctrl-cab' }, [h('div', { class: 'ctrl-cab-linha' }, [h('span', { text: texto }), abrir]), editor]);
  }

  function cartaoAba(aba, aberto) {
    var cab = h('summary', null, [
      h('span', { class: 'aba-nome', text: aba.nome }),
      aba.oculta ? h('span', { class: 'marca-oculta', text: 'aba oculta' }) : null,
      h('span', { class: 'aba-meta', text: metaAba(aba) })
    ]);
    var corpo = h('div', { class: 'aba-corpo' });
    var cartao = h('details', { class: 'aba', open: aberto }, [cab, corpo]);
    if (estado.arquivo.origem !== 'colado') corpo.appendChild(controleCabecalho(aba, cartao));
    var ligacoes = estado.modoSaida === 'amostra' ? RES.descreverRelacoes(aba) : [];
    if (ligacoes.length) {
      corpo.appendChild(h('div', { class: 'ligacoes' }, [
        h('strong', { text: 'Ligações entre colunas que a amostra mantém' }),
        h('ul', null, ligacoes.map(function (t) { return h('li', { text: t }); }))
      ]));
    }
    if (aba.linhaCab < 0 || !aba.colunas.length) {
      corpo.appendChild(h('p', { class: 'vazio', text: 'Esta aba não tem dados. No arquivo gerado ela também fica vazia.' }));
    } else {
      corpo.appendChild(tabelaColunas(aba));
    }
    cartao._aba = aba;
    return cartao;
  }

  function renderizarEstrutura() {
    var arq = estado.arquivo;
    atualizarModoSaida();
    listaAbas.textContent = '';
    var total = contarColunas(arq);
    arq.abas.forEach(function (aba, i) { listaAbas.appendChild(cartaoAba(aba, i === 0 || total <= 60)); });
    var origem = arq.origem === 'csv' ? ' (CSV)' : arq.origem === 'colado' ? ' (títulos colados)' : '';
    resumoArquivo.textContent = arq.nome + origem + ': ' + plural(arq.abas.length, 'aba', 'abas') + ', ' + plural(total, 'coluna', 'colunas') + '.';
    passo2.hidden = false;
    barra.hidden = false;
    piscar(passo2);
  }

  // ---------- o que gerar: amostra ou arquivo inteiro ----------
  var ROTULO_ACAO = { pseudonimizar: 'Trocar por fictício', manter: 'Manter', generalizar: 'Generalizar', limpar: 'Apagar' };
  function podeInteiro() { return !!(estado.original && /\.(xlsx|xlsm|csv|txt)$/i.test(estado.original.nome)); }
  function acaoDe(aba, col) {
    var escolhida = estado.acoes[aba.nome] && estado.acoes[aba.nome][col.c];
    return escolhida && A.inteiro.acoesPossiveis(col.tipo).indexOf(escolhida) >= 0 ? escolhida : A.inteiro.acaoPadrao(col.tipo);
  }
  // Ações de todas as colunas (as escolhidas e as padrão), por aba — é o que vai para o processamento.
  function acoesCompletas() {
    var r = {};
    estado.arquivo.abas.forEach(function (aba) {
      r[aba.nome] = {};
      aba.colunas.forEach(function (col) { r[aba.nome][col.c] = acaoDe(aba, col); });
    });
    return r;
  }
  function atualizarModoSaida() {
    var inteiro = estado.modoSaida === 'inteiro', pode = podeInteiro();
    cartaoAmostra._radio.checked = !inteiro;
    cartaoInteiro._radio.checked = inteiro;
    cartaoInteiro._radio.disabled = !pode;
    cartaoAmostra.classList.toggle('selecionado', !inteiro);
    cartaoInteiro.classList.toggle('selecionado', inteiro);
    cartaoInteiro.classList.toggle('indisponivel', !pode);
    avisoSaida.hidden = pode;
    avisoSaida.textContent = !estado.original
      ? 'Trocar o arquivo inteiro precisa do arquivo (não só dos títulos das colunas).'
      : 'Trocar o arquivo inteiro funciona com .xlsx e .csv. Abra este arquivo no Excel, salve como .xlsx e envie de novo.';
    textoPasso2.textContent = inteiro
      ? 'Veja o tipo de cada coluna e escolha o que fazer com ela. Por padrão, o que identifica pessoas ou empresas é trocado por fictício; o resto fica como está.'
      : 'Veja o tipo que a ferramenta identificou em cada coluna e um exemplo do que vai aparecer no arquivo. Se algum tipo estiver errado, é só trocar.';
    notaPasso2.textContent = inteiro
      ? 'Os tipos das colunas vêm das primeiras ' + L.AMOSTRA + ' linhas de cada aba, mas a troca vale para todas as linhas. Textos fora das tabelas (títulos, notas, caixas de texto) viram textos inventados. ' +
        'Comentários, autor do arquivo, links e macros são tirados.'
      : 'Para ser rápida, a ferramenta analisa até ' + L.AMOSTRA + ' linhas de cada aba. Nomes, documentos, valores e textos dos exemplos são inventados. ' +
        'Listas curtas (como tipo de documento ou status), valores 0/1 e colunas com um valor fixo mantêm o que está no original.';
    atualizarBarra();
  }
  function definirModoSaida(m) {
    if (m === 'inteiro' && !podeInteiro()) { atualizarModoSaida(); return; }
    if (estado.modoSaida === m) return;
    estado.modoSaida = m;
    painelResultado.hidden = true;
    if (estado.arquivo) renderizarEstrutura(); else atualizarModoSaida();
  }
  function atualizarBarra() {
    var inteiro = estado.modoSaida === 'inteiro';
    grupoQtd.hidden = inteiro;
    definirRotulo(botaoGerar, 'baixar', inteiro ? 'Gerar arquivo com dados trocados' : 'Baixar planilha de exemplo (' + estado.n + ' linhas)');
  }

  // ---------- quantidade, gerar e resumo ----------
  function definirLinhas(n) {
    estado.n = n;
    chips.forEach(function (c) { c.setAttribute('aria-pressed', c.textContent === String(n) ? 'true' : 'false'); });
    atualizarBarra();
  }
  definirLinhas(estado.n);

  function mostrarProgresso(f) {
    var rotulo = botaoGerar.querySelector('span:last-child');
    if (rotulo && botaoGerar.classList.contains('carregando')) rotulo.textContent = 'Trocando os dados… ' + Math.round(f * 100) + '%';
  }

  function gerarInteiro() {
    if (!estado.arquivo || !podeInteiro()) return Promise.resolve(null);
    var orig = estado.original, modelo = estado.arquivo;
    return executar({
      botao: botaoGerar,
      texto: 'Trocando os dados…',
      ok: 'Arquivo baixado',
      antes: function () { painelResultado.hidden = true; },
      tarefa: function () {
        var acoes = acoesCompletas();
        return foraDaTela('inteiro', orig.nome, orig.bytes, function () {
          return A.inteiro.processar(new Blob([orig.bytes]), orig.nome, modelo, { acoes: acoes, progresso: mostrarProgresso });
        }, { modelo: modelo, acoes: acoes }, mostrarProgresso).then(function (r) {
          baixar(r.nome, r.blob);
          mostrarResultado(r);
          toast('Arquivo com dados trocados baixado: ' + r.nome);
          return r;
        });
      }
    });
  }

  var NOMES_CLASSE = {
    pessoa: ['nome de pessoa', 'nomes de pessoas'], empresa: ['empresa', 'empresas'], cpf: ['CPF', 'CPFs'], cnpj: ['CNPJ', 'CNPJs'],
    email: ['e-mail', 'e-mails'], telefone: ['telefone', 'telefones'], cep: ['CEP', 'CEPs'], endereco: ['endereço', 'endereços'],
    bairro: ['bairro', 'bairros'], cidade: ['cidade', 'cidades'], chave: ['chave de acesso', 'chaves de acesso'], codigo: ['código', 'códigos'],
    texto: ['texto', 'textos']
  };
  function mostrarResultado(r) {
    var rel = r.relatorio;
    painelResultado.textContent = '';
    var total = rel.abas.reduce(function (s, a) { return s + a.trocadas; }, 0) + (rel.textosSoltos || 0);
    var trocas = Object.keys(rel.pseudonimos || {}).map(function (c) {
      var e = rel.pseudonimos[c], n = NOMES_CLASSE[c] || [c, c];
      return plural(e.distintos, n[0] + ' diferente', n[1] + ' diferentes') + ' → a mesma quantidade de fictícios (' + plural(e.ocorrencias, 'ocorrência', 'ocorrências') + ')';
    });
    function bloco(titulo, itens, vazio) {
      return h('div', { class: 'resultado-bloco' }, [
        h('h3', { text: titulo }),
        itens.length ? h('ul', null, itens.map(function (t) { return h('li', { text: t }); })) : h('p', { class: 'passo-texto', text: vazio })
      ]);
    }
    painelResultado.appendChild(h('div', { class: 'passo-topo' }, [
      h('span', { class: 'passo-num ok' }, [icone('ok')]),
      h('div', null, [
        h('h2', { text: 'Pronto: ' + r.nome }),
        h('p', { class: 'passo-texto', text: plural(total, 'valor trocado', 'valores trocados') + ' em ' + plural(rel.abas.length, 'aba', 'abas') + '. O arquivo já foi baixado.' })
      ])
    ]));
    painelResultado.appendChild(bloco('O que foi trocado', trocas, 'Nenhum valor precisou ser trocado.'));
    painelResultado.appendChild(bloco('O que foi tirado do arquivo', (rel.removidas || []).map(function (t) { return t.charAt(0).toUpperCase() + t.slice(1); }), 'Nada precisou ser tirado.'));
    if ((rel.avisos || []).length) painelResultado.appendChild(bloco('Confira', rel.avisos, ''));
    painelResultado.appendChild(h('p', { class: 'aviso-lgpd' }, [icone('alerta'), h('span', {
      text: 'O arquivo gerado continua sendo dado pessoal (pseudonimizado): o que foi mantido — datas, valores, cidades, listas — é real, e quem tiver o arquivo original consegue ligar as duas versões. ' +
        'Guarde e compartilhe com o mesmo cuidado, e confira antes de enviar. A tabela de trocas não fica guardada: se gerar de novo, os fictícios serão outros.'
    })]));
    painelResultado.hidden = false;
    piscar(painelResultado);
  }

  function gerar() {
    if (!estado.arquivo) return Promise.resolve(null);
    return executar({
      botao: botaoGerar,
      texto: 'Gerando a planilha…',
      ok: 'Planilha baixada',
      tarefa: function () {
        var r = A.saida.gerar(estado.arquivo, estado.n);
        baixar(r.nome, r.bytes);
        toast('Planilha de exemplo baixada: ' + r.nome);
        return r;
      }
    });
  }

  function copiarResumo() {
    if (!estado.arquivo) return Promise.resolve(null);
    return executar({
      botao: botaoResumo,
      texto: 'Copiando…',
      ok: 'Descrição copiada',
      tarefa: function () {
        var t = RES.texto(estado.arquivo);
        return Promise.resolve(copiar(t)).then(function () {
          toast('Descrição copiada. Cole no seu pedido de automação.');
          return t;
        });
      }
    });
  }

  // ---------- modos ----------
  function trocarModo(m) {
    estado.modo = m;
    abaArquivo.setAttribute('aria-selected', m === 'arquivo' ? 'true' : 'false');
    abaColar.setAttribute('aria-selected', m === 'colar' ? 'true' : 'false');
    painelArquivo.hidden = m !== 'arquivo';
    painelColar.hidden = m !== 'colar';
    if (m === 'colar') campoColado.focus();
  }

  // ---------- eventos ----------
  abaArquivo.addEventListener('click', function () { trocarModo('arquivo'); });
  abaColar.addEventListener('click', function () { trocarModo('colar'); });
  botaoAnalisar.addEventListener('click', analisarColado);
  campoColado.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); analisarColado(); }
  });
  botaoGerar.addEventListener('click', function () { return estado.modoSaida === 'inteiro' ? gerarInteiro() : gerar(); });
  botaoResumo.addEventListener('click', copiarResumo);
  entrada.addEventListener('change', function () {
    var f = entrada.files && entrada.files[0];
    entrada.value = '';
    if (f) carregarArquivo(f);
  });

  if (!opcoes.semEventosGlobais) {
    // Aceita soltar o arquivo em qualquer ponto da página; o destaque é só visual (classe CSS).
    var profundidade = 0;
    var temArquivos = function (e) {
      var tipos = e.dataTransfer && e.dataTransfer.types;
      return !!tipos && Array.prototype.indexOf.call(tipos, 'Files') >= 0;
    };
    window.addEventListener('dragenter', function (e) {
      if (!temArquivos(e)) return;
      e.preventDefault();
      if (profundidade++ === 0 && !estado.ocupado) {
        if (estado.modo !== 'arquivo') trocarModo('arquivo');
        raiz.classList.add('arrastando');
      }
    });
    window.addEventListener('dragover', function (e) {
      if (!temArquivos(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = estado.ocupado ? 'none' : 'copy';
    });
    window.addEventListener('dragleave', function (e) {
      if (!temArquivos(e)) return;
      if (--profundidade <= 0) {
        profundidade = 0;
        raiz.classList.remove('arrastando');
      }
    });
    window.addEventListener('drop', function (e) {
      if (!temArquivos(e)) return;
      e.preventDefault();
      profundidade = 0;
      raiz.classList.remove('arrastando');
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && !estado.ocupado) carregarArquivo(f);
    });
  }

  return {
    raiz: raiz,
    estado: estado,
    carregarBytes: carregarBytes,
    analisarColado: function (texto, nomeAba, nomeArquivo) {
      campoColado.value = texto;
      if (nomeAba != null) campoAba.value = nomeAba;
      if (nomeArquivo != null) campoNome.value = nomeArquivo;
      return analisarColado();
    },
    definirLinhas: definirLinhas,
    definirModoSaida: definirModoSaida,
    definirAcao: function (nomeAba, c, acao) { (estado.acoes[nomeAba] = estado.acoes[nomeAba] || {})[c] = acao; if (estado.arquivo) renderizarEstrutura(); },
    escolherDoZip: escolherDoZip,
    gerar: gerar,
    gerarInteiro: gerarInteiro,
    resultado: painelResultado,
    copiarResumo: copiarResumo,
    botoes: { gerar: botaoGerar, resumo: botaoResumo, chips: chips }
  };
}

A.app = { montar: montar, baixarArquivo: baixarArquivo, copiarTexto: copiarTexto, exibir: exibir };
