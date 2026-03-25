import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import type { Patient } from './patient.service';
import type { PersistenceMode } from './patient-storage.types';

interface PatientBookmarkSnapshot {
  id: string;
  patient: Patient;
  bookmarkedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PatientBookmarkService {
  constructor(private storageService: StorageService) {}

  getBookmarkedPatients(mode: PersistenceMode, fhirBaseUrl?: string): PatientBookmarkSnapshot[] {
    return this.readSnapshots(this.getStorageKey(mode, fhirBaseUrl));
  }

  isBookmarked(patientId: string, mode: PersistenceMode, fhirBaseUrl?: string): boolean {
    return this.getBookmarkedPatients(mode, fhirBaseUrl).some((item) => item.id === patientId);
  }

  toggleBookmark(patient: Patient, mode: PersistenceMode, fhirBaseUrl?: string): boolean {
    const key = this.getStorageKey(mode, fhirBaseUrl);
    const bookmarks = this.readSnapshots(key);
    const existingIndex = bookmarks.findIndex((item) => item.id === patient.id);

    if (existingIndex >= 0) {
      bookmarks.splice(existingIndex, 1);
      this.writeSnapshots(key, bookmarks);
      return false;
    }

    bookmarks.unshift({
      id: patient.id,
      patient,
      bookmarkedAt: new Date().toISOString()
    });
    this.writeSnapshots(key, bookmarks);
    return true;
  }

  upsertBookmarkSnapshot(patient: Patient, mode: PersistenceMode, fhirBaseUrl?: string): void {
    const key = this.getStorageKey(mode, fhirBaseUrl);
    const bookmarks = this.readSnapshots(key);
    const existingIndex = bookmarks.findIndex((item) => item.id === patient.id);

    if (existingIndex < 0) {
      return;
    }

    bookmarks[existingIndex] = {
      ...bookmarks[existingIndex],
      patient
    };
    this.writeSnapshots(key, bookmarks);
  }

  private getStorageKey(mode: PersistenceMode, fhirBaseUrl?: string): string {
    if (mode === 'local') {
      return 'ehr_bookmarked_patients_local';
    }

    const normalizedBaseUrl = (fhirBaseUrl || 'default').trim().replace(/\/$/, '');
    const encodedBaseUrl = encodeURIComponent(normalizedBaseUrl);
    return `ehr_bookmarked_patients_fhir_${encodedBaseUrl}`;
  }

  private readSnapshots(key: string): PatientBookmarkSnapshot[] {
    const rawValue = this.storageService.getItem(key);
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeSnapshots(key: string, snapshots: PatientBookmarkSnapshot[]): void {
    this.storageService.saveItem(key, JSON.stringify(snapshots));
  }
}
