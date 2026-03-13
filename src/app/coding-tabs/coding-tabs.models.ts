export interface BindingSpec {
  title?: string;
  code?: any;
  type?: string;
  ecl?: string | null;
  value?: any;
  note?: string | null;
  unit?: any;
  repeatable?: boolean;
  count?: number;
  [key: string]: any;
}

export interface CodingTabSpec {
  title: string;
  description?: string;
  bindings: BindingSpec[];
  [key: string]: any;
}

export type CodingTabsSource = CodingTabSpec[] | string[];
