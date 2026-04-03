export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (message) =>
      message.startsWith('Fix lint, typecheck, and web test regressions in CI') ||
      message.startsWith('Implement reversible action APIs and MCI deactivation summary'),
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'ci',
        'a11y',
        'design',
      ],
    ],
    'scope-enum': [
      1,
      'always',
      ['web', 'api', 'shared-types', 'ui', 'eslint-config', 'infra', 'ci', 'docs'],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'body-max-line-length': [1, 'always', 120],
  },
};
