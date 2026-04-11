import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/zcoin-pay.ts",
  output: [
    {
      file: "dist/zcoin-pay.js",
      format: "umd",
      name: "ZcoinPayModule",
      exports: "named",
    },
    {
      file: "dist/zcoin-pay.esm.js",
      format: "es",
    },
  ],
  plugins: [
    typescript({ tsconfig: "./tsconfig.json" }),
  ],
};
