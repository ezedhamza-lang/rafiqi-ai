import babelParser from '@babel/eslint-parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    plugins: {
      'react-hooks': reactHooks
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-react']
        }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        process: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        speechSynthesis: 'readonly',
        performance: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        HTMLCanvasElement: 'readonly',
        requestAnimationFrame: 'readonly',
        crypto: 'readonly',
        MediaRecorder: 'readonly',
        HTMLElement: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    ignores: ['node_modules/', 'dist/']
  }
];
