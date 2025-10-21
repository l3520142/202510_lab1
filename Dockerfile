# 使用 Ubuntu 24.04 作為基底映像
FROM ubuntu:24.04

# 必要的系統套件（可按需調整）；在此階段需要 root
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates sudo curl && \
    rm -rf /var/lib/apt/lists/*

# 建立非 root 使用者 (uid/gid 可依需求調整)
ARG USERNAME=dev
ARG USER_UID=1000
ARG USER_GID=1000

RUN groupadd --gid ${USER_GID} ${USERNAME} \
    && useradd --uid ${USER_UID} --gid ${USER_GID} -m ${USERNAME} -s /bin/bash \
    && mkdir -p /workspaces/202510_lab1 \
    && chown -R ${USERNAME}:${USERNAME} /workspaces/202510_lab1 \
    && echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${USERNAME} \
    && chmod 0440 /etc/sudoers.d/${USERNAME}

# 設定工作目錄（擁有權已指派給非 root 使用者）
WORKDIR /workspaces/202510_lab1

# COPY / RUN 等需要 root 的步驟應該放在上面區塊（若有）

# 最後切換到非 root 使用者（確保最後一個 USER 不是 root）
USER ${USERNAME}

# 預設指令（可按專案需求調整）
CMD ["sleep", "infinity"]