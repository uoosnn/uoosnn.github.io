---
title: "MSSQL 구성 관리자 오류, 공유 기능 복구로 해결하기"
description: "sqlmanager.dll 누락 및 MMC 스냅인 로드 실패 시 DB 인스턴스 중단 없이 ISO 설치 미디어의 공유 기능(Shared Features)으로 복구한 사례"
date: 2026-07-20
tags: [Database, MSSQL, SQL Server, DBA, Windows, Troubleshooting]
---

# MSSQL 구성 관리자 오류, 공유 기능 복구로 해결하기

::: tip 1줄 요약
`SQL Server Configuration Manager` 실행 시 `sqlmanager.dll` 누락으로 MMC 스냅인 로드가 실패할 때, 수동 DLL 복사 대신 **MSSQL 설치 ISO의 '복구(Repair)' 메뉴에서 '공유 기능(Shared Features)'만 선택 복원**하면 DB 엔진 무중단으로 안전하게 복구할 수 있다.
:::

## 1. 장애 현상: SQL Server 구성 관리자(MMC) 스냅인 로드 실패

Windows Server에서 네트워크 프로토콜 및 서비스 계정을 관리하는 **SQL Server 구성 관리자(`SQLServerManagerXX.msc`)** 실행 시 스냅인 초기화 실패 에러가 발생했다.

* **원인**: `C:\Windows\System32\` 또는 `C:\Program Files (x86)\Microsoft SQL Server\...\Shared\` 경로의 핵심 라이브러리인 `sqlmanager.dll` 파일이 백신 오진 또는 비정상 패치로 인해 유실됨.
* **1차 수동 조치 실패**: 타 정상 서버에서 `sqlmanager.dll`만 복사해 붙여넣었으나, 연관된 종속 DLL 및 COM 등록 정보 불일치로 여전히 오류 발생.

---

## 2. 해결 절차: ISO 설치 미디어를 통한 '공유 기능' 부분 복구

운영 중인 DB 인스턴스(`MSSQLSERVER`)를 재설치하거나 중단하지 않고, 관리 툴 레이어만 깨끗하게 복원하는 **'Shared Features 복구'**를 진행했다.

```
[복구 범위 격리]
┌──────────────────────────────────────────────┐
│ MSSQL Server                                 │
│  ├─ [DB 엔진 인스턴스] : 정상 가동 유지 (무영향) │
│  └─ [공유 기능 (Shared)] : ISO 미디어로 복구  │
│      └─ sqlmanager.dll, 클라이언트 툴, MMC     │
└──────────────────────────────────────────────┘
```

### Step 1. 동일 버전 MSSQL 설치 ISO 마운트
해당 서버에 설치된 SQL Server 메이저 버전(예: SQL Server 2019/2022)의 공식 설치 ISO를 마운트한다.

### Step 2. Setup.exe 실행 및 유지보수(Maintenance) 진입
`setup.exe` 실행 ➔ 좌측 네비게이션에서 **유지 관리(Maintenance)** 선택 ➔ **복구(Repair)** 클릭.

### Step 3. 복구 대상 선택 (핵심)
인스턴스 선택 화면에서 특정 DB 인스턴스를 고르지 않고, **'공유 기능만 복구(Repair shared features only)'** 라디오 버튼을 선택하여 진행.

### Step 4. 검증
복구 마법사 완료 후 CLI 또는 실행창에서 구성 관리자 재실행:
```cmd
# SQL Server 2019 기준 구성 관리자 실행
SQLServerManager15.msc
```
-> 정상적으로 모든 인스턴스 및 네트워크 구성 스냅인이 로드됨을 확인.

---

## 3. 핵심 체크포인트 (Gotchas)

1. **설치 미디어 빌드 버전 일치**: 원본 서버에 누적 업데이트(CU, Cumulative Update)가 적용되어 있다면, 초기 RTM ISO로 복원 후 현재 적용된 CU 패키지를 다시 한 번 실행해 주어야 버전 불일치를 방지할 수 있다.
2. **수동 DLL 복사 지양**: Windows MMC 스냅인은 COM 레지스트리 GUID 및 SxS(Side-by-Side) 어셈블리 종속성을 가지므로, 개별 DLL 복사보다는 공식 복구 마법사를 활용하는 것이 안전하다.

---
*게시된 시간: 2026-07-20 14:07:27*
*수정한 시간: 2026-08-15 13:57:00*
