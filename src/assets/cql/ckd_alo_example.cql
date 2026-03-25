library ckd version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED-CT": 'http://snomed.info/sct'

// Key laboratory values
code "Serum Creatinine": '2160-0' from "LOINC" display 'Creatinine [Mass/volume] in Serum or Plasma'
code "Cystatin C": '33747-0' from "LOINC" display 'Cystatin C [Mass/volume] in Serum or Plasma'
code "Urine Albumin": '14956-7' from "LOINC" display 'Microalbumin [Mass/volume] in Urine'
code "Urine Creatinine": '2161-8' from "LOINC" display 'Creatinine [Mass/volume] in Urine'
code "Hemoglobin": '718-7' from "LOINC" display 'Hemoglobin [Mass/volume] in Blood'
code "Systolic BP": '8480-6' from "LOINC" display 'Systolic blood pressure'

// Value sets for conditions
valueset "Hypertension": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.3157.4022'
valueset "Diabetes Type 2": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.103.12.1021'
valueset "Cardiovascular Disease": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.369'
valueset "Stage 5 Kidney Disease": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1002'

context Patient

// Basic patient information
define "Patient Age": AgeInYears()
define "Patient Gender": Patient.gender.value

// Laboratory values retrieval
define "Most Recent Creatinine":
  Last([Observation: "Serum Creatinine"] O
    where O.status in { 'final', 'amended', 'corrected' }
    
    sort by effective.value)

define "Creatinine Value":
  if "Most Recent Creatinine" is not null then
    ("Most Recent Creatinine".value as FHIR.Quantity).value.value
  else
    null

define private "Most Recent Cystatin C":
  Last([Observation: "Cystatin C"] O
    where O.status in { 'final', 'amended', 'corrected' }
      
    sort by effective.value)

define private "Cystatin C Value":
  if "Most Recent Cystatin C" is not null then
    ("Most Recent Cystatin C".value as FHIR.Quantity).value.value
  else
    null


define private "Most Recent ACR":
  Last([Observation] O
    where O.code ~ Code '14958-3' from "LOINC"
      and O.status in { 'final', 'amended', 'corrected' }
    sort by effective.value)

define private "ACR Value":
  if "Most Recent ACR" is not null then
    ("Most Recent ACR".value as FHIR.Quantity).value.value
  else
    null

// CKD-EPI eGFR calculation (simplified - using creatinine only)
define private "Calculate eGFR CKD EPI":
  if "Creatinine Value" is not null and "Patient Age" is not null then
    case "Patient Gender"
      when 'female' then
        case
          when "Creatinine Value" <= 0.7 then
            144 * Power("Creatinine Value" / 0.7, -0.329) * Power(0.993, "Patient Age")
          else
            144 * Power("Creatinine Value" / 0.7, -1.209) * Power(0.993, "Patient Age")
        end
      when 'male' then
        case
          when "Creatinine Value" <= 0.9 then
            141 * Power("Creatinine Value" / 0.9, -0.411) * Power(0.993, "Patient Age")
          else
            141 * Power("Creatinine Value" / 0.9, -1.209) * Power(0.993, "Patient Age")
        end
      else
        null
    end
  else
    null

// Age-adjusted GFR thresholds
define private "eGFR Threshold for Age":
  case
    when "Patient Age" < 40 then 75
    when "Patient Age" >= 65 then 45
    else 60
  end

// CKD diagnostic criteria
define private "Has Decreased eGFR":
  "Calculate eGFR CKD EPI" < "eGFR Threshold for Age"

define private "Has Albuminuria":
  "ACR Value" >= 30

define private "ACR Category":
  case
    when "ACR Value" < 30 then 'A1'
    when "ACR Value" >= 30 and "ACR Value" <= 300 then 'A2'
    when "ACR Value" > 300 then 'A3'
    else null
  end

// CKD staging
define private "CKD GFR Stage":
  case
    when "Calculate eGFR CKD EPI" >= 90 then 'G1'
    when "Calculate eGFR CKD EPI" >= 60 and "Calculate eGFR CKD EPI" < 90 then 'G2'
    when "Calculate eGFR CKD EPI" >= 45 and "Calculate eGFR CKD EPI" < 60 then 'G3a'
    when "Calculate eGFR CKD EPI" >= 30 and "Calculate eGFR CKD EPI" < 45 then 'G3b'
    when "Calculate eGFR CKD EPI" >= 15 and "Calculate eGFR CKD EPI" < 30 then 'G4'
    when "Calculate eGFR CKD EPI" < 15 then 'G5'
    else null
  end

