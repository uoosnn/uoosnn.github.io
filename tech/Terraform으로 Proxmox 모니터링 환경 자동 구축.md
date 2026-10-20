---
title: "Terraform과 Cloud-init으로 Proxmox 모니터링 VM 자동 배포"
description: "Terraform의 proxmox_virtual_environment_file 리소스를 활용하여 cloud-init 스크립트를 주입, VM 생성부터 Prometheus, Grafana 등 모니터링 스택의 Docker Compose 배포까지 자동화하는 과정을 설명합니다."
date: 2026-10-20
tags: [Tech, Automation, Architecture, Linux]
---

# Terraform과 Cloud-init으로 Proxmox 모니터링 VM 자동 배포

::: tip 1줄 요약
Terraform과 cloud-init을 이용해 Proxmox VM을 생성하고, VM 부팅 시 Docker Compose로 Prometheus, Grafana, Loki 모니터링 스택을 자동으로 배포하는 구성입니다.
:::

## 개요

Proxmox 환경에서 다수의 테스트용 가상 머신을 운영하기 위한 기반 모니터링 시스템을 Terraform으로 자동 구축합니다. 이 구성은 `vm1-monitor`라는 특정 VM에 Prometheus, Grafana, Loki, Node Exporter 스택을 Docker Compose를 통해 배포하는 과정을 cloud-init으로 자동화하는 것을 목표로 합니다.

## VM 환경 정의

Terraform 변수를 사용하여 프로젝트에 필요한 전체 VM 목록과 각각의 사양, 역할을 정의합니다. 이 중 `vm1-monitor`가 모니터링 스택이 설치될 대상입니다.

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

## Cloud-init을 이용한 VM 프로비저닝 자동화

`proxmox_virtual_environment_file` 리소스를 사용해 Proxmox의 스니펫 기능으로 cloud-init 설정 파일을 업로드합니다. 이 파일은 모니터링 VM이 생성될 때 자동으로 실행되어 시스템 초기 설정부터 모니터링 애플리케이션 배포까지 모든 과정을 처리합니다.

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

### 구성 분석

1.  **초기 시스템 설정**: `hostname`, `users`, `packages` 등의 모듈을 통해 VM의 기본 정보를 설정하고 필수 패키지를 설치합니다.
2.  **설정 파일 생성 (`write_files`)**:
    *   `prometheus.yml`: Prometheus가 수집할 대상(target)을 정적으로 정의합니다. `vm1-monitor` 자신을 포함한 모든 랩 VM의 `node-exporter` 엔드포인트(`:9100`)가 명시되어 있습니다.
    *   `datasources.yml`: Grafana의 프로비저닝 기능을 활용하여, Grafana가 시작될 때 Prometheus와 Loki를 데이터 소스로 자동 등록하도록 설정합니다.
    *   `docker-compose.yml`: 모니터링 스택을 구성하는 각 서비스(Prometheus, Loki, Grafana, Node Exporter)를 정의합니다. `monitoring` 브리지 네트워크를 통해 서비스 간 통신이 이루어집니다. 특히 `node_exporter`는 `network_mode: host`로 설정하여 컨테이너가 아닌 호스트 VM 자체의 시스템 메트릭을 수집합니다.
3.  **서비스 실행 (`runcmd`)**:
    *   방화벽(firewalld)을 비활성화합니다.
    *   Docker CE 리포지토리를 추가하고 Docker 및 Docker Compose를 설치합니다.
    *   Docker 서비스를 활성화하고, `write_files` 단계에서 생성한 `docker-compose.yml` 파일을 이용해 모든 모니터링 서비스를 백그라운드에서 실행합니다.

## 핵심 체크포인트 (Gotchas)

*   **Cloud-init 활용**: VM 생성과 동시에 패키지 설치, 설정 파일 주입, 서비스 실행까지 단일 워크플로우로 처리하여 인프라 프로비저닝을 완벽하게 자동화할 수 있습니다.
*   **Node Exporter의 Host 모드**: `network_mode: host`와 `pid: host` 옵션은 `node_exporter`가 컨테이너 내부가 아닌 호스트 VM의 네트워크 및 프로세스 정보를 직접 접근하여 정확한 시스템 메트릭을 수집하기 위한 필수 설정입니다.
*   **Grafana 자동 프로비저닝**: `volumes`를 통해 `datasources.yml` 설정 파일을 컨테이너 내 특정 경로에 마운트하면, Grafana 실행 시 수동 설정 작업 없이도 즉시 데이터 소스를 사용할 수 있어 배포 편의성이 크게 향상됩니다.
