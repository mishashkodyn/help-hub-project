export type MenuItem = {
  icon?: string;
  label?: string;
  route?: string;
};

export interface DashboardCardItem {
  icon: string;
  title: string;
  description: string;
  buttonText: string;
  route: string;
  iconBgClass: string;
  iconTextClass: string;
}