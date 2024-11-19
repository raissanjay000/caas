module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'scope-empty': [2, 'never'], // require scope
        'scope-pattern': [2, 'always', /^MWPW-\d+$/], // enforce MWPW-numbers ONLY in scope
        'header-pattern': [2, 'always', /^(?:feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert)\(MWPW-\d+\):/], // stricter header pattern
    },
};
