---
title: "MRTG 트래픽 그래프로 서버 속도를 알 수 없는 이유"
description: "Throughput(처리량)과 Latency(지연시간)의 차이, traceroute를 활용한 구간별 RTT 측정 및 대역폭 포화 판별법"
date: 2026-07-10
tags: [Network, MRTG, Troubleshooting, Latency, Bandwidth, Infrastructure]
---

# MRTG 트래픽 그래프로 서버 속도를 알 수 없는 이유

::: tip 1줄 요약
MRTG는 단위 시간당 데이터 전송량인 **처리량(Throughput)**만 기록할 뿐, 실제 사용자가 체감하는 **지연 시간(Latency / RTT)**을 측정하지 못하므로 성능 병목 진단 시에는 반드시 `traceroute`와 `mtr`을 병행해야 한다.
:::

## 1. Throughput(처리량) vs Latency(지연 시간)

"서버가 느리다"는 문의 시 MRTG 그래프를 제시하는 경우가 많으나, 두 지표는 성격이 완전히 다르다.

```
[고속도로 비유]
- Throughput (처리량) : 고속도로 차선 수 (8차선 vs 2차선) -> 전송된 데이터 총량 (bps)
- Latency    (지연시간) : 차량의 주행 속도 및 정체 수준    -> 패킷 왕복 시간 (ms)
```

| 구분 | Throughput (MRTG) | Latency (traceroute / ping) |
| :--- | :--- | :--- |
| **측정 대상** | 네트워크 인터페이스를 통과한 초당 비트 수 (bps) | 패킷이 출발지에서 목적지까지 도달하는 왕복 시간 (ms) |
| **속도 체감** | 대용량 파일 다운로드 속도에 영향 | 웹 페이지 응답 속도, API 호출, 터미널 반응 속도에 직결 |
| **상관관계** | 트래픽이 낮아도 망 정체 시 느릴 수 있음 | 트래픽이 높아도 여유 대역폭이 있다면 빠름 |

---

## 2. 네트워크 구간 진단의 정석: `traceroute` & `mtr`

구간별 병목과 패킷 손실을 진단할 때는 홉(hop)별 RTT를 측정하는 도구를 사용한다.

```bash
# Linux: 실시간 패킷 손실 및 지연 구간 추적
mtr -rw example.com

# Windows: 구간별 홉 추적
tracert -d example.com
```

* 특정 홉 이후부터 RTT가 급증하거나 패킷 손실(Packet Loss)이 발생한다면 해당 ISP 라우터 또는 회선 구간의 병목으로 판별할 수 있다.

---

## 3. MRTG 그래프가 유의미한 단서가 되는 예외 상황: Bandwidth Clipping

MRTG가 유일하게 성능 저하의 직접 원인으로 지목될 때는 **대역폭 포화(Bandwidth Saturation)**가 발생했을 때다.

```
[대역폭 포화 시 MRTG 패턴: Flat-top Clipping]
Traffic (Mbps)
 100M ┌───────────────────────┐ <── 인터페이스/QoS 대역폭 한계선
      │  /───\  /───────────\  │
  50M │ /     \/             \ │
      └─────────────────────────
```

그래프 상단이 특정 임계치(예: 100Mbps 회선 한계)에 도달하여 평평하게 잘리는 형태(Clipping)가 지속된다면, 버퍼 오버플로우로 인한 패킷 큐잉(Queuing) 및 드롭(Drop)이 발생하여 Latency가 폭증하게 된다.

---

## 4. 해외망 물리적 지연(Latency) 기준치

국내망 `traceroute`는 정상이지만 해외 리전/서버 연결이 느린 경우, 이는 물리적 광케이블 거리로 인한 피할 수 없는 지연이다.

* **서울 ➔ 일본 도쿄**: 평균 30ms ~ 40ms (매우 양호)
* **서울 ➔ 미국 서부 (오리건/캘리포니아)**: 평균 130ms ~ 160ms
* **서울 ➔ 미국 동부 (버지니아)**: 평균 190ms ~ 220ms
* **서울 ➔ 유럽 (네덜란드/독일)**: 평균 230ms ~ 280ms

이러한 물리적 지연은 CDN(CloudFront, Cloudflare) 캐싱 또는 엣지 라우팅 가속(AWS Global Accelerator)으로 완화해야 한다.

---

## 5. 핵심 체크포인트 (Gotchas)

1. **MRTG 5분 평균의 함정**: MRTG는 기본적으로 5분 단위 평균값을 그래프로 그리므로, 1~2초 단위의 순간적인 트래픽 스파이크(Micro-burst)를 감지하지 못할 수 있다.
2. **단순 ICMP 차단 주의**: `traceroute` 중간 홉에서 `* * *` (Request timed out)이 나온다고 해서 반드시 장애는 아니며, 중간 백본 라우터가 보안상 ICMP 응답을 드롭하도록 설정된 경우가 많다.

---
*게시된 시간: 2026-07-10 08:56:55*
*수정한 시간: 2026-08-15 13:57:00*
