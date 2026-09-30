// Planilhas de exemplo com dados inventados (sementes fixas). Usadas pelo teste no navegador e pelos testes em Node.
// Precisa do SheetJS disponível como `XLSX` global.
import { RNG, pad, serialDe, partes, dataBR, dataISO, dataBRValida, numBR, r2, logUnif, ponderado, semAcentoT, igual, pct, log10, chaveN, quadro, dvCpfT, dvCnpjT, dvChaveT, cpfValidoT, cnpjValidoT, cpfT, cnpjT, mascCpf, mascCnpj, cp1252, bytesAleatorios, NOMES_T, SOBRENOMES_T, PALAVRAS_T, DDDS_T, RE_NOME, RE_EMAIL_T, frase, coluna } from './auxiliares.js';
// ================= planilhas de exemplo (dados inventados) =================
function definirVendas() {
  var R = RNG(20240601);
  var N = 150;
  var vendas = [
    coluna(N, 'Pedido', 's', null, { tipo: 'codigo', arm: 'texto' }, { t: 's', re: /^PED-\d{6}$/ }, function (i) { return 'PED-' + pad(4512 + i * 3, 6); }),
    coluna(N, 'Data do pedido', 'n', 'dd/mm/yyyy', { tipo: 'data', arm: 'nativo' }, { t: 'n', z: 'dd/mm/yyyy', inteiro: true, ordem: 'asc', data: true }, function (i) { return 45292 + Math.floor(i * 181 / N); }),
    coluna(N, 'Data (texto)', 's', null, { tipo: 'data', arm: 'texto' }, { t: 's', re: /^\d{2}\/\d{2}\/\d{4}$/, valida: dataBRValida }, function () { return dataBR(45292 + R.int(0, 365)); }),
    coluna(N, 'Cliente', 's', null, { tipo: 'pessoa', arm: 'texto' }, { t: 's', re: RE_NOME }, function () { return R.pick(NOMES_T) + ' ' + R.pick(SOBRENOMES_T); }),
    coluna(N, 'CPF', 's', null, { tipo: 'cpf', arm: 'texto' }, { t: 's', re: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/, valida: cpfValidoT }, function () { return mascCpf(cpfT(R)); }),
    coluna(N, 'CNPJ', 's', null, { tipo: 'cnpj', arm: 'texto' }, { t: 's', re: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, valida: cnpjValidoT }, function () { return mascCnpj(cnpjT(R)); }),
    coluna(N, 'Razão Social', 's', null, { tipo: 'empresa', arm: 'texto' }, { t: 's', re: /\S+ \S+/ }, function () {
      return R.pick(['Alfa', 'Beta', 'Gama', 'Delta', 'Ômega', 'Sigma', 'Zeta', 'Kappa', 'Lambda', 'Épsilon']) + ' ' +
        R.pick(['Comércio', 'Serviços', 'Distribuidora', 'Indústria', 'Logística']) + ' ' + R.pick(['Ltda', 'S.A.', 'ME', 'EIRELI']);
    }),
    coluna(N, 'E-mail', 's', null, { tipo: 'email', arm: 'texto' }, { t: 's', re: RE_EMAIL_T }, function (i) { return 'contato' + (1000 + i) + '@empresa-ficticia.com.br'; }),
    coluna(N, 'Telefone', 's', null, { tipo: 'telefone', arm: 'texto' }, { t: 's', re: /^\(\d{2}\) 9?\d{4}-\d{4}$/ }, function () {
      var d = R.pick(DDDS_T);
      return R.num() < 0.7 ? '(' + d + ') 9' + pad(R.int(0, 9999), 4) + '-' + pad(R.int(0, 9999), 4)
        : '(' + d + ') ' + R.int(2, 5) + pad(R.int(0, 999), 3) + '-' + pad(R.int(0, 9999), 4);
    }),
    coluna(N, 'CEP', 's', null, { tipo: 'cep', arm: 'texto' }, { t: 's', re: /^\d{5}-\d{3}$/ }, function () { return pad(R.int(1000, 99999), 5) + '-' + pad(R.int(0, 999), 3); }),
    coluna(N, 'Valor total', 'n', '"R$" #,##0.00', { tipo: 'moeda', arm: 'nativo' }, { t: 'n', z: '"R$" #,##0.00', casas: 2, grandeza: [10, 50000] }, function () { return r2(logUnif(R, 10, 50000)); }),
    coluna(N, 'Desconto', 'n', '0.0%', { tipo: 'percentual', arm: 'nativo' }, { t: 'n', z: '0.0%', casas: 3, entre: [0, 1] }, function () { return R.int(0, 50) * 5 / 1000; }),
    coluna(N, 'Quantidade', 'n', null, { tipo: 'inteiro', arm: 'nativo' }, { t: 'n', inteiro: true, grandeza: [1, 50] }, function () { return R.int(1, 50); }),
    coluna(N, 'Peso (kg)', 'n', '0.000', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '0.000', casas: 3, grandeza: [0.1, 500] }, function () { return Math.round(R.unif(0.1, 500) * 1000) / 1000; }),
    coluna(N, 'Preço unitário (texto)', 's', null, { tipo: 'decimal', arm: 'texto' }, { t: 's', re: /^\d{1,3}(\.\d{3})*,\d{2}$/ }, function () { return numBR(r2(R.unif(1, 5000)), 2); }),
    coluna(N, 'Hora da entrega', 'n', 'hh:mm', { tipo: 'hora', arm: 'nativo' }, { t: 'n', z: 'hh:mm', entre: [0, 1] }, function () { return R.int(480, 1080) / 1440; }),
    coluna(N, 'Registro', 'n', 'dd/mm/yyyy hh:mm:ss', { tipo: 'datahora', arm: 'nativo' }, { t: 'n', z: 'dd/mm/yyyy hh:mm:ss', data: true }, function () { return 45292 + R.int(0, 180) + R.int(0, 86399) / 86400; }),
    coluna(N, 'Status ', 's', null, { tipo: 'categoria', arm: 'texto' }, { t: 's', cat: true }, function () { return ponderado(R, [['Pago', 0.5], ['Pendente', 0.3], ['Cancelado', 0.15], ['Estornado', 0.05]]); }),
    coluna(N, 'Entregue?', 's', null, { tipo: 'simnao', arm: 'texto' }, { t: 's', simnao: true }, function () { return R.num() < 0.7 ? 'Sim' : 'Não'; }),
    coluna(N, 'Observação', 's', null, { tipo: 'texto', arm: 'texto' }, { t: 's', re: /\S/ }, function () { return R.num() < 0.3 ? null : frase(R, 4, 9); }),
    coluna(N, 'Coluna vazia', 's', null, { tipo: 'vazia' }, { vazia: true }, function () { return null; }),
    coluna(N, 'Nº da nota', 'n', null, { tipo: 'inteiro', arm: 'nativo' }, { t: 'n', inteiro: true, grandeza: [100000, 999999] }, function () { return R.num() < 0.2 ? null : R.int(100000, 999999); }),
    coluna(N, 'Faturamento anual', 'n', '#,##0', { tipo: 'inteiro', arm: 'nativo' }, { t: 'n', z: '#,##0', inteiro: true, grandeza: [100, 1e7], log: true }, function () { return Math.round(logUnif(R, 100, 1e7)); }),
    coluna(N, 'Saldo', 'n', '#,##0.00;[Red]-#,##0.00', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '#,##0.00;[Red]-#,##0.00', casas: 2, sinais: true }, function () { return R.num() < 0.3 ? -r2(R.unif(1, 5000)) : r2(R.unif(1, 20000)); }),
    coluna(N, 'Ativo', 'b', null, { tipo: 'simnao', arm: 'nativo' }, { t: 'b' }, function () { return R.num() < 0.8; })
  ];

  var NC = 120;
  var clientes = [
    coluna(NC, 'Código', 'n', null, { tipo: 'inteiro', arm: 'nativo' }, { t: 'n', inteiro: true, ordem: 'asc', acimaDe: 1120 }, function (i) { return 1001 + i; }),
    coluna(NC, 'Nome', 's', null, { tipo: 'pessoa', arm: 'texto' }, { t: 's', maiusculo: true, re: /^[A-ZÀ-Ý]+( [A-ZÀ-Ý]+)+$/ }, function () { return (R.pick(NOMES_T) + ' ' + R.pick(SOBRENOMES_T)).toUpperCase(); }),
    coluna(NC, 'E-mail', 's', null, { tipo: 'email', arm: 'texto' }, { t: 's', re: RE_EMAIL_T }, function (i) { return semAcentoT(R.pick(NOMES_T)).toLowerCase() + '.' + i + '@cliente-ficticio.com.br'; }),
    coluna(NC, 'Celular', 's', null, { tipo: 'telefone', arm: 'texto' }, { t: 's', re: /^\d{11}$/ }, function () { return R.pick(DDDS_T) + '9' + pad(R.int(0, 99999999), 8); }),
    coluna(NC, 'CPF', 's', null, { tipo: 'cpf', arm: 'texto' }, { t: 's', re: /^\d{11}$/, valida: cpfValidoT }, function () { return cpfT(R); }),
    coluna(NC, 'Nascimento', 's', null, { tipo: 'data', arm: 'texto' }, { t: 's', re: /^\d{4}-\d{2}-\d{2}$/ }, function () { return dataISO(serialDe(1950, 1, 1) + R.int(0, 20000)); }),
    coluna(NC, 'UF', 's', null, { tipo: 'uf', arm: 'texto' }, { t: 's', uf: true }, function () { return ponderado(R, [['SP', 0.4], ['RJ', 0.25], ['MG', 0.2], ['RS', 0.1], ['BA', 0.05]]); }),
    coluna(NC, 'Limite de crédito', 'n', '[$R$-416] #,##0.00', { tipo: 'moeda', arm: 'nativo' }, { t: 'n', z: '[$R$-416] #,##0.00', casas: 2 }, function () { return r2(R.unif(500, 50000)); }),
    coluna(NC, 'Cliente desde', 'n', 'mmm/yyyy', { tipo: 'data', arm: 'nativo' }, { t: 'n', z: 'mmm/yyyy', inteiro: true, data: true }, function () { return serialDe(R.int(2015, 2024), R.int(1, 12), 1); }),
    coluna(NC, 'Score', 'n', null, { tipo: 'decimal', arm: 'nativo' }, { t: 'n', casas: 1, grandeza: [0.1, 10] }, function () { return Math.round(R.unif(0.1, 10) * 10) / 10; })
  ];

  var NR = 6;
  var resumo = [
    coluna(NR, 'Mês', 'n', 'mmm/yy', { tipo: 'data', arm: 'nativo' }, { t: 'n', z: 'mmm/yy', inteiro: true, data: true }, function (i) { return serialDe(2024, i + 1, 1); }),
    coluna(NR, 'Pedidos', 'n', '#,##0', { tipo: 'inteiro', arm: 'nativo' }, { t: 'n', z: '#,##0', inteiro: true, grandeza: [100, 900] }, function () { return R.int(100, 900); }),
    coluna(NR, 'Receita', 'n', '"R$" #,##0.00', { tipo: 'moeda', arm: 'nativo' }, { t: 'n', z: '"R$" #,##0.00', casas: 2 }, function () { return r2(R.unif(20000, 90000)); }),
    coluna(NR, 'Ticket médio', 'n', '#,##0.00', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '#,##0.00', casas: 2 }, function () { return r2(R.unif(80, 300)); })
  ];

  var NA = 15;
  var usuarios = ['Ana Silva', 'Bruno Costa', 'Helena Lima', 'Pedro Gomes'];
  var auditoria = [
    coluna(NA, 'Evento', 's', null, { tipo: 'categoria', arm: 'texto' }, { t: 's', cat: true }, function (i) { return ['Login', 'Logout', 'Exportação'][i % 3]; }),
    coluna(NA, 'Usuário', 's', null, { tipo: 'pessoa', arm: 'texto' }, { t: 's', re: RE_NOME }, function () { return R.pick(usuarios); }),
    coluna(NA, 'Quando', 'n', 'dd/mm/yyyy hh:mm', { tipo: 'datahora', arm: 'nativo' }, { t: 'n', z: 'dd/mm/yyyy hh:mm', data: true }, function (i) { return 45292 + i * 0.37; })
  ];

  var NM = 20000;
  var movimentos = [
    coluna(NM, 'ID', 'n', null, { tipo: 'inteiro', arm: 'nativo' }, { t: 'n', inteiro: true, acimaDe: NM }, function (i) { return i + 1; }),
    coluna(NM, 'Data', 'n', 'dd/mm/yyyy', { tipo: 'data', arm: 'nativo' }, { t: 'n', z: 'dd/mm/yyyy', inteiro: true, ordem: 'asc', data: true }, function (i) { return 45292 + Math.floor(i * 366 / NM); }),
    coluna(NM, 'Conta', 's', null, { tipo: 'codigo', arm: 'texto' }, { t: 's', re: /^CC-\d{5}$/ }, function () { return 'CC-' + pad(R.int(0, 99999), 5); }),
    coluna(NM, 'Tipo', 's', null, { tipo: 'categoria', arm: 'texto' }, { t: 's', cat: true }, function () { return R.num() < 0.6 ? 'Crédito' : 'Débito'; }),
    coluna(NM, 'Valor', 'n', '#,##0.00', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '#,##0.00', casas: 2 }, function () { return r2(R.unif(1, 100000)); }),
    coluna(NM, 'Histórico', 's', null, { tipo: 'texto', arm: 'texto' }, { t: 's', re: /\S/ }, function () { return frase(R, 3, 7); })
  ];

  return {
    nome: 'vendas_exemplo.xlsx',
    abas: [
      {
        nome: 'Vendas', oculta: 0, cab: 3, colInicio: 0,
        acima: [['Relatório de Vendas — Empresa Fictícia Ltda'], ['Período: 01/01/2024 a 30/06/2024'], []],
        merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }],
        cols: [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 16 }],
        colunas: vendas
      },
      { nome: 'Clientes', oculta: 0, cab: 0, colInicio: 0, colunas: clientes },
      {
        nome: 'Resumo', oculta: 0, cab: 1, colInicio: 1,
        acima: [[null, 'Resumo mensal — valores fictícios']],
        merges: [{ s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }],
        colunas: resumo
      },
      { nome: 'Auditoria', oculta: 1, cab: 0, colInicio: 0, colunas: auditoria },
      { nome: 'Movimentos', oculta: 0, cab: 0, colInicio: 0, colunas: movimentos, amostra: 500 },
      { nome: 'Notas', oculta: 0, cab: -1, colunas: [] }
    ]
  };
}

