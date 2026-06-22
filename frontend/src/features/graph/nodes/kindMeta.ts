import {
  Network,
  Boxes,
  Server,
  Database,
  HardDrive,
  ShieldHalf,
  KeyRound,
  Globe,
  Cloud,
  type LucideIcon,
} from "lucide-react";

/** Maps an AWS resource kind to a display icon and short label. */
export const KIND_META: Record<string, { icon: LucideIcon; label: string }> = {
  aws_vpc: { icon: Network, label: "VPC" },
  aws_subnet: { icon: Boxes, label: "Subnet" },
  aws_internet_gateway: { icon: Globe, label: "Internet Gateway" },
  aws_security_group: { icon: ShieldHalf, label: "Security Group" },
  aws_instance: { icon: Server, label: "EC2 Instance" },
  aws_db_instance: { icon: Database, label: "RDS Instance" },
  aws_s3_bucket: { icon: HardDrive, label: "S3 Bucket" },
  aws_iam_role: { icon: KeyRound, label: "IAM Role" },
  aws_cloudwatch: { icon: Cloud, label: "CloudWatch" },
};

export function kindMeta(kind: string) {
  return KIND_META[kind] ?? { icon: Boxes, label: kind };
}
