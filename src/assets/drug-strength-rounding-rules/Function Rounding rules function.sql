-- EXEMPLE
-- 34 / 172
SELECT
	divide_with_sig(34,172),
	rule_of_rounding_divide_with_sig(34,172)





-- 1) Compute GCD of two BIGINTs
DELIMITER $$
CREATE FUNCTION gcd(a BIGINT, b BIGINT)
RETURNS BIGINT
DETERMINISTIC
BEGIN
  DECLARE r BIGINT;
  WHILE b <> 0 DO
    SET r = a MOD b;
    SET a = b;
    SET b = r;
  END WHILE;
  RETURN ABS(a);
END$$
DELIMITER ;

-- 2) Count sig‑figs (as before)
DELIMITER $$
CREATE FUNCTION count_sig_figs_non_exact_number(num_str VARCHAR(100))
RETURNS INT
DETERMINISTIC
BEGIN
  DECLARE s VARCHAR(100);
  DECLARE dec_pos INT;
  SET s = TRIM(num_str);
  IF s REGEXP '^[\+\-]?[0-9]+(\.[0-9]+)?[eE][\+\-]?[0-9]+$' THEN
    SET s = REPLACE(REPLACE(SUBSTRING_INDEX(LOWER(s), 'e', 1), '+',''), '-','');
    RETURN CHAR_LENGTH(REPLACE(s, '.', ''));
  END IF;
  SET s = REPLACE(REPLACE(s, '+',''), '-','');
  WHILE LEFT(s,1) = '0' AND CHAR_LENGTH(s) > 1 DO
    SET s = SUBSTRING(s, 2);
  END WHILE;
  SET dec_pos = LOCATE('.', s);
  IF dec_pos > 0 THEN
    RETURN CHAR_LENGTH(REPLACE(s, '.', ''));
  ELSE
    WHILE RIGHT(s,1) = '0' AND CHAR_LENGTH(s) > 1 DO
      SET s = LEFT(s, CHAR_LENGTH(s)-1);
    END WHILE;
    RETURN CHAR_LENGTH(s);
  END IF;
END$$
DELIMITER ;


DELIMITER $$

DROP FUNCTION IF EXISTS count_sig_figs $$
CREATE FUNCTION count_sig_figs(num_str VARCHAR(100))
RETURNS INT
DETERMINISTIC
BEGIN
  DECLARE s VARCHAR(100);

  -- 1) normalize
  SET s = TRIM(num_str);

  -- 2) if scientific notation, isolate mantissa
  IF s REGEXP '^[\+\-]?[0-9]+(\.[0-9]+)?[eE][\+\-]?[0-9]+$' THEN
    SET s = SUBSTRING_INDEX(LOWER(s), 'e', 1);
  END IF;

  -- 3) strip signs and decimal point
  SET s = REPLACE(REPLACE(REPLACE(s, '+',''), '-',''), '.','');

  -- 4) now *every* remaining digit is significant
  RETURN CHAR_LENGTH(s);
END$$

DELIMITER ;

-- 3) Test whether a_str/b_str terminates
DELIMITER $$
CREATE FUNCTION is_terminating_fraction(a_str VARCHAR(100), b_str VARCHAR(100))
RETURNS BOOL
DETERMINISTIC
BEGIN
  DECLARE sa, sb VARCHAR(100);
  DECLARE intA, intB BIGINT;
  DECLARE scaleA, scaleB INT;
  DECLARE n, d, g BIGINT;

  -- strip signs
  SET sa = REPLACE(REPLACE(TRIM(a_str), '+',''), '-','');
  SET sb = REPLACE(REPLACE(TRIM(b_str), '+',''), '-','');

  -- extract integer & scale for a_str
  IF LOCATE('.', sa)>0 THEN
    SET scaleA = CHAR_LENGTH(sa) - LOCATE('.', sa);
    SET sa = REPLACE(sa, '.', '');
  ELSE
    SET scaleA = 0;
  END IF;
  -- for b_str
  IF LOCATE('.', sb)>0 THEN
    SET scaleB = CHAR_LENGTH(sb) - LOCATE('.', sb);
    SET sb = REPLACE(sb, '.', '');
  ELSE
    SET scaleB = 0;
  END IF;

  SET intA = CAST(sa AS UNSIGNED);
  SET intB = CAST(sb AS UNSIGNED);

  -- form the unreduced numerator/denominator
  SET n = intA * POW(10, scaleB);
  SET d = intB * POW(10, scaleA);

  -- reduce by GCD
  SET g = gcd(n, d);
  SET d = d DIV g;

  -- strip factors of 2 and 5
  WHILE d MOD 2 = 0 DO SET d = d DIV 2; END WHILE;
  WHILE d MOD 5 = 0 DO SET d = d DIV 5; END WHILE;

  RETURN d = 1;
END$$
DELIMITER ;

-- 4) Final divide_with_sig that returns raw when terminating
DELIMITER $$

DROP FUNCTION IF EXISTS divide_with_sig $$
CREATE FUNCTION divide_with_sig(
  a_str VARCHAR(100),
  b_str VARCHAR(100)
) RETURNS VARCHAR(64)
  DETERMINISTIC
