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
  loadingSubsetmembers: boolean = false;

  referenceData: any[] = [
    { referencedComponentId: "403197009", name: "Sun-induced wrinkles" },
    { referencedComponentId: "279002006", name: "Lichenification of skin" },
    { referencedComponentId: "274672009", name: "Changes in skin texture" },
    { referencedComponentId: "271767006", name: "Peeling of skin" },
    { referencedComponentId: "271761007", name: "Scaly skin" },
    { referencedComponentId: "247434009", name: "Wrinkled skin" }
  ]

  referenceDataDisplayedColumns: string[] = ['referencedComponentId', 'name'];
  referenceDataDataSource = new MatTableDataSource<any>(this.referenceData);

  constructor(private http: HttpClient, public terminologyService: TerminologyService, private _snackBar: MatSnackBar) { }

  ngAfterViewInit() {
    this.studentSubsetMembersDataSource.sort = this.sort;
  }

  onSubsetmembersFileSelected(event: Event) {
    this.studentSubsetmembers = [];
    this.studentSubsetDefinition = "";
    this.studentSubsetMembersDataSource = new MatTableDataSource<any>();
    this.studentSubsetMembersDataSource.sort = this.sort;
    this.loadingSubsetmembers = true;
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
            subsetMembers.push(subsetMember);
          }
          // sort subsetmembers alphabetically
          subsetMembers.sort((a, b) => {
            return a.name.localeCompare(b.name);
          });
          // Set the data source's data to the parsed subset members.
          this.studentSubsetMembersDataSource.data = subsetMembers;
          this.loadingSubsetmembers = false; // Set loading to false as the operation is complete.
        } catch (error: any) {
          this._snackBar.openFromComponent(SnackAlertComponent, {
            duration: 5 * 1000,
            data: "Error reading file: " + error.message,
            panelClass: ['red-snackbar']
          });
          this.loadingSubsetmembers = false; // Set loading to false as there was an error.
        }
      };
      reader.onerror = (error) => {
        // Handle file read errors
        this._snackBar.openFromComponent(SnackAlertComponent, {
          duration: 5 * 1000,
          data: "Error reading file: " + error,
          panelClass: ['red-snackbar']
        });
        this.loadingSubsetmembers = false; // Set loading to false as there was an error.
      };
      reader.readAsText(file);
    } else {
      // No file was selected
      this.loadingSubsetmembers = false;
    }
  }
}
