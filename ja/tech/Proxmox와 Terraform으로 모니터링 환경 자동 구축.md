---
title: "ProxmoxとTerraformで監視環境を自動構築"
description: "Terraformとcloud-initを使用してProxmox VMを作成する際に、DockerベースのPrometheusおよびGrafana監視スタックを自動的にデプロイする一連の構成プロセスを記録します。"
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# ProxmoxとTerraformで監視環境を自動構築

::: tip 1行要約
Terraformの`proxmox_virtual_environment_file`リソースでcloud-init設定を注入し、VMプロビジョニングと同時にDocker Composeベースの監視スタック(Prometheus, Grafana, Loki)を完全に自動でデプロイします。
:::

## プロジェクト概要とVM構成

テストプロジェクトのためにProxmoxベースの仮想環境を構築します。VMの全リストと役割はTerraform変数で定義されており、このドキュメントでは監視役割を担当する`vm1-monitor`の自動化された構築プロセスに焦点を当てます。

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

`vm1-monitor`にはPrometheusとGrafanaベースの監視スタックがデプロイされます。

## Cloud-initを利用したVMプロビジョニングの自動化

Terraformの`proxmox_virtual_environment_file`リソースを使用して、Proxmoxにcloud-init用の設定ファイル(`user-data-monitor.yaml`)を生成し、VMに渡します。このスクリプトはVM起動時に自動的に実行され、初期設定を完了します。

```terraform
resource "proxmox_virtual_environment_file" "monitor_user_data" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "localhost"
  source_raw {
    data      = <<-EOF
    #cloud-config
    # ... (cloud-init content below)
    EOF
    file_name = "user-data-monitor.yaml"
  }
}
```

### 1. システム基本設定とパッケージインストール

cloud-initスクリプトは、ホスト名設定、rootアカウントのSSHキー登録、およびパッケージインストールを実行します。

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

### 2. 監視スタック設定ファイルの生成 (`write_files`)

VM内部に監視スタックの起動に必要な設定ファイルを事前に生成します。

-   **/opt/monitoring/prometheus.yml**: Prometheus設定ファイルで、ラボ全体のVMを静的ターゲットとして指定します。
-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Grafanaプロビジョニングファイルで、起動時にPrometheusとLokiをデータソースとして自動登録します。
-   **/opt/monitoring/docker-compose.yml**: Prometheus, Loki, Grafana, Node Exporterコンテナを定義および管理するDocker Composeファイルです。

```yaml
# Docker Compose一部抜粋
# /opt/monitoring/docker-compose.yml
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

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: always
    ports:
      - "3000:3000"
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
```

`node_exporter`は、ホストVMのシステムメトリックを正確に収集するために、`network_mode: host`と`pid: host`オプションを使用し、ホストのルートファイルシステム(`/`)をコンテナ内部にマウントします。

### 3. サービス実行 (`runcmd`)

すべてのファイル生成が完了した後、`runcmd`を通じて実際のサービス起動コマンドを順次実行します。

-   ファイアウォール(firewalld)の無効化
-   Docker CEリポジトリの追加とインストール
-   Dockerサービスの有効化と開始
-   生成された`docker-compose.yml`ファイルを使用して監視スタックを実行

```yaml
runcmd:
  - systemctl stop firewalld || true
  - systemctl disable firewalld || true
  - dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  - dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  - systemctl enable --now docker
  - docker compose -f /opt/monitoring/docker-compose.yml up -d
```

このプロセスを通じて、`terraform apply`コマンドを一度実行するだけで、Proxmox VMの作成から監視環境のデプロイまでのすべての作業が自動的に完了します。

## 主要なチェックポイント (Gotchas)

*   **Cloud-initの活用**: Terraformの`proxmox_virtual_environment_file`と`source_raw`を通じてcloud-initスクリプトを直接注入することで、VM作成と同時に複雑な初期化作業をコードベースで自動化できます。
*   **宣言的アプリケーションデプロイ**: 監視スタックのすべての構成要素(Prometheus, Grafanaなど)と設定を`docker-compose.yml`ファイル一つで定義することで、アプリケーションレイヤーのデプロイを一貫性があり再現可能なものにします。
*   **ホストレベルのメトリック収集**: `node_exporter`コンテナ設定時の`network_mode: host`、`pid: host`、ルートファイルシステムのマウント(`/:/host:ro`)は、コンテナ内部ではなくホストVM自体のシステム指標を収集するための必須構成です。
