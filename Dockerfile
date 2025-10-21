# 使用輕量級的 Nginx Alpine 映像
FROM nginx:alpine

# 維護者資訊
LABEL org.opencontainers.image.source="https://github.com/YOUR_USERNAME/YOUR_REPO"
LABEL org.opencontainers.image.description="井字遊戲 - 靜態網頁應用"
LABEL org.opencontainers.image.licenses="MIT"

# 安裝必要套件（已存在）
RUN apk add --no-cache pcre2=10.46-r0

# 移除預設的 Nginx 網頁
RUN rm -rf /usr/share/nginx/html/*

# 複製靜態檔案到 Nginx 目錄
COPY app/ /usr/share/nginx/html/

# 建立自訂的 Nginx 配置（監聽 8080 端口以支援非 root 用戶）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 修改 Nginx 配置以支援非 root 用戶運行
RUN sed -i 's/listen\s*80;/listen 8080;/g' /etc/nginx/conf.d/default.conf && \
    sed -i 's/listen\s*\[::\]:80;/listen [::]:8080;/g' /etc/nginx/conf.d/default.conf && \
    sed -i '/user\s*nginx;/d' /etc/nginx/nginx.conf && \
    sed -i 's,/var/run/nginx.pid,/tmp/nginx.pid,' /etc/nginx/nginx.conf && \
    sed -i "/^http {/a \    proxy_temp_path /tmp/proxy_temp;\n    client_body_temp_path /tmp/client_temp;\n    fastcgi_temp_path /tmp/fastcgi_temp;\n    uwsgi_temp_path /tmp/uwsgi_temp;\n    scgi_temp_path /tmp/scgi_temp;\n" /etc/nginx/nginx.conf

# 建立非 root 使用者並設定資料夾權限，確保 Nginx 在非 root 下可寫入必要路徑
RUN addgroup -S appgroup && adduser -S -G appgroup appuser && \
    mkdir -p /var/cache/nginx /tmp && \
    chown -R appuser:appgroup /usr/share/nginx/html /var/cache/nginx /tmp

# 切換為非 root 使用者執行（修正 missing USER）
USER appuser

# 暴露 8080 端口（非特權端口）
EXPOSE 8080

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]