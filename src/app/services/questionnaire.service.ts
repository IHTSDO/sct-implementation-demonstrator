import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { FhirService } from './fhir.service';

@Injectable({
  providedIn: 'root'
})
export class QuestionnaireService {

  constructor(private http: HttpClient, private fhirService: FhirService) { }

  async generateRootQuestionnaire(title: string, questionnaires: any[]): Promise<any> {
    try {
      const data = await lastValueFrom(this.http.get('assets/questionnaires/root-questionnaire-template.json'));
      let rootQuestionnaire: any = data;
      rootQuestionnaire.title = title;
      let count = 0;
      let baseUrl = this.fhirService.getBaseUrl();
      let userTag = this.fhirService.getUserTag();
      questionnaires.forEach(questionnaire => {
        count++;
        questionnaire.url = baseUrl + "/Questionnaire/" + questionnaire.id;
        rootQuestionnaire.item.push({
          linkId: count.toString(),
          text: questionnaire.title,
          type: "group",
          required: false,
          item: [
            {
                extension: [
                    {
                        url: "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire",
                        valueCanonical: questionnaire.url
                    }
                ],
                linkId: count.toString() + ".1",
                text: "Unable to resolve sub-questionnaire",
                type: "display"
            }
          ]
        });
      });
      return rootQuestionnaire;
    } catch (error) {
      console.error('Error generating root questionnaire:', error);
      throw error; // Rethrow or handle as needed
    }
  }

  async getRootQuestionnaireData(rootQuestionnaire: any): Promise<{ title: string, questionnaires: any[] }> {
    if (!rootQuestionnaire || !Array.isArray(rootQuestionnaire.item)) {
      throw new Error('Invalid root questionnaire');
    }
  
    const title = rootQuestionnaire.title;
    const questionnairePromises = rootQuestionnaire.item
      .filter((item: any) => item.type === 'group' && item.item && Array.isArray(item.item))
      .flatMap((groupItem: any) => groupItem.item)
      .map(async (subItem: any) => {
        const subQuestionnaireExtension = subItem.extension?.find((ext: any) => 
          ext.url === "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire"
        );
        if (subQuestionnaireExtension) {
          const url = subQuestionnaireExtension.valueCanonical;
          return this.getQuestionnaireFromUrl(url);
        }
        return null;
      });
  
    const questionnaires = (await Promise.all(questionnairePromises)).filter(q => q !== null);
  
    return { title, questionnaires };
  }
  

  checkForAssembleRoot(questionnaire: any): boolean {
    if (!questionnaire || !questionnaire.extension || !Array.isArray(questionnaire.extension)) {
        return false;
    }
    return questionnaire.extension.some((ext: any) => ext.valueCode === "assemble-root");
  }

  async assembleQuestionnaire(questionnaire: any): Promise<any> {
    // clone the questionnaire
    questionnaire = JSON.parse(JSON.stringify(questionnaire));
    if (!this.checkForAssembleRoot(questionnaire)) {
        return null;
    }
    for (let item of questionnaire.item) {
        if (item.type == "group") {
            item.extension = []
            for (let subItem of item.item) {
                if (subItem.extension && Array.isArray(subItem.extension)) {
                    for (let ext of subItem.extension) {
                        if (ext.url === "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire") {
                            let subQuestionnaire = await this.getQuestionnaireFromUrl(ext.valueCanonical);
                            if (subQuestionnaire) {
                                item.item = subQuestionnaire.item;
                            }
                            // add assembledfrom extension
                            if (!item.extension) {
                                item.extension = [];
                            }
                            item.extension.push({
                              url: "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-assembledFrom",
                              valueCanonical: ext.valueCanonical
                            });
                        }
                    }
                }
            }
        }
    }
    questionnaire.extension = questionnaire.extension.filter((ext:any) => ext.valueCode !== "assemble-root");
    return questionnaire;
  }

  async disassembleQuestionnaire(rootQuestionnaire: any): Promise<{ title: any, questionnaires: any[] }> {
    if (!rootQuestionnaire || !rootQuestionnaire.item || !Array.isArray(rootQuestionnaire.item)) {
      throw new Error('Invalid root questionnaire');
    }
  
    const title = rootQuestionnaire.title;
    const disassembledQuestionnaires = [];
  
    for (const item of rootQuestionnaire.item) {
      if (item.type === 'group' && item.extension && Array.isArray(item.extension)) {
        const assembledFromExtension = item.extension.find( (ext: any) => ext.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-assembledFrom');
        if (assembledFromExtension) {
          const subQuestionnaireUrl = assembledFromExtension.valueCanonical;
          const subQuestionnaire = await this.getQuestionnaireFromUrl(subQuestionnaireUrl);
          if (subQuestionnaire) {
            disassembledQuestionnaires.push(subQuestionnaire);
          }
        }
      }
    }
  
    return { title, questionnaires: disassembledQuestionnaires };
  }
  

  async getQuestionnaireFromUrl(url: string): Promise<any> {
    try {
        const data = await lastValueFrom(this.http.get(url));
        return data;
    } catch (error) {
        console.error('Error fetching questionnaire:', error);
        return null;
    }
  }

}
