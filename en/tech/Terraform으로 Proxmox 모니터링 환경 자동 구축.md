---
title: "Automating Proxmox Monitoring VM Deployment with Terraform and Cloud-init"
description: "This post explains how to automate the deployment of a monitoring stack (Prometheus, Grafana, etc.) via Docker Compose, from VM creation to injecting cloud-init scripts using Terraform's `proxmox_virtual_environment_file` resource."
date: 2026-10-20
tags: [Tech, Automation, Architecture, Linux]
---

# Automating Proxmox Monitoring VM Deployment with Terraform and Cloud-init

::: tip TL;DR
This setup uses Terraform and cloud-init to create a Proxmox VM and automatically deploy a Prometheus, Grafana, and Loki monitoring stack via Docker Compose upon VM boot.
:::

## Overview

This post details how to automatically build a foundational monitoring system using Terraform for managing multiple test virtual machines in a Proxmox environment. The goal is to automate the deployment of a Prometheus, Grafana, Loki, and Node Exporter stack on a specific VM named `vm1-monitor` via Docker Compose, leveraging cloud-init.

## Defining the VM Environment

We define the complete list of VMs required for the project, along with their specifications and roles, using Terraform variables. Among these, `vm1-monitor` is the target for installing the monitoring stack.

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

## Automating VM Provisioning with Cloud-init

We use the `proxmox_virtual_environment_file` resource to upload a cloud-init configuration file to Proxmox's snippets feature. This file will automatically execute when the monitoring VM is created, handling everything from initial system setup to the deployment of monitoring applications.

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

### Configuration Breakdown

1.  **Initial System Setup**: Basic VM information is configured and essential packages are installed using modules like `hostname`, `users`, and `packages`.
2.  **Configuration File Creation (`write_files`)**:
    *   `prometheus.yml`: Statically defines the targets for Prometheus to scrape. It explicitly lists the `node-exporter` endpoints (`:9100`) for all lab VMs, including `vm1-monitor` itself.
    *   `datasources.yml`: Leverages Grafana's provisioning feature to automatically register Prometheus and Loki as data sources when Grafana starts.
    *   `docker-compose.yml`: Defines each service (Prometheus, Loki, Grafana, Node Exporter) that makes up the monitoring stack. Inter-service communication occurs via the `monitoring` bridge network. Notably, `node_exporter` is configured with `network_mode: host` to collect system metrics directly from the host VM itself, rather than from within the container.
3.  **Service Execution (`runcmd`)**:
    *   Disables the firewall (firewalld).
    *   Adds the Docker CE repository and installs Docker along with Docker Compose.
    *   Enables the Docker service and starts all monitoring services in the background using the `docker-compose.yml` file created in the `write_files` step.

## Key Takeaways (Gotchas)

*   **Leveraging Cloud-init**: By handling package installation, configuration file injection, and service execution in a single workflow simultaneously with VM creation, infrastructure provisioning can be fully automated.
*   **Node Exporter's Host Mode**: The `network_mode: host` and `pid: host` options are crucial for `node_exporter` to directly access network and process information from the host VM itself, rather than from within the container, ensuring accurate system metric collection.
*   **Grafana Auto-Provisioning**: By mounting the `datasources.yml` configuration file to a specific path within the container via `volumes`, data sources can be used immediately upon Grafana startup without manual configuration, significantly improving deployment convenience.

*Posted: 2026-10-20 00:00:00*