function definirCsv() {
  var R = RNG(777);
  var N = 40;
  var nomes = [], emails = [], tels = [], datas = [], salarios = [], cidades = [], ativos = [], obs = [];
  var serials = [], salNum = [];
  var linhasCsv = [];
  for (var i = 0; i < N; i++) {
    var nome = R.pick(NOMES_T) + ' ' + R.pick(SOBRENOMES_T);
    var email = semAcentoT(nome).toLowerCase().replace(/ /g, '.') + i + '@exemplo-ficticio.com.br';
    var tel = '(21) 9' + pad(R.int(0, 9999), 4) + '-' + pad(R.int(0, 9999), 4);
    var serial = serialDe(1960, 1, 1) + R.int(0, 15000);
    var sal = r2(R.unif(1500, 25000));
    var cidade = ponderado(R, [['São Paulo', 0.4], ['Belo Horizonte', 0.3], ['Curitiba', 0.2], ['Florianópolis', 0.1]]);
    var ativo = R.num() < 0.75 ? 'S' : 'N';
    var ob = R.num() < 0.5 ? null : frase(R, 3, 6) + '; ligar após 18h';
    nomes.push(nome); emails.push(email); tels.push(tel); datas.push(dataBR(serial)); serials.push(serial);
    salarios.push(numBR(sal, 2)); salNum.push(sal); cidades.push(cidade); ativos.push(ativo); obs.push(ob);
    linhasCsv.push([nome, email, tel, dataBR(serial), numBR(sal, 2), cidade, ativo, ob == null ? '' : '"' + ob + '"'].join(';'));
  }
  var cab = ['Nome', 'E-mail', 'Telefone', 'Data de nascimento', 'Salário', 'Cidade', 'Ativo', 'Observação'];
  var texto = cab.join(';') + '\r\n' + linhasCsv.join('\r\n') + '\r\n';
  function col(nome, valores, esp, saida, reaisNum) { return { nome: nome, valores: valores, esp: esp, saida: saida, reaisNum: reaisNum }; }
  return {
    nome: 'contatos_exemplo.csv',
    bytes: cp1252(texto),
    abas: [{
      nome: 'contatos_exemplo', oculta: 0, cab: 0, colInicio: 0,
      colunas: [
        col('Nome', nomes, { tipo: 'pessoa', arm: 'texto' }, { t: 's', re: RE_NOME }),
        col('E-mail', emails, { tipo: 'email', arm: 'texto' }, { t: 's', re: RE_EMAIL_T }),
        col('Telefone', tels, { tipo: 'telefone', arm: 'texto' }, { t: 's', re: /^\(\d{2}\) 9\d{4}-\d{4}$/ }),
        col('Data de nascimento', datas, { tipo: 'data', arm: 'nativo' }, { t: 'n', z: 'dd/mm/yyyy', inteiro: true, data: true }, serials),
        col('Salário', salarios, { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '#,##0.00', casas: 2, grandeza: [1500, 25000] }, salNum),
        col('Cidade', cidades, { tipo: 'cidade', arm: 'texto' }, { t: 's', cidade: true }),
        col('Ativo', ativos, { tipo: 'simnao', arm: 'texto' }, { t: 's', simnao: true }),
        col('Observação', obs, { tipo: 'texto', arm: 'texto' }, { t: 's', re: /\S/ })
      ]
    }]
  };
}

