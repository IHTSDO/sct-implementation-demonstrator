export type LoincTreeNode = {
  code: string;
  display: string;
  isGrouper?: boolean;
  level?: number;
  isExpanded?: boolean;
  isLoadingChildren?: boolean;
  children?: LoincTreeNode[];
};
