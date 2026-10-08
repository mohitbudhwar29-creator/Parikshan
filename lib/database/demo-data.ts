import type { ExtractedRecord, ExtractedLabValue, ExtractedMedicine } from "@/types/health";

// Fictional demo data only. Names, clinics and doctors are invented. Values are illustrative.

export const DEMO_EMAIL = "demo.patient@example.com";
export const DEMO_ABHA = "99-0000-0000-0001";

export interface DemoProfileSeed {
  key: "self" | "child" | "elder";
  name: string;
  dateOfBirth: string;
  relationship: "SELF" | "CHILD" | "ELDER";
  records: ExtractedRecord[];
}

const lab = (testName: string, value: string, unit: string, referenceRange = ""): ExtractedLabValue => ({
  testName,
  value,
  unit,
  referenceRange,
});

const medicine = (
  name: string,
  dosage: string,
  frequency: string,
  timesPerDay: number,
  durationDays: number,
  notes = "",
): ExtractedMedicine => ({ name, dosage, frequency, timesPerDay, durationDays, notes });

const baseRecord = (
  documentType: ExtractedRecord["documentType"],
  title: string,
  recordDate: string,
  extra: Partial<ExtractedRecord> = {},
): ExtractedRecord => ({
  documentType,
  title,
  recordDate,
  doctorName: "Dr. Example",
  facility: "City Diagnostics Lab",
  diagnosisTerms: [],
  medications: [],
  labValues: [],
  warnings: [],
  ...extra,
});

const fullBloodReport = (
  recordDate: string,
  values: { hb: string; glucose: string; bp: string; vitD?: string; cholesterol?: string },
): ExtractedRecord =>
  baseRecord("LAB_REPORT", "Blood Report", recordDate, {
    labValues: [
      lab("Haemoglobin (Hb)", values.hb, "g/dL", "12.0 - 16.0"),
      lab("RBC Count", "4.6", "mill/cumm", "4.2 - 5.4"),
      lab("Total WBC Count", "7800", "cells/cumm", "4000 - 11000"),
      lab("Platelet Count", "250000", "/cumm", "150000 - 410000"),
      lab("MCV", "88", "fL", "80 - 100"),
      lab("MCH", "29", "pg", "27 - 32"),
      lab("MCHC", "33", "g/dL", "32 - 36"),
      lab("RDW", "13.2", "%", "11.5 - 14.5"),
      lab("Blood Glucose (Fasting)", values.glucose, "mg/dL", "70 - 100"),
      ...(values.vitD ? [lab("Vitamin D (25-OH)", values.vitD, "ng/mL", "30 - 100")] : []),
      ...(values.cholesterol ? [lab("Total Cholesterol", values.cholesterol, "mg/dL", "< 200")] : []),
      lab("Blood Pressure", values.bp, "mmHg", "90-120 / 60-80"),
    ],
  });

