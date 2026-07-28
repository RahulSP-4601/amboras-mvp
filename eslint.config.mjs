import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      complexity: ["error", 10],
      "max-depth": ["error", 4],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      "no-console": "error",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      complexity: ["error", 10],
      "max-depth": ["error", 4],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      "no-console": "error",
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
