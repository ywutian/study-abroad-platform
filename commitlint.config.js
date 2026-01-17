module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only
        'style', // Formatting, no code change
        'refactor', // Code restructuring
        'perf', // Performance improvement
        'test', // Adding/fixing tests
        'build', // Build system / dependencies
        'ci', // CI/CD changes
        'chore', // Maintenance tasks
        'revert', // Revert previous commit
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
