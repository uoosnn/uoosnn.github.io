---
title: "Proxmox와 Terraform으로 모니터링 환경 자동 구축"
description: "Terraform과 cloud-init을 사용하여 Proxmox VM 생성 시, Docker 기반의 Prometheus 및 Grafana 모니터링 스택을 자동으로 배포하는 전체 구성 과정을 기록합니다."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# Proxmox와 Terraform으로 모니터링 환경 자동 구축

::: tip 1줄 요약
Terraform의 `proxmox_virtual_environment_file` 리소스로 cloud-init 설정을 주입하여, VM 프로비저닝과 동시에 Docker Compose 기반 모니터링 스택(Prometheus, Grafana, Loki)을 완전 자동으로 배포합니다.
:::

## 프로젝트 개요 및 VM 구성

테스트 프로젝트를 위해 Proxmox 기반의 가상 환경을 구성합니다. 전체 VM 목록과 역할은 Terraform 변수로 정의되었으며, 이 문서에서는 모니터링 역할을 담당할 `vm1-monitor`의 자동화된 구축 과정에 집중합니다.

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

`vm1-monitor`에는 Prometheus와 Grafana 기반의 모니터링 스택이 배포됩니다.

## Cloud-init을 이용한 VM 프로비저닝 자동화

Terraform의 `proxmox_virtual_environment_file` 리소스를 사용하여 Proxmox에 cloud-init용 설정 파일(`user-data-monitor.yaml`)을 생성하고 VM에 전달합니다. 이 스크립트는 VM 부팅 시 자동으로 실행되어 초기 설정을 완료합니다.

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

### 1. 시스템 기본 설정 및 패키지 설치

cloud-init 스크립트는 호스트 이름 설정, root 계정 SSH 키 등록 및 패키지 설치를 수행합니다.

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

### 2. 모니터링 스택 설정 파일 생성 (`write_files`)

VM 내부에 모니터링 스택 구동에 필요한 설정 파일들을 미리 생성합니다.

-   **/opt/monitoring/prometheus.yml**: Prometheus 설정 파일로, 전체 랩 VM들을 정적 타겟으로 지정합니다.
-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Grafana 프로비저닝 파일로, 부팅 시 Prometheus와 Loki를 데이터 소스로 자동 등록합니다.
-   **/opt/monitoring/docker-compose.yml**: Prometheus, Loki, Grafana, Node Exporter 컨테이너를 정의하고 관리하는 Docker Compose 파일입니다.

```yaml
# Docker Compose 일부 발췌
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

`node_exporter`는 호스트 VM의 시스템 메트릭을 정확히 수집하기 위해 `network_mode: host`와 `pid: host` 옵션을 사용하고, 호스트의 루트 파일시스템(`/`)을 컨테이너 내부로 마운트합니다.

### 3. 서비스 실행 (`runcmd`)

모든 파일 생성이 완료된 후, `runcmd`를 통해 실제 서비스 구동 명령을 순차적으로 실행합니다.

-   방화벽(firewalld) 비활성화
-   Docker CE 리포지토리 추가 및 설치
-   Docker 서비스 활성화 및 시작
-   생성된 `docker-compose.yml` 파일을 사용하여 모니터링 스택 실행

```yaml
runcmd:
  - systemctl stop firewalld || true
  - systemctl disable firewalld || true
  - dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  - dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  - systemctl enable --now docker
  - docker compose -f /opt/monitoring/docker-compose.yml up -d
```

이 과정을 통해 `terraform apply` 명령 한 번으로 Proxmox VM 생성부터 모니터링 환경 배포까지의 모든 작업이 자동으로 완료됩니다.

## 핵심 체크포인트 (Gotchas)

*   **Cloud-init 활용**: Terraform의 `proxmox_virtual_environment_file`과 `source_raw`를 통해 cloud-init 스크립트를 직접 주입하면, VM 생성과 동시에 복잡한 초기화 작업을 코드 기반으로 자동화할 수 있습니다.
*   **선언적 애플리케이션 배포**: 모니터링 스택의 모든 구성 요소(Prometheus, Grafana 등)와 설정을 `docker-compose.yml` 파일 하나로 정의하여, 애플리케이션 레이어의 배포를 일관되고 재현 가능하게 만듭니다.
*   **Host-level 메트릭 수집**: `node_exporter` 컨테이너 설정 시 `network_mode: host`, `pid: host`, 루트 파일시스템 마운트(`/:/host:ro`)는 컨테이너 내부가 아닌 호스트 VM 자체의 시스템 지표를 수집하기 위한 필수 구성입니다.
