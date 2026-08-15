---
title: "Configuring Network Security Using a Forti Firewall"
date: 2026-05-17
tags: [Tech, AI, 기술분석]
---

# Configuring Network Security Using a Forti Firewall


This document outlines how to configure a network based on a FortiGate firewall to meet customer security requirements. This article covers the process of configuring internal server IPs as private and enhancing security by segmenting the network into Zones.

## Getting Started: Firmware Update and Initial Setup

Before starting the main configuration, the first step is to update the firewall's firmware to the latest version and perform basic initial setup. This is an essential first step to building a stable and secure network environment.

## 1. Private Internal IP Configuration (NAT Setup)

For server security, we will use private IPs internally and apply Network Address Translation (NAT) settings to allow access from the outside via public IPs.

- **Mode Change**: If the firewall is currently operating in TP (Transparent/Bridge) mode, it must be changed to a mode that supports NAT configuration.
- **Effect**: Through this configuration, internal servers will use a private IP range, blocking direct external access and enhancing security.

## 2. Network Segmentation through Zone Division

The network is logically divided by creating Zones for each physical port. This allows for granular control over communication between each Zone.

- **Zone Configuration**: In addition to the currently used `internal` Zone, up to 7 additional Zones can be configured using available ports.
- **Private IP Range Assignment**: Independent private IP ranges can be assigned to each Zone.
  - Example: `was (10.0.1.x/24)`, `db (10.0.2.x/24)`, `dev (10.0.100.x/24)`
- **Policy-Based Communication**: Communication between Zones is only permitted through firewall policies, effectively blocking unauthorized internal traffic.
- **Required Equipment**: If multiple servers need to be connected under a Zone, renting two additional switches may be necessary.

## 3. Additional Feature: SSL-VPN Utilization

The Forti-60F device in use supports the SSL-VPN feature. This allows for the creation of an environment where users can securely access the internal network from the outside. Detailed configuration requires consultation with the security team.

## Conclusion

As described above, a robust network security environment can be established by configuring NAT, Zone division, and policies on the Forti firewall. Once this configuration is complete, a separate router device like the previously used Cisco 1900 may no longer be necessary.

---
*Published: 2026-05-17 08:11:32*

---
*Posted: 2026-08-15 13:57:00*
*Updated: 2026-08-15 13:57:00*
