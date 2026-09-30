// Regrava test/integ/referencia.json. Use só quando uma mudança no resultado for intencional,
// e diga no commit o que mudou e por quê.
import fs from 'node:fs';
import path from 'node:path';
import { raiz } from '../test/apoio/ambiente.mjs';
import { fotografar, casos } from '../test/integ/fotografia.mjs';

const saida = {};
for (const { f, n, chave } of casos()) saida[chave] = fotografar(f, n);
fs.writeFileSync(path.join(raiz, 'test/integ/referencia.json'), JSON.stringify(saida));
console.log('Referência regravada: ' + Object.keys(saida).length + ' amostras.');
