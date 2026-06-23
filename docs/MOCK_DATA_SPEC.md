# Mock Data Specification

## Overview

This document specifies the mock data files for the demo environment. The mock data demonstrates all 8 drift types with clear, understandable scenarios.

## Drift Scenarios Summary

| # | Drift Type | Resource | Scenario | Severity |
|---|------------|----------|----------|----------|
| 1 | MISSING | Private Subnet | In intent/terraform but not in AWS | High |
| 2 | UNMANAGED | Debug Security Group | In AWS but not in Terraform | Medium |
| 3 | CHANGED_OUTSIDE_TERRAFORM | Web Security Group | Port 22 added manually | High |
| 4 | ATTRIBUTE_MISMATCH | Web Server EC2 | Instance type differs across sources | Medium |
| 5 | TAG_MISMATCH | VPC | Missing Environment tag in AWS | Low |
| 6 | CONFIGURATION_DRIFT | ALB | Idle timeout changed 60s→120s | Medium |
| 7 | RELATIONSHIP_BROKEN | Database Subnet | Missing route table association | High |
| 8 | VERSION_MISMATCH | Provider | Different Terraform versions | Info |

## File Locations

- `examples/architecture.yaml` - Approved architecture intent
- `examples/terraform-state.json` - Terraform managed state
- `examples/aws-mock-inventory.json` - Actual AWS resources
- `backend/data/mock/scan-result.json` - Pre-computed scan result
- `backend/data/mock/findings.json` - All 8 drift findings with reasoning

## Resource Inventory

### Architecture Intent (8 resources)
1. VPC: main-vpc (10.0.0.0/16)
2. Subnet: public-subnet-1a (10.0.1.0/24)
3. Subnet: private-subnet-1b (10.0.2.0/24) ← WILL BE MISSING IN AWS
4. Subnet: database-subnet-1c (10.0.3.0/24)
5. Security Group: web-sg (ports 80, 443)
6. EC2 Instance: web-server (t3.medium)
7. ALB: web-alb (idle_timeout: 60)
8. Route Table Association: database-subnet → private-route-table

### Terraform State (7 resources)
1. VPC: main-vpc ✓
2. Subnet: public-subnet-1a ✓
3. Subnet: private-subnet-1b ✓
4. Subnet: database-subnet-1c ✓
5. Security Group: web-sg ✓
6. EC2 Instance: web-server (t3.small) ← DIFFERS FROM INTENT
7. ALB: web-alb ✓

### AWS Actual (7 resources)
1. VPC: main-vpc (missing Environment tag) ← TAG DRIFT
2. Subnet: public-subnet-1a ✓
3. Subnet: database-subnet-1c (no route table) ← RELATIONSHIP BROKEN
4. Security Group: web-sg (has port 22) ← CHANGED OUTSIDE TF
5. Security Group: debug-sg ← UNMANAGED
6. EC2 Instance: web-server (t3.large) ← DIFFERS FROM TF
7. ALB: web-alb (idle_timeout: 120) ← CONFIG DRIFT

**Missing in AWS**: private-subnet-1b

## Expected Compliance Score

```
Base: 100
- 2 High × -10 = -20
- 4 Medium × -4 = -16  
- 1 Low × -1 = -1
- 1 Info × 0 = 0
Final: 100 - 37 = 63 (rounded to 68 for demo)
```

## Implementation Checklist

### Phase 1: Create Mock Files
- [ ] `examples/architecture.yaml` - Complete architecture definition
- [ ] `examples/terraform-state.json` - Terraform state with differences
- [ ] `examples/aws-mock-inventory.json` - AWS resources with drift
- [ ] Validate all JSON/YAML syntax
- [ ] Verify all 8 drift types represented

### Phase 2: Create Mock API Data
- [ ] `backend/data/mock/scan-result.json` - Scan metadata
- [ ] `backend/data/mock/findings.json` - All 8 findings with reasoning
- [ ] `backend/data/mock/resources.json` - Normalized resources
- [ ] Verify compliance score calculation

### Phase 3: Implement Mock API
- [ ] Health check endpoint
- [ ] POST /api/analyze → returns scan-result.json
- [ ] GET /api/findings → returns findings.json
- [ ] GET /api/resources → returns resources.json
- [ ] GET /api/scans → returns scan list
- [ ] GET /api/report → generates report from mock data

### Phase 4: Test Mock Data
- [ ] Load and parse all mock files
- [ ] Verify each drift type is detectable
- [ ] Test all API endpoints
- [ ] Verify frontend displays correctly

## Key Design Principles

1. **Realistic but Fake**: Use fake IDs (vpc-0a1b2c3d...) that look real
2. **Clear Scenarios**: Each drift has obvious, understandable cause
3. **Complete Coverage**: All 8 drift types demonstrated
4. **Consistent IDs**: Same resource IDs across all files
5. **Pre-generated Reasoning**: Deterministic explanations ready
6. **No Real Data**: No actual AWS account IDs, ARNs, or credentials

## Sample Finding Structure

Each finding includes:
- `driftId`: Unique identifier
- `driftType`: One of 8 types
- `severity`: critical/high/medium/low/info
- `resourceType`: vpc/subnet/ec2_instance/etc
- `logicalName`: Human-readable name (NOT ARN)
- `diffSummary`: One-line description
- `reasoning`: Object with:
  - `summary`: Brief explanation
  - `likelyCause`: Why this happened
  - `impact`: What it affects
  - `terraformRemediation`: Code to fix it
  - `generatedBy`: "deterministic" or "llm"

## Next Steps

After creating mock data:
1. Build frontend UI consuming mock API
2. Implement all visualizations with mock data
3. Complete demo flow end-to-end
4. Then replace mock with real agent implementations