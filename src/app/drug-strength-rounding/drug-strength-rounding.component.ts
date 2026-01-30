import { Component, OnInit } from '@angular/core';

interface CalculationResult {
  numerator: string;
  denominator: string;
  rawResult: number;
  roundedResult: string;
  sigFigsNumerator: number;
  sigFigsDenominator: number;
  sigFigsMin: number;
  isTerminating: boolean;
  rule: string;
}

interface Example {
  numerator: string;
  denominator: string;
  description: string;
}

@Component({
  selector: 'app-drug-strength-rounding',
  templateUrl: './drug-strength-rounding.component.html',
  styleUrls: ['./drug-strength-rounding.component.css'],
  standalone: false
})
export class DrugStrengthRoundingComponent implements OnInit {
  numerator: string = '';
  denominator: string = '';
  result: CalculationResult | null = null;

  examples: Example[] = [
    { numerator: '34', denominator: '172', description: 'Example from SQL (34/172)' },
    { numerator: '1', denominator: '2', description: 'Terminating fraction (1/2)' },
    { numerator: '1', denominator: '4', description: 'Terminating fraction (1/4)' },
    { numerator: '1', denominator: '5', description: 'Terminating fraction (1/5)' },
    { numerator: '1', denominator: '3', description: 'Non-terminating fraction (1/3)' },
    { numerator: '1', denominator: '7', description: 'Non-terminating fraction (1/7)' },
    { numerator: '100', denominator: '3', description: 'Different significant figures (100/3)' },
    { numerator: '1.5e2', denominator: '3', description: 'Scientific notation (1.5e2/3)' },
    { numerator: '0.00123', denominator: '0.045', description: 'Leading zeros (0.00123/0.045)' },
    { numerator: '100.0', denominator: '2.5', description: 'Trailing zeros (100.0/2.5)' }
  ];

  constructor() { }

  ngOnInit(): void {
  }

  // Greatest Common Divisor using Euclidean algorithm
  gcd(a: bigint, b: bigint): bigint {
    let r: bigint;
    while (b !== 0n) {
      r = a % b;
      a = b;
      b = r;
    }
    return a < 0n ? -a : a;
  }

  // Count significant figures in a number string.
  // Leading zeros do not count as significant figures (e.g. 0.00123 has 3 sig figs).
  countSigFigs(numStr: string): number {
    let s = numStr.trim();

    // If scientific notation, isolate mantissa
    const scientificNotationRegex = /^[\+\-]?[0-9]+(\.[0-9]+)?[eE][\+\-]?[0-9]+$/;
    if (scientificNotationRegex.test(s)) {
      s = s.toLowerCase().split('e')[0];
    }

    s = s.replace(/[\+\-]/g, '');

    // Find first non-zero digit; leading zeros don't count as significant
    const firstNonZero = s.search(/[1-9]/);
    if (firstNonZero === -1) {
      return 0; // all zeros
    }

    // From first significant digit to end, count every digit (0-9)
    let count = 0;
    for (let i = firstNonZero; i < s.length; i++) {
      if (s[i] >= '0' && s[i] <= '9') {
        count++;
      }
    }
    return count;
  }

  // Determine if a fraction terminates (denominator only has factors 2 and 5 after reduction)
  isTerminatingFraction(aStr: string, bStr: string): boolean {
    // Strip signs
    let sa = aStr.trim().replace(/[\+\-]/g, '');
    let sb = bStr.trim().replace(/[\+\-]/g, '');

    // Extract integer & scale for a_str
    let scaleA = 0;
    if (sa.includes('.')) {
      scaleA = sa.length - sa.indexOf('.') - 1;
      sa = sa.replace('.', '');
    }

    // Extract integer & scale for b_str
    let scaleB = 0;
    if (sb.includes('.')) {
      scaleB = sb.length - sb.indexOf('.') - 1;
      sb = sb.replace('.', '');
    }

    const intA = BigInt(sa);
    const intB = BigInt(sb);

    // Form the unreduced numerator/denominator
    let n = intA * (10n ** BigInt(scaleB));
    let d = intB * (10n ** BigInt(scaleA));

    // Reduce by GCD
    const g = this.gcd(n, d);
    d = d / g;

    // Strip factors of 2 and 5
    while (d % 2n === 0n) {
      d = d / 2n;
    }
    while (d % 5n === 0n) {
      d = d / 5n;
    }

    return d === 1n;
  }