// Formato de uma exportação de CT-e: cidades e UF ligadas, origem que vem em blocos, 0 fixo e flag 0/1.
function definirFretes() {
  var R = RNG(90210);
  var N = 200;
  var lugares = [['SAO JOSE DO RIO PRETO', 'SP'], ['BIRIGUI', 'SP'], ['ITUIUTABA', 'MG'], ['PALMITAL', 'SP'], ['ARACATUBA', 'SP'],
    ['BRASILIA', 'DF'], ['NEOPOLIS', 'SE'], ['MACEIO', 'AL'], ['JOAO PESSOA', 'PB'], ['JEQUIE', 'BA'], ['JABOATAO DOS GUARARAPES', 'PE'],
    ['CAMPINAS', 'SP'], ['RIBEIRAO PRETO', 'SP'], ['UBERLANDIA', 'MG'], ['GOIANIA', 'GO'], ['RECIFE', 'PE'], ['SALVADOR', 'BA'],
    ['CURITIBA', 'PR'], ['LONDRINA', 'PR'], ['JOINVILLE', 'SC'], ['PORTO ALEGRE', 'RS'], ['MANAUS', 'AM'], ['FORTALEZA', 'CE']];
  var NOMES_UF = { SP: 'São Paulo', MG: 'Minas Gerais', DF: 'Distrito Federal', SE: 'Sergipe', AL: 'Alagoas', PB: 'Paraíba', BA: 'Bahia',
    PE: 'Pernambuco', GO: 'Goiás', PR: 'Paraná', SC: 'Santa Catarina', RS: 'Rio Grande do Sul', AM: 'Amazonas', CE: 'Ceará' };
  var CFOPS = [5352, 6352, 5353, 6353, 5932, 6932, 5351, 6351, 5357, 6357, 5360, 6360, 5949, 6949];
  var RUAS = ['RUA DAS PALMEIRAS', 'AV BRASIL', 'RUA SETE DE SETEMBRO', 'AVENIDA PAULISTA', 'RUA XV DE NOVEMBRO', 'TRAVESSA DO COMERCIO', 'RUA DOM PEDRO II', 'AV GETULIO VARGAS'];
  var BAIRROS = ['CENTRO', 'JARDIM AMERICA', 'VILA NOVA', 'PARQUE INDUSTRIAL', 'JARDIM EUROPA', 'VILA MARIANA', 'DISTRITO INDUSTRIAL', 'BOA VISTA'];
  function letra() { return String.fromCharCode(65 + R.int(0, 25)); }
  function chaveCte() {
    var c = '35' + '24' + pad(R.int(1, 12), 2) + cnpjT(R) + '57' + '001' + pad(R.int(0, 999999999), 9) + '1' + pad(R.int(0, 99999999), 8);
    return c + dvChaveT(c);
  }
  var linhas = [], ori = R.pick(lugares), iguais = 0;
  for (var i = 0; i < N; i++) {
    if (R.num() < 0.1) ori = R.pick(lugares);
    var dst = R.num() < 0.1 ? ori : R.pick(lugares);
    if (dst === ori) iguais++;
    var tipo = R.num() < 0.2 ? 'MINUTA' : 'CTRC/CTE';
    var emissao = 45292 + R.int(0, 180), qtd = R.int(1, 40), unit = r2(R.unif(5, 500)), frete = r2(R.unif(20, 2000)), icms = r2(R.unif(1, 200));
    linhas.push({
      tipo: tipo, ori: ori, dst: dst, sel: R.num() < 0.4 ? 1 : 0, nr: 150000 + i * 3 + R.int(0, 2), peso: Math.round(R.unif(0.5, 400) * 10) / 10,
      chave: chaveCte(), cfop: R.pick(CFOPS),
      placa: letra() + letra() + letra() + R.int(0, 9) + (R.num() < 0.5 ? letra() : String(R.int(0, 9))) + pad(R.int(0, 99), 2),
      emissao: emissao, entrega: emissao + R.int(0, 10), qtd: qtd, unit: unit, merc: r2(qtd * unit), frete: frete, icms: icms, total: r2(frete + icms),
      doc: tipo === 'MINUTA' ? 'MIN-' + pad(R.int(0, 9999), 4) : 'CTE-' + pad(R.int(0, 999999), 6),
      estado: NOMES_UF[dst[1]], endereco: R.pick(RUAS) + ', ' + R.int(1, 2500), bairro: R.pick(BAIRROS) + (R.num() < 0.5 ? '' : ' ' + R.int(1, 9))
    });
  }
  function col(nome, t, z, esp, saida, f) { return coluna(N, nome, t, z, esp, saida, function (i) { return f(linhas[i]); }); }
  return {
    nome: 'fretes_exemplo.xlsx',
    abas: [{
      nome: 'Fretes', oculta: 0, cab: 0, colInicio: 0,
      igualdade: { base: 1, dep: 3, taxa: iguais / N },
      colunas: [
        col('Tipo Doc', 's', null, { tipo: 'categoria', arm: 'texto' }, { t: 's', cat: true }, function (l) { return l.tipo; }),
        col('Cid Origem Prestação', 's', null, { tipo: 'cidade', arm: 'texto' }, { t: 's', cidade: true, maiusculo: true }, function (l) { return l.ori[0]; }),
        col('UF Origem Prestação', 's', null, { tipo: 'uf', arm: 'texto' }, { t: 's', ufDe: 1 }, function (l) { return l.ori[1]; }),
        col('Cid Destino Prestação', 's', null, { tipo: 'cidade', arm: 'texto' }, { t: 's', cidade: true, maiusculo: true }, function (l) { return l.dst[0]; }),
        col('UF Destino Prestação', 's', null, { tipo: 'uf', arm: 'texto' }, { t: 's', ufDe: 3 }, function (l) { return l.dst[1]; }),
        col('CTe Globalizado', 'n', null, { tipo: 'constante', arm: 'texto' }, { t: 'n', fixo: 0 }, function () { return 0; }),
        col('Selecionar', 'n', null, { tipo: 'categoria', arm: 'texto' }, { t: 'n', cat: true }, function (l) { return l.sel; }),
        col('Nr CTe', 'n', null, { tipo: 'inteiro', arm: 'nativo' }, { t: 'n', inteiro: true, ordem: 'asc' }, function (l) { return l.nr; }),
        col('Peso Real', 'n', null, { tipo: 'decimal', arm: 'nativo' }, { t: 'n', casas: 1, grandeza: [0.5, 400] }, function (l) { return l.peso; }),
        col('Chave CT-e', 's', null, { tipo: 'chave', arm: 'texto' }, { t: 's', chave: '57' }, function (l) { return l.chave; }),
        col('CFOP', 'n', null, { tipo: 'categoria', arm: 'texto' }, { t: 'n', cat: true }, function (l) { return l.cfop; }),
        col('Placa', 's', null, { tipo: 'codigo', arm: 'texto' }, { t: 's', re: /^[A-Z]{3}\d[A-Z0-9]\d{2}$/ }, function (l) { return l.placa; }),
        col('Dt Emissão', 'n', 'dd/mm/yyyy', { tipo: 'data', arm: 'nativo' }, { t: 'n', z: 'dd/mm/yyyy', inteiro: true, data: true }, function (l) { return l.emissao; }),
        col('Dt Entrega', 'n', 'dd/mm/yyyy', { tipo: 'data', arm: 'nativo' }, { t: 'n', z: 'dd/mm/yyyy', inteiro: true, data: true, depoisDe: 12 }, function (l) { return l.entrega; }),
        col('Qtd Volumes', 'n', null, { tipo: 'inteiro', arm: 'nativo' }, { t: 'n', inteiro: true }, function (l) { return l.qtd; }),
        col('Vlr Unit', 'n', '#,##0.00', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '#,##0.00', casas: 2 }, function (l) { return l.unit; }),
        col('Vlr Mercadoria', 'n', '#,##0.00', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '#,##0.00', casas: 2, conta: ['produto', 14, 15] }, function (l) { return l.merc; }),
        col('Vlr Frete', 'n', '#,##0.00', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '#,##0.00', casas: 2 }, function (l) { return l.frete; }),
        col('Vlr ICMS', 'n', '#,##0.00', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '#,##0.00', casas: 2 }, function (l) { return l.icms; }),
        col('Vlr Total Prestação', 'n', '#,##0.00', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', z: '#,##0.00', casas: 2, conta: ['soma', 17, 18] }, function (l) { return l.total; }),
        col('Nr Doc', 's', null, { tipo: 'codigo', arm: 'texto' }, { t: 's', formatoDe: { cat: 0, mapa: { 'MINUTA': /^MIN-\d{4}$/, 'CTRC/CTE': /^CTE-\d{6}$/ } } }, function (l) { return l.doc; }),
        col('Estado Destino', 's', null, { tipo: 'uf', arm: 'texto' }, { t: 's', ufDe: 3 }, function (l) { return l.estado; }),
        col('Endereço Entrega', 's', null, { tipo: 'endereco', arm: 'texto' }, { t: 's', maiusculo: true, re: /^(RUA|AV|AVENIDA|TRAVESSA) .+, \d+$/ }, function (l) { return l.endereco; }),
        col('Bairro Entrega', 's', null, { tipo: 'bairro', arm: 'texto' }, { t: 's', maiusculo: true, re: /\S/ }, function (l) { return l.bairro; })
      ]
    }]
  };
}

