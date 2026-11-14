import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypeScript,
  {
    ignores: [".next/**", "coverage/**", "node_modules/**", "next-env.d.ts", "mobile/**"],
  },
];

export default config;
