---
title: "Network Security Architecture with FortiGate: NAT Migration and 3-Tier Zone Segmentation"
description: "How to migrate FortiGate-60F from Transparent to NAT mode, configure 3-tier Zone isolation (WAS/DB/DEV), and enforce Virtual IP (VIP) forwarding rules"
date: 2026-05-17
tags: [Network, Security, Firewall, FortiGate, NAT, VPN, Architecture]
---

# Network Security Architecture with FortiGate: NAT Migration and 3-Tier Zone Segmentation

::: tip 1-Line Summary
Migrated FortiGate-60F from Transparent to **NAT/Route Mode**, segmented physical ports into isolated **WAS / DB / DEV Zones**, and enforced strict 1:1 Virtual IP (VIP) policies to establish enterprise-grade defense-in-depth.
:::

## 1. Security Architecture & Threat Model

Eliminated direct public IP exposure across backend workloads by shifting instances into RFC1918 private subnets (`10.0.0.0/8`) and isolating subnets into dedicated firewall zones to block lateral movement.

```
[FortiGate 60F Zone Topology]
                        Internet (WAN 1 / Public IP)
                                   │
                         ┌─────────▼─────────┐
                         │   FortiGate-60F   │
                         │  (NAT/Route Mode) │
                         └──┬──────┬──────┬──┘
                            │      │      │
           ┌────────────────┘      │      └────────────────┐
           ▼                       ▼                       ▼
    [WAS Zone (DMZ)]       [DB Zone (Isolated)]    [DEV Zone (Internal)]
     10.0.1.0/24             10.0.2.0/24             10.0.100.0/24
    (Inbound VIP 80/443)    (3306 allowed from WAS)  (SSL-VPN Access)
```

---

## 2. Step-by-Step Configuration

### 1) Operating Mode: Transparent ➔ NAT/Route Mode
Transition the appliance from L2 bridge mode to L3 routing/NAT mode to act as the primary network gateway.

### 2) Port Isolation & Subnet Allocation
Break out physical switch interfaces into dedicated zones:
* **Port 1 (WAS Zone)**: `10.0.1.1/24`
* **Port 2 (DB Zone)**: `10.0.2.1/24` (Direct outbound internet blocked)
* **Port 3 (DEV Zone)**: `10.0.100.1/24`

### 3) Virtual IP (VIP) Port Forwarding
Map inbound web traffic from the public IP to the private WAS server:

```ini
config firewall vip
    edit "VIP_WAS_HTTPS"
        set extip 203.0.113.10
        set mappedip "10.0.1.10"
        set extintf "wan1"
        set portforward enable
        set protocol tcp
        set extport 443
        set mappedport 443
    next
end
```

### 4) Inter-Zone Traffic Rules
* **WAS ➔ DB**: Whitelist strictly required database ports (`TCP 3306`, `TCP 1433`).
* **DB ➔ External**: Explicit Deny All.
* **External ➔ All**: Implicit Deny All except defined VIP endpoints.

---

## 3. Gotchas & Engineering Checkpoints

1. **Console Access During Mode Switch**: Switching from Transparent to NAT mode flushes interface configurations; always execute via local serial console.
2. **VIP Policy Binding**: Creating a VIP object is insufficient; an explicit `firewall policy` referencing the VIP as the destination address must be active for packets to traverse.

---
*Published: 2026-05-17 08:11:32*
*Updated: 2026-08-15 13:57:00*
