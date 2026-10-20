---
title: "Automating Monitoring Environment Setup with Proxmox and Terraform"
description: "This post covers a configuration example of automatically deploying a Prometheus, Grafana, and Loki monitoring stack with Docker Compose when creating Proxmox VMs, leveraging Terraform and cloud-init."
date: 2026-10-20
tags: [Tech, Automation, Cloud, Linux, Architecture]
---

# Automating Monitoring Environment Setup with Proxmox and Terraform

::: tip TL;DR
During Proxmox VM provisioning, we inject cloud-init configurations via Terraform's `proxmox_virtual_environment_file` resource to automatically deploy a Docker Compose-based Prometheus and Grafana monitoring stack.
:::

## Project Overview and VM Configuration

To set up our test project environment, we manage Proxmox-based virtual machines using Terraform. The entire lab environment consists of monitoring, load balancer, web, and data VMs.

The list of virtual machines defined as Terraform variables is as follows. We'll focus on the automated configuration of `vm1-monitor`.

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

## Automating the Monitoring VM with Cloud-init

We use the `proxmox_virtual_environment_file` resource to pass a cloud-init script during VM creation. This script automates everything from initial VM setup to deploying the monitoring stack.

```terraform
resource "proxmox_virtual_environment_file" "monitor_user_data" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "localhost"
  source_raw {
    data      = <<-EOF
    #cloud-config
    # ... (cloud-init content) ...
    EOF
    file_name = "user-data-monitor.yaml"
  }
}
```

### Detailed Analysis of the Cloud-config Script

The complete cloud-init script consists of three phases: system initialization, configuration file creation, and service execution.

#### 1. System Initialization and Package Installation

We configure the VM's hostname, FQDN, and specify the root account's SSH key and password. Then, `package_update` is executed, and essential packages required for Docker installation are installed.

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

#### 2. Dynamic Configuration File Generation (`write_files`)

We use the `write_files` directive to create the necessary configuration files for the monitoring stack inside the VM.

-   **/opt/monitoring/prometheus.yml**: This is Prometheus's configuration file, where we pre-define the list of all VMs to be monitored (as `node-exporter` targets) via `static_configs`.

    ```yaml
    global:
      scrape_interval: 5s
    scrape_configs:
      - job_name: 'proxmox-cluster'
        static_configs:
          - targets: ['10.0.0.100:9100']
            labels:
              instance: 'vm1-monitor'
          # ... other targets
    ```

-   **/opt/monitoring/provisioning/datasources/datasources.yml**: This configuration is used for Grafana's provisioning feature. When the Grafana container starts, it reads this file to automatically register Prometheus and Loki as data sources.

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

-   **/opt/monitoring/docker-compose.yml**: This defines the entire monitoring stack, including Prometheus, Grafana, Loki, and Node Exporter. Each service communicates via the `monitoring` bridge network.

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
      loki:
        image: grafana/loki:latest
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

#### 3. Docker Installation and Service Execution (`runcmd`)

In the final step of the script, we execute actual commands via `runcmd`. We disable the firewall, add the Docker CE repository, and install Docker and the Docker Compose plugin. Finally, all monitoring services are started in the background using the `docker-compose.yml` file created earlier.

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

-   **Cloud-init Automation**: The `proxmox_virtual_environment_file` resource is the key conduit for injecting cloud-init user data into Proxmox VMs. This enables complete zero-touch provisioning, from VM creation to application deployment.
-   **Grafana Provisioning**: By mounting YAML configuration files to the `/etc/grafana/provisioning/datasources` path within the Grafana container, you can manage and automatically register data sources as code, without manual UI configuration.
-   **Node Exporter Host Metric Collection**: To accurately collect system metrics from the host VM itself using the `node_exporter` container, you need to use `network_mode: host`, `pid: host` options, and mount the host's root filesystem (`/`) into the container as read-only.

*Posted: 2026-10-20 00:00:00*
