---
title: "Automating Monitoring VM Deployment with Proxmox and Terraform"
description: "This post details how to automatically deploy a monitoring stack including Prometheus, Grafana, and Loki using Docker Compose in a Proxmox virtual environment, leveraging Terraform and cloud-init."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux]
---

# Automating Monitoring VM Deployment with Proxmox and Terraform

::: tip TL;DR
Leveraging Terraform's `proxmox_virtual_environment_file` resource to inject cloud-init scripts, we automatically configure a Docker-based Prometheus monitoring stack concurrently with Proxmox VM creation.
:::

## Project Overview

We're setting up a Proxmox-based virtualization environment for a test project. The entire VM configuration is managed via Terraform variables, with a focus on automating the `vm1-monitor` VM, which will serve as our monitoring node.

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

On `vm1-monitor`, we'll deploy a monitoring stack consisting of Prometheus, Grafana, Loki, and Node Exporter using Docker Compose.

## Automating VM Provisioning with Cloud-Init

We use Terraform's `proxmox_virtual_environment_file` resource to store and inject a cloud-init file containing all necessary configurations and scripts as a Proxmox snippet during VM creation.

```terraform
resource "proxmox_virtual_environment_file" "monitor_user_data" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "localhost"
  source_raw {
    data      = <<-EOF
    #cloud-config
    # ... cloud-init content ...
    EOF
    file_name = "user-data-monitor.yaml"
  }
}
```

### Cloud-Init Configuration Details

The cloud-init script automates all steps from initial VM setup, package installation, configuration file creation, to Docker Compose execution.

#### 1. Basic System Configuration and Package Installation
We configure the VM's hostname, FQDN, and register the `root` user's SSH key. Subsequently, essential utilities like `curl` and `wget` are installed, along with `dnf-plugins-core`, which is required for Docker installation.

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

#### 2. Creating Monitoring Stack Configuration Files (`write_files`)
The `write_files` module is used to create Prometheus, Grafana datasource, and Docker Compose configuration files at specified paths within the VM.

-   **/opt/monitoring/prometheus.yml**: Defines Prometheus's scrape targets. Currently, we directly specify the IP addresses of the VMs to be monitored via `static_configs`.

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

-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Configures Grafana to automatically register Prometheus and Loki as datasources upon startup.

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

-   **/opt/monitoring/docker-compose.yml**: Defines each service (Prometheus, Loki, Grafana, Node Exporter) comprising the monitoring stack as containers.

    ```yaml
    version: '3.8'
    services:
      prometheus:
        image: prom/prometheus:latest
        container_name: prometheus
        # ...
      loki:
        image: grafana/loki:latest
        container_name: loki
        # ...
      grafana:
        image: grafana/grafana:latest
        container_name: grafana
        # ...
      node_exporter:
        image: prom/node-exporter:latest
        container_name: node_exporter
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

#### 3. Running Services (`runcmd`)
After all files are created, `runcmd` is used to disable the firewall, install and start Docker, and then run the monitoring stack in the background using the generated `docker-compose.yml` file.

```yaml
runcmd:
  - systemctl stop firewalld || true
  - systemctl disable firewalld || true
  - dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  - dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  - systemctl enable --now docker
  - docker compose -f /opt/monitoring/docker-compose.yml up -d
```

## Key Checkpoints (Gotchas)

-   **Grafana Auto-Provisioning**: When running the Grafana container, mounting the datasource configuration file (`datasources.yml`) to `/etc/grafana/provisioning/datasources` via `volumes` will automatically register the datasources upon Grafana startup, eliminating the need for manual configuration.
-   **Node Exporter Host Metric Collection**: To run Node Exporter as a Docker container and collect metrics from the host VM itself, you must use the `network_mode: host` and `pid: host` options. Additionally, the host's root filesystem needs to be mounted read-only to `/host` within the container, and the `--path.rootfs=/host` argument must be passed to collect accurate system information.
-   **Cloud-Init and Terraform Integration**: Using the `proxmox_virtual_environment_file` resource allows you to manage complex multi-line scripts or configuration files directly within your Terraform code via `source_raw`, generating them as Proxmox snippets. This is a crucial aspect of automating VM provisioning.

*Posted: 2026-10-20 00:00:00*
