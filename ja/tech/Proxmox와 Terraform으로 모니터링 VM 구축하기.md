---
title: "Terraformとcloud-initを使ったProxmox監視VMのデプロイ自動化"
description: "Terraformのcloud-initサポート機能を活用し、Proxmox VM作成時にDockerのインストール、およびPrometheus、Grafana、Loki監視スタックをDocker Composeで自動デプロイする構成事例を解説します。"
date: 2026-10-20
tags: [Tech, Automation, Architecture, Linux, Cloud]
---

# Terraformとcloud-initを使ったProxmox監視VMのデプロイ自動化

::: tip 1行要約
Terraformの`proxmox_virtual_environment_file`リソースを活用し、cloud-initスクリプトでProxmox VMの作成からDockerベースのPrometheus、Grafana監視スタックのデプロイまで、全プロセスを自動化した構成の記録です。
:::

## プロジェクト概要とVM構成
Proxmox環境でテスト用の仮想マシンラボを構築するプロジェクトの初期段階として、監視サーバー（`vm1-monitor`）の構築を自動化することを目標とします。ラボ全体の環境は、Terraform変数で以下のように定義されています。

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

このうち、`vm1-monitor` VMにPrometheus、Grafanaベースの監視スタックをデプロイするために、Terraformとcloud-initを使用します。

## Terraformを使ったcloud-initスクリプトのデプロイ
`proxmox_virtual_environment_file`リソースを使用して、cloud-initのユーザーデータスクリプトをProxmoxのスニペットとして保存します。このスクリプトは、VMが初回起動される際に実行され、OS設定からアプリケーションのデプロイまで、すべてのプロセスを自動的に処理します。

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
      # Prometheus, Grafana, Docker Compose 設定ファイルの生成
      # ... (ファイル内容は以下で詳細に解説)

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

### cloud-init構成の分析

#### 1. OS初期設定とパッケージインストール
スクリプトの初期部分では、VMの基本環境を設定します。ホスト名、FQDNを指定し、rootユーザーのSSHキーとパスワードを設定します。その後、`package_update: true`でシステムをアップデートし、`packages`リストに定義された必須ユーティリティをインストールします。

#### 2. 設定ファイルの動的生成 (`write_files`)
`write_files`ディレクティブを使用して、VM内部に監視スタックに必要な設定ファイルを事前に生成します。

-   **`/opt/monitoring/prometheus.yml`**: Prometheusのスクレイプターゲットを定義します。現在は`static_configs`を通じて、監視対象のVMのIPアドレスを静的に指定しています。
    ```yaml
    global:
      scrape_interval: 5s
    scrape_configs:
      - job_name: 'proxmox-cluster'
        static_configs:
          - targets: ['10.0.0.100:9100'] # vm1-monitor
            # ... その他のVMターゲット
    ```
-   **`/opt/monitoring/provisioning/datasources/datasources.yml`**: Grafanaが起動する際に自動的にプロビジョニングするデータソースを定義します。これにより、Grafana UIで手動でPrometheusとLokiを接続する必要がなくなります。
    ```yaml
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
    ```
-   **`/opt/monitoring/docker-compose.yml`**: 監視スタックを構成するすべてのサービス（Prometheus、Loki、Grafana、Node Exporter）をDocker Composeで定義します。
    ```yaml
    version: '3.8'
    services:
      prometheus:
        image: prom/prometheus:latest
        # ...
      grafana:
        image: grafana/grafana:latest
        volumes:
          - /opt/monitoring/provisioning/datasources:/etc/grafana/provisioning/datasources
        # ...
      node_exporter:
        image: prom/node-exporter:latest
        network_mode: host
        pid: host
        volumes:
          - /:/host:ro,rslave
        command:
          - --path.rootfs=/host
    networks:
      monitoring:
        driver: bridge
    ```

#### 3. サービスのインストールと実行 (`runcmd`)
`runcmd`ブロックは、スクリプトの最終段階で順次実行されます。
1.  `firewalld`サービスを停止し、無効化します。
2.  Docker CEリポジトリを追加し、Docker関連パッケージをインストールします。
3.  Dockerサービスを有効化し、起動します。
4.  `write_files`で生成された`docker-compose.yml`ファイルを使用して、定義されたすべての監視サービスをバックグラウンドで実行します。

## 主要なチェックポイント (Gotchas)
-   **`cloud-init`の統合デプロイ能力**: `cloud-init`は、単なるOS初期化にとどまらず、`write_files`でアプリケーション設定ファイルを生成し、`runcmd`でDockerのようなランタイムをインストールしてサービスまで実行する「Zero-Touch」デプロイパイプラインの構築が可能です。
-   **Docker Composeネットワークの活用**: `monitoring`というユーザー定義のブリッジネットワークを作成し、サービス間の通信を簡素化しました。Grafanaの設定でPrometheusのURLを`http://prometheus:9090`のようにコンテナ名で指定できるため、IPアドレスへの依存性を排除できます。
-   **`node-exporter`のホストメトリック収集設定**: `node-exporter`コンテナに`network_mode: host`、`pid: host`オプションを適用し、ホストのルートファイルシステム（`/`）をコンテナ内部の`/host`にマウントしました。これは、コンテナ内部ではなく、コンテナが実行中の`vm1-monitor` VM自体のシステムメトリックを正確に収集するための必須構成です。
