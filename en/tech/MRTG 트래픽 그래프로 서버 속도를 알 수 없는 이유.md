---
title: "Why MRTG Traffic Graphs Cannot Measure True Server Latency"
description: "Throughput vs Latency fundamentals, diagnosing hop-by-hop RTT with traceroute and mtr, and identifying bandwidth saturation clipping patterns"
date: 2026-07-10
tags: [Network, MRTG, Troubleshooting, Latency, Bandwidth, Infrastructure]
---

# Why MRTG Traffic Graphs Cannot Measure True Server Latency

::: tip 1-Line Summary
MRTG only visualizes **Throughput (bits transferred per second)** and cannot measure user-perceived **Latency (Round-Trip Time)**; engineers must combine `traceroute` and `mtr` to diagnose true network bottlenecks.
:::

## 1. Throughput vs Latency: The Highway Analogy

When clients complain that "the server feels slow," presenting an MRTG graph is insufficient because the metrics represent fundamentally different physical characteristics.

```
[Highway Analogy]
- Throughput : Number of lanes (8 lanes vs 2 lanes) -> Volume of data (bps)
- Latency    : Speed limit and traffic congestion    -> Packet round-trip time (ms)
```

| Metric | Throughput (MRTG) | Latency (traceroute / ping) |
| :--- | :--- | :--- |
| **Measurement** | Bits transferred through interface per second (bps) | Time required for packet to travel round-trip (ms) |
| **User Impact** | Bulk file download completion speed | Web page load time, API call latency, SSH responsiveness |
| **Correlation** | Low throughput can still experience high latency | High throughput can maintain low latency if capacity allows |

---

## 2. Standard Diagnostic Tools: `traceroute` & `mtr`

```bash
# Linux: Real-time hop-by-hop latency and packet loss analysis
mtr -rw example.com

# Windows: Trace route hops
tracert -d example.com
```
* Sharp spikes in RTT or packet loss starting from a specific intermediate router pinpoint the exact ISP or transit provider link causing the degradation.

---

## 3. When MRTG Does Indicate a Problem: Bandwidth Clipping

```
[Bandwidth Saturation Pattern: Flat-Top Clipping]
Traffic (Mbps)
 100M ┌───────────────────────┐ <── Line / QoS Bandwidth Ceiling
      │  /───\  /───────────\  │
  50M │ /     \/             \ │
      └─────────────────────────
```

When an MRTG graph exhibits a flat-topped ceiling hitting physical interface or QoS limits, hardware packet queues overflow, causing dropped packets and catastrophic latency spikes.

---

## 4. Gotchas & Engineering Checkpoints

1. **5-Minute Average Blind Spot**: Standard MRTG graphs smooth out traffic over 5-minute sampling windows, hiding sub-second micro-bursts that degrade latency.
2. **Benign ICMP Drops**: `* * *` hops in `traceroute` output frequently indicate backbone routers intentionally rate-limiting ICMP TTL-exceeded responses rather than actual network faults.

---
*Published: 2026-07-10 08:56:55*
*Updated: 2026-08-15 13:57:00*
