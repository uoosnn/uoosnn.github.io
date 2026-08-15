---
title: "RDS Blue/Green Migration to Minimize Downtime"
date: 2026-07-28
tags: [Tech, Troubleshooting, Incident Report]
---

# RDS Blue/Green Migration to Minimize Downtime


## Problem: Approaching End of Support (EOS) for Aurora MySQL Version

The minor version of our operational AWS RDS Aurora cluster was soon to reach its End of Support (EOS). Upon reaching EOS, security patches and bug fixes would no longer be provided, making a database version upgrade essential for stable service operation.

Instead of a simple minor version upgrade, the goal was set to migrate to a Long-Term Support (LTS) version (e.g., Aurora MySQL 3.10) with an extended support lifecycle, ensuring stability for several years to come. The biggest challenge was minimizing service interruption, or downtime.

## Solution Strategy: Adopting AWS RDS Blue/Green Deployment

To minimize downtime and ensure a safe rollback path, we adopted the **Blue/Green Deployment** method provided by AWS RDS. This strategy involves creating a replica (Green environment) of the currently operational DB (Blue environment) in advance, maintaining data synchronization, and finally switching traffic over all at once.

The core of this strategy is leveraging MySQL's logical replication feature, `binlog`.

## Key Prerequisite: `binlog` Activation

**RDS Blue/Green Deployment** records all data changes occurring in the Blue environment to the `binlog` and continuously applies them to the Green environment to synchronize data. However, in most operational environments, `binlog` is often disabled (`OFF`) for performance reasons.

Therefore, before attempting to create a Blue/Green deployment, the `binlog_format` setting in the parameter group of the Blue environment (original DB) had to be changed first.

```ini
# Target: Blue (original) cluster parameter group
# Before change: binlog_format = OFF
# After change: binlog_format = MIXED
```

Since the `binlog_format` parameter is of `Static` type, **rebooting the DB instance is essential** to apply the changes. Considering the service impact, maintenance time was secured to complete the reboot in advance of the actual migration work. This preliminary step was a crucial stage that determined the success of the entire **RDS Blue/Green migration**.

## Migration Execution Procedure

### 1. Create Blue/Green Deployment

After the preliminary preparations were complete, we initiated 'Create Blue/Green Deployment' for the original cluster in the AWS console. During this process, AWS automatically performs the following tasks:

1.  Creates a snapshot of the Blue environment.
2.  Builds a new cluster (Green environment) of the target LTS version based on that snapshot.
3.  Initiates data replication from the Blue environment to the Green environment using the `binlog` to maintain real-time synchronization.

This creation process can take tens of minutes or more depending on the database size, but it does not affect the service in the Blue environment at all.

### 2. Validate Green Environment

The Green environment has an independent endpoint, completely separate from the Blue environment. We thoroughly validated whether the application had any compatibility issues with the new DB version using this endpoint. If issues were found at this stage, there was no risk. We could simply delete the Green environment, analyze the cause, and recreate it.

### 3. Switchover

After all validations were complete, we executed the 'Switchover' to transition traffic. Only at this stage does a brief downtime occur. The switchover process is as follows:

1.  Temporarily blocks all write transactions to the Blue environment.
2.  Applies all remaining `binlog` events from the Blue environment to the Green environment to ensure 100% data consistency.
3.  Changes the DNS record of the DB endpoint previously used by the Blue environment to point to the Green environment.
4.  The Green environment begins processing write traffic as the new production DB.

This entire process typically completes within **approximately 1 minute**, allowing the migration to finish with a brief downtime that is barely noticeable to users.

### 4. Post-Migration Actions

Even after a successful switchover, the old Blue environment is not immediately deleted but remains. This serves as a form of insurance in case of unforeseen circumstances, providing an option for rollback if a serious issue arises. After confirming service stability, we cleaned up the old Blue environment to avoid unnecessary costs.

In conclusion, **RDS Blue/Green Deployment** was once again confirmed to be a highly effective method for safely upgrading a database while minimizing downtime through logical replication using `binlog`.

---
*Posted: 2026-07-28 09:03:17*
*Updated: 2026-08-15 13:57:00*
