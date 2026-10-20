---
title: "Automating Monitoring Environment Setup with Proxmox and Terraform"
description: "This post details the complete configuration process for automatically deploying a Docker-based Prometheus and Grafana monitoring stack when creating Proxmox VMs using Terraform and cloud-init."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# Automating Monitoring Environment Setup with Proxmox and Terraform

::: tip TL;DR
By injecting cloud-init configurations via Terraform's `proxmox_virtual_environment_file` resource, we fully automate the deployment of a Docker Compose-based monitoring stack (Prometheus, Grafana, Loki) concurrently with VM provisioning.
:::

## Project Overview and VM Configuration

We're setting up a Proxmox-based virtual environment for a test project. The complete list of VMs and their roles are defined as Terraform variables, and this post will focus on the automated setup process for `vm1-monitor`, which will serve as our monitoring node.

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

A Prometheus and Grafana-based monitoring stack will be deployed on `vm1-monitor`.

## Automating VM Provisioning with Cloud-init

We use Terraform's `proxmox_virtual_environment_file` resource to create a cloud-init configuration file (`user-data-monitor.yaml`) on Proxmox and pass it to the VM. This script automatically executes upon VM boot to complete the initial setup.

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

### 1. Basic System Setup and Package Installation

The cloud-init script performs hostname configuration, registers SSH keys for the root account, and installs necessary packages.

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

### 2. Creating Monitoring Stack Configuration Files (`write_files`)

We pre-create the configuration files required to run the monitoring stack inside the VM.

-   **/opt/monitoring/prometheus.yml**: The Prometheus configuration file, which defines all lab VMs as static targets.
-   **/opt/monitoring/provisioning/datasources/datasources.yml**: A Grafana provisioning file that automatically registers Prometheus and Loki as data sources upon boot.
-   **/opt/monitoring/docker-compose.yml**: The Docker Compose file that defines and manages the Prometheus, Loki, Grafana, and Node Exporter containers.

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

The `node_exporter` uses `network_mode: host` and `pid: host` options to accurately collect system metrics from the host VM, and mounts the host's root filesystem (`/`) into the container.

### 3. Running Services (`runcmd`)

After all files are created, `runcmd` sequentially executes the commands to start the actual services.

-   Disable firewalld
-   Add and install Docker CE repository
-   Enable and start Docker service
-   Run the monitoring stack using the generated `docker-compose.yml` file

```yaml
runcmd:
  - systemctl stop firewalld || true
  - systemctl disable firewalld || true
  - dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  - dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  - systemctl enable --now docker
  - docker compose -f /opt/monitoring/docker-compose.yml up -d
```

Through this process, a single `terraform apply` command automatically completes all tasks, from Proxmox VM creation to monitoring environment deployment.

## Key Takeaways (Gotchas)

*   **Leveraging Cloud-init**: By directly injecting cloud-init scripts via Terraform's `proxmox_virtual_environment_file` and `source_raw`, you can automate complex initialization tasks concurrently with VM creation, all through code.
*   **Declarative Application Deployment**: Defining all monitoring stack components (Prometheus, Grafana, etc.) and their configurations in a single `docker-compose.yml` file makes application layer deployment consistent and reproducible.
*   **Host-level Metric Collection**: When configuring the `node_exporter` container, `network_mode: host`, `pid: host`, and mounting the root filesystem (`/:/host:ro`) are essential configurations for collecting system metrics from the host VM itself, rather than from within the container.

*Posted: 2026-10-20 09:00:00*
