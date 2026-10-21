---
title: "Terraform과 cloud-init으로 Proxmox 모니터링 환경 구축 자동화"
description: "Proxmox VM 생성 시 Terraform과 cloud-init을 이용해 Prometheus, Grafana, Loki 등 모니터링 스택을 Docker Compose로 자동 배포하는 전체 설정 과정을 다룹니다."
date: 2026-10-21
tags: [Automation, Tech, Cloud, Serverless]
---

# Terraform과 cloud-init으로 Proxmox 모니터링 환경 구축 자동화

::: tip 1줄 요약
Terraform의 `proxmox_virtual_environment_file` 리소스를 통해 cloud-init 스크립트를 주입하여, Proxmox VM 생성과 동시에 Docker 기반의 Prometheus, Grafana 모니터링 스택을 자동으로 배포합니다.
:::

## 개요

Proxmox 환경에서 테스트용 가상머신 랩을 구성하는 과정에서, 모니터링 서버(`vm1-monitor`)의 구축을 자동화하기 위해 Terraform과 cloud-init이 사용되었습니다. VM 생성 시점에 cloud-init 스크립트가 실행되어 Docker 설치, 설정 파일 작성, 그리고 Docker Compose를 이용한 모니터링 서비스(Prometheus, Grafana, Loki, Node Exporter) 실행까지 모든 과정을 처리합니다.

## Terraform 및 cloud-init 설정 분석

핵심은 `proxmox_virtual_environment_file` 리소스를 사용하여 cloud-init 설정 파일(`user-data-monitor.yaml`)을 Proxmox의 스니펫으로 저장하고, 이를 VM 생성 시 적용하는 것입니다.

아래는 `vm1-monitor` VM에 적용된 전체 cloud-init 스크립트입니다.

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
```

### 주요 실행 단계

1.  **초기 시스템 설정**: VM의 호스트 이름, FQDN을 설정하고 root 계정의 SSH 키와 패스워드를 구성합니다. `package_update: true`를 통해 패키지 목록을 갱신하고 기본 유틸리티를 설치합니다.

2.  **설정 파일 동적 생성 (`write_files`)**:
    *   **`prometheus.yml`**: Prometheus의 설정 파일로, 5대의 VM(`vm1`~`vm5`)을 정적 타겟으로 지정합니다. 각 타겟은 `node_exporter`가 리스닝하는 9100번 포트를 가리킵니다.
    *   **`datasources.yml`**: Grafana의 프로비저닝 기능으로, Grafana 시작 시 Prometheus와 Loki를 데이터 소스로 자동 등록합니다. `url` 항목에 Docker Compose 내부 서비스 이름(`prometheus`, `loki`)을 사용합니다.
    *   **`docker-compose.yml`**: 모니터링 스택의 모든 컴포넌트를 정의합니다. `monitoring` 브릿지 네트워크를 생성하여 서비스 간 통신을 격리하고, `restart: always` 정책으로 컨테이너의 영속성을 보장합니다.

3.  **애플리케이션 배포 및 실행 (`runcmd`)**:
    *   `firewalld` 서비스를 중지 및 비활성화하여 포트 접근 문제를 방지합니다.
    *   Docker CE 리포지토리를 추가하고 Docker 엔진 및 Compose 플러그인을 설치합니다.
    *   `systemctl enable --now docker` 명령으로 Docker 서비스를 활성화하고 즉시 시작합니다.
    *   마지막으로, `docker compose up -d` 명령을 실행하여 `/opt/monitoring` 경로에 생성된 설정 파일을 기반으로 전체 모니터링 스택을 백그라운드에서 실행합니다.

## 핵심 체크포인트 (Gotchas)

*   **정적 IP 의존성**: `prometheus.yml`에 모니터링 대상 VM들의 IP 주소가 하드코딩되어 있습니다. VM의 IP가 변경되거나 추가/삭제될 경우, 설정 파일을 수동으로 수정하고 Prometheus 서비스를 재시작해야 합니다.
*   **보안 설정**: Grafana의 관리자 비밀번호(`GF_SECURITY_ADMIN_PASSWORD`)가 `docker-compose.yml` 파일에 평문으로 노출되어 있습니다. 프로덕션 환경에서는 Vault나 다른 시크릿 관리 도구를 사용하는 것이 안전합니다.
*   **방화벽 정책**: `runcmd`에서 `firewalld`를 완전히 비활성화합니다. 이는 테스트 환경에서는 편리하지만, 보안상 취약할 수 있습니다. 실제 운영 환경에서는 필요한 포트(3000, 9090, 9100 등)만 선별적으로 허용하는 방화벽 규칙을 적용해야 합니다.
