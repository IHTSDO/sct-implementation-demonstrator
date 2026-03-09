export type EclOperator =
  | ''
  | 'descendantof'
  | 'descendantorselfof'
  | 'childof'
  | 'ancestorof'
  | 'ancestororselfof'
  | 'parentof'
  | 'memberOf';

export type EclComparisonOperator = '=' | '!=';

export interface EclConceptExpression {
  operator?: EclOperator;
  conceptId?: string;
  term?: string;
  wildcard?: boolean;
  nestedExpressionConstraint?: EclExpressionConstraint;
  uiId?: string;
}

export interface EclAttribute {
  attributeName: EclConceptExpression;
  expressionComparisonOperator?: EclComparisonOperator;
  value: EclConceptExpression;
  numericComparisonOperator?: string;
  stringComparisonOperator?: string;
  booleanComparisonOperator?: string;
  uiId?: string;
}

export interface EclSubAttributeSet {
  attribute: EclAttribute;
  uiId?: string;
}

export interface EclAttributeSet {
  subAttributeSet: EclSubAttributeSet;
  conjunctionAttributeSet?: EclSubAttributeSet[];
  disjunctionAttributeSet?: EclSubAttributeSet[];
  uiId?: string;
}

export interface EclSubRefinement {
  eclAttributeSet: EclAttributeSet;
  uiId?: string;
}

export interface EclRefinement {
  subRefinement: EclSubRefinement;
  disjunctionSubRefinements?: EclSubRefinement[];
  uiId?: string;
}

export interface EclExpressionConstraint extends EclConceptExpression {
  subexpressionConstraint?: EclExpressionConstraint;
  eclRefinement?: EclRefinement;
  conjunctionExpressionConstraints?: EclExpressionConstraint[];
  disjunctionExpressionConstraints?: EclExpressionConstraint[];
  exclusionExpressionConstraints?: {
    first?: EclExpressionConstraint;
    second?: EclExpressionConstraint;
  };
}

export interface EclDomainAttribute {
  conceptId: string;
  fsn?: {
    term?: string;
  };
  attributeRange?: Array<{
    rangeConstraint?: string;
  }>;
}
