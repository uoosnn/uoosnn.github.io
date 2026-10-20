---
title: "Proxmox와 Terraform으로 모니터링 환경 자동 구축하기"
description: "Terraform과 cloud-init을 활용하여 Proxmox VM 생성 시 Prometheus, Grafana, Loki 모니터링 스택을 Docker Compose로 자동 배포하는 구성 사례를 다룹니다."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# Proxmox와 Terraform으로 모니터링 환경 자동 구축하기

::: tip 1줄 요약
Proxmox VM 프로비저닝 과정에서 Terraform의 `proxmox_virtual_environment_file` 리소스를 통해 cloud-init 설정을 주입하여, Docker Compose 기반의 Prometheus 및 Grafana 모니터링 스택을 자동으로 배포합니다.
:::

## 프로젝트 개요 및 가상 머신 구성

테스트 프로젝트 환경을 구축하기 위해 Proxmox 기반의 가상 머신들을 Terraform으로 관리합니다. 전체 랩 환경은 모니터링, 로드 밸런서, 웹, 데이터 VM으로 구성됩니다.

Terraform 변수로 정의된 가상 머신 목록은 다음과 같습니다. 이 중 `vm1-monitor`의 자동화 구성에 집중합니다.

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

## Cloud-init을 활용한 모니터링 VM 자동화

`proxmox_virtual_environment_file` 리소스를 사용하여 VM 생성 시 cloud-init 스크립트를 전달합니다. 이 스크립트는 VM의 초기 설정부터 모니터링 스택 배포까지 모든 과정을 자동화합니다.

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

### Cloud-config 스크립트 상세 분석

전체 cloud-init 스크립트는 시스템 초기화, 설정 파일 생성, 서비스 실행의 세 단계로 구성됩니다.

#### 1. 시스템 초기화 및 패키지 설치

VM의 호스트 이름, FQDN을 설정하고 root 계정의 SSH 키와 패스워드를 지정합니다. 이후 `package_update`를 실행하고 Docker 설치에 필요한 기본 패키지들을 설치합니다.

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

#### 2. 설정 파일 동적 생성 (`write_files`)

`write_files` 지시어를 사용하여 모니터링 스택에 필요한 설정 파일들을 VM 내부에 생성합니다.

-   **/opt/monitoring/prometheus.yml**: Prometheus의 설정 파일로, `static_configs`를 통해 모니터링할 전체 VM(`node-exporter` 타겟)의 목록을 미리 정의합니다.

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

-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Grafana의 프로비저닝 기능에 사용될 설정입니다. Grafana 컨테이너가 시작될 때 이 파일을 읽어 Prometheus와 Loki를 데이터 소스로 자동 등록합니다.

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

-   **/opt/monitoring/docker-compose.yml**: Prometheus, Grafana, Loki, Node Exporter를 포함한 전체 모니터링 스택을 정의합니다. 각 서비스는 `monitoring` 브리지 네트워크를 통해 통신합니다.

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

#### 3. Docker 설치 및 서비스 실행 (`runcmd`)

스크립트의 마지막 단계에서는 `runcmd`를 통해 실제 명령어들을 실행합니다. 방화벽을 비활성화하고, Docker CE 리포지토리를 추가하여 Docker와 Docker Compose 플러그인을 설치합니다. 마지막으로, 앞에서 생성한 `docker-compose.yml` 파일을 사용하여 모든 모니터링 서비스를 백그라운드로 실행합니다.

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

-   **Cloud-init 자동화**: `proxmox_virtual_environment_file` 리소스는 Proxmox VM에 cloud-init 사용자 데이터를 주입하는 핵심 통로입니다. 이를 통해 VM 생성부터 애플리케이션 배포까지 완전한 제로터치 프로비저닝이 가능합니다.
-   **Grafana 프로비저닝**: Grafana 컨테이너의 `/etc/grafana/provisioning/datasources` 경로에 YAML 설정 파일을 마운트하면, 수동 UI 설정 없이 데이터 소스를 코드로 관리하고 자동 등록할 수 있습니다.
-   **Node Exporter 호스트 메트릭 수집**: `node_exporter` 컨테이너에서 호스트 VM 자체의 시스템 메트릭을 정확히 수집하려면 `network_mode: host`, `pid: host` 옵션과 함께 호스트의 루트 파일시스템 (`/`)을 컨테이너 내부에 읽기 전용으로 마운트해야 합니다.
