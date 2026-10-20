---
title: "TerraformとCloud-initでProxmoxモニタリングスタック構築を自動化"
description: "Terraformの`proxmox_virtual_environment_file`リソースを活用し、cloud-initスクリプトでProxmox VM作成時にPrometheus、Grafana、LokiなどのモニタリングスタックをDocker Composeで自動デプロイする構成事例です。"
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# TerraformとCloud-initでProxmoxモニタリングスタック構築を自動化

::: tip 1行要約
Terraformの`proxmox_virtual_environment_file`リソースにcloud-init設定を注入し、Proxmox VMプロビジョニングと同時にDocker ComposeベースのPrometheus、Grafana、Lokiモニタリング環境を自動で構築します。
:::

## 概要

Proxmox環境でテスト用の仮想マシンクラスターを構築し、そのうちの1つのVMをモニタリングサーバーとして指定し、Prometheus、Grafana、Lokiスタックを自動でデプロイすることを目標とします。TerraformのProxmox Providerとcloud-initを組み合わせることで、VM作成からアプリケーションデプロイまでの全プロセスをコードで管理します。

## Terraform変数定義

プロジェクトで使用するVMの全リストをTerraform変数として宣言し、管理の一貫性を確保します。各VMは固有の`vmid`、ハードウェア仕様（`cores`、`memory`）、そして役割（`role`）を持ちます。この構成では、`vm1-monitor` VMの設定に焦点を当てます。

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

`proxmox_virtual_environment_file`リソースを使用して、Proxmoxデータストアにcloud-initユーザーデータファイルを生成します。このファイルは、モニタリングVMが起動する際に実行され、システム設定、パッケージインストール、設定ファイル作成、Dockerコンテナ実行まで、すべてのタスクを自動で処理します。

```terraform
resource "proxmox_virtual_environment_file" "monitor_user_data" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "localhost"
  source_raw {
    data      = <<-EOF
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
      # Prometheus 設定ファイル
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
                # ... (other targets)

      # Grafana データソースプロビジョニング
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

      # Docker Compose ファイル
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

### Cloud-init構成分析

- **`write_files`**: VM内部に必要な設定ファイルを事前に作成します。
  - `prometheus.yml`: Prometheusが収集するターゲットを静的に定義します。
  - `datasources.yml`: Grafanaが起動する際にPrometheusとLokiをデータソースとして自動登録するよう設定します。
  - `docker-compose.yml`: モニタリングスタックを構成するすべてのサービス（Prometheus、Loki、Grafana、Node Exporter）を定義し、`monitoring`ブリッジネットワークで接続します。
- **`node_exporter`設定**: コンテナではなくホストVM自体のシステムメトリックを収集するために、`network_mode: host`と`pid: host`オプションを使用します。また、ホストのルートファイルシステムを`/host`として読み取り専用でマウントし、システム全体の情報を収集できるように設定します。
- **`runcmd`**: VM起動時の最終段階で実行されるコマンドリストです。ファイアウォールの無効化、Dockerのインストールとサービス有効化、そして定義された`docker-compose.yml`ファイルを利用してモニタリングスタックをバックグラウンドで実行します。

## 主要なチェックポイント (Gotchas)

- **Cloud-init Snippetの活用**: `proxmox_virtual_environment_file`リソースの`content_type = "snippets"`オプションは、Proxmoxのスニペット機能を活用する上で重要です。これにより、別途HTTPサーバーを用意することなく、Terraformコード内で直接cloud-initスクリプトを注入できます。
- **Node Exporterによるホストメトリックの収集**: 正確なホストモニタリングのためには、`node_exporter`コンテナに`network_mode: host`オプションを適用し、ホストのルートファイルシステム（`/:/host:ro,rslave`）をマウントして、コンテナ隔離環境から外れたシステム全体のメトリックを収集するように構成する必要があります。
- **Grafanaデータソースの自動化**: `write_files`を通じてGrafanaのプロビジョニングディレクトリ（`/etc/grafana/provisioning/datasources`）にデータソース設定ファイルを事前に作成しておくことで、Grafanaコンテナ実行時に手動での介入なしに、すぐにPrometheusとLokiを利用できる状態になります。

*投稿日時: 2026-10-20 00:00:00*
