import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';
import { TerminologyService } from 'src/app/services/terminology.service';

@Component({
  selector: 'app-subset-validator',
  templateUrl: './subset-validator.component.html',
  styleUrls: ['./subset-validator.component.css']
})
export class SubsetValidatorComponent implements AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;

  studentSubsetMembersDisplayedColumns: string[] = ['referencedComponentId', 'name', 'result'];
  studentSubsetMembersDataSource = new MatTableDataSource<any>();
  studentSubsetmembers: any[] = [];
  studentSubsetDefinition: string = "";

  keyConceptValidationResult: string = "";
  definitionVsMembersValidationResult: string = "";
  membersNotInRefrenceListResult: string = "";
  membersValidationResult = false;


  loading: boolean = false;

  ok: string = "✅";
  error: string = "🟥";

  assignments = [
    {
      "name": "Assignment X",
      "referenceData": [
        { "referencedComponentId": "403197009", "name": "Sun-induced wrinkles" },
        { "referencedComponentId": "279002006", "name": "Lichenification of skin" },
        { "referencedComponentId": "274672009", "name": "Changes in skin texture" },
        { "referencedComponentId": "271767006", "name": "Peeling of skin" },
        { "referencedComponentId": "271761007", "name": "Scaly skin" },
        { "referencedComponentId": "247434009", "name": "Wrinkled skin" }
      ],
      "referenceDefinition": "< 185823004 |Finding of skin texture (finding)|",
      "keyConceptsInECL": [
        { "code": "185823004", "display": "Finding of skin texture (finding)"}
      ],
      "customMessages": [
        { "conceptId": "403197009", "note": "wrong hierarchy", "principle": "wrong hierarchy" }, 
        { "conceptId": "403197009", "note": "wrong hierarchy", "principle": "wrong hierarchy" }
      ]
    },
    {
      "name": "Assignment Y",
      "referenceData": [
        { "referencedComponentId": "403197009", "name": "Sun-induced wrinkles" },
        { "referencedComponentId": "279002006", "name": "Lichenification of skin" },
        { "referencedComponentId": "274672009", "name": "Changes in skin texture" },
        { "referencedComponentId": "271767006", "name": "Peeling of skin" },
        { "referencedComponentId": "271761007", "name": "Scaly skin" },
        { "referencedComponentId": "247434009", "name": "Wrinkled skin" }
      ],
      "referenceDefinition": "< 185823004 |Finding of skin texture (finding)|",
      "keyConceptsInECL": [
        { "code": "185823004", "display": "Finding of skin texture (finding)"}
      ],
      "customMessages": [
        { "conceptId": "403197009", "note": "wrong hierarchy", "principle": "wrong hierarchy" }, 
        { "conceptId": "403197009", "note": "wrong hierarchy", "principle": "wrong hierarchy" }
      ]
    }
  ];

  selectedAssignment: any = this.assignments[0];

  referenceDataDisplayedColumns: string[] = ['referencedComponentId', 'name'];
  referenceDataDataSource = new MatTableDataSource<any>(this.selectedAssignment.referenceData);


  constructor(private http: HttpClient, public terminologyService: TerminologyService, private _snackBar: MatSnackBar) { }

  ngAfterViewInit() {
    // this.setAssignment(this.assignments[0]);
  }

  setAssignment(assignment: any) {
    if (assignment) {
      this.selectedAssignment = assignment;
      this.referenceDataDataSource = new MatTableDataSource<any>(this.selectedAssignment.referenceData);
    }
  }

  //----------- New Logic ------------

  async checkStudentECLvsStudentList(): Promise<number> {
    let notFound = 0;
    if (!this.studentSubsetDefinition) {
      let studentEclExpansinon = await this.terminologyService.expandValueSet(this.studentSubsetDefinition, "").toPromise();
      let studentList = this.studentSubsetmembers;
      let notFound = 0;
      studentList.forEach((studentMember: any) => {
        const found = studentEclExpansinon.expansion.contains.find((studentEclMember: any) => studentEclMember.code === studentMember.referencedComponentId);
        if (!found) {
          studentMember.inStudentECL = {
            value: false,
            message: ''
          };
          notFound++;
        } else {
          studentMember.inStudentECL = {
            value: true,
            message: ''
          };
        }
      });
    }
    return notFound;
  }

  checkStudentECLvsKeyConcept(): boolean {
    if (!this.studentSubsetDefinition) {
      let studentEcl = this.studentSubsetDefinition;
      let keyConcepts = this.selectedAssignment.keyConceptsInECL;
      let found = true;
      keyConcepts.forEach((keyConcept: any) => {
        if (!studentEcl.includes(keyConcept.code)) {
          found = false;
        }
      });
      return found;
    } else {
      return true;
    }
  }

  checkStudentListVsReferenceList() {
    let studentList = this.studentSubsetmembers;
    let referenceList = this.selectedAssignment.referenceData;
    let notFound = 0;
    studentList.forEach((studentMember: any) => {
      const found = referenceList.find((referenceMember: any) => referenceMember.referencedComponentId === studentMember.referencedComponentId);
      if (!found) {
        studentMember.inReferenceList = {
          value: true,
          message: ''
        };
        notFound++;
      } else {
        studentMember.inReferenceList = {
          value: false,
          message: ''
        };
      }
    });
  }

  checkStudentListVsCustomMessages() {
    let studentList = this.studentSubsetmembers;
    let customMessages = this.selectedAssignment.customMessages;
    studentList.forEach((studentMember: any) => {
      const found = customMessages.find((customMessage: any) => customMessage.conceptId === studentMember.referencedComponentId);
      if (found) {
        studentMember.customMessage = {
          value: true,
          principle: found.principle,
          note: found.note
        };
      } else {
        studentMember.customMessage = {
          value: false,
          principle: '',
          note: ''
        };
      }
    });
  }


  //----------- End New Logic ------------

  async validateAssignment() {
    this.loading = true;
    this.keyConceptValidationResult = "";
    this.definitionVsMembersValidationResult = "";
    this.membersValidationResult = false;
    this.loading = true;
    
    if (this.studentSubsetDefinition) {
      let studentECLvsStudentList = await this.checkStudentECLvsStudentList();
      if (studentECLvsStudentList > 0) {
        this.definitionVsMembersValidationResult = this.error + " " + studentECLvsStudentList + " members not found in student ECL";
      } else {
        this.definitionVsMembersValidationResult = this.ok + " All members found in student ECL";
      }

      let keyConceptsValidation = this.checkStudentECLvsKeyConcept();
      if (keyConceptsValidation) {
        this.keyConceptValidationResult = this.ok + " Student ECL contains all key concepts";
      } else {
        this.keyConceptValidationResult = this.error + " Student ECL does not contain all key concepts";
      }
    }

    this.checkStudentListVsReferenceList();
    let countNotInReferenceList = this.studentSubsetmembers.filter((member: any) => !member.inReferenceList.value).length;
    if (countNotInReferenceList > 0) {
      this.membersNotInRefrenceListResult = this.error + " " + countNotInReferenceList + " members not found in reference list";
    } else {
      this.membersNotInRefrenceListResult = this.ok + " All members found in reference list";
    }

    this.checkStudentListVsCustomMessages();
    this.loading = false;
    this.membersValidationResult = true;
  }

  onSubsetmembersFileSelected(event: Event) {
    this.studentSubsetmembers = [];
    this.studentSubsetMembersDataSource = new MatTableDataSource<any>();
    this.studentSubsetMembersDataSource.sort = this.sort;
    this.loading = true;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // validate if it is a TSV txt file
          const content = reader.result as string;
          const lines = content.split('\n');
          const header = lines[0].split('\t');
          if (header.length < 2) {
            throw new Error("Invalid file format");
          }
          const referencedComponentIdIndex = header.indexOf("referencedComponentId");
          const nameIndex = header.indexOf("name");
          if (referencedComponentIdIndex < 0 || nameIndex < 0) {
            throw new Error("Invalid file format");
          }
          const subsetMembers: any[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].split('\t');
            if (line.length < 2) {
              continue;
            }
            const subsetMember: any = {};
            subsetMember.referencedComponentId = line[referencedComponentIdIndex];
            subsetMember.name = line[nameIndex];
            subsetMember.result = {
              value: 'Not validated',
              message: ''
            };
            subsetMember.scope = {
              value: 'Not validated',
              message: ''
            };
            subsetMembers.push(subsetMember);
          }
          // sort subsetmembers alphabetically
          subsetMembers.sort((a, b) => {
            return a.name.localeCompare(b.name);
          });
          this.studentSubsetmembers = subsetMembers;
          // Set the data source's data to the parsed subset members.
          this.studentSubsetMembersDataSource.data = subsetMembers;
          this.loading = false; // Set loading to false as the operation is complete.
        } catch (error: any) {
          this._snackBar.openFromComponent(SnackAlertComponent, {
            duration: 5 * 1000,
            data: "Error reading file: " + error.message,
            panelClass: ['red-snackbar']
          });
          this.loading = false; // Set loading to false as there was an error.
        }
      };
      reader.onerror = (error) => {
        // Handle file read errors
        this._snackBar.openFromComponent(SnackAlertComponent, {
          duration: 5 * 1000,
          data: "Error reading file: " + error,
          panelClass: ['red-snackbar']
        });
        this.loading = false; // Set loading to false as there was an error.
      };
      reader.readAsText(file);
    } else {
      // No file was selected
      this.loading = false;
    }
  }

  onDefinitionFileSelected(event: Event) {
    this.studentSubsetDefinition = "";
    this.loading = true;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // validate if it is a TSV txt file
          const content = reader.result as string;
          // remove all appreviations of \r
          const contentWithoutCarriageReturn = content.replace(/\r/g, '');
          const lines = contentWithoutCarriageReturn.split('\n');
          const header = lines[0].split('\t');
          if (header.length < 2) {
            throw new Error("Invalid file format");
          }
          const referencedComponentIdIndex = header.indexOf("referencedComponentId");
          const definitionIndex = header.indexOf("definition");
          if (referencedComponentIdIndex < 0 || definitionIndex < 0) {
            throw new Error("Invalid file format");
          }
          this.studentSubsetDefinition = lines[1].split('\t')[definitionIndex];
          this.loading = false; // Set loading to false as the operation is complete.
        } catch (error: any) {
          this._snackBar.openFromComponent(SnackAlertComponent, {
            duration: 5 * 1000,
            data: "Error reading file: " + error.message,
            panelClass: ['red-snackbar']
          });
          this.loading = false; // Set loading to false as there was an error.
        }
      };
      reader.onerror = (error) => {
        // Handle file read errors
        this._snackBar.openFromComponent(SnackAlertComponent, {
          duration: 5 * 1000,
          data: "Error reading file: " + error,
          panelClass: ['red-snackbar']
        });
        this.loading = false; // Set loading to false as there was an error.
      };
      reader.readAsText(file);
    } else {
      // No file was selected
      this.loading = false;
    }
  }
}
