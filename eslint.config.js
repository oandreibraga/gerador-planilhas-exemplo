// Regras de código. No código do app (src/) ficam proibidas as APIs que poderiam mandar dados para fora
// do computador, executar texto como código ou montar HTML a partir de texto.
import js from '@eslint/js';
import globals from 'globals';

const REDE = 'O app não pode acessar a rede: tudo roda no computador de quem usa.';

export default [
  {
    ignores: ['node_modules/', '.ferramentas/', '.npm-cache/', 'dist/', 'vendor/', 'test/saida/', 'test/fixtures/arquivos/',
      'test-results/', 'playwright-report/', 'temas-internos/', 'fonte/', 'testes/']
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-useless-escape': 'off', // barras extras em regex não mudam o comportamento
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  },
  {
    files: ['src/**/*.js', 'test/navegador/**/*.js', 'test/fixtures/**/*.js'],
    languageOptions: { globals: { ...globals.browser, XLSX: 'readonly' } }
  },
  {
    files: ['src/trabalhador.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.worker } }
  },
  {
    files: ['src/**/*.js'],
    rules: {
      'no-restricted-globals': ['error',
        { name: 'fetch', message: REDE }, { name: 'XMLHttpRequest', message: REDE }, { name: 'WebSocket', message: REDE },
        { name: 'EventSource', message: REDE }, { name: 'RTCPeerConnection', message: REDE }, { name: 'importScripts', message: REDE },
        { name: 'localStorage', message: 'Nada do arquivo pode ficar guardado no navegador.' },
        { name: 'sessionStorage', message: 'Nada do arquivo pode ficar guardado no navegador.' },
        { name: 'indexedDB', message: 'Nada do arquivo pode ficar guardado no navegador.' }
      ],
      'no-restricted-properties': ['error',
        { object: 'navigator', property: 'sendBeacon', message: REDE },
        { object: 'window', property: 'open', message: 'Abrir outra janela pode levar a um endereço externo.' },
        { object: 'document', property: 'write', message: 'Use h() e textContent.' },
        { property: 'innerHTML', message: 'Use h() e textContent (o único uso permitido é o dos ícones fixos).' },
        { property: 'outerHTML', message: 'Use h() e textContent.' },
        { property: 'insertAdjacentHTML', message: 'Use h() e textContent.' }
      ]
    }
  },
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.js', 'playwright.config.mjs'],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ['test/e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  }
];