export const DEMO_PROFILES: DemoProfileSeed[] = [
  {
    key: "self",
    name: "Demo User",
    dateOfBirth: "1992-06-15",
    relationship: "SELF",
    records: [
      baseRecord("LAB_REPORT", "Blood Report", "2026-01-12", {
        labValues: [
          lab("Haemoglobin (Hb)", "14.5", "g/dL", "12.0 - 16.0"),
          lab("Blood Glucose (Fasting)", "101", "mg/dL", "70 - 100"),
          lab("Blood Pressure", "126/84", "mmHg", "90-120 / 60-80"),
          lab("Vitamin D (25-OH)", "19.0", "ng/mL", "30 - 100"),
          lab("Total Cholesterol", "212", "mg/dL", "< 200"),
        ],
      }),
      baseRecord("LAB_REPORT", "Blood Report", "2026-04-13", {
        labValues: [
          lab("Haemoglobin (Hb)", "13.8", "g/dL", "12.0 - 16.0"),
          lab("Blood Glucose (Fasting)", "98", "mg/dL", "70 - 100"),
        ],
      }),
      baseRecord("LAB_REPORT", "Blood Report", "2026-08-14", {
        labValues: [
          lab("Haemoglobin (Hb)", "12.6", "g/dL", "12.0 - 16.0"),
          lab("Blood Glucose (Fasting)", "104", "mg/dL", "70 - 100"),
          lab("Blood Pressure", "122/82", "mmHg", "90-120 / 60-80"),
        ],
      }),
      fullBloodReport("2026-09-12", { hb: "11.0", glucose: "108", bp: "120/80", vitD: "24.5", cholesterol: "198" }),
      baseRecord("DOCTOR_VISIT", "Doctor Visit", "2026-09-02", {
        facility: "City Health Clinic",
        diagnosisTerms: ["Seasonal allergy (as written by doctor)"],
        labValues: [lab("Heart Rate", "78", "bpm", "60 - 100"), lab("Weight", "68.4", "kg")],
      }),
      baseRecord("PRESCRIPTION", "Prescription", "2026-10-06", {
        facility: "City Health Clinic",
        diagnosisTerms: ["Fever (as written by doctor)"],
        medications: [
          medicine("Paracetamol", "500 mg", "1-0-1", 2, 5, "after food"),
          medicine("Amoxicillin", "500 mg", "1-1-1", 3, 7, "before food"),
          medicine("Vitamin D3", "1000 IU", "1-0-0", 1, 90, "after breakfast"),
        ],
      }),
    ],
  },
  {
    key: "child",
    name: "Aarav (demo child)",
    dateOfBirth: "2019-03-10",
    relationship: "CHILD",
    records: [
      baseRecord("DOCTOR_VISIT", "Doctor Visit", "2026-01-20", {
        facility: "City Health Clinic",
        labValues: [lab("Weight", "22.1", "kg"), lab("Heart Rate", "96", "bpm", "70 - 120")],
        diagnosisTerms: ["Routine growth check"],
      }),
      baseRecord("LAB_REPORT", "Blood Report", "2026-08-12", {
        labValues: [lab("Haemoglobin (Hb)", "12.8", "g/dL", "11.5 - 14.5")],
      }),
      baseRecord("DOCTOR_VISIT", "Doctor Visit", "2026-09-20", {
        facility: "City Health Clinic",
        labValues: [lab("Weight", "23.4", "kg"), lab("Heart Rate", "92", "bpm", "70 - 120")],
        diagnosisTerms: ["Routine growth check"],
      }),
    ],
  },
  {
    key: "elder",
    name: "Savitri Devi (demo elder)",
    dateOfBirth: "1956-05-02",
    relationship: "ELDER",
    records: [
      baseRecord("LAB_REPORT", "Blood Report", "2026-05-05", {
        labValues: [
          lab("Haemoglobin (Hb)", "11.8", "g/dL", "12.0 - 15.5"),
          lab("Blood Glucose (Fasting)", "142", "mg/dL", "70 - 100"),
          lab("Blood Pressure", "142/88", "mmHg", "90-120 / 60-80"),
          lab("Total Cholesterol", "220", "mg/dL", "< 200"),
        ],
      }),
      baseRecord("LAB_REPORT", "Blood Report", "2026-09-05", {
        labValues: [
          lab("Haemoglobin (Hb)", "12.1", "g/dL", "12.0 - 15.5"),
          lab("Blood Glucose (Fasting)", "138", "mg/dL", "70 - 100"),
          lab("Blood Pressure", "136/84", "mmHg", "90-120 / 60-80"),
          lab("Total Cholesterol", "214", "mg/dL", "< 200"),
        ],
      }),
    ],
  },
];

/** Mock interaction dataset. Stored as normalised generic names with the alphabetically first name as medicineA. */
export const DEMO_INTERACTIONS: { medicineA: string; medicineB: string; description: string }[] = [
  { medicineA: "amoxicillin", medicineB: "warfarin", description: "Amoxicillin may increase the blood-thinning effect of warfarin. Blood clotting tests (INR) may need closer checking." },
  { medicineA: "paracetamol", medicineB: "warfarin", description: "Regular use of paracetamol may raise the INR (blood clotting time) in people taking warfarin." },
  { medicineA: "amoxicillin", medicineB: "methotrexate", description: "Penicillin-type antibiotics may increase methotrexate levels in the blood." },
  { medicineA: "ibuprofen", medicineB: "warfarin", description: "Taking ibuprofen with warfarin may increase the risk of bleeding." },
  { medicineA: "aspirin", medicineB: "ibuprofen", description: "Ibuprofen may reduce the heart-protective effect of low-dose aspirin when taken together." },
  { medicineA: "hydrochlorothiazide", medicineB: "vitamin d", description: "Vitamin D taken with thiazide diuretics may raise blood calcium levels." },
  { medicineA: "calcium", medicineB: "levothyroxine", description: "Calcium can reduce how well levothyroxine is absorbed when both are taken at the same time." },
  { medicineA: "iron", medicineB: "levothyroxine", description: "Iron can reduce how well levothyroxine is absorbed when both are taken at the same time." },
];