BEGIN
  -- 1) Declare every variable with its own DECLARE
  DECLARE a_val           DECIMAL(30,10);
  DECLARE b_val           DECIMAL(30,10);
  DECLARE raw_val         DECIMAL(30,10);
  DECLARE tmp_val         DECIMAL(30,10);
  DECLARE display_val     DECIMAL(30,10);
  DECLARE sig_a           INT;
  DECLARE sig_b           INT;
  DECLARE sig_min         INT;
  DECLARE digits_before   INT;
  DECLARE round_d         INT;
  DECLARE sig_res         INT;
  DECLARE desired_sig     INT;
  DECLARE result_str      VARCHAR(64);

  -- 2) Parse inputs and count sig‑figs
  SET a_val   = CAST(a_str AS DECIMAL(30,10));
  SET b_val   = CAST(b_str AS DECIMAL(30,10));
  SET sig_a   = count_sig_figs(a_str);
  SET sig_b   = count_sig_figs(b_str);
  SET sig_min = LEAST(sig_a, sig_b);

  -- 3) Compute raw quotient
  SET raw_val = a_val / b_val;

  -- 4) Decide display_val + desired_sig (p or p+1 for guard)
  IF is_terminating_fraction(a_str, b_str) THEN
    SET display_val = raw_val;
    SET desired_sig = sig_min;
  ELSE
    SET digits_before = FLOOR(LOG10(ABS(raw_val)));
    SET round_d       = sig_min - digits_before - 1;
    SET tmp_val       = ROUND(raw_val, round_d + 1);  -- one guard digit
    SET display_val   = tmp_val;
    SET desired_sig   = sig_min + 1;
  END IF;

  -- 5) Convert to text and trim non‑significant zeros
  SET result_str = CAST(display_val AS CHAR);
  SET result_str = TRIM(TRAILING '0' FROM result_str);
  SET result_str = TRIM(TRAILING '.' FROM result_str);

  -- 6) If non‑terminating, pad with zeros up to desired_sig
  IF NOT is_terminating_fraction(a_str, b_str) THEN
    SET sig_res = count_sig_figs(result_str);
    IF sig_res < desired_sig THEN
      IF LOCATE('.', result_str) = 0 THEN
        SET result_str = CONCAT(result_str, '.');
      END IF;
      SET result_str = CONCAT(
        result_str,
        REPEAT('0', desired_sig - sig_res)
      );
    END IF;
  END IF;

  RETURN result_str;
END$$

DELIMITER ;



-- juste pour afficher la règle appliquée

DELIMITER $$

DROP FUNCTION IF EXISTS rule_of_rounding_divide_with_sig$$
CREATE FUNCTION rule_of_rounding_divide_with_sig(
  a_str VARCHAR(100),
  b_str VARCHAR(100)
) RETURNS VARCHAR(255)
  DETERMINISTIC
BEGIN
  -- 1) Declare every variable with its own DECLARE
  DECLARE a_val           DECIMAL(30,10);
  DECLARE b_val           DECIMAL(30,10);
  DECLARE raw_val         DECIMAL(30,10);
  DECLARE tmp_val         DECIMAL(30,10);
  DECLARE display_val     DECIMAL(30,10);
  DECLARE sig_a           INT;
  DECLARE sig_b           INT;
  DECLARE sig_min         INT;
  DECLARE digits_before   INT;
  DECLARE round_d         INT;
  DECLARE sig_res         INT;
  DECLARE desired_sig     INT;
  DECLARE rule_result_str,result_str      VARCHAR(255);

  -- 2) Parse inputs and count sig‑figs
  SET a_val   = CAST(a_str AS DECIMAL(30,10));
  SET b_val   = CAST(b_str AS DECIMAL(30,10));
  SET sig_a   = count_sig_figs(a_str);
  SET sig_b   = count_sig_figs(b_str);
  SET sig_min = LEAST(sig_a, sig_b);

  -- 3) Compute raw quotient
  SET raw_val = a_val / b_val;

  -- 4) Decide display_val + desired_sig (p or p+1 for guard)
  IF is_terminating_fraction(a_str, b_str) THEN
    SET display_val = raw_val;
    SET desired_sig = sig_min;
  ELSE
    SET digits_before = FLOOR(LOG10(ABS(raw_val)));
    SET round_d       = sig_min - digits_before - 1;
    SET tmp_val       = ROUND(raw_val, round_d + 1);  -- one guard digit
    SET display_val   = tmp_val;
    SET desired_sig   = sig_min + 1;
  END IF;

  -- 5) Convert to text and trim non‑significant zeros
  SET result_str = CAST(display_val AS CHAR);
  SET result_str = TRIM(TRAILING '0' FROM result_str);
  SET result_str = TRIM(TRAILING '.' FROM result_str);
  SET rule_result_str = "terminating fraction rules";
  -- 6) If non‑terminating, pad with zeros up to desired_sig
  IF NOT is_terminating_fraction(a_str, b_str) THEN
    SET sig_res = count_sig_figs(result_str);
    IF sig_res < desired_sig THEN
      IF LOCATE('.', result_str) = 0 THEN
        SET result_str = CONCAT(result_str, '.');
      END IF;
      SET result_str = CONCAT(
        result_str,
        REPEAT('0', desired_sig - sig_res)
      );
    END IF;
    SET rule_result_str = CONCAT('Significant Trailing Zeros + Significant digits rules (', CAST(sig_min    AS CHAR), ') + Guard digits rules (+1) = ', CAST(desired_sig   AS CHAR));
  END IF;

  RETURN rule_result_str;
END$$

DELIMITER ;