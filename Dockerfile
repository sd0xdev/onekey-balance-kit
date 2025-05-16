FROM node:22-slim AS builder

WORKDIR /app

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 複製 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 複製 tsconfig 和 nest 配置
COPY tsconfig*.json nest-cli.json ./

# 安裝依賴
RUN pnpm install --frozen-lockfile

# 複製源代碼
COPY src/ ./src/

# 建置應用
RUN pnpm build

# 第二階段：運行環境
FROM node:22-slim AS runner

WORKDIR /app

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 非 root 用戶運行應用
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r nodejs && useradd -r -g nodejs nodejs

# 定義運行時環境變數
ENV NODE_ENV production

# 從建置階段複製必要文件
COPY --from=builder --chown=nodejs:nodejs /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# 使用非 root 用戶
USER nodejs

# 使用 dumb-init 處理信號
ENTRYPOINT ["dumb-init", "--"]

# 默認命令
CMD ["node", "dist/main"]

# 暴露應用端口
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