// Risk categories for cardiovascular and renal outcomes
define private "CKD Risk Category":
  case
    when "CKD GFR Stage" in {'G1', 'G2'} and "ACR Category" = 'A1' then 'Low Risk'
    when ("CKD GFR Stage" = 'G1' and "ACR Category" = 'A2') 
          or ("CKD GFR Stage" = 'G2' and "ACR Category" = 'A2')
         or ("CKD GFR Stage" = 'G3a' and "ACR Category" = 'A1') then 'Moderate Risk'
    when ("CKD GFR Stage" = 'G1' and "ACR Category" = 'A3')
         or ("CKD GFR Stage" in {'G2', 'G3a'} and "ACR Category" = 'A3')
         or ("CKD GFR Stage" = 'G3a' and "ACR Category" = 'A2')
         or ("CKD GFR Stage" = 'G3b' and "ACR Category" in {'A1', 'A2'}) then 'High Risk'
    when ("CKD GFR Stage" = 'G3b' and "ACR Category" = 'A3')
         or ("CKD GFR Stage" in {'G4', 'G5'}) then 'Very High Risk'
    else null
  end

// CKD diagnostic criteria (either decreased eGFR OR markers of kidney damage)
define private "Has CKD":
  "Has Decreased eGFR" or "Has Albuminuria" or "Has Stage 5 Kidney Disease"

// Comorbidities
define private "Has Diabetes":
  exists([Condition: "Diabetes Type 2"] D
    where D.clinicalStatus.coding.code[0] ='active')

define private "Has Hypertension":
  exists([Condition: "Hypertension"] H
    where H.clinicalStatus.coding.code[0] ='active')

define private "Has Cardiovascular Disease":
  exists([Condition: "Cardiovascular Disease"] C
    where C.clinicalStatus.coding.code[0] ='active')

define private "Has Stage 5 Kidney Disease":
  exists([Condition: "Stage 5 Kidney Disease"] K
    where K.clinicalStatus.coding.code[0] ='active')

// Screening criteria
define private "Requires CKD Screening":
  "Has Hypertension" 
  or "Has Diabetes"
  or "Has Cardiovascular Disease"
  or "Patient Age" >= 60
  or exists([Observation] BMI
       where BMI.status in {'final', 'amended', 'corrected'}
       and BMI.code.coding.code[0] = '39156-5'
         and (BMI.value as FHIR.Quantity).value.value > 30)

// Nephrology referral criteria
define private "Requires Nephrology Referral by eGFR":
  case
    when "Patient Age" > 80 and "Calculate eGFR CKD EPI" < 20 then true
    when "Patient Age" >= 70 and "Patient Age" <= 80 and "Calculate eGFR CKD EPI" < 30 then true
    when "Patient Age" < 70 and "Calculate eGFR CKD EPI" < 45 then true
    when "Calculate eGFR CKD EPI" < 30 then true
    else false
  end

define private "Requires Nephrology Referral by ACR":
  "ACR Value" > 300

define private "Requires Nephrology Referral":
  "Requires Nephrology Referral by eGFR"
  or "Requires Nephrology Referral by ACR"
  or "Has Rapid Progression"
  or "Has Refractory Hypertension"
  or "Has Anemia with CKD"

// Progression assessment (simplified)
define private "Has Rapid Progression":
  // This would require multiple eGFR measurements over time
  // Simplified as placeholder
  false

define private "Has Refractory Hypertension":
  exists([Observation: "Systolic BP"] BP
    where BP.status in {'final', 'amended', 'corrected'}
      and (BP.value as FHIR.Quantity).value.value > 130
      )
  and "Has Hypertension"

define private "Most Recent Hemoglobin":
  Last([Observation: "Hemoglobin"] H
    where H.status in { 'final', 'amended', 'corrected' }
      
    sort by effective.value)

define private "Hemoglobin Value":
  if "Most Recent Hemoglobin" is not null then
    ("Most Recent Hemoglobin".value as FHIR.Quantity).value.value
  else
    null

define private "Has Anemia with CKD":
  "Has CKD" and "CKD GFR Stage" in {'G3a', 'G3b', 'G4', 'G5'}
  and "Hemoglobin Value" < 10.0

// Monitoring frequency
define private "Monitoring Frequency":
  case "CKD GFR Stage"
    when 'G1' then 'Annual if ACR > 30 mg/g, otherwise no specific frequency'
    when 'G2' then 'Annual if ACR > 30 mg/g, otherwise no specific frequency'
    when 'G3a' then 'Every 6-12 months'
    when 'G3b' then 'Every 3-6 months'
    when 'G4' then 'Every 3 months'
    when 'G5' then 'Every 1-3 months'
    else 'Not specified'
  end

