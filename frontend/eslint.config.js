import babelParser from '@babel/eslint-parser';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';

export default [
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    plugins: {
      'react-hooks': reactHooks,
      react
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
      // إصلاح (27-08-2026): بلا eslint-plugin-react، قاعدة no-unused-vars
      // الأساسية لا "تفهم" أن <MyComponent /> يعني استعمالاً للمتغيّر
      // MyComponent، فكانت تُبلّغ خطأً عن عشرات المكوّنات المُستعملة فعلاً
      // في JSX باعتبارها "غير مستخدمة" (خصوصاً في StudentSpace.jsx و
      // TeacherDashboard.jsx و SuperAdminDashboard.jsx وStoryExercises.jsx).
      // قاعدة react/jsx-uses-vars تُصلح هذا بإعلام no-unused-vars بأن أي
      // معرّف يُستعمل كوسم JSX يُعتبر "مُستعملاً".
      'react/jsx-uses-vars': 'warn',
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
