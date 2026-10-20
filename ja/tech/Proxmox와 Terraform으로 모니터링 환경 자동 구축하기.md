---
title: "ProxmoxとTerraformで監視環境を自動構築する"
description: "Terraformとcloud-initを活用し、Proxmox VM作成時にPrometheus、Grafana、Lokiの監視スタックをDocker Composeで自動デプロイする構成事例を解説します。"
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# ProxmoxとTerraformで監視環境を自動構築する

::: tip 1行要約
Proxmox VMのプロビジョニング過程で、Terraformの`proxmox_virtual_environment_file`リソースを介してcloud-init設定を注入し、Docker ComposeベースのPrometheusおよびGrafana監視スタックを自動デプロイします。
:::

## プロジェクト概要と仮想マシン構成

テストプロジェクト環境を構築するため、Proxmoxベースの仮想マシン群をTerraformで管理します。全体のラボ環境は、監視、ロードバランサー、Web、データVMで構成されます。

Terraform変数で定義された仮想マシンリストは以下の通りです。この中で`vm1-monitor`の自動化構成に焦点を当てます。

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

## Cloud-initを活用した監視VMの自動化

`proxmox_virtual_environment_file`リソースを使用して、VM作成時にcloud-initスクリプトを渡します。このスクリプトは、VMの初期設定から監視スタックのデプロイまで、すべてのプロセスを自動化します。

```terraform
resource "proxmox_virtual_environment_file" "monitor_user_data" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "localhost"
  source_raw {
    data      = <<-EOF
    #cloud-config
    # ... (cloud-init content) ...
    EOF
    file_name = "user-data-monitor.yaml"
  }
}
```

### Cloud-configスクリプトの詳細分析

全体のcloud-initスクリプトは、システム初期化、設定ファイル生成、サービス実行の3つの段階で構成されます。

#### 1. システム初期化とパッケージインストール

VMのホスト名、FQDNを設定し、rootアカウントのSSHキーとパスワードを指定します。その後、`package_update`を実行し、Dockerインストールに必要な基本パッケージをインストールします。

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
```

#### 2. 設定ファイルの動的生成 (`write_files`)

`write_files`ディレクティブを使用して、監視スタックに必要な設定ファイルをVM内部に生成します。

-   **/opt/monitoring/prometheus.yml**: Prometheusの設定ファイルで、`static_configs`を介して監視対象の全VM（`node-exporter`ターゲット）のリストを事前に定義します。

    ```yaml
    global:
      scrape_interval: 5s
    scrape_configs:
      - job_name: 'proxmox-cluster'
        static_configs:
          - targets: ['10.0.0.100:9100']
            labels:
              instance: 'vm1-monitor'
          # ... other targets
    ```

-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Grafanaのプロビジョニング機能で使用される設定です。Grafanaコンテナが起動する際にこのファイルを読み込み、PrometheusとLokiをデータソースとして自動登録します。

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

-   **/opt/monitoring/docker-compose.yml**: Prometheus、Grafana、Loki、Node Exporterを含む監視スタック全体を定義します。各サービスは`monitoring`ブリッジネットワークを介して通信します。

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
      loki:
        image: grafana/loki:latest
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

#### 3. Dockerのインストールとサービス実行 (`runcmd`)

スクリプトの最終段階では、`runcmd`を介して実際のコマンドを実行します。ファイアウォールを無効化し、Docker CEリポジトリを追加してDockerとDocker Composeプラグインをインストールします。最後に、前述で作成した`docker-compose.yml`ファイルを使用して、すべての監視サービスをバックグラウンドで実行します。

```yaml
runcmd:
  - systemctl stop firewalld || true
  - systemctl disable firewalld || true
  - dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  - dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  - systemctl enable --now docker
  - docker compose -f /opt/monitoring/docker-compose.yml up -d
```

## 主要なチェックポイント (Gotchas)

-   **Cloud-initの自動化**: `proxmox_virtual_environment_file`リソースは、Proxmox VMにcloud-initユーザーデータを注入する主要な経路です。これにより、VM作成からアプリケーションデプロイまで、完全なゼロタッチプロビジョニングが可能になります。
-   **Grafanaのプロビジョニング**: Grafanaコンテナの`/etc/grafana/provisioning/datasources`パスにYAML設定ファイルをマウントすることで、手動でのUI設定なしにデータソースをコードで管理し、自動登録できます。
-   **Node Exporterによるホストメトリック収集**: `node_exporter`コンテナでホストVM自身のシステムメトリックを正確に収集するには、`network_mode: host`、`pid: host`オプションに加え、ホストのルートファイルシステム（`/`）をコンテナ内部に読み取り専用でマウントする必要があります。

*投稿日時: YYYY-MM-DD HH:mm:ss*
