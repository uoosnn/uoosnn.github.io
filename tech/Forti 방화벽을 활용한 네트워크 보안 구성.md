---
title: "FortiGate 방화벽을 활용한 NAT 전환 및 Zone 기반 네트워크 보안 구성"
description: "Forti-60F 기반 Transparent에서 NAT 모드 전환, 3-Tier Zone(WAS/DB/DEV) 분할 및 VIP(Virtual IP) 포워딩 실전 가이드"
date: 2026-05-17
tags: [Network, Security, Firewall, FortiGate, NAT, VPN, Architecture]
---

# FortiGate 방화벽을 활용한 NAT 전환 및 Zone 기반 네트워크 보안 구성

::: tip 1줄 요약
단순 브리지(Transparent) 모드로 동작하던 FortiGate-60F를 **NAT/Route 모드로 전환**하고, 물리 포트별로 **WAS / DB / DEV Zone을 격리**한 뒤 VIP(Virtual IP) 1:1 NAT 및 세부 정책을 적용하여 보안 경계를 구축한 실전 구성안.
:::

## 1. 네트워크 보안 구성 개요

기존 공인 IP 직접 할당 방식에서 탈피하여 내부 서버를 사설 IP 대역(`10.0.0.0/8`)으로 은닉하고, 용도별 Zone 분할을 통해 수평 이동(Lateral Movement) 공격을 원천 차단하는 구성을 진행했다.

```
[FortiGate 60F Zone 토폴로지]
                        Internet (WAN 1 / 공인 IP)
                                   │
                         ┌─────────▼─────────┐
                         │   FortiGate-60F   │
                         │  (NAT/Route Mode) │
                         └──┬──────┬──────┬──┘
                            │      │      │
           ┌────────────────┘      │      └────────────────┐
           ▼                       ▼                       ▼
    [WAS Zone (DMZ)]       [DB Zone (격리)]        [DEV Zone (개발)]
     10.0.1.0/24             10.0.2.0/24             10.0.100.0/24
    (공인 VIP 80/443 허용)  (WAS에서의 3306/1433만 허용) (SSL-VPN 접근)
```

---

## 2. 핵심 단계별 구성 절차

### 1) 방화벽 모드 전환: TP(Transparent) ➔ NAT/Route 모드
* 브리지 모드에서는 L3 라우팅과 NAT가 불가하므로, 인터페이스에 내부 게이트웨이 IP를 할당할 수 있도록 NAT 모드로 전환.
* 기존 상단 라우터(Cisco 1900 등)의 기본 게이트웨이 역할을 FortiGate가 직접 수행하도록 통합.

### 2) 물리 포트별 Zone 분할 및 사설 IP 서브넷 할당
`internal` 기본 스위치 포트를 분리하여 각 업무망별 독립 인터페이스/Zone을 생성한다.

```
- Port 1 (WAS Zone) : 10.0.1.1/24 (VLAN 또는 전용 L2 스위치 연동)
- Port 2 (DB Zone)  : 10.0.2.1/24 (인터넷 직접 아웃바운드 차단)
- Port 3 (DEV Zone) : 10.0.100.1/24
```

### 3) VIP (Virtual IP) 인바운드 포트포워딩 설정
외부 공인 IP로 인입되는 웹 트래픽(`80`, `443`)을 WAS 사설 IP로 1:1 매핑한다.

```ini
# FortiGate CLI 예시: WAS VIP 생성 및 정책 매핑
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

### 4) Zone 간 트래픽 제어 정책 (Inter-Zone Firewall Policy)
* **WAS ➔ DB**: 지정된 DB 포트(`TCP 3306`, `TCP 1433`)만 화이트리스트 허용.
* **DB ➔ External**: 인터넷 직접 연결 완전 차단.
* **External ➔ All**: 기본 Deny All, 오직 허가된 VIP 포트만 허용.

---

## 3. 원격 관리: SSL-VPN 터널 구성

외부 엔지니어의 원격 유지보수를 위해 FortiGate 내장 SSL-VPN 포털을 활성화하고, MFA(OTP) 연동 및 사설 IP 풀(`10.0.200.0/24`)을 할당하여 DEV/WAS Zone 접근만 인가한다.

---

## 4. 핵심 체크포인트 (Gotchas)

1. **TP 모드 전환 시 세션 끊김**: Transparent 모드에서 NAT 모드로 전환할 때 모든 인터페이스 IP가 리셋될 수 있으므로, 반드시 로컬 콘솔(RJ45 콘솔 케이블) 연결 상태에서 작업해야 한다.
2. **L2 스위치 분리**: 방화벽 하단에 서버 대수가 많을 경우 각 Zone별로 물리 스위치를 분리하거나, 관리형 스위치에서 802.1Q VLAN 태깅을 설정해야 브로드캐스트 도메인이 격리된다.
3. **VIP와 방화벽 정책의 관계**: VIP 객체를 생성했더라도 `firewall policy`에서 WAN ➔ WAS Zone 방향으로 VIP를 목적지(Destination)로 명시하고 허용해 주어야 실제 패킷이 통과한다.

---
*게시된 시간: 2026-05-17 08:11:32*
*수정한 시간: 2026-08-15 13:57:00*
