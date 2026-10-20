---
title: "TerraformとCloud-initでProxmox監視VMを自動デプロイ"
description: "Terraformの`proxmox_virtual_environment_file`リソースを活用し、cloud-initスクリプトを注入することで、VM作成からPrometheus、Grafanaなどの監視スタックのDocker Composeデプロイまでを自動化するプロセスを解説します。"
date: 2026-10-20
tags: [Tech, Automation, Architecture, Linux]
---

# TerraformとCloud-initでProxmox監視VMを自動デプロイ

::: tip 1行要約
Terraformとcloud-initを利用してProxmox VMを構築し、VM起動時にDocker ComposeでPrometheus、Grafana、Lokiの監視スタックを自動デプロイする構成です。
:::

## 概要

Proxmox環境で多数のテスト用仮想マシンを運用するための基盤監視システムをTerraformで自動構築します。この構成は、`vm1-monitor`という特定のVMにPrometheus、Grafana、Loki、Node ExporterスタックをDocker Compose経由でデプロイするプロセスをcloud-initで自動化することを目的としています。

## VM環境定義

Terraform変数を使い、プロジェクトに必要なVMの全リストと、それぞれのスペック、ロールを定義します。この中で`vm1-monitor`が監視スタックのインストール対象となります。

```terraform
variable "lab_vms" {
  default = {
    "vm1-monitor" = { vmid = 501, cores = 2, memory = 2048, ip = "", role = "monitor" }
    "vm2-lb"      = { vmid = 502, cores = 1, memory = 1024, ip = "", role = "node" }
    "vm3-web1"    = { vmid = 503, cores = 1, memory = 1024, ip = "", role = "node" }
    "vm4-web2"    = { vmid = 504, cores = 1, memory = 1024, ip = "", role = "node" }
    "vm5-data"    = { vmid = 505, cores = 1, memory = 2048, ip = "", role = "node" }
  }
}
```

## Cloud-initを利用したVMプロビジョニング自動化

`proxmox_virtual_environment_file`リソースを使用して、Proxmoxのスニペット機能でcloud-init設定ファイルをアップロードします。このファイルは、監視VMが作成される際に自動的に実行され、システム初期設定から監視アプリケーションのデプロイまで、すべてのプロセスを処理します。

```terraform
resource "proxmox_virtual_environment_file" "monitor_user_data" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "localhost"
  source_raw {
    data = <<-EOF
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
    EOF

    file_name = "user-data-monitor.yaml"
  }
}
```

### 構成分析

1.  **初期システム設定**: `hostname`、`users`、`packages`などのモジュールを通じて、VMの基本情報を設定し、必須パッケージをインストールします。
2.  **設定ファイルの生成 (`write_files`)**:
    *   `prometheus.yml`: Prometheusが収集するターゲットを静的に定義します。`vm1-monitor`自身を含むすべてのラボVMの`node-exporter`エンドポイント（`:9100`）が明示されています。
    *   `datasources.yml`: Grafanaのプロビジョニング機能を活用し、Grafana起動時にPrometheusとLokiをデータソースとして自動登録するよう設定します。
    *   `docker-compose.yml`: 監視スタックを構成する各サービス（Prometheus、Loki、Grafana、Node Exporter）を定義します。`monitoring`ブリッジネットワークを通じてサービス間の通信が行われます。特に`node_exporter`は`network_mode: host`に設定されており、コンテナ内ではなくホストVM自身のシステムメトリックを収集します。
3.  **サービス実行 (`runcmd`)**:
    *   ファイアウォール(firewalld)を無効化します。
    *   Docker CEリポジトリを追加し、DockerおよびDocker Composeをインストールします。
    *   Dockerサービスを有効化し、`write_files`ステップで生成した`docker-compose.yml`ファイルを利用して、すべての監視サービスをバックグラウンドで実行します。

## 押さえておくべきポイント (Gotchas)

*   **Cloud-initの活用**: VM作成と同時にパッケージインストール、設定ファイルの注入、サービス実行までを単一のワークフローで処理することで、インフラプロビジョニングを完全に自動化できます。
*   **Node Exporterのホストモード**: `network_mode: host`と`pid: host`オプションは、`node_exporter`がコンテナ内部ではなくホストVMのネットワークおよびプロセス情報に直接アクセスし、正確なシステムメトリックを収集するための必須設定です。
*   **Grafanaの自動プロビジョニング**: `volumes`を通じて`datasources.yml`設定ファイルをコンテナ内の特定のパスにマウントすることで、Grafana実行時に手動設定作業なしで即座にデータソースを利用できるようになり、デプロイの利便性が大幅に向上します。
