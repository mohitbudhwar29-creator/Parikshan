// Maps stored demo data to FHIR R4 resources for export. Pure functions: no database access here.
// Identifiers use a placeholder system (urn:example:...) on purpose. A production integration would use
// the national identifier system its governing body publishes. ABHA numbers are deliberately never exported.

export const PLACEHOLDER_IDENTIFIER_SYSTEM = "urn:example:personal-health-copilot:profile";


export interface ExportProfile {
  id: string;
  name: string;
  dateOfBirth: Date | null;
}

export interface ExportLab {
  id: string;
  testName: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  referenceRange: string | null;
  flag: string;
}

export interface ExportMedicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string | null;
  timesPerDay: number;
  durationDays: number | null;
  startDate: Date;
  endDate: Date | null;
  notes: string | null;
}

export interface ExportRecord {
  id: string;
  type: string;
  title: string;
  recordDate: Date;
  doctorName: string | null;
  facility: string | null;
  diagnosisTerms: string[];
  fileName: string | null;
  labs: ExportLab[];
  medications: ExportMedicine[];
}

type FhirResource = { resourceType: string; id: string } & Record<string, unknown>;

const ISO_DATE = (value: Date) => value.toISOString().slice(0, 10);

function patientRef(profileId: string) {
  return { reference: `Patient/${profileId}` };
}

export function patientResource(profile: ExportProfile): FhirResource {
  return {
    resourceType: "Patient",
    id: profile.id,
    identifier: [{ system: PLACEHOLDER_IDENTIFIER_SYSTEM, value: profile.id }],
    name: [{ text: profile.name }],
    ...(profile.dateOfBirth ? { birthDate: ISO_DATE(profile.dateOfBirth) } : {}),
  };
}

const INTERPRETATION: Record<string, { code: string; display: string } | undefined> = {
  LOW: { code: "L", display: "Low" },
  HIGH: { code: "H", display: "High" },
  NORMAL: { code: "N", display: "Normal" },
};

export function observationResources(profileId: string, record: ExportRecord): FhirResource[] {
  return record.labs.map((lab) => {
    const interpretation = INTERPRETATION[lab.flag];
    const numeric = lab.numericValue;
    return {
      resourceType: "Observation",
      id: lab.id,
      status: "final",
      code: { text: lab.testName },
      subject: patientRef(profileId),
      effectiveDateTime: record.recordDate.toISOString(),
      ...(numeric !== null
        ? { valueQuantity: { value: numeric, ...(lab.unit ? { unit: lab.unit } : {}) } }
        : { valueString: lab.value }),
      ...(lab.referenceRange ? { referenceRange: [{ text: lab.referenceRange }] } : {}),
      ...(interpretation
        ? { interpretation: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: interpretation.code, display: interpretation.display }] }] }
        : {}),
    };
  });
}

export function medicationRequestResources(profileId: string, medicines: ExportMedicine[], today: Date): FhirResource[] {
  return medicines.map((medicine) => {
    const ended = medicine.endDate !== null && medicine.endDate.getTime() < today.getTime();
    const status = ended ? "completed" : "active";
    return {
      resourceType: "MedicationRequest",
      id: medicine.id,
      status,
      intent: "order",
      medicationCodeableConcept: { text: medicine.name },
      subject: patientRef(profileId),
      authoredOn: medicine.startDate.toISOString(),
      dosageInstruction: [
        {
          text: [medicine.dosage, medicine.frequency, medicine.notes].filter(Boolean).join(", "),
          timing: { repeat: { frequency: medicine.timesPerDay } },
        },
      ],
      dispenseRequest: {
        validityPeriod: {
          start: ISO_DATE(medicine.startDate),
          ...(medicine.endDate ? { end: ISO_DATE(medicine.endDate) } : {}),
        },
      },
    };
  });
}

export function documentReferenceResource(profileId: string, record: ExportRecord): FhirResource {
  return {
    resourceType: "DocumentReference",
    id: `doc-${record.id}`,
    status: "current",
    subject: patientRef(profileId),
    date: record.recordDate.toISOString(),
    description: record.title,
    type: { text: record.type },
    content: [
      {
        attachment: {
          title: record.fileName ?? record.title,
          // File bytes are never embedded in exports. The original stays in the app's protected storage.
          contentType: record.fileName?.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
        },
      },
    ],
  };
}

export function encounterResource(profileId: string, record: ExportRecord): FhirResource {
  return {
    resourceType: "Encounter",
    id: `enc-${record.id}`,
    status: "finished",
    class: { code: "AMB", display: "ambulatory" },
    subject: patientRef(profileId),
    period: { start: record.recordDate.toISOString() },
    ...(record.facility ? { serviceProvider: { display: record.facility } } : {}),
    ...(record.doctorName ? { participant: [{ individual: { display: record.doctorName } }] } : {}),
    ...(record.diagnosisTerms.length > 0
      ? { reasonCode: record.diagnosisTerms.map((term) => ({ text: term })) }
      : {}),
  };
}

export function diagnosticReportResource(profileId: string, record: ExportRecord, observationIds: string[]): FhirResource {
  return {
    resourceType: "DiagnosticReport",
    id: `report-${record.id}`,
    status: "final",
    code: { text: record.title },
    subject: patientRef(profileId),
    effectiveDateTime: record.recordDate.toISOString(),
    result: observationIds.map((id) => ({ reference: `Observation/${id}` })),
  };
}

/** Builds a FHIR R4 collection bundle for one profile. */
export function buildFhirBundle(profile: ExportProfile, records: ExportRecord[], today: Date): Record<string, unknown> {
  const resources: FhirResource[] = [patientResource(profile)];
  const medicines: ExportMedicine[] = [];
  for (const record of records) {
    const observations = observationResources(profile.id, record);
    resources.push(...observations);
    if (record.labs.length > 0) {
      resources.push(diagnosticReportResource(profile.id, record, observations.map((item) => item.id)));
    }
    resources.push(documentReferenceResource(profile.id, record));
    if (record.type !== "LAB_REPORT" || record.diagnosisTerms.length > 0) {
      resources.push(encounterResource(profile.id, record));
    }
    medicines.push(...record.medications);
  }
  resources.push(...medicationRequestResources(profile.id, medicines, today));

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: today.toISOString(),
    meta: { tag: [{ code: "DEMO", display: "Fictional demo data. Not an official health record." }] },
    entry: resources.map((resource) => ({ fullUrl: `${resource.resourceType}/${resource.id}`, resource })),
  };
}
