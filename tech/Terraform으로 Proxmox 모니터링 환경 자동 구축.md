---
title: "Terraform과 cloud-init으로 Proxmox 모니터링 VM 자동 배포"
description: "Terraform의 proxmox_virtual_environment_file 리소스를 사용하여 Proxmox VM을 생성하고, cloud-init으로 Docker 기반 Prometheus, Grafana, Loki 스택을 자동으로 구성하는 과정을 설명합니다."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# Terraform과 cloud-init으로 Proxmox 모니터링 VM 자동 배포

::: tip 1줄 요약
Terraform의 `proxmox_virtual_environment_file` 리소스와 cloud-init을 활용하여, Proxmox VM 생성 시점에 Docker 기반의 Prometheus, Grafana 모니터링 스택을 자동으로 배포하는 방법을 다룹니다.
:::

## 개요

Proxmox 환경에서 테스트용 가상머신 클러스터를 구축할 때, 모니터링 환경을 수동으로 설정하는 것은 반복적이고 비효율적일 수 있습니다. 이 문서에서는 Terraform과 cloud-init을 결합하여 모니터링 역할을 수행할 VM(`vm1-monitor`)의 생성부터 Prometheus, Grafana, Loki 등 모니터링 스택 배포까지의 전 과정을 자동화하는 방법을 기록합니다.

## Terraform 및 cloud-init 구성

Terraform의 `proxmox_virtual_environment_file` 리소스를 사용하면 VM 생성 시점에 cloud-init 스크립트를 주입하여 초기 설정을 자동화할 수 있습니다. `source_raw` 블록 내에 정의된 cloud-init 스크립트는 VM의 첫 부팅 시 실행됩니다.

### 1. Terraform 리소스 정의

`proxmox_virtual_environment_file` 리소스를 사용하여 `user-data-monitor.yaml`이라는 이름으로 cloud-init 스크립트 파일을 Proxmox 스토리지(`local`의 `snippets`)에 업로드합니다. 이 파일은 이후 VM 생성 시 참조됩니다.

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

### 2. cloud-init 스크립트 상세 구성

VM 부팅 시 실행될 작업들은 `#cloud-config` 지시어 아래에 YAML 형식으로 정의됩니다.

#### 기본 시스템 설정 및 패키지 설치

VM의 호스트 이름, FQDN을 설정하고 root 사용자의 SSH 키와 패스워드를 지정합니다. 이후 `package_update`를 수행하고 모니터링 스택 배포에 필요한 `curl`, `wget`, `docker` 관련 패키지를 설치합니다.

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

#### 설정 파일 생성 (`write_files`)

`write_files` 모듈을 사용하여 Docker Compose로 실행할 모니터링 스택의 설정 파일들을 VM 내의 `/opt/monitoring` 경로에 미리 생성합니다.

-   **/opt/monitoring/prometheus.yml**: Prometheus의 스크랩 타겟을 정의합니다. 현재는 정적 IP 목록으로 5대의 VM을 지정했습니다.
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

-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Grafana가 시작될 때 자동으로 데이터 소스를 등록하도록 설정합니다. 이를 통해 Grafana UI에서 수동으로 Prometheus와 Loki를 추가할 필요가 없습니다.
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

-   **/opt/monitoring/docker-compose.yml**: Prometheus, Grafana, Loki, Node Exporter 서비스를 컨테이너로 정의합니다. 각 서비스는 `monitoring` 브리지 네트워크를 통해 통신합니다.
    ```yaml
    version: '3.8'
    services:
      prometheus:
        # ...
      grafana:
        # ...
        volumes:
          - /opt/monitoring/provisioning/datasources:/etc/grafana/provisioning/datasources
      loki:
        # ...
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
    `node_exporter`는 호스트 VM의 시스템 메트릭을 정확히 수집하기 위해 `network_mode: host`, `pid: host` 옵션과 함께 호스트의 루트 파일 시스템(`/`)을 마운트하여 실행합니다.

#### 서비스 실행 (`runcmd`)

모든 파일 생성이 완료된 후, `runcmd` 모듈을 통해 실제 서비스 설치 및 실행 명령을 순차적으로 수행합니다. 방화벽을 비활성화하고, Docker 리포지토리를 추가하여 Docker 및 Docker Compose를 설치한 뒤, 시스템 서비스로 등록하고 활성화합니다. 마지막으로 미리 생성된 `docker-compose.yml` 파일을 사용하여 모니터링 스택을 백그라운드에서 실행합니다.

```yaml
runcmd:
  - systemctl stop firewalld || true
  - systemctl disable firewalld || true
  - dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  - dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  - systemctl enable --now docker
  - docker compose -f /opt/monitoring/docker-compose.yml up -d
```

## 핵심 체크포인트 (Gotchas)

*   **cloud-init 활용**: VM 생성 시점에 `cloud-init`을 활용하면 패키지 설치, 설정 파일 생성, 서비스 실행 등 초기화 작업을 완벽하게 자동화하여 일관성 있는 환경을 보장할 수 있습니다.
*   **Grafana Provisioning**: Grafana의 Provisioning 기능을 사용하면 데이터 소스나 대시보드를 코드로 관리할 수 있습니다. 컨테이너 볼륨으로 설정 파일을 마운트하는 것만으로 Grafana 실행 시 자동으로 구성이 적용되어 수동 설정 과정을 제거합니다.
*   **Node Exporter 호스트 모드**: 컨테이너화된 `node_exporter`가 호스트 시스템의 메트릭을 정확하게 수집하기 위해서는 `network_mode: host`, `pid: host` 및 루트 파일 시스템 마운트(`--path.rootfs=/host`)와 같은 권한 설정이 필수적입니다.
