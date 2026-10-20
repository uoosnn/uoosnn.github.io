---
title: "Terraform과 Cloud-init으로 Proxmox 모니터링 스택 구축 자동화"
description: "Terraform의 proxmox_virtual_environment_file 리소스를 활용하여, cloud-init 스크립트로 Proxmox VM 생성 시 Prometheus, Grafana, Loki 등 모니터링 스택을 Docker Compose로 자동 배포하는 구성 사례입니다."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# Terraform과 Cloud-init으로 Proxmox 모니터링 스택 구축 자동화

::: tip 1줄 요약
Terraform `proxmox_virtual_environment_file` 리소스에 cloud-init 설정을 주입하여, Proxmox VM 프로비저닝과 동시에 Docker Compose 기반의 Prometheus, Grafana, Loki 모니터링 환경을 자동으로 구성합니다.
:::

## 개요

Proxmox 환경에서 테스트용 가상머신 클러스터를 구성하고, 이 중 하나의 VM을 모니터링 서버로 지정하여 Prometheus, Grafana, Loki 스택을 자동으로 배포하는 것을 목표로 합니다. Terraform의 Proxmox Provider와 cloud-init을 결합하여 VM 생성부터 애플리케이션 배포까지의 전 과정을 코드로 관리합니다.

## Terraform 변수 정의

프로젝트에서 사용할 전체 VM 목록을 Terraform 변수로 선언하여 관리의 일관성을 확보합니다. 각 VM은 고유 `vmid`, 하드웨어 사양(`cores`, `memory`), 그리고 역할(`role`)을 가집니다. 이 구성에서는 `vm1-monitor` VM의 설정에 집중합니다.

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

`proxmox_virtual_environment_file` 리소스를 사용하여 Proxmox 데이터스토어에 cloud-init 사용자 데이터 파일을 생성합니다. 이 파일은 모니터링 VM이 부팅될 때 실행되어 시스템 설정, 패키지 설치, 설정 파일 생성, Docker 컨테이너 실행까지 모든 작업을 자동으로 처리합니다.

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
      # Prometheus 설정 파일
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

      # Grafana 데이터소스 프로비저닝
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

      # Docker Compose 파일
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

### Cloud-init 구성 분석

- **`write_files`**: VM 내부에 필요한 설정 파일들을 미리 생성합니다.
  - `prometheus.yml`: Prometheus가 수집할 대상(targets)을 정적으로 정의합니다.
  - `datasources.yml`: Grafana가 시작될 때 Prometheus와 Loki를 데이터 소스로 자동 등록하도록 설정합니다.
  - `docker-compose.yml`: 모니터링 스택을 구성하는 모든 서비스(Prometheus, Loki, Grafana, Node Exporter)를 정의하고, `monitoring` 브리지 네트워크로 연결합니다.
- **`node_exporter` 설정**: 컨테이너가 아닌 호스트 VM 자체의 시스템 메트릭을 수집하기 위해 `network_mode: host`와 `pid: host` 옵션을 사용합니다. 또한, 호스트의 루트 파일 시스템을 `/host`로 읽기 전용 마운트하여 전체 시스템 정보를 수집할 수 있도록 설정합니다.
- **`runcmd`**: VM 부팅 시 마지막 단계에서 실행될 명령어 목록입니다. 방화벽 비활성화, Docker 설치 및 서비스 활성화, 그리고 정의된 `docker-compose.yml` 파일을 이용해 모니터링 스택을 백그라운드로 실행합니다.

## 핵심 체크포인트 (Gotchas)

- **Cloud-init Snippet 활용**: `proxmox_virtual_environment_file` 리소스의 `content_type = "snippets"` 옵션은 Proxmox의 스니펫 기능을 활용하는 핵심입니다. 이를 통해 별도의 HTTP 서버 없이 Terraform 코드 내에서 직접 cloud-init 스크립트를 주입할 수 있습니다.
- **Node Exporter의 호스트 메트릭 수집**: 정확한 호스트 모니터링을 위해서는 `node_exporter` 컨테이너에 `network_mode: host` 옵션을 적용하고, 호스트의 루트 파일 시스템(`/:/host:ro,rslave`)을 마운트하여 컨테이너 격리 환경을 벗어난 시스템 전체의 메트릭을 수집하도록 구성해야 합니다.
- **Grafana 데이터소스 자동화**: `write_files`를 통해 Grafana의 프로비저닝 디렉터리(`/etc/grafana/provisioning/datasources`)에 데이터소스 설정 파일을 미리 생성해두면, Grafana 컨테이너 실행 시 수동 개입 없이 즉시 Prometheus와 Loki를 사용할 수 있는 상태가 됩니다.
