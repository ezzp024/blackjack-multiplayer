module.exports = {
  apps: [{
    name: 'obsidian-casino',
    script: './server.js',
    watch: false,
    autorestart: true,
    max_restarts: 20,
    restart_delay: 3000,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
  }]
};
