import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", ".storage/**", ".pgdata/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 基本設計書 6.3 NF-S-06：XSS対策として禁止
      "react/no-danger": "error",
      // アバター画像はレイヤーを重ねる都合で <img> を使う
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