function definirXls() {
  var R = RNG(4242);
  var N = 30;
  return {
    nome: 'legado_exemplo.xls',
    abas: [{
      nome: 'Plan1', oculta: 0, cab: 1, colInicio: 0,
      acima: [['Cadastro de produtos (fictício)']],
      merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }],
      colunas: [
        coluna(N, 'Código', 's', null, { tipo: 'codigo', arm: 'texto' }, { t: 's', re: /^AB-\d{4}$/ }, function (i) { return 'AB-' + pad(1000 + i * 7, 4); }),
        coluna(N, 'Descrição', 's', null, { tipo: 'texto', arm: 'texto' }, { t: 's', re: /\S/ }, function () { return frase(R, 2, 5); }),
        coluna(N, 'Valor', 'n', '#,##0.00', { tipo: 'decimal', arm: 'nativo' }, { t: 'n', casas: 2 }, function () { return r2(R.unif(5, 900)); }),
        coluna(N, 'Data', 'n', 'dd/mm/yyyy', { tipo: 'data', arm: 'nativo' }, { t: 'n', inteiro: true, data: true }, function () { return 44927 + R.int(0, 700); })
      ]
    }]
  };
}

function montarAbaFixture(a) {
  var ws = {}, maxR = 0, maxC = 0, tem = false;
  function por(r, c, cel) {
    ws[XLSX.utils.encode_cell({ r: r, c: c })] = cel;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
    tem = true;
  }
  (a.acima || []).forEach(function (linha, r) {
    linha.forEach(function (v, c) { if (v != null) por(r, c, { t: 's', v: v }); });
  });
  (a.colunas || []).forEach(function (col, j) {
    var c = (a.colInicio || 0) + j;
    por(a.cab, c, { t: 's', v: col.nome });
    col.valores.forEach(function (v, i) {
      if (v == null) return;
      var cel = { t: col.t, v: v };
      if (col.z) cel.z = col.z;
      por(a.cab + 1 + i, c, cel);
    });
  });
  ws['!ref'] = tem ? XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } }) : 'A1';
  if (a.merges) ws['!merges'] = a.merges;
  if (a.cols) ws['!cols'] = a.cols;
  return ws;
}

