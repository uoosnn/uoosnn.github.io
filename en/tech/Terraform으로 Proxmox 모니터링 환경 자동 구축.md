---
title: "Automating Proxmox Monitoring VM Deployment with Terraform and cloud-init"
description: "This post details how to create a Proxmox VM using Terraform's `proxmox_virtual_environment_file` resource and automatically configure a Docker-based Prometheus, Grafana, and Loki stack with cloud-init."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# Automating Proxmox Monitoring VM Deployment with Terraform and cloud-init

::: tip TL;DR
This post covers how to automatically deploy a Docker-based Prometheus and Grafana monitoring stack at the time of Proxmox VM creation, leveraging Terraform's `proxmox_virtual_environment_file` resource and cloud-init.
:::

## Overview

When building a test virtual machine cluster in a Proxmox environment, manually setting up the monitoring stack can be repetitive and inefficient. This document outlines how to automate the entire process, from creating a VM (`vm1-monitor`) dedicated to monitoring, to deploying the Prometheus, Grafana, and Loki monitoring stack, by combining Terraform and cloud-init.

## Terraform and cloud-init Configuration

Terraform's `proxmox_virtual_environment_file` resource allows you to automate initial setup by injecting cloud-init scripts at the time of VM creation. The cloud-init script defined within the `source_raw` block will execute on the VM's first boot.

### 1. Defining the Terraform Resource

We'll use the `proxmox_virtual_environment_file` resource to upload a cloud-init script file named `user-data-monitor.yaml` to Proxmox storage (`snippets` on `local`). This file will then be referenced during VM creation.

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

### 2. Detailed cloud-init Script Configuration

Tasks to be executed on VM boot are defined in YAML format under the `#cloud-config` directive.

#### Basic System Setup and Package Installation

Set the VM's hostname, FQDN, and specify the root user's SSH key and password. Then, perform a `package_update` and install `curl`, `tar`, `wget`, and Docker-related packages required for the monitoring stack deployment.

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

#### Creating Configuration Files (`write_files`)

The `write_files` module is used to pre-create configuration files for the Docker Compose-based monitoring stack within the VM, at the `/opt/monitoring` path.

-   **/opt/monitoring/prometheus.yml**: Defines Prometheus's scrape targets. Currently, 5 VMs are specified using a static IP list.
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

-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Configures Grafana to automatically register data sources upon startup. This eliminates the need to manually add Prometheus and Loki via the Grafana UI.
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

-   **/opt/monitoring/docker-compose.yml**: Defines Prometheus, Grafana, Loki, and Node Exporter services as containers. Each service communicates via the `monitoring` bridge network.
    ```yaml
    version: '3.8'
    services:
      prometheus:
        # ...
      grafana:
        # ...
        volumes:
          - /opt/monitoring/provisioning/datasources:/etc/grafana/provisioning/datasources
      loki:
        # ...
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
    `node_exporter` runs with `network_mode: host`, `pid: host` options, and mounts the host's root filesystem (`/`) to accurately collect system metrics from the host VM.

#### Running Services (`runcmd`)

After all files are created, the `runcmd` module sequentially executes the actual service installation and startup commands. It disables the firewall, adds the Docker repository, installs Docker and Docker Compose, then registers and enables them as system services. Finally, it uses the pre-created `docker-compose.yml` file to run the monitoring stack in the background.

```yaml
runcmd:
  - systemctl stop firewalld || true
  - systemctl disable firewalld || true
  - dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  - dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  - systemctl enable --now docker
  - docker compose -f /opt/monitoring/docker-compose.yml up -d
```

## Key Takeaways (Gotchas)

*   **Leveraging cloud-init**: Utilizing `cloud-init` at VM creation time allows for complete automation of initialization tasks such as package installation, configuration file creation, and service execution, ensuring a consistent environment.
*   **Grafana Provisioning**: Grafana's Provisioning feature enables managing data sources and dashboards as code. By simply mounting configuration files as container volumes, configurations are automatically applied when Grafana starts, eliminating manual setup.
*   **Node Exporter Host Mode**: For a containerized `node_exporter` to accurately collect metrics from the host system, permission settings such as `network_mode: host`, `pid: host`, and mounting the root filesystem (`--path.rootfs=/host`) are essential.

*Posted: 2026-10-20 00:00:00*
