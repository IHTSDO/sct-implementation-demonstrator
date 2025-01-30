import { TerminologyService } from "src/app/services/terminology.service";
import { Patient } from "./patient";

export class GameService {

    terminologyService: TerminologyService;

    constructor(terminologyService: TerminologyService) {
        this.terminologyService = terminologyService;
    }

    checkPatientDiagnosisVsEcl(patient: Patient, ecl: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
          let untreatedDx = 0;
          let eclAppendix = '';
      
          patient?.clinicalData.diagnosis.forEach((dx: any, index: number) => {
            if (dx.status !== "treated") {
              untreatedDx++;
              if (untreatedDx > 1) {
                eclAppendix += ` OR ${dx.code}`;
              } else {
                eclAppendix += ` ${dx.code}`;
              }
            }
          });
      
          if (untreatedDx === 0) {
            resolve([]);
            return;
          } else {
            ecl = ecl + ' AND (' + eclAppendix + ' )';
            this.terminologyService.expandValueSetUsingCache(ecl, '').subscribe(
              (data: any) => {
                if (data.expansion?.total > 0) {
                  resolve(data.expansion.contains);
                } else {
                  resolve([]);
                }
              },
              (error: any) => {
                reject(error);
              }
            );
          }
        });
      }

}