module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'scope-enum': [2, 'always', []], // disable default scope enum check
        'scope-pattern': [2, 'always', /MWPW-\d+/], // enforce MWPW-numbers in scope
    }
};
