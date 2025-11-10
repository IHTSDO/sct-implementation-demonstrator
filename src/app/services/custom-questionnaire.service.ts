import { Injectable } from '@angular/core';

export interface CustomQuestionnaire {
  id: string;
  name: string;
  description: string;
  category: string;
  data: any; // The actual FHIR Questionnaire resource
  uploadedDate: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomQuestionnaireService {
  private readonly STORAGE_KEY = 'custom-questionnaires';

  constructor() { }

  /**
   * Get all custom questionnaires from localStorage
   */
  getAllCustomQuestionnaires(): CustomQuestionnaire[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) {
        return [];
      }
      return JSON.parse(data) as CustomQuestionnaire[];
    } catch (error) {
      console.error('Error reading custom questionnaires from localStorage:', error);
      return [];
    }
  }

  /**
   * Get a specific custom questionnaire by ID
   */
  getCustomQuestionnaire(id: string): CustomQuestionnaire | null {
    const questionnaires = this.getAllCustomQuestionnaires();
    return questionnaires.find(q => q.id === id) || null;
  }

  /**
   * Add a new custom questionnaire
   */
  addCustomQuestionnaire(questionnaire: any): { success: boolean; id?: string; error?: string } {
    try {
      // Validate that it's a FHIR Questionnaire
      if (!questionnaire || questionnaire.resourceType !== 'Questionnaire') {
        return { success: false, error: 'Invalid FHIR Questionnaire: resourceType must be "Questionnaire"' };
      }

      // Extract basic information
      const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const name = questionnaire.title || questionnaire.name || 'Untitled Questionnaire';
      const description = questionnaire.description || 'No description provided';
      const category = 'Custom Questionnaires';

      const customQuestionnaire: CustomQuestionnaire = {
        id,
        name,
        description,
        category,
        data: questionnaire,
        uploadedDate: new Date().toISOString()
      };

      // Get existing questionnaires
      const questionnaires = this.getAllCustomQuestionnaires();

      // Check for duplicates based on questionnaire ID or name
      const duplicate = questionnaires.find(q => 
        q.data.id === questionnaire.id || 
        (q.name === name && q.data.url === questionnaire.url)
      );

      if (duplicate) {
        return { success: false, error: 'A questionnaire with this ID or URL already exists' };
      }

      // Add the new questionnaire
      questionnaires.push(customQuestionnaire);

      // Save to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(questionnaires));

      return { success: true, id };
    } catch (error) {
      console.error('Error adding custom questionnaire:', error);
      return { success: false, error: 'Failed to save questionnaire to localStorage' };
    }
  }

  /**
   * Delete a custom questionnaire
   */
  deleteCustomQuestionnaire(id: string): boolean {
    try {
      const questionnaires = this.getAllCustomQuestionnaires();
      const filtered = questionnaires.filter(q => q.id !== id);
      
      if (filtered.length === questionnaires.length) {
        // Nothing was deleted
        return false;
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error deleting custom questionnaire:', error);
      return false;
    }
  }

  /**
   * Delete all custom questionnaires
   */
  deleteAllCustomQuestionnaires(): boolean {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Error deleting all custom questionnaires:', error);
      return false;
    }
  }

  /**
   * Check if a questionnaire ID is a custom questionnaire
   */
  isCustomQuestionnaire(id: string): boolean {
    return id.startsWith('custom-');
  }
}

