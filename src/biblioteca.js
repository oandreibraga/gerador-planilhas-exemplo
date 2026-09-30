// Junta todos os módulos na ordem certa e expõe o objeto `Amostra` (usado pela página, pelo Worker e pelos testes).
import { A } from './nucleo/amostra.js';
import './dados/ptbr.js';
import './dados/cidades.js';
import './nucleo/util.js';
import './nucleo/detectar.js';
import './formatos/leitura.js';
import './nucleo/geradores.js';
import './formatos/amostra.js';
import './nucleo/resumo.js';
import './ui/app.js';

globalThis.Amostra = A;
export { A };
