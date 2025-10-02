import { Injectable } from '@angular/core';
import { Patient, Condition } from './patient.service';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface DiagnosisSpec {
  label: string;
  computedLocation: string;
  termQueried: string;
  snomed: {
    code: string;
    display: string;
    icd10: {
      code: string;
    };
    descendants: Array<{
      code: string;
      display: string;
      icd10: {
        code: string;
      };
    }>;
  };
}

export interface AgeGroupSpec {
  ageGroup: string;
  ageStart: number;
  ageEnd: number | null;
  male: DiagnosisSpec[];
  female: DiagnosisSpec[];
}

export interface PatientGenerationSpec {
  diseasePrevalenceByAgeAndSex: AgeGroupSpec[];
}

@Injectable({
  providedIn: 'root'
})
export class PatientSimulationService {

  private readonly maleFirstNames = [
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Charles', 'Joseph', 'Thomas',
    'Christopher', 'Daniel', 'Paul', 'Mark', 'Donald', 'George', 'Kenneth', 'Steven', 'Edward', 'Brian',
    'Ronald', 'Anthony', 'Kevin', 'Jason', 'Matthew', 'Gary', 'Timothy', 'Jose', 'Larry', 'Jeffrey',
    'Frank', 'Scott', 'Eric', 'Stephen', 'Andrew', 'Raymond', 'Gregory', 'Joshua', 'Jerry', 'Dennis',
    'Walter', 'Patrick', 'Peter', 'Harold', 'Douglas', 'Henry', 'Carl', 'Arthur', 'Ryan', 'Roger',
    'Albert', 'Lawrence', 'Wayne', 'Eugene', 'Louis', 'Philip', 'Bobby', 'Johnny', 'Ralph', 'Eugene'
  ];

  private readonly femaleFirstNames = [
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
    'Nancy', 'Lisa', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle',
    'Laura', 'Sarah', 'Kimberly', 'Deborah', 'Dorothy', 'Lisa', 'Nancy', 'Karen', 'Betty', 'Helen',
    'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle', 'Laura', 'Sarah', 'Kimberly', 'Deborah',
    'Dorothy', 'Amy', 'Angela', 'Ashley', 'Brenda', 'Emma', 'Olivia', 'Cynthia', 'Marie', 'Janet',
    'Catherine', 'Frances', 'Christine', 'Samantha', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Virginia',
    'Maria', 'Heather', 'Diane', 'Julie', 'Joyce', 'Victoria', 'Kelly', 'Christina', 'Joan', 'Evelyn'
  ];

