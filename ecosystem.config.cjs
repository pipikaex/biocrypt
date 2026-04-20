module.exports = {
  apps: [{
    name: "biocrypt-net",
    script: "packages/server/dist/main.js",
    cwd: "/home/dev/biocrypt-net",
    env: {
      PORT: 3100,
      INITIAL_DIFFICULTY_ZEROS: "9",
      DIFFICULTY_ADJUSTMENT_INTERVAL: "2016",
      TARGET_BLOCK_TIME_MS: "600000",
      DATA_DIR: "/home/dev/biocrypt-net/data",
      NETWORK_FEE_RATE: "0.1",
      NODE_ENV: "production",
    },
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    watch: false,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
  }],
};
