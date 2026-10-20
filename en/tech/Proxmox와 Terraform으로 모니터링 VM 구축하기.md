---
title: "Automating Proxmox Monitoring VM Deployment with Terraform and cloud-init"
description: "This post analyzes a configuration example leveraging Terraform's cloud-init support to automate the deployment of a Docker-based Prometheus, Grafana, and Loki monitoring stack via Docker Compose during Proxmox VM creation."
date: 2026-10-20
tags: [Tech, Automation, Architecture, Linux, Cloud]
---

# Automating Proxmox Monitoring VM Deployment with Terraform and cloud-init

::: tip TL;DR
This post details automating the entire process, from Proxmox VM creation to deploying a Docker-based Prometheus and Grafana monitoring stack, using Terraform's `proxmox_virtual_environment_file` resource and cloud-init scripts.
:::

## Project Overview and VM Configuration
As an initial step in a project to set up a virtual machine lab for testing in a Proxmox environment, the goal is to automate the deployment of a monitoring server (`vm1-monitor`). The entire lab environment is defined using Terraform variables as follows:

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

For the `vm1-monitor` VM, we'll use Terraform and cloud-init to deploy a Prometheus and Grafana-based monitoring stack.

## Deploying cloud-init Scripts with Terraform
We use the `proxmox_virtual_environment_file` resource to store the cloud-init user data script as a Proxmox snippet. This script runs when the VM first boots, automating everything from OS configuration to application deployment.

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

### cloud-init Configuration Breakdown

#### 1. Initial OS Setup and Package Installation
The initial part of the script configures the VM's basic environment. It specifies the hostname, FQDN, and sets up the root user's SSH key and password. Subsequently, `package_update: true` updates the system, and essential utilities defined in the `packages` list are installed.

#### 2. Dynamic Configuration File Generation (`write_files`)
The `write_files` directive is used to pre-create the necessary configuration files for the monitoring stack inside the VM.

-   **/opt/monitoring/prometheus.yml**: Defines Prometheus's scrape targets. Currently, `static_configs` are used to statically specify the IP addresses of the VMs to be monitored.
    ```yaml
    global:
      scrape_interval: 5s
    scrape_configs:
      - job_name: 'proxmox-cluster'
        static_configs:
          - targets: ['10.0.0.100:9100'] # vm1-monitor
            # ... 다른 VM 타겟들
    ```
-   **/opt/monitoring/provisioning/datasources/datasources.yml**: Defines data sources that Grafana will automatically provision upon startup. This eliminates the need to manually connect Prometheus and Loki via the Grafana UI.
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
-   **/opt/monitoring/docker-compose.yml**: Defines all services comprising the monitoring stack (Prometheus, Loki, Grafana, Node Exporter) using Docker Compose.
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

#### 3. Service Installation and Execution (`runcmd`)
The `runcmd` block executes sequentially in the final stage of the script.
1.  Stops and disables the `firewalld` service.
2.  Adds the Docker CE repository and installs Docker-related packages.
3.  Enables and starts the Docker service.
4.  Uses the `docker-compose.yml` file, created by `write_files`, to run all defined monitoring services in the background.

## Key Takeaways (Gotchas)
-   **`cloud-init`'s Integrated Deployment Capabilities**: `cloud-init` goes beyond simple OS initialization; it enables building a 'Zero-Touch' deployment pipeline by generating application configuration files with `write_files` and installing runtimes like Docker to launch services via `runcmd`.
-   **Leveraging Docker Compose Networks**: A custom bridge network named `monitoring` simplifies inter-service communication. In Grafana's configuration, Prometheus's URL can be specified by its container name, such as `http://prometheus:9090`, eliminating IP address dependency.
-   **`node-exporter` Host Metric Collection Setup**: The `node-exporter` container is configured with `network_mode: host` and `pid: host` options, and the host's root filesystem (`/`) is mounted to `/host` inside the container. This is a crucial configuration to accurately collect system metrics from the `vm1-monitor` VM itself, rather than from within the container.
