module.exports = {
    singleQuote: true,
    trailingComma: 'es5',
    arrowParens: 'always',
    tabWidth: 4,
    printWidth: 120,
    overrides: [
        {
            files: ['*.yml'],
            options: {
                tabWidth: 2,
                parser: 'yaml',
            },
        },
    ],
};
