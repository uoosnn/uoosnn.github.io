---
title: "Proxmox와 Terraform을 활용한 모니터링 VM 자동 배포"
description: "Terraform과 cloud-init을 사용하여 Proxmox 가상 환경에 Prometheus, Grafana, Loki를 포함한 모니터링 스택을 Docker Compose로 자동 배포하는 구성 기록입니다."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux]
---

# Proxmox와 Terraform을 활용한 모니터링 VM 자동 배포

::: tip 1줄 요약
Terraform의 `proxmox_virtual_environment_file` 리소스를 통해 cloud-init 스크립트를 주입하여, Proxmox VM 생성과 동시에 Docker 기반의 Prometheus 모니터링 스택을 자동으로 구성합니다.
:::

## 프로젝트 개요

테스트 프로젝트를 위해 Proxmox 기반의 가상화 환경을 구축합니다. 전체 VM 구성은 Terraform 변수로 관리하며, 이 중 모니터링 역할을 담당할 `vm1-monitor` VM의 자동화에 집중합니다.

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

`vm1-monitor`에는 Prometheus, Grafana, Loki, Node Exporter로 구성된 모니터링 스택을 Docker Compose를 이용해 배포합니다.

## Cloud-Init을 이용한 VM 프로비저닝 자동화

Terraform의 `proxmox_virtual_environment_file` 리소스를 사용하여 VM 생성 시 필요한 모든 설정과 스크립트를 담은 cloud-init 파일을 Proxmox 스니펫으로 저장하고 주입합니다.

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

### Cloud-Init 구성 상세

cloud-init 스크립트는 VM의 초기 설정, 패키지 설치, 설정 파일 생성, 그리고 Docker Compose 실행까지 모든 단계를 자동화합니다.

#### 1. 기본 시스템 설정 및 패키지 설치
VM의 호스트명, FQDN을 설정하고 `root` 사용자의 SSH 키를 등록합니다. 이후 `curl`, `wget` 등 기본 유틸리티와 Docker 설치에 필요한 `dnf-plugins-core`를 설치합니다.

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

#### 2. 모니터링 스택 설정 파일 생성 (`write_files`)
`write_files` 모듈을 사용하여 Prometheus, Grafana 데이터소스, Docker Compose 설정 파일을 VM 내 지정된 경로에 생성합니다.

-   **/opt/monitoring/prometheus.yml**: Prometheus의 스크레이프 대상을 정의합니다. 현재는 `static_configs`를 통해 모니터링할 VM들의 IP 주소를 직접 지정합니다.

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

-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Grafana가 시작될 때 자동으로 Prometheus와 Loki를 데이터소스로 등록하도록 설정합니다.

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

-   **/opt/monitoring/docker-compose.yml**: 모니터링 스택을 구성하는 각 서비스(Prometheus, Loki, Grafana, Node Exporter)를 컨테이너로 정의합니다.

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

#### 3. 서비스 실행 (`runcmd`)
모든 파일 생성이 완료된 후, `runcmd`를 통해 방화벽을 비활성화하고 Docker를 설치 및 실행한 뒤, 작성된 `docker-compose.yml` 파일을 이용해 모니터링 스택을 백그라운드로 실행합니다.

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

-   **Grafana 자동 프로비저닝**: Grafana 컨테이너 실행 시 `volumes`를 통해 데이터소스 설정 파일(`datasources.yml`)을 `/etc/grafana/provisioning/datasources` 경로에 마운트하면, Grafana 시작 시 자동으로 데이터소스가 등록되어 수동 설정 과정이 필요 없습니다.
-   **Node Exporter 호스트 메트릭 수집**: Docker 컨테이너로 Node Exporter를 실행하여 호스트 VM 자체의 메트릭을 수집하려면 `network_mode: host`, `pid: host` 옵션을 사용해야 합니다. 또한, 호스트의 루트 파일 시스템을 컨테이너 내 `/host`로 읽기 전용 마운트하고 `--path.rootfs=/host` 인자를 전달해야 정확한 시스템 정보를 수집할 수 있습니다.
-   **Cloud-Init과 Terraform 연동**: `proxmox_virtual_environment_file` 리소스를 사용하면 복잡한 멀티라인 스크립트나 설정 파일을 Terraform 코드 내에서 `source_raw`로 관리하여 Proxmox 스니펫으로 생성할 수 있습니다. 이는 VM 프로비저닝 자동화의 핵심적인 부분입니다.