// Blood pressure targets
define private "BP Target Systolic":
  case
    when "ACR Value" > 30 then 130
    else 140
  end

// Medication adjustments needed
define private "Requires Medication Adjustment":
  "CKD GFR Stage" in {'G3b', 'G4', 'G5'}

define private "Contraindicated Medications":
  if "CKD GFR Stage" in {'G3b', 'G4', 'G5'} then
    {'NSAIDs', 'Metformin (if eGFR < 30)', 'Iodinated contrast (use with caution)'}
  else
    {}

// Dietary recommendations
define private "Dietary Recommendations":
  case "CKD GFR Stage"
    when 'G1' then {'Moderate sodium restriction if hypertensive'}
    when 'G2' then {'Moderate sodium restriction if hypertensive'}
    when 'G3a' then {'Moderate sodium restriction if hypertensive'}
    when 'G3b' then {'Monitor protein intake', 'Sodium restriction'}
    when 'G4' then {'Protein restriction (0.8 g/kg/day)', 'Sodium, potassium, phosphorus restriction'}
    when 'G5' then {'Protein restriction (0.8 g/kg/day)', 'Sodium, potassium, phosphorus restriction'}
    else {'Standard healthy diet'}
  end

// Vaccination recommendations
define private "Vaccination Recommendations":
  if "CKD GFR Stage" in {'G3b', 'G4', 'G5'} then
    {'Pneumococcal vaccine', 'Influenza vaccine', 'Hepatitis B vaccine'}
  else
    {'Standard age-appropriate vaccines'}

// Main assessment result
define  "CKD Assessment Result":
 Tuple
  {
    patient_id: Patient.id.value,
    assessment_date: Today(),
    age: "Patient Age",
    gender: "Patient Gender",
    creatinine: "Creatinine Value",
    egfr: "Calculate eGFR CKD EPI",
    acr: "ACR Value",
    acr_category: "ACR Category",
    ckd_stage: "CKD GFR Stage",
    has_ckd: "Has CKD",
    risk_category: "CKD Risk Category",
    requires_screening: "Requires CKD Screening",
    requires_nephrology_referral: "Requires Nephrology Referral",
    monitoring_frequency: "Monitoring Frequency",
    bp_target_systolic: "BP Target Systolic",
    requires_medication_adjustment: "Requires Medication Adjustment",
    contraindicated_medications: "Contraindicated Medications",
    dietary_recommendations: "Dietary Recommendations",
    vaccination_recommendations: "Vaccination Recommendations",
    diabetes: "Has Diabetes",
    hypertension: "Has Hypertension",
    cardiovascular_disease: "Has Cardiovascular Disease"
  }

// Specific SGLT2 inhibitor recommendations for diabetic patients
define "SGLT2 Inhibitor Recommendations":
  if "Has Diabetes" and "Calculate eGFR CKD EPI" >= 25 then
    case
      when "Calculate eGFR CKD EPI" >= 45 then 
        {'Dapagliflozin (approved for CKD)', 'Empagliflozin', 'Canagliflozin if ACR > 300'}
      when "Calculate eGFR CKD EPI" >= 30 then 
        {'Dapagliflozin (approved for CKD)', 'Empagliflozin'}
      when "Calculate eGFR CKD EPI" >= 25 then 
        {'Dapagliflozin (approved for CKD) - can continue until dialysis'}
      else 
        {}
    end
  else if not "Has Diabetes" and "Calculate eGFR CKD EPI" >= 25 then
    {'Dapagliflozin (approved for non-diabetic CKD)'}
  else
    {}

define private "TrioForRec":
 ("Has Diabetes" or "Has Hypertension" or "ACR Value" > 30)

define private "aia_rec":
  ("Has CKD" and "TrioForRec") 

// Comprehensive treatment recommendations
define "Treatment Recommendations":
  {
    ace_inhibitor_arb: if "aia_rec" then 'Recommended' else 'Consider',
    sglt2_inhibitors: "SGLT2 Inhibitor Recommendations",
    statin_therapy: if "CKD GFR Stage" in {'G3a', 'G3b', 'G4', 'G5'} then 'Recommended for cardiovascular protection' else 'As per standard guidelines',
    lifestyle_modifications: {'Mediterranean diet', 'Regular exercise (150 min/week)', 'Smoking cessation', 'Weight management'},
    mineral_bone_disorder_monitoring: if "CKD GFR Stage" in {'G3b', 'G4', 'G5'} then 'Monitor calcium, phosphorus, PTH, vitamin D' else 'Not required'
  }