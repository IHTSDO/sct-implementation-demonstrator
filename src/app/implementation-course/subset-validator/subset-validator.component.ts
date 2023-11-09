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

  studentSubsetMembersDisplayedColumns: string[] = ['referencedComponentId', 'name', 'result', 'scope'];
  studentSubsetMembersDataSource = new MatTableDataSource<any>();
  studentSubsetmembers: any[] = [];
  studentSubsetDefinition: string = "";
  definitionValidationResult: string = "";
  definitionVsMembersValudationResult: string = "";
  membersValidationResult: string = "";
  validatingMembers: boolean = false;
  validatingDefinition: boolean = false;
  loading: boolean = false;

  ok: string = "✅";
  error: string = "🟥";

  referenceData: any[] = []

  moduleDReferenceData: any[] = [
    { referencedComponentId: "403197009", name: "Sun-induced wrinkles" },
    { referencedComponentId: "279002006", name: "Lichenification of skin" },
    { referencedComponentId: "274672009", name: "Changes in skin texture" },
    { referencedComponentId: "271767006", name: "Peeling of skin" },
    { referencedComponentId: "271761007", name: "Scaly skin" },
    { referencedComponentId: "247434009", name: "Wrinkled skin" }
  ]

  referenceDataDisplayedColumns: string[] = ['referencedComponentId', 'name'];
  referenceDataDataSource = new MatTableDataSource<any>(this.referenceData);
  referenceDefinition: string = "";
  moduleDReferenceDefinition: string = "< 185823004 |Finding of skin texture (finding)|";

  selectedAssignment = "Module D";

  constructor(private http: HttpClient, public terminologyService: TerminologyService, private _snackBar: MatSnackBar) { }

  ngAfterViewInit() {
    this.setAssignment("Module D");
  }

  setAssignment(assignment: string) {
    if (assignment === "Module D") {
      this.referenceData = this.moduleDReferenceData;
      this.referenceDefinition = this.moduleDReferenceDefinition;
    }
  }

  async validateSubsetMembers() {
    this.validatingMembers = true;
    this.membersValidationResult = "";
    if (this.studentSubsetDefinition) {
      this.validateExpansion();
    }
    let correct = 0;
    let notAcceptable = 0;
    // Loop thorugh subset members and check if they are present in reference data
    const studentSubsetDefinitionExpansion = await this.terminologyService.expandValueSet(this.studentSubsetDefinition, "").toPromise();
    // create a list with all the codes in the expansion
    const studentSubsetDefinitionExpansionCodes = studentSubsetDefinitionExpansion.expansion.contains.map((member: any) => member.code);
    // sort the list alphabetically
    studentSubsetDefinitionExpansionCodes.sort((a: any, b: any) => {
      return a.localeCompare(b);
    });
    // create a list with all the codes in the studentSubsetMembersDataSource.data
    const studentSubsetMembersDataSourceCodes = this.studentSubsetMembersDataSource.data.map((member: any) => member.referencedComponentId);
    // sort the list alphabetically
    studentSubsetMembersDataSourceCodes.sort((a, b) => {
      return a.localeCompare(b);
    });
    // check if the lists contain exactly the same codes or not, regardless of the order
    const sameCodes = studentSubsetDefinitionExpansionCodes.length === 
      studentSubsetMembersDataSourceCodes.length && studentSubsetDefinitionExpansionCodes.every((value:string, index: number) => value === studentSubsetMembersDataSourceCodes[index]);
    if (sameCodes) {
      this.definitionVsMembersValudationResult = `${this.ok}  The members list contains exactly the same concepts as the definition expansion`;
    } else {
      this.definitionVsMembersValudationResult = `${this.error}  The members list does not contain exactly the same concepts as the definition expansion`;
    }
    this.studentSubsetMembersDataSource.data.forEach(subsetMember => {
      const found = this.referenceData.find(referenceMember => referenceMember.referencedComponentId === subsetMember.referencedComponentId);
      if (found) {
        subsetMember.result = {
          value: 'Correct',
          message: ''
        };
        correct++;
      } else {
        subsetMember.result = {
          value: 'Not acceptable',
          message: 'Subset member not found in reference data'
        };
        notAcceptable++;
      }
    });
    this.validatingMembers = false;
    const icon = notAcceptable > 0 ? this.error : this.ok;
    this.membersValidationResult = `${icon}  The student Members list contains ${correct} correct concepts, and ${notAcceptable} incorrect concepts, based on the exercise reference data`;
  }

  async validateExpansion() {
    this.validatingDefinition = true;
    this.definitionValidationResult = "";
    let studentExpansinon = await this.terminologyService.expandValueSet(this.studentSubsetDefinition, "").toPromise();
    let referenceExpansion = await this.terminologyService.expandValueSet(this.referenceDefinition, "").toPromise();
    // calculate the numer of concepts in the student expansion that are not in the reference expansion
    let notFound = 0;
    this.studentSubsetMembersDataSource.data.forEach((studentExpansionMember: any) => {
      const found = referenceExpansion.expansion.contains.find((referenceExpansionMember: any) => referenceExpansionMember.code === studentExpansionMember.referencedComponentId);
      if (!found) {
        studentExpansionMember.scope = {
          value: 'In expansion',
          message: ''
        };
        notFound++;
      } else {
        studentExpansionMember.scope = {
          value: 'Not in expansion',
          message: ''
        };
      }
    });
    // calculate the percentage of concepts in the student expansion that are not in the reference expansion
    const percentage = Math.round(notFound / studentExpansinon.expansion.contains.length * 100);
    this.validatingDefinition = false;
    const icon = notFound > 0 ? this.error : this.ok;
    this.definitionValidationResult = `${icon}  The student ECL Definition Expasion contains ${notFound} concepts that out of scope from expected answer (${percentage}%)`;
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
          console.log(header)
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
