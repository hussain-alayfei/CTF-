// Data for the Re-Identified (danger) challenge. Two datasets shown live in the
// browser. The lesson: only ONE anonymised record lacks a "twin" sharing its
// exact quasi-identifiers (age + zip + gender), so only that person can be
// re-identified with confidence by linking to the public roll.
//
// The correct linkage and the recovery token are NOT here — they live only in
// the database and are released by the verify_reident RPC after the player
// submits the correct pair. Reading this file tells you the data, never the
// answer.

export interface AnonRow {
  anon_id: string;
  age: number;
  zip: string;
  gender: 'M' | 'F';
  condition: string;
}

export interface PublicRow {
  public_id: string;
  name: string;
  age: number;
  zip: string;
  gender: 'M' | 'F';
}

// "Anonymised" hospital discharge release — names removed, quasi-identifiers kept.
export const ANON_EXPORT: AnonRow[] = [
  { anon_id: 'A-3300', age: 34, zip: '11201', gender: 'M', condition: 'Asthma' },
  { anon_id: 'A-3301', age: 34, zip: '11201', gender: 'M', condition: 'Fractured wrist' },
  { anon_id: 'A-5012', age: 41, zip: '11205', gender: 'F', condition: 'Migraine' },
  { anon_id: 'A-5013', age: 41, zip: '11205', gender: 'F', condition: 'Hypertension' },
  { anon_id: 'A-6620', age: 27, zip: '11201', gender: 'F', condition: 'Anxiety disorder' },
  { anon_id: 'A-6621', age: 27, zip: '11201', gender: 'F', condition: 'Seasonal allergy' },
  { anon_id: 'A-7731', age: 29, zip: '11215', gender: 'F', condition: 'HIV treatment' },
  { anon_id: 'A-8890', age: 52, zip: '11205', gender: 'M', condition: 'Type 2 diabetes' },
  { anon_id: 'A-8891', age: 52, zip: '11205', gender: 'M', condition: 'Back pain' },
  { anon_id: 'A-9002', age: 34, zip: '11215', gender: 'M', condition: 'Sprained ankle' },
  { anon_id: 'A-9003', age: 34, zip: '11215', gender: 'M', condition: 'Influenza' },
  { anon_id: 'A-1140', age: 45, zip: '11201', gender: 'F', condition: 'Depression' },
  { anon_id: 'A-1141', age: 45, zip: '11201', gender: 'F', condition: 'Thyroid disorder' },
  { anon_id: 'A-2205', age: 27, zip: '11205', gender: 'M', condition: 'Concussion' },
  { anon_id: 'A-2206', age: 27, zip: '11205', gender: 'M', condition: 'Broken nose' },
];

// Public voter roll — names present, freely available.
export const PUBLIC_ROLL: PublicRow[] = [
  { public_id: 'V-1001', name: 'David Cohen', age: 34, zip: '11201', gender: 'M' },
  { public_id: 'V-1002', name: 'Marcus Lee', age: 34, zip: '11201', gender: 'M' },
  { public_id: 'V-1010', name: 'Sara Weiss', age: 41, zip: '11205', gender: 'F' },
  { public_id: 'V-1011', name: 'Rina Adler', age: 41, zip: '11205', gender: 'F' },
  { public_id: 'V-1020', name: 'Yuki Tan', age: 27, zip: '11201', gender: 'F' },
  { public_id: 'V-1021', name: 'Mona Diallo', age: 27, zip: '11201', gender: 'F' },
  { public_id: 'V-2050', name: 'Nadia Osman', age: 29, zip: '11215', gender: 'F' },
  { public_id: 'V-1030', name: 'Omar Farid', age: 52, zip: '11205', gender: 'M' },
  { public_id: 'V-1031', name: 'Paul Genovese', age: 52, zip: '11205', gender: 'M' },
  { public_id: 'V-1040', name: 'Ken Ito', age: 34, zip: '11215', gender: 'M' },
  { public_id: 'V-1041', name: 'Leo Marsh', age: 34, zip: '11215', gender: 'M' },
  { public_id: 'V-1050', name: 'Aisha Rahman', age: 45, zip: '11201', gender: 'F' },
  { public_id: 'V-1051', name: 'Tara Nyx', age: 45, zip: '11201', gender: 'F' },
  { public_id: 'V-1060', name: 'Sam Park', age: 27, zip: '11205', gender: 'M' },
  { public_id: 'V-1061', name: 'Rex Hollis', age: 27, zip: '11205', gender: 'M' },
];