  private readonly lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
    'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
    'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
    'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson'
  ];

  private readonly cities = [
    'Springfield', 'Franklin', 'Georgetown', 'Clinton', 'Fairview', 'Salem', 'Madison', 'Washington',
    'Chester', 'Marion', 'Greenville', 'Georgetown', 'Jackson', 'Franklin', 'Clinton', 'Springfield',
    'Salem', 'Madison', 'Washington', 'Chester', 'Marion', 'Greenville', 'Georgetown', 'Jackson',
    'Franklin', 'Clinton', 'Springfield', 'Salem', 'Madison', 'Washington', 'Chester', 'Marion'
  ];

  private readonly states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  private readonly phoneAreaCodes = [
    '201', '202', '203', '205', '206', '207', '208', '209', '210', '212',
    '213', '214', '215', '216', '217', '218', '219', '224', '225', '228',
    '229', '231', '234', '239', '240', '248', '251', '252', '253', '254',
    '256', '260', '262', '267', '269', '270', '276', '281', '301', '302',
    '303', '304', '305', '307', '308', '309', '310', '312', '313', '314',
    '315', '316', '317', '318', '319', '320', '321', '323', '325', '330',
    '331', '334', '336', '337', '339', '347', '351', '352', '360', '361',
    '386', '401', '402', '404', '405', '406', '407', '408', '409', '410',
    '412', '413', '414', '415', '417', '419', '423', '424', '425', '430',
    '432', '434', '435', '440', '442', '443', '445', '447', '458', '463',
    '464', '469', '470', '475', '478', '479', '480', '484', '501', '502',
    '503', '504', '505', '507', '508', '509', '510', '512', '513', '515',
    '516', '517', '518', '520', '530', '531', '534', '539', '540', '541',
    '551', '559', '561', '562', '563', '564', '567', '570', '571', '573',
    '574', '575', '580', '585', '586', '601', '602', '603', '605', '606',
    '607', '608', '609', '610', '612', '614', '615', '616', '617', '618',
    '619', '620', '623', '626', '628', '629', '630', '631', '636', '641',
    '646', '650', '651', '657', '660', '661', '662', '667', '669', '678',
    '681', '682', '701', '702', '703', '704', '706', '707', '708', '712',
    '713', '714', '715', '716', '717', '718', '719', '720', '724', '725',
    '727', '731', '732', '734', '737', '740', '743', '747', '754', '757',
    '760', '762', '763', '765', '769', '770', '772', '773', '774', '775',
    '779', '781', '785', '786', '787', '801', '802', '803', '804', '805',
    '806', '808', '810', '812', '813', '814', '815', '816', '817', '818',
    '828', '830', '831', '832', '843', '845', '847', '848', '850', '856',
    '857', '858', '859', '860', '862', '863', '864', '865', '870', '872',
    '878', '901', '903', '904', '906', '907', '908', '909', '910', '912',
    '913', '914', '915', '916', '917', '918', '919', '920', '925', '928',
    '929', '930', '931', '934', '936', '937', '940', '941', '947', '949',
    '951', '952', '954', '956', '959', '970', '971', '972', '973', '978',
    '979', '980', '984', '985', '989'
  ];

  private patientGenerationSpec: PatientGenerationSpec | null = null;

  constructor(private http: HttpClient) { }

  /**
   * Generates a random patient with realistic data
   */
  generateRandomPatient(): Patient {
    const gender = this.getRandomGender();
    const firstName = this.getRandomFirstName(gender);
    const lastName = this.getRandomLastName();
    const birthDate = this.generateRandomBirthDate();
    const age = this.calculateAge(birthDate);
    
    const patientId = 'patient-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const mrn = 'MRN' + String(Date.now()).slice(-6);
    
    const phoneNumber = this.generateRandomPhoneNumber();
    const email = this.generateRandomEmail(firstName, lastName);
    const address = this.generateRandomAddress();

    return {
      resourceType: 'Patient',
      id: patientId,
      identifier: [
        {
          system: 'http://hospital.example.org/identifiers/patient',
          value: mrn
        }
      ],
      active: true,
      name: [
        {
          use: 'official',
          family: lastName,
          given: [firstName]
        }
      ],
      telecom: [
        {
          system: 'phone',
          value: phoneNumber,
          use: 'home'
        },
        {
          system: 'email',
          value: email,
          use: 'home'
        }
      ],
      gender: gender,
      birthDate: birthDate,
      address: [address]
    };
  }

  /**
   * Generates multiple random patients
   */
  generateRandomPatients(count: number): Patient[] {
    const patients: Patient[] = [];
    for (let i = 0; i < count; i++) {
      patients.push(this.generateRandomPatient());
    }
    return patients;
  }

  private getRandomGender(): string {
    const genders = ['male', 'female'];
    return genders[Math.floor(Math.random() * genders.length)];
  }

  private getRandomFirstName(gender: string): string {
    const names = gender === 'male' ? this.maleFirstNames : this.femaleFirstNames;
    return names[Math.floor(Math.random() * names.length)];
  }

  private getRandomLastName(): string {
    return this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
  }

  private generateRandomBirthDate(): string {
    // Generate age between 18 and 85
    const age = Math.floor(Math.random() * 68) + 18;
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - age;
    
    // Generate random month (1-12) and day (1-28 to avoid month-end issues)
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    
    // Format as YYYY-MM-DD
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    
    return `${birthYear}-${monthStr}-${dayStr}`;
  }

  private calculateAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  private generateRandomPhoneNumber(): string {
    const areaCode = this.phoneAreaCodes[Math.floor(Math.random() * this.phoneAreaCodes.length)];
    const exchange = Math.floor(Math.random() * 900) + 100; // 100-999
    const number = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
    
    return `+1-${areaCode}-${exchange}-${number}`;
  }

  private generateRandomEmail(firstName: string, lastName: string): string {
    const domain = 'email.com';
    
    // Sometimes add numbers or variations
    const variations = [
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
      `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 99) + 1}@${domain}`,
      `${firstName.toLowerCase()}${Math.floor(Math.random() * 99) + 1}@${domain}`
    ];
    
    return variations[Math.floor(Math.random() * variations.length)];
  }

  private generateRandomAddress(): any {
    const streetNumbers = Math.floor(Math.random() * 9999) + 1;
    const streetNames = [
      'Main St', 'Oak Ave', 'Pine St', 'Maple Dr', 'Cedar Ln', 'Elm St', 'Park Ave', 'First St',
      'Second St', 'Third St', 'Broadway', 'Washington St', 'Lincoln Ave', 'Jefferson St', 'Madison Ave',
      'Franklin St', 'Church St', 'School St', 'High St', 'Market St', 'Center St', 'Union St',
      'Spring St', 'Summer St', 'Winter St', 'Autumn Ln', 'Garden St', 'Forest Ave', 'River Rd',
      'Hill St', 'Valley Rd', 'Meadow Ln', 'Sunset Blvd', 'Sunrise Ave', 'Dawn St', 'Dusk Ave'
    ];
    
    const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
    const city = this.cities[Math.floor(Math.random() * this.cities.length)];
    const state = this.states[Math.floor(Math.random() * this.states.length)];
    const postalCode = this.generateRandomPostalCode();

    return {
      use: 'home',
      type: 'physical',
      line: [`${streetNumbers} ${streetName}`],
      city: city,
      state: state,
      postalCode: postalCode,
      country: 'US'
    };
  }

  private generateRandomPostalCode(): string {
    // Generate a realistic US ZIP code
    const firstPart = Math.floor(Math.random() * 99999) + 10000; // 10000-99999
    return firstPart.toString();
  }

  /**
   * Generates a patient with specific age range
   */
  generateRandomPatientWithAgeRange(minAge: number, maxAge: number): Patient {
    const patient = this.generateRandomPatient();
    const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - age;
    
    // Generate random month and day
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    
    patient.birthDate = `${birthYear}-${monthStr}-${dayStr}`;
    
    return patient;
  }

  /**
   * Generates a patient with specific gender
   */
  generateRandomPatientWithGender(gender: 'male' | 'female'): Patient {
    const patient = this.generateRandomPatient();
    patient.gender = gender;
    
    // Update name to match gender
    const firstName = this.getRandomFirstName(gender);
    if (patient.name && patient.name.length > 0) {
      patient.name[0].given = [firstName];
    }
    
    return patient;
  }

  /**
   * Loads the patient generation specification from the JSON file
   */
  private loadPatientGenerationSpec(): Observable<PatientGenerationSpec> {
    if (this.patientGenerationSpec) {
      return of(this.patientGenerationSpec);
    }

    return this.http.get<PatientGenerationSpec>('/assets/patients/patient-generation-spec.json')
      .pipe(
        map(spec => {
          this.patientGenerationSpec = spec;
          return spec;
        }),
        catchError(error => {
          return of({ diseasePrevalenceByAgeAndSex: [] });
        })
      );
  }

  /**
   * Generates 1-4 random diagnoses for a patient based on their age and gender
   */
  generateDiagnoses(patient: Patient): Observable<Condition[]> {
    return this.loadPatientGenerationSpec().pipe(
      map(spec => {
        const age = this.calculateAge(patient.birthDate || '');
        const gender = patient.gender || 'male';
        
        // Find the appropriate age group
        const ageGroup = this.findAgeGroup(spec, age);
        if (!ageGroup) {
          return [];
        }

        // Get the appropriate gender array
        const genderArray = gender === 'female' ? ageGroup.female : ageGroup.male;
        if (genderArray.length === 0) {
          return [];
        }

        // Generate 1-4 random diagnoses
        const numDiagnoses = Math.floor(Math.random() * 4) + 1; // 1-4 diagnoses
        const selectedDiagnoses: DiagnosisSpec[] = [];
        const usedCodes = new Set<string>();

        // Select random diagnoses without repetition
        while (selectedDiagnoses.length < numDiagnoses && selectedDiagnoses.length < genderArray.length) {
          const randomIndex = Math.floor(Math.random() * genderArray.length);
          const diagnosis = genderArray[randomIndex];
          
          // Check if we haven't already selected this SNOMED code
          if (!usedCodes.has(diagnosis.snomed.code)) {
            selectedDiagnoses.push(diagnosis);
            usedCodes.add(diagnosis.snomed.code);
          }
        }

        // Convert to FHIR Condition resources
        return selectedDiagnoses.map(diagnosis => this.createConditionFromDiagnosis(patient, diagnosis));
      })
    );
  }

  /**
   * Finds the appropriate age group for a given age
   */
  private findAgeGroup(spec: PatientGenerationSpec, age: number): AgeGroupSpec | null {
    for (const ageGroup of spec.diseasePrevalenceByAgeAndSex) {
      if (age >= ageGroup.ageStart && (ageGroup.ageEnd === null || age <= ageGroup.ageEnd)) {
        return ageGroup;
      }
    }
    return null;
  }

  /**
   * Creates a FHIR Condition resource from a diagnosis specification
   */
  private createConditionFromDiagnosis(patient: Patient, diagnosis: DiagnosisSpec): Condition {
    const conditionId = `condition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const currentTime = new Date().toISOString();

    return {
      resourceType: 'Condition',
      id: conditionId,
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        }],
        text: 'Active'
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed'
        }],
        text: 'Confirmed'
      },
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: diagnosis.snomed.code,
          display: diagnosis.snomed.display
        }],
        text: diagnosis.snomed.display
      },
      subject: {
        reference: `Patient/${patient.id}`,
        display: this.getPatientDisplayName(patient)
      },
      onsetDateTime: currentTime,
      recordedDate: currentTime,
      snomedConceptId: diagnosis.snomed.code,
      icd10Code: diagnosis.snomed.icd10?.code || undefined,
      computedLocation: diagnosis.computedLocation
    } as Condition;
  }

  /**
   * Gets the display name for a patient
   */
  private getPatientDisplayName(patient: Patient): string {
    if (patient.name && patient.name.length > 0) {
      const name = patient.name[0];
      if (name.text) return name.text;
      if (name.given && name.family) {
        return `${name.given.join(' ')} ${name.family}`;
      }
      if (name.family) return name.family;
    }
    return `Patient ${patient.id}`;
  }

  /**
   * Generates a random patient with diagnoses based on age and gender
   */
  generateRandomPatientWithDiagnoses(): Observable<{ patient: Patient; diagnoses: Condition[] }> {
    const patient = this.generateRandomPatient();
    return this.generateDiagnoses(patient).pipe(
      map(diagnoses => ({ patient, diagnoses }))
    );
  }

  /**
   * Generates a patient with specific age range and diagnoses
   */
  generateRandomPatientWithAgeRangeAndDiagnoses(minAge: number, maxAge: number): Observable<{ patient: Patient; diagnoses: Condition[] }> {
    const patient = this.generateRandomPatientWithAgeRange(minAge, maxAge);
    return this.generateDiagnoses(patient).pipe(
      map(diagnoses => ({ patient, diagnoses }))
    );
  }

  /**
   * Generates a patient with specific gender and diagnoses
   */
  generateRandomPatientWithGenderAndDiagnoses(gender: 'male' | 'female'): Observable<{ patient: Patient; diagnoses: Condition[] }> {
    const patient = this.generateRandomPatientWithGender(gender);
    return this.generateDiagnoses(patient).pipe(
      map(diagnoses => ({ patient, diagnoses }))
    );
  }
}
