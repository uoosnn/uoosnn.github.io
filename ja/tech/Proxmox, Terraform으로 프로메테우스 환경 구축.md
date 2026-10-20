---
title: "ProxmoxとTerraformを活用した監視VMの自動デプロイ"
description: "Terraformとcloud-initを使用して、Proxmox仮想環境にPrometheus、Grafana、Lokiを含む監視スタックをDocker Composeで自動デプロイする構成記録です。"
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux]
---

# ProxmoxとTerraformを活用した監視VMの自動デプロイ

::: tip 1行要約
Terraformの`proxmox_virtual_environment_file`リソースを介してcloud-initスクリプトを注入し、Proxmox VMの作成と同時にDockerベースのPrometheus監視スタックを自動的に構成します。
:::

## プロジェクト概要

テストプロジェクトのためにProxmoxベースの仮想化環境を構築します。VM全体の構成はTerraform変数で管理し、このうち監視ロールを担当する`vm1-monitor` VMの自動化に焦点を当てます。

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

`vm1-monitor`には、Prometheus、Grafana、Loki、Node Exporterで構成される監視スタックをDocker Composeを利用してデプロイします。

## Cloud-Initを利用したVMプロビジョニングの自動化

Terraformの`proxmox_virtual_environment_file`リソースを使用して、VM作成時に必要なすべての設定とスクリプトを格納したcloud-initファイルをProxmoxスニペットとして保存し、注入します。

```terraform
resource "proxmox_virtual_environment_file" "monitor_user_data" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "localhost"
  source_raw {
    data      = <<-EOF
    #cloud-config
    # ... cloud-init content ...
    EOF
    file_name = "user-data-monitor.yaml"
  }
}
```

### Cloud-Init構成の詳細

cloud-initスクリプトは、VMの初期設定、パッケージインストール、設定ファイル作成、そしてDocker Composeの実行まで、すべてのステップを自動化します。

#### 1. 基本システム設定とパッケージインストール
VMのホスト名、FQDNを設定し、`root`ユーザーのSSHキーを登録します。その後、`curl`、`wget`などの基本ユーティリティとDockerインストールに必要な`dnf-plugins-core`をインストールします。

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

#### 2. 監視スタック設定ファイルの生成 (`write_files`)
`write_files`モジュールを使用して、Prometheus、Grafanaデータソース、Docker Compose設定ファイルをVM内の指定されたパスに生成します。

-   **/opt/monitoring/prometheus.yml**: Prometheusのスクレイプターゲットを定義します。現在は`static_configs`を介して監視するVMのIPアドレスを直接指定します。

    ```yaml
    global:
      scrape_interval: 5s
    scrape_configs:
      - job_name: 'proxmox-cluster'
        static_configs:
          - targets: ['10.0.0.100:9100']
            labels:
              instance: 'vm1-monitor'
          - targets: ['10.0.0.101:9100']
            # ... other targets
    ```

-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Grafanaが起動する際に、PrometheusとLokiをデータソースとして自動登録するように設定します。

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

-   **/opt/monitoring/docker-compose.yml**: 監視スタックを構成する各サービス(Prometheus, Loki, Grafana, Node Exporter)をコンテナとして定義します。

    ```yaml
    version: '3.8'
    services:
      prometheus:
        image: prom/prometheus:latest
        container_name: prometheus
        # ...
      loki:
        image: grafana/loki:latest
        container_name: loki
        # ...
      grafana:
        image: grafana/grafana:latest
        container_name: grafana
        # ...
      node_exporter:
        image: prom/node-exporter:latest
        container_name: node_exporter
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

#### 3. サービス実行 (`runcmd`)
すべてのファイル作成が完了した後、`runcmd`を介してファイアウォールを無効化し、Dockerをインストールおよび実行した後、作成された`docker-compose.yml`ファイルを利用して監視スタックをバックグラウンドで実行します。

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

-   **Grafana自動プロビジョニング**: Grafanaコンテナ実行時に`volumes`を介してデータソース設定ファイル(`datasources.yml`)を`/etc/grafana/provisioning/datasources`パスにマウントすると、Grafana起動時に自動的にデータソースが登録され、手動設定のプロセスが不要になります。
-   **Node Exporterホストメトリック収集**: DockerコンテナとしてNode Exporterを実行し、ホストVM自体のメトリックを収集するには、`network_mode: host`、`pid: host`オプションを使用する必要があります。また、ホストのルートファイルシステムをコンテナ内の`/host`に読み取り専用でマウントし、`--path.rootfs=/host`引数を渡すことで、正確なシステム情報を収集できます。
-   **Cloud-InitとTerraformの連携**: `proxmox_virtual_environment_file`リソースを使用すると、複雑な複数行のスクリプトや設定ファイルをTerraformコード内で`source_raw`として管理し、Proxmoxスニペットとして生成できます。これはVMプロビジョニング自動化の重要な部分です。
