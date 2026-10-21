---
title: "Terraformとcloud-initでProxmox監視環境の構築を自動化"
description: "Proxmox VM作成時にTerraformとcloud-initを利用し、Prometheus、Grafana、Lokiなどの監視スタックをDocker Composeで自動デプロイする一連の設定プロセスを解説します。"
date: 2026-10-21
tags: [Automation, Tech, Cloud, Serverless]
---

# Terraformとcloud-initでProxmox監視環境の構築を自動化

::: tip 1行要約
Terraformの`proxmox_virtual_environment_file`リソースを使ってcloud-initスクリプトを注入し、Proxmox VM作成と同時にDockerベースのPrometheus、Grafana監視スタックを自動デプロイします。
:::

## 概要

Proxmox環境でテスト用の仮想マシンラボを構築する際、監視サーバー（`vm1-monitor`）の構築を自動化するためにTerraformとcloud-initを使用しました。VM作成時にcloud-initスクリプトが実行され、Dockerのインストール、設定ファイルの作成、そしてDocker Composeを使った監視サービス（Prometheus、Grafana、Loki、Node Exporter）の起動まで、すべてのプロセスを処理します。

## Terraformとcloud-initの設定分析

ポイントは、`proxmox_virtual_environment_file`リソースを使ってcloud-init設定ファイル（`user-data-monitor.yaml`）をProxmoxのスニペットとして保存し、これをVM作成時に適用することです。

以下は、`vm1-monitor` VMに適用されたcloud-initスクリプト全体です。

```yaml
#cloud-config
hostname: vm1-monitor
fqdn: vm1-monitor.lab
manage_etc_hosts: true
users:
  - name: root
    ssh_authorized_keys:
      - "ssh-ed25519..."
chpasswd:
  list: |
    root:password
  expire: false
package_update: true
packages:
  - curl
  - tar
  - wget
  - dnf-plugins-core

write_files:
  - path: /opt/monitoring/prometheus.yml
    permissions: '0644'
    content: |
      global:
        scrape_interval: 5s
      scrape_configs:
        - job_name: 'proxmox-cluster'
          static_configs:
            - targets: ['10.0.0.100:9100']
              labels:
                instance: 'vm1-monitor'
            - targets: ['10.0.0.101:9100']
              labels:
                instance: 'vm2-lb'
            - targets: ['10.0.0.102:9100']
              labels:
                instance: 'vm3-web1'
            - targets: ['10.0.0.103:9100']
              labels:
                instance: 'vm4-web2'
            - targets: ['10.0.0.104:9100']
              labels:
                instance: 'vm5-data'

  - path: /opt/monitoring/provisioning/datasources/datasources.yml
    permissions: '0644'
    content: |
      apiVersion: 1
      datasources:
        - name: Prometheus
          type: prometheus
          access: proxy
          url: http://prometheus:9090
          isDefault: true
        - name: Loki
          type: loki
          access: proxy
          url: http://loki:3100

  - path: /opt/monitoring/docker-compose.yml
    permissions: '0644'
    content: |
      version: '3.8'
      services:
        prometheus:
          image: prom/prometheus:latest
          container_name: prometheus
          restart: always
          volumes:
            - /opt/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
          ports:
            - "9090:9090"
          networks:
            - monitoring

        loki:
          image: grafana/loki:latest
          container_name: loki
          restart: always
          ports:
            - "3100:3100"
          command: -config.file=/etc/loki/local-config.yaml
          networks:
            - monitoring

        grafana:
          image: grafana/grafana:latest
          container_name: grafana
          restart: always
          ports:
            - "3000:3000"
          environment:
            - GF_SECURITY_ADMIN_PASSWORD=admin
          volumes:
            - /opt/monitoring/provisioning/datasources:/etc/grafana/provisioning/datasources
          networks:
            - monitoring

        node_exporter:
          image: prom/node-exporter:latest
          container_name: node_exporter
          restart: always
          network_mode: host
          pid: host
          volumes:
            - /:/host:ro,rslave
          command:
            - --path.rootfs=/host

      networks:
        monitoring:
          driver: bridge

runcmd:
  - systemctl stop firewalld || true
  - systemctl disable firewalld || true
  - dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  - dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  - systemctl enable --now docker
  - docker compose -f /opt/monitoring/docker-compose.yml up -d
```

### 主要実行ステップ

1.  **初期システム設定**: VMのホスト名、FQDNを設定し、rootアカウントのSSHキーとパスワードを構成します。`package_update: true`によりパッケージリストを更新し、基本的なユーティリティをインストールします。

2.  **設定ファイルの動的生成 (`write_files`)**:
    *   **`prometheus.yml`**: Prometheusの設定ファイルで、5台のVM（`vm1`～`vm5`）を静的ターゲットとして指定します。各ターゲットは`node_exporter`がリッスンする9100番ポートを指します。
    *   **`datasources.yml`**: Grafanaのプロビジョニング機能により、Grafana起動時にPrometheusとLokiをデータソースとして自動登録します。`url`項目にはDocker Compose内部のサービス名（`prometheus`、`loki`）を使用します。
    *   **`docker-compose.yml`**: 監視スタックのすべてのコンポーネントを定義します。`monitoring`ブリッジネットワークを作成してサービス間の通信を分離し、`restart: always`ポリシーでコンテナの永続性を保証します。

3.  **アプリケーションのデプロイと実行 (`runcmd`)**:
    *   `firewalld`サービスを停止および無効化し、ポートアクセス問題を回避します。
    *   Docker CEリポジトリを追加し、DockerエンジンおよびComposeプラグインをインストールします。
    *   `systemctl enable --now docker`コマンドでDockerサービスを有効化し、すぐに起動します。
    *   最後に、`docker compose up -d`コマンドを実行し、`/opt/monitoring`パスに作成された設定ファイルに基づいて監視スタック全体をバックグラウンドで実行します。

## 重要なチェックポイント (Gotchas)

*   **静的IP依存性**: `prometheus.yml`には監視対象VMのIPアドレスがハードコーディングされています。VMのIPが変更されたり、追加/削除されたりした場合、設定ファイルを手動で修正し、Prometheusサービスを再起動する必要があります。
*   **セキュリティ設定**: Grafanaの管理者パスワード（`GF_SECURITY_ADMIN_PASSWORD`）が`docker-compose.yml`ファイルに平文で露出しています。本番環境ではVaultや他のシークレット管理ツールを使用するのが安全です。
*   **ファイアウォールポリシー**: `runcmd`で`firewalld`を完全に無効化しています。これはテスト環境では便利ですが、セキュリティ上脆弱になる可能性があります。実際の運用環境では、必要なポート（3000、9090、9100など）のみを選択的に許可するファイアウォールルールを適用する必要があります。
