/* Web Worker: lê, analisa e processa a planilha fora da tela, para a página não travar com arquivos grandes.
   Roda depois do SheetJS e da biblioteca (os três textos viram um Blob em src/ui/app.js).
   Recebe { id, op, nome, bytes, ... } e responde { id, ok, res } ou { id, ok: false, erro };
   no arquivo inteiro, manda também { id, progresso } (0 a 1) enquanto trabalha. */
self.onmessage = function (e) {
  var m = e.data, A = self.Amostra, tarefa;
  if (m.op === 'listarZip') {
    tarefa = A.leitura.listarZip(m.bytes);
  } else if (m.op === 'inteiro') {
    var ultimo = 0;
    tarefa = A.inteiro.processar(new Blob([m.bytes]), m.nome, m.modelo, {
      acoes: m.acoes,
      progresso: function (f) {
        var agora = Date.now();
        if (agora - ultimo < 150 && f < 1) return;
        ultimo = agora;
        self.postMessage({ id: m.id, progresso: f });
      }
    });
  } else {
    tarefa = A.leitura.abrirSeguro({ nome: m.nome, bytes: m.bytes }).then(function (arq) {
      A.detectar.analisarArquivo(arq);
      return arq;
    });
  }
  Promise.resolve(tarefa).then(function (res) {
    self.postMessage({ id: m.id, ok: true, res: res });
  }, function (err) {
    self.postMessage({
      id: m.id,
      ok: false,
      erro: {
        message: String((err && err.message) || err),
        tipo: err && err.tipo,
        detalhe: err && err.detalhe,
        amigavel: !!(err && err.amigavel)
      }
    });
  });
};
