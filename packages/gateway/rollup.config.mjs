import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/biocrypt-pay.ts",
  output: [
    {
      file: "dist/biocrypt-pay.js",
      format: "umd",
      name: "BiocryptPayModule",
      exports: "named",
    },
    {
      file: "dist/biocrypt-pay.esm.js",
      format: "es",
    },
  ],
  plugins: [
    typescript({ tsconfig: "./tsconfig.json" }),
  ],
};
