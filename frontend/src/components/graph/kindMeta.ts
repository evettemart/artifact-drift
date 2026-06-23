import {
  Boxes,
  Cloud,
  Database,
  Globe,
  HardDrive,
  KeyRound,
  Network,
  Server,
  Shield,
  Split,
  type LucideIcon,
} from 'lucide-react';

export interface KindMeta {
  icon: LucideIcon;
  label: string;
}

const KIND_META: Record<string, KindMeta> = {
  aws_vpc: { icon: Network, label: 'VPC' },
  aws_subnet: { icon: Boxes, label: 'Subnet' },
  aws_internet_gateway: { icon: Globe, label: 'Internet Gateway' },
  aws_security_group: { icon: Shield, label: 'Security Group' },
  aws_instance: { icon: Server, label: 'EC2 Instance' },
  aws_db_instance: { icon: Database, label: 'RDS Instance' },
  aws_s3_bucket: { icon: HardDrive, label: 'S3 Bucket' },
  aws_iam_role: { icon: KeyRound, label: 'IAM Role' },
  aws_lb: { icon: Split, label: 'Load Balancer' },
  aws_lb_target_group: { icon: Split, label: 'Target Group' },
  aws_cloudwatch: { icon: Cloud, label: 'CloudWatch' },
};

export function kindMeta(kind: string): KindMeta {
  return KIND_META[kind] ?? { icon: Boxes, label: kind.replace(/_/g, ' ') };
}
