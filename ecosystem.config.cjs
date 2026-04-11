module.exports = {
  apps: [{
    name: "zcoin-bio",
    script: "packages/server/dist/main.js",
    cwd: "/home/dev/zcoin.bio",
    env: {
      PORT: 3100,
      INITIAL_DIFFICULTY_ZEROS: "5",
      DIFFICULTY_ADJUSTMENT_INTERVAL: "10",
      TARGET_BLOCK_TIME_MS: "60000",
      DATA_DIR: "/home/dev/zcoin.bio/data",
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
