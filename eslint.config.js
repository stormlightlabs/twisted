import js from '@eslint/js'
import { vueTsConfigs, withVueTs } from '@vue/eslint-config-typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import unicorn from 'eslint-plugin-unicorn'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

const sourceFiles = ['**/*.{js,mjs,cjs,ts,mts,cts,vue}']

/** Flat ESLint configuration for Vue, TypeScript, tests, and Prettier. */
const config = withVueTs(
	{
		name: 'twisted/ignores',
		ignores: ['coverage/**', 'dist/**', 'node_modules/**', 'tests/e2e/screenshots/**', 'tests/e2e/videos/**'],
	},
	{ ...js.configs.recommended, name: 'twisted/javascript', files: ['**/*.{js,mjs,cjs}'] },
	pluginVue.configs['flat/essential'],
	vueTsConfigs.recommended,
	{
		name: 'twisted/unicorn',
		files: sourceFiles,
		plugins: { unicorn },
		rules: {
			'unicorn/error-message': 'error',
			'unicorn/new-for-builtins': 'error',
			'unicorn/no-abusive-eslint-disable': 'error',
			'unicorn/no-array-method-this-argument': 'error',
			'unicorn/no-document-cookie': 'error',
			'unicorn/no-empty-file': 'error',
			'unicorn/no-instanceof-array': 'error',
			'unicorn/no-invalid-fetch-options': 'error',
			'unicorn/no-invalid-remove-event-listener': 'error',
			'unicorn/no-new-buffer': 'error',
			'unicorn/no-object-as-default-parameter': 'error',
			'unicorn/no-static-only-class': 'error',
			'unicorn/no-thenable': 'error',
			'unicorn/no-typeof-undefined': 'error',
			'unicorn/no-unnecessary-await': 'error',
			'unicorn/no-useless-promise-resolve-reject': 'error',
			'unicorn/prefer-date-now': 'error',
			'unicorn/prefer-includes': 'error',
			'unicorn/prefer-node-protocol': 'error',
			'unicorn/prefer-number-properties': 'error',
			'unicorn/prefer-object-from-entries': 'error',
			'unicorn/prefer-optional-catch-binding': 'error',
			'unicorn/prefer-string-starts-ends-with': 'error',
			'unicorn/prefer-string-trim-start-end': 'error',
			'unicorn/prefer-type-error': 'error',
			'unicorn/require-number-to-fixed-digits-argument': 'error',
			'unicorn/throw-new-error': 'error',
		},
	},
	{
		name: 'twisted/project',
		files: sourceFiles,
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'no-console': 'off',
			'no-debugger': 'off',
			'vue/no-deprecated-slot-attribute': 'off',
		},
	},
	{
		name: 'twisted/cypress',
		files: ['tests/e2e/**/*.ts'],
		languageOptions: { globals: { ...globals.chai, ...globals.mocha, Cypress: 'readonly', cy: 'readonly' } },
	},
	eslintConfigPrettier,
)

export default config
