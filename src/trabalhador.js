/* Web Worker: lê e analisa a planilha fora da tela, para a página não travar com arquivos grandes.
   Roda depois do SheetJS e da biblioteca (os três textos viram um Blob em src/ui/app.js).
   Recebe { id, op, nome, bytes } e responde { id, ok, res } ou { id, ok: false, erro }. */
self.onmessage = function (e) {
  var m = e.data, A = self.Amostra;
  var tarefa = m.op === 'listarZip'
    ? A.leitura.listarZip(m.bytes)
    : A.leitura.abrirSeguro({ nome: m.nome, bytes: m.bytes }).then(function (arq) {
      A.detectar.analisarArquivo(arq);
      return arq;
    });
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
