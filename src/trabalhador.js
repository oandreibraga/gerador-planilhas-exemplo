/* Web Worker: lê e analisa a planilha fora da tela, para a página não travar com arquivos grandes.
   Roda depois do SheetJS e da biblioteca (os três textos viram um Blob em src/ui/app.js).
   Recebe { id, op, nome, bytes } e responde { id, ok, res } ou { id, ok: false, erro }. */
self.onmessage = function (e) {
  var m = e.data, A = self.Amostra;
  try {
    var res;
    if (m.op === 'listarZip') {
      res = A.leitura.listarZip(m.bytes);
    } else {
      res = A.leitura.abrir({ nome: m.nome, bytes: m.bytes });
      A.detectar.analisarArquivo(res);
    }
    self.postMessage({ id: m.id, ok: true, res: res });
  } catch (err) {
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
  }
};
