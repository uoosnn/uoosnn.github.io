---
title: "Automating Proxmox Monitoring Stack Deployment with Terraform and Cloud-init"
description: "This post details a configuration example for automatically deploying a monitoring stack (Prometheus, Grafana, Loki, etc.) via Docker Compose using cloud-init scripts when creating Proxmox VMs, leveraging Terraform's `proxmox_virtual_environment_file` resource."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# Automating Proxmox Monitoring Stack Deployment with Terraform and Cloud-init

::: tip TL;DR
By injecting cloud-init configurations into the Terraform `proxmox_virtual_environment_file` resource, we can automatically set up a Docker Compose-based Prometheus, Grafana, and Loki monitoring environment concurrently with Proxmox VM provisioning.
:::

## Overview

The goal is to set up a test virtual machine cluster in a Proxmox environment, designate one of these VMs as a monitoring server, and automatically deploy a Prometheus, Grafana, and Loki stack. By combining Terraform's Proxmox Provider with cloud-init, we manage the entire process, from VM creation to application deployment, as code.

## Terraform Variable Definition

We declare the entire list of VMs to be used in the project as Terraform variables to ensure consistent management. Each VM has a unique `vmid`, hardware specifications (`cores`, `memory`), and a `role`. In this configuration, we'll focus on the `vm1-monitor` VM's setup.

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

We use the `proxmox_virtual_environment_file` resource to create a cloud-init user data file in the Proxmox datastore. This file will execute when the monitoring VM boots, automatically handling all tasks from system configuration and package installation to creating configuration files and running Docker containers.

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
      # Prometheus configuration file
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

      # Grafana datasource provisioning
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

      # Docker Compose file
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

### Cloud-init Configuration Analysis

-   **`write_files`**: Pre-creates necessary configuration files inside the VM.
    -   `prometheus.yml`: Statically defines the targets Prometheus will scrape.
    -   `datasources.yml`: Configures Grafana to automatically register Prometheus and Loki as data sources upon startup.
    -   `docker-compose.yml`: Defines all services comprising the monitoring stack (Prometheus, Loki, Grafana, Node Exporter) and connects them via the `monitoring` bridge network.
-   **`node_exporter` configuration**: To collect system metrics from the host VM itself, rather than just within the container, we use `network_mode: host` and `pid: host` options. Additionally, the host's root filesystem is mounted as `/host` in read-only mode to allow collecting comprehensive system information.
-   **`runcmd`**: A list of commands to be executed in the final stage of VM boot. This includes disabling the firewall, installing and enabling Docker, and running the monitoring stack in the background using the defined `docker-compose.yml` file.

## Gotchas

-   **Leveraging Cloud-init Snippets**: The `content_type = "snippets"` option in the `proxmox_virtual_environment_file` resource is key to utilizing Proxmox's snippet feature. This allows direct injection of cloud-init scripts within the Terraform code without needing a separate HTTP server.
-   **Node Exporter Host Metric Collection**: For accurate host monitoring, the `node_exporter` container must be configured with `network_mode: host` and the host's root filesystem (`/:/host:ro,rslave`) mounted. This setup allows it to collect system-wide metrics beyond the container's isolated environment.
-   **Automating Grafana Data Sources**: By pre-creating data source configuration files in Grafana's provisioning directory (`/etc/grafana/provisioning/datasources`) via `write_files`, Prometheus and Loki become immediately available for use when the Grafana container starts, without any manual intervention.
