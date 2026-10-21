---
title: "Automating Proxmox Monitoring Setup with Terraform and cloud-init"
description: "This post covers the complete setup process for automatically deploying a monitoring stack (Prometheus, Grafana, Loki, etc.) using Docker Compose when creating Proxmox VMs with Terraform and cloud-init."
date: 2026-10-21
tags: [Automation, Tech, Cloud, Serverless]
---

# Automating Proxmox Monitoring Setup with Terraform and cloud-init

::: tip TL;DR
By injecting a cloud-init script via Terraform's `proxmox_virtual_environment_file` resource, we can automatically deploy a Docker-based Prometheus and Grafana monitoring stack concurrently with Proxmox VM creation.
:::

## Overview

During the setup of a test virtual machine lab in a Proxmox environment, Terraform and cloud-init were utilized to automate the deployment of a monitoring server (`vm1-monitor`). Upon VM creation, the cloud-init script executes, handling everything from Docker installation and configuration file generation to launching monitoring services (Prometheus, Grafana, Loki, Node Exporter) via Docker Compose.

## Terraform and cloud-init Configuration Analysis

The core idea is to use the `proxmox_virtual_environment_file` resource to store the cloud-init configuration file (`user-data-monitor.yaml`) as a Proxmox snippet, which is then applied during VM creation.

Below is the complete cloud-init script applied to the `vm1-monitor` VM.

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

### Key Execution Steps

1.  **Initial System Setup**: Configures the VM's hostname and FQDN, and sets up the root account's SSH key and password. Updates package lists and installs essential utilities via `package_update: true`.

2.  **Dynamic Configuration File Generation (`write_files`)**:
    *   **`prometheus.yml`**: Prometheus configuration file, specifying 5 VMs (`vm1`~`vm5`) as static targets. Each target points to port 9100, where `node_exporter` is listening.
    *   **`datasources.yml`**: Utilizes Grafana's provisioning feature to automatically register Prometheus and Loki as data sources upon Grafana startup. The `url` field uses the internal Docker Compose service names (`prometheus`, `loki`).
    *   **`docker-compose.yml`**: Defines all components of the monitoring stack. It creates a `monitoring` bridge network to isolate communication between services and ensures container persistence with a `restart: always` policy.

3.  **Application Deployment and Execution (`runcmd`)**:
    *   Stops and disables the `firewalld` service to prevent port access issues.
    *   Adds the Docker CE repository and installs the Docker engine and Compose plugin.
    *   Enables and immediately starts the Docker service using the `systemctl enable --now docker` command.
    *   Finally, executes the `docker compose up -d` command to run the entire monitoring stack in the background, based on the configuration files created in `/opt/monitoring`.

## Key Gotchas

*   **Static IP Dependency**: The IP addresses of the monitored VMs are hardcoded in `prometheus.yml`. If a VM's IP changes, or if VMs are added/removed, the configuration file must be manually updated, and the Prometheus service restarted.
*   **Security Configuration**: Grafana's admin password (`GF_SECURITY_ADMIN_PASSWORD`) is exposed in plain text within the `docker-compose.yml` file. For production environments, it's safer to use Vault or other secret management tools.
*   **Firewall Policy**: `firewalld` is completely disabled in `runcmd`. While convenient for a test environment, this can be a security vulnerability. In a production setting, firewall rules should be applied to selectively allow only necessary ports (e.g., 3000, 9090, 9100).