function escreverPlanilha(def, bookType) {
  var wb = { SheetNames: [], Sheets: {} };
  def.abas.forEach(function (a) {
    wb.SheetNames.push(a.nome);
    wb.Sheets[a.nome] = montarAbaFixture(a);
  });
  wb.Workbook = { Sheets: def.abas.map(function (a) { return { name: a.nome, Hidden: a.oculta || 0 }; }) };
  return new Uint8Array(XLSX.write(wb, { bookType: bookType || 'xlsx', type: 'array' }));
}

function arquivoComSenha() {
  var cfb = XLSX.CFB.utils.cfb_new();
  var info = new Uint8Array(64);
  info[0] = 4; info[2] = 3; // EncryptionInfo versão 4.3 (ECMA-376 extensível)
  XLSX.CFB.utils.cfb_add(cfb, '/EncryptionInfo', info);
  XLSX.CFB.utils.cfb_add(cfb, '/EncryptedPackage', bytesAleatorios(2048, 99));
  var out = XLSX.CFB.write(cfb, { type: 'array' });
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

function montarZip(arquivos) {
  var cfb = XLSX.CFB.utils.cfb_new();
  arquivos.forEach(function (a) { XLSX.CFB.utils.cfb_add(cfb, '/' + a[0], a[1]); });
  var out = XLSX.CFB.write(cfb, { fileType: 'zip', type: 'array', compression: true });
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

var FIX = null;
// Descarta as planilhas montadas (a próxima chamada de fixtures() monta de novo).
function redefinirFixtures() { FIX = null; }
function fixtures() {
  if (FIX) return FIX;
  var t0 = performance.now();
  var vendas = definirVendas();
  vendas.bytes = escreverPlanilha(vendas, 'xlsx');
  var csv = definirCsv();
  var fretes = definirFretes();
  fretes.bytes = escreverPlanilha(fretes, 'xlsx');
  var xls = definirXls();
  xls.bytes = escreverPlanilha(xls, 'biff8');
  var texto = new TextEncoder().encode('arquivo de texto que não é planilha');
  var zips = {
    varias: { nome: 'planilhas_exemplo.zip', bytes: montarZip([['vendas_exemplo.xlsx', vendas.bytes], ['entrada/contatos_exemplo.csv', csv.bytes], ['leia-me.txt', texto], ['__MACOSX/._vendas_exemplo.xlsx', texto], ['~$vendas_exemplo.xlsx', texto]]) },
    uma: { nome: 'so_fretes.zip', bytes: montarZip([['fretes_exemplo.xlsx', fretes.bytes], ['leia-me.txt', texto]]) },
    nenhuma: { nome: 'sem_planilha.zip', bytes: montarZip([['leia-me.txt', texto]]) }
  };
  var zipQuebrado = bytesAleatorios(4096, 5);
  zipQuebrado[0] = 0x50; zipQuebrado[1] = 0x4B; zipQuebrado[2] = 3; zipQuebrado[3] = 4;
  FIX = {
    vendas: vendas,
    fretes: fretes,
    zips: zips,
    csv: csv,
    xls: xls,
    senha: { nome: 'senha_exemplo.xlsx', bytes: arquivoComSenha() },
    corrompido: { nome: 'corrompido.xlsx', bytes: bytesAleatorios(4096, 7) },
    zipQuebrado: { nome: 'corrompido_zip.xlsx', bytes: zipQuebrado },
    ms: performance.now() - t0
  };
  return FIX;
}


export { definirVendas, definirCsv, definirFretes, definirXls, montarAbaFixture, escreverPlanilha, arquivoComSenha, montarZip, fixtures, redefinirFixtures };
