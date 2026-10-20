---
title: "Terraform과 cloud-init을 이용한 Proxmox 모니터링 VM 배포 자동화"
description: "Terraform의 cloud-init 지원 기능을 활용하여 Proxmox VM 생성 시 Docker 설치 및 Prometheus, Grafana, Loki 모니터링 스택을 Docker Compose로 자동 배포하는 구성 사례를 분석합니다."
date: 2026-10-20
tags: [Tech, Automation, Architecture, Linux, Cloud]
---

# Terraform과 cloud-init을 이용한 Proxmox 모니터링 VM 배포 자동화

::: tip 1줄 요약
Terraform의 `proxmox_virtual_environment_file` 리소스를 활용, cloud-init 스크립트로 Proxmox VM 생성부터 Docker 기반 Prometheus, Grafana 모니터링 스택 배포까지 전 과정을 자동화한 구성 기록입니다.
:::

## 프로젝트 개요 및 VM 구성
Proxmox 환경에서 테스트를 위한 가상머신 랩을 구성하는 프로젝트의 초기 단계로, 모니터링 서버(`vm1-monitor`) 구축을 자동화하는 것을 목표로 합니다. 전체 랩 환경은 Terraform 변수로 다음과 같이 정의되었습니다.

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

이 중 `vm1-monitor` VM에 Prometheus, Grafana 기반의 모니터링 스택을 배포하기 위해 Terraform과 cloud-init을 사용합니다.

## Terraform을 이용한 cloud-init 스크립트 배포
`proxmox_virtual_environment_file` 리소스를 사용하여 cloud-init 사용자 데이터 스크립트를 Proxmox의 스니펫으로 저장합니다. 이 스크립트는 VM이 처음 부팅될 때 실행되어 OS 설정부터 애플리케이션 배포까지 모든 과정을 자동으로 처리합니다.

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
      # Prometheus, Grafana, Docker Compose 설정 파일 생성
      # ... (파일 내용은 아래에서 상세 분석)

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

### cloud-init 구성 분석

#### 1. OS 초기 설정 및 패키지 설치
스크립트의 초기 부분은 VM의 기본 환경을 설정합니다. 호스트 이름, FQDN을 지정하고 root 사용자의 SSH 키와 패스워드를 설정합니다. 이후 `package_update: true`로 시스템을 업데이트하고 `packages` 목록에 정의된 필수 유틸리티들을 설치합니다.

#### 2. 설정 파일 동적 생성 (`write_files`)
`write_files` 지시문을 사용하여 VM 내부에 모니터링 스택에 필요한 설정 파일들을 미리 생성합니다.

-   **/opt/monitoring/prometheus.yml**: Prometheus의 스크레이프 대상을 정의합니다. 현재는 `static_configs`를 통해 모니터링할 VM들의 IP 주소를 정적으로 명시하고 있습니다.
    ```yaml
    global:
      scrape_interval: 5s
    scrape_configs:
      - job_name: 'proxmox-cluster'
        static_configs:
          - targets: ['10.0.0.100:9100'] # vm1-monitor
            # ... 다른 VM 타겟들
    ```
-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Grafana가 시작될 때 자동으로 프로비저닝할 데이터 소스를 정의합니다. 이를 통해 Grafana UI에서 수동으로 Prometheus와 Loki를 연결할 필요가 없어집니다.
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
-   **/opt/monitoring/docker-compose.yml**: 모니터링 스택을 구성하는 모든 서비스(Prometheus, Loki, Grafana, Node Exporter)를 Docker Compose로 정의합니다.
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

#### 3. 서비스 설치 및 실행 (`runcmd`)
`runcmd` 블록은 스크립트의 마지막 단계에서 순차적으로 실행됩니다.
1.  `firewalld` 서비스를 중지 및 비활성화합니다.
2.  Docker CE 리포지토리를 추가하고 Docker 관련 패키지를 설치합니다.
3.  Docker 서비스를 활성화하고 시작합니다.
4.  `write_files`로 생성된 `docker-compose.yml` 파일을 사용하여 정의된 모든 모니터링 서비스를 백그라운드에서 실행합니다.

## 핵심 체크포인트 (Gotchas)
-   **`cloud-init`의 통합 배포 능력**: `cloud-init`은 단순한 OS 초기화를 넘어, `write_files`로 애플리케이션 설정 파일을 생성하고 `runcmd`로 Docker와 같은 런타임을 설치하여 서비스까지 실행하는 'Zero-Touch' 배포 파이프라인 구축이 가능합니다.
-   **Docker Compose 네트워크 활용**: `monitoring`이라는 사용자 정의 브리지 네트워크를 생성하여 서비스 간 통신을 단순화했습니다. Grafana 설정에서 Prometheus의 URL을 `http://prometheus:9090`과 같이 컨테이너 이름으로 지정할 수 있어 IP 주소 의존성을 제거합니다.
-   **`node-exporter`의 호스트 메트릭 수집 설정**: `node-exporter` 컨테이너에 `network_mode: host`, `pid: host` 옵션을 적용하고 호스트의 루트 파일시스템(`/`)을 컨테이너 내부 `/host`로 마운트했습니다. 이는 컨테이너 내부가 아닌, 컨테이너가 실행 중인 `vm1-monitor` VM 자체의 시스템 메트릭을 정확하게 수집하기 위한 필수 구성입니다.
