import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

export interface DetectedEntity {
  id: string;
  name: string;
  type: 'condition' | 'procedure' | 'medication';
  confidence: number;
  detectedText: string;
  conceptId: string;
  isExisting?: boolean;
  textPosition?: number; // Position in the original text where entity was found
}

export interface EntityDetectionResult {
  conditions: DetectedEntity[];
  procedures: DetectedEntity[];
  medications: DetectedEntity[];
}

export interface EntityPattern {
  keywords: string[];
  name: string;
  type: 'condition' | 'procedure' | 'medication';
  conceptId: string;
  confidence: number;
}

@Injectable({
  providedIn: 'root'
})
export class AiCodingService {

  private entityPatterns: EntityPattern[] = [
    // Conditions
    {
      keywords: ['myocardial infarction'],
      name: 'Acute myocardial infarction',
      type: 'condition',
      conceptId: '57054005',
      confidence: 95
    },
    {
      keywords: ['acute appendicitis'],
      name: 'Acute appendicitis',
      type: 'condition',
      conceptId: '74400008',
      confidence: 92
    },
    {
      keywords: ['hypertension'],
      name: 'Hypertension',
      type: 'condition',
      conceptId: '38341003',
      confidence: 90
    },
    {
      keywords: ['chest pain'],
      name: 'Chest pain',
      type: 'condition',
      conceptId: '29857009',
      confidence: 80
    },
    {
      keywords: ['shortness of breath'],
      name: 'Dyspnea',
      type: 'condition',
      conceptId: '267036007',
      confidence: 82
    },
    {
      keywords: ['abdominal pain'],
      name: 'Abdominal pain',
      type: 'condition',
      conceptId: '21522001',
      confidence: 78
    },
    {
      keywords: ['rectal bleeding'],
      name: 'Rectal bleeding',
      type: 'condition',
      conceptId: '405729008',
      confidence: 85
    },

    // Procedures
    {
      keywords: ['percutaneous coronary angioplasty'],
      name: 'Percutaneous coronary angioplasty',
      type: 'procedure',
      conceptId: '415070008',
      confidence: 95
    },
    {
      keywords: ['laparoscopic appendectomy'],
      name: 'Laparoscopic appendectomy',
      type: 'procedure',
      conceptId: '287682004',
      confidence: 93
    },
    {
      keywords: ['colonoscopy'],
      name: 'Colonoscopy',
      type: 'procedure',
      conceptId: '73761001',
      confidence: 96
    },
    // Medications
    {
      keywords: ['aspirin', 'acetylsalicylic acid', 'asa'],
      name: 'Aspirin',
      type: 'medication',
      conceptId: '387458008',
      confidence: 96
    },
    {
      keywords: ['metoprolol', 'metoprolol tartrate', 'beta blocker'],
      name: 'Metoprolol',
      type: 'medication',
      conceptId: '387506000',
      confidence: 94
    },
    {
      keywords: ['ibuprofen', 'advil', 'motrin', 'nsaid'],
      name: 'Ibuprofen',
      type: 'medication',
      conceptId: '387207008',
      confidence: 93
    },
    {
      keywords: ['iron supplement', 'iron supplements', 'ferrous sulfate'],
      name: 'Iron supplement',
      type: 'medication',
      conceptId: '3829006',
      confidence: 88
    },
    {
      keywords: ['antihypertensive', 'antihypertensive medication', 'blood pressure medication'],
      name: 'Antihypertensive agent',
      type: 'medication',
      conceptId: '22198003',
      confidence: 85
    }
  ];

  constructor() { }

  /**
   * Detect clinical entities from text using mock AI processing
   * @param text Clinical text to analyze
   * @param existingEntities Optional array of existing entities to check for duplicates
   * @returns Observable of detection results
   */
  detectEntities(text: string, existingEntities?: DetectedEntity[]): Observable<EntityDetectionResult> {
    // Simulate AI processing delay
    return of(this.performEntityDetection(text, existingEntities)).pipe(
      delay(1500) // Simulate API call delay
    );
  }