  // Main division function with significant figure rounding
  divideWithSig(aStr: string, bStr: string): string {
    const aVal = parseFloat(aStr);
    const bVal = parseFloat(bStr);
    const sigA = this.countSigFigs(aStr);
    const sigB = this.countSigFigs(bStr);
    const sigMin = Math.min(sigA, sigB);

    // Compute raw quotient
    const rawVal = aVal / bVal;

    let displayVal: number;
    let desiredSig: number;

    // Decide display_val + desired_sig (p or p+1 for guard)
    if (this.isTerminatingFraction(aStr, bStr)) {
      displayVal = rawVal;
      desiredSig = sigMin;
    } else {
      const digitsBefore = Math.floor(Math.log10(Math.abs(rawVal)));
      const roundD = sigMin - digitsBefore - 1;
      const tmpVal = Math.round(rawVal * Math.pow(10, roundD + 1)) / Math.pow(10, roundD + 1);
      displayVal = tmpVal;
      desiredSig = sigMin + 1;
    }

    // Convert to text and trim non-significant zeros
    let resultStr = displayVal.toString();
    // Trim trailing zeros only after decimal point
    if (resultStr.includes('.')) {
      resultStr = resultStr.replace(/0+$/, ''); // Trim trailing zeros
      resultStr = resultStr.replace(/\.$/, ''); // Trim trailing decimal point
    }

    // If non-terminating, pad with zeros up to desired_sig
    if (!this.isTerminatingFraction(aStr, bStr)) {
      const sigRes = this.countSigFigs(resultStr);
      if (sigRes < desiredSig) {
        if (!resultStr.includes('.')) {
          resultStr = resultStr + '.';
        }
        resultStr = resultStr + '0'.repeat(desiredSig - sigRes);
      }
    }

    return resultStr;
  }

  // Returns descriptive text of which rule was applied
  ruleOfRoundingDivideWithSig(aStr: string, bStr: string): string {
    const sigA = this.countSigFigs(aStr);
    const sigB = this.countSigFigs(bStr);
    const sigMin = Math.min(sigA, sigB);

    if (this.isTerminatingFraction(aStr, bStr)) {
      return 'Terminating fraction rules';
    } else {
      const desiredSig = sigMin + 1;
      return `Significant Trailing Zeros + Significant digits rules (${sigMin}) + Guard digits rules (+1) = ${desiredSig}`;
    }
  }

  calculate(): void {
    if (!this.numerator || !this.denominator) {
      this.result = null;
      return;
    }

    try {
      const aVal = parseFloat(this.numerator);
      const bVal = parseFloat(this.denominator);

      if (isNaN(aVal) || isNaN(bVal) || bVal === 0) {
        this.result = null;
        return;
      }

      const rawResult = aVal / bVal;
      const roundedResult = this.divideWithSig(this.numerator, this.denominator);
      const sigA = this.countSigFigs(this.numerator);
      const sigB = this.countSigFigs(this.denominator);
      const sigMin = Math.min(sigA, sigB);
      const isTerminating = this.isTerminatingFraction(this.numerator, this.denominator);
      const rule = this.ruleOfRoundingDivideWithSig(this.numerator, this.denominator);

      this.result = {
        numerator: this.numerator,
        denominator: this.denominator,
        rawResult,
        roundedResult,
        sigFigsNumerator: sigA,
        sigFigsDenominator: sigB,
        sigFigsMin: sigMin,
        isTerminating,
        rule
      };
    } catch (error) {
      this.result = null;
    }
  }

  loadExample(example: Example): void {
    this.numerator = example.numerator;
    this.denominator = example.denominator;
    this.calculate();
  }

  clear(): void {
    this.numerator = '';
    this.denominator = '';
    this.result = null;
  }
}