  /**
   * Extract detected text from the original text based on keywords
   * @param text Original text
   * @param keyword The matched keyword
   * @returns Object with the actual detected text snippet and its position
   */
  private extractDetectedText(text: string, keyword: string): { detectedText: string, position: number } {
    // Use regex to find the exact match with word boundaries (same as detection logic)
    const regex = new RegExp(`\\b(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
    const match = text.match(regex);
    
    if (match && match.index !== undefined) {
      return {
        detectedText: match[1], // Return the actual matched text with original case
        position: match.index
      };
    }
    
    // Fallback if regex doesn't work - use simple indexOf
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(keyword.toLowerCase());
    if (index !== -1) {
      return {
        detectedText: text.substring(index, index + keyword.length),
        position: index
      };
    }
    
    // Final fallback
    return {
      detectedText: keyword,
      position: -1
    };
  }

  /**
   * Check if an entity already exists in the patient's record
   * @param entity Entity to check
   * @param existingEntities Array of existing entities
   * @returns Entity with isExisting flag set appropriately
   */
  private checkForExistingEntity(entity: DetectedEntity, existingEntities?: DetectedEntity[]): DetectedEntity {
    if (!existingEntities) {
      return entity;
    }

    const exists = existingEntities.some(existing => 
      existing.conceptId === entity.conceptId || 
      existing.name.toLowerCase() === entity.name.toLowerCase()
    );

    return {
      ...entity,
      isExisting: exists
    };
  }

  /**
   * Perform the actual entity detection logic
   * @param text Clinical text to analyze
   * @param existingEntities Optional existing entities
   * @returns Detection results
   */
  private performEntityDetection(text: string, existingEntities?: DetectedEntity[]): EntityDetectionResult {
    const result: EntityDetectionResult = {
      conditions: [],
      procedures: [],
      medications: []
    };

    if (!text || text.trim().length === 0) {
      return result;
    }

    const lowerText = text.toLowerCase();

    // Process each pattern
    for (const pattern of this.entityPatterns) {
      // Check if any keyword matches - use more precise matching
      const matchedKeyword = pattern.keywords.find(keyword => {
        const keywordLower = keyword.toLowerCase();
        // Use word boundary matching for better precision
        const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(lowerText);
      });

      if (matchedKeyword) {
        const extractedInfo = this.extractDetectedText(text, matchedKeyword);
        const entity: DetectedEntity = {
          id: `detected-${pattern.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: pattern.name,
          type: pattern.type,
          confidence: pattern.confidence,
          detectedText: extractedInfo.detectedText,
          conceptId: pattern.conceptId,
          textPosition: extractedInfo.position
        };

        // Check for existing entities
        const checkedEntity = this.checkForExistingEntity(entity, existingEntities);

        // Add to appropriate category
        switch (pattern.type) {
          case 'condition':
            result.conditions.push(checkedEntity);
            break;
          case 'procedure':
            result.procedures.push(checkedEntity);
            break;
          case 'medication':
            result.medications.push(checkedEntity);
            break;
        }
      }
    }

    // Sort entities within each category by their text position
    result.conditions.sort((a, b) => (a.textPosition || 0) - (b.textPosition || 0));
    result.procedures.sort((a, b) => (a.textPosition || 0) - (b.textPosition || 0));
    result.medications.sort((a, b) => (a.textPosition || 0) - (b.textPosition || 0));

    return result;
  }

  /**
   * Get available entity patterns for reference
   * @returns Array of entity patterns
   */
  getEntityPatterns(): EntityPattern[] {
    return [...this.entityPatterns];
  }

  /**
   * Debug method to test what entities would be detected for a given text
   * @param text Text to test
   * @returns Array of matched patterns with their keywords
   */
  debugDetection(text: string): Array<{pattern: EntityPattern, matchedKeyword: string}> {
    const matches: Array<{pattern: EntityPattern, matchedKeyword: string}> = [];
    const lowerText = text.toLowerCase();

    for (const pattern of this.entityPatterns) {
      const matchedKeyword = pattern.keywords.find(keyword => {
        const keywordLower = keyword.toLowerCase();
        const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(lowerText);
      });

      if (matchedKeyword) {
        matches.push({ pattern, matchedKeyword });
      }
    }

    return matches;
  }

  /**
   * Add a new entity pattern for detection
   * @param pattern New pattern to add
   */
  addEntityPattern(pattern: EntityPattern): void {
    this.entityPatterns.push(pattern);
  }

  /**
   * Remove an entity pattern
   * @param conceptId SNOMED CT concept ID to remove
   */
  removeEntityPattern(conceptId: string): void {
    this.entityPatterns = this.entityPatterns.filter(p => p.conceptId !== conceptId);
  }
}
